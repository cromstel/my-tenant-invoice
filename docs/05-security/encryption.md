# Encryption

## Defense-in-Depth Encryption Model

myTenant Invoice implements encryption across five layers:

| Layer              | Scope                                           | Algorithm / Standard                  | Key Management Solution          |
|--------------------|-------------------------------------------------|---------------------------------------|----------------------------------|
| L1: Client Transit | Browser → Edge → Gateway → Services (TLS 1.3)  | TLS 1.3 with AES-256-GCM / ChaCha20   | ACM / Let's Encrypt ECDSA P-384  |
| L2: Service Mesh  | Internal service-to-service (mTLS)             | Istio: TLS 1.3 ECDHE-X25519 + AES-256-GCM | Istio CA (SPIFFE) rotated hourly |
| L3: Volume / Disk | AWS EBS / Azure Disk volumes (at rest)          | AES-256-XTS via LUKS / cloud-native   | AWS KMS / Azure Key Vault CMK    |
| L4: Object Storage | S3 buckets, backups, PDFs, report exports      | SSE-KMS (AES-256-GCM via envelope)    | AWS KMS per-bucket CMKs          |
| L5: Column / Field | PII, payment tokens, SSN/ITIN, TIN, bank details | AES-256-GCM per-row + envelope       | Vault Transit Engine (BYOK/HYOK customer keys optional) |

Additionally, **invoice authenticity** is protected via **Ed25519 detached digital signatures** on every finalized invoice PDF, verifiable via public keys published at `https://trust.cromstel.com/.well-known/invoice-signing.jwks`.

---

## L1: In-Transit Encryption (TLS)

### Public Endpoints TLS Configuration

| Setting                          | Value
|----------------------------------|------------------------------------------------
| Minimum Protocol                 | TLS 1.3 **only** (TLS 1.2 disabled since 2025-01-01)
| Cipher Suites (TLS 1.3)          | `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`, `TLS_AES_128_GCM_SHA256` (in preference order)
| Cipher Suites (legacy fallback — only for private Enterprise mTLS endpoints) | TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384, TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
| Key Exchange                     | ECDHE secp384r1 / X25519 (forward secrecy required; non-PFS ciphers rejected)
| Certificate Type                 | ECDSA P-384 leaf certificates + RSA-4096 cross-sign (legacy)
| HSTS                             | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
| OCSP Stapling                    | MUST staple (enabled + TLS feature extension)
| Certificate Transparency         | Signed Certificate Timestamps (SCTs) embedded — 3+ logs per cert
| CAA DNS Record                   | `0 issue "amazon.com"` + `0 issue "letsencrypt.org"` + `0 issuewild ";"` (no wildcards)

### mTLS for Enterprise Customers

Enterprise tier tenants can enable mutual TLS on their dedicated API subdomain:
```
customer-org.customer-api.mytenant-invoice.cromstel.com
```
CromStel validates the client certificate chain against a customer-provided CA trust bundle. Invalid CN / SAN → rejected at edge.

### TLS Testing Baseline

SSL Labs Server Test A+ (latest report: 2025-08-14 — A+). ImmuniWeb CryptoTest: 100/100 cipher strength.

---

## L2: Internal Service-to-Service (Service Mesh)

Istio service mesh enforces **strict mTLS** (`PeerAuthentication: STRICT` mode — plaintext rejected) for all Pod-to-Pod traffic within the EKS cluster.

```yaml
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT         # Every pod MUST speak mTLS; exceptions only via workload selector
```

SPIFFE IDs are issued per-ServiceAccount, rotated hourly:
```
spiffe://cluster.local/ns/mytenant/sa/api-service
```

Authorization Policy (`AuthorizationPolicy`) enforced at sidecars — e.g. only the `payment-service` may egress to Stripe CIDRs; all others are dropped by Envoy.

---

## L3: Volume / At-Rest Encryption (Disks)

### Database (Aurora PostgreSQL)

| Feature                          | Setting
|----------------------------------|-------------------------------------------------
| Storage Encryption               | AWS Aurora at-rest encryption (AES-256-XTS) enabled for all instances, all clusters, all regions — cannot be disabled
| KMS Key ARN                      | Customer can BYOK via `aws_kms_key` referenced in cluster. Default: managed AWS KMS `arn:aws:kms:us-east-1:account:key/...`
| Automated Backups                | Encrypted with same CMK as cluster (default), or dedicated backup CMK option
| Cross-Region Read Replica        | Separate KMS key per region (complies with data residency regulations); replica key encrypted under DR-region CMK
| Snapshots                        | Separate CMK; restore requires KMS grant permission + explicit CloudTrail multi-party approval

### Elastic Block Store (EBS) — Worker Nodes

- `encrypted: true` on all EBS volumes via Terraform SCP policy (DENY launch if `encrypted != true`)
- Separate CMK per environment (dev/staging/prod)
- Ephemeral NVMe SSDs on EC2 nodes encrypted with LUKS passphrase stored in Vault (boot-only unlock)

### RDS / ElastiCache

- ElastiCache Redis clusters: **at-rest encryption** enabled (AES-256), **in-transit encryption** enabled (TLS 1.2+ mandatory for Redis clients). Redis AUTH token stored in Vault.

---

## L4: Object Storage (S3)

### Default Bucket Policy

All buckets enforce encryption in transit and at rest via bucket policy (fail-closed):

```json
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:PutObject",
  "Resource": "arn:aws:s3:::mytenant-invoices-prod/*",
  "Condition": {
    "StringNotEquals": {
      "s3:x-amz-server-side-encryption": "aws:kms"
    }
  }
},
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:*",
  "Resource": ["arn:aws:s3:::mytenant-invoices-prod", "arn:aws:s3:::mytenant-invoices-prod/*"],
  "Condition": { "Bool": { "aws:SecureTransport": "false" } }
}
```

### Bucket Matrix

| Bucket Name                              | CMK              | Object Lock Mode | Retention         | Purpose
|------------------------------------------|------------------|------------------|-------------------|-------------------------------
| `mytenant-invoices-prod`                 | KMS `cmk-invoices` | Compliance     | 7 years           | Finalized invoice PDFs
| `mytenant-report-exports-prod`           | KMS `cmk-reports` | Governance     | 90 days           | Ad-hoc reports (customer downloadable)
| `mytenant-audit-archive-prod`            | KMS `cmk-audit`    | Compliance     | 7 years WORM      | Audit log archive (immutable)
| `mytenant-backups-prod`                  | KMS `cmk-backups`  | Compliance     | 365 days          | WAL archives + pg_dumps
| `mytenant-webhook-dlq-prod`              | KMS `cmk-webhooks` | Governance     | 30 days           | Failed webhook replay queue

**Customer-controlled CMKs:** Enterprise tenants can BYOK via cross-account KMS grant on `mytenant-invoices-{customer_id}-prod`, `mytenant-report-exports-{customer_id}-prod` buckets. CromStel cannot read invoice PDFs without an active grant from the customer (revoke → CromStel loses access immediately; recovery requires customer re-grant).

---

## L5: Column / Field Level Encryption (CLE)

Sensitive columns are encrypted at the application layer **before** writing to Postgres (transparently via Prisma middleware + Vault Transit). This means even if someone bypasses RLS or gains a read replica, sensitive columns remain ciphertext.

### Encrypted Column Inventory

| Table            | Column(s)                            | Classification | Algorithm     | Keyring in Vault Transit
|------------------|--------------------------------------|---------------|---------------|--------------------------
| `customers`      | `email`, `phone`, `personal_id` (SSN/SIN/TIN), `dob` | Confidential/Restricted | AES-256-GCM (Deterministic for email — for uniqueness lookups) | `pii-customers-prod`
| `customer_bank_accounts` | `account_number`, `routing_number`, `iban`           | Restricted | AES-256-GCM (Randomized) | `financial-pci-prod`
| `payment_methods`  | `psp_vault_token` (Spreedly), `billing_address_full`, `card_last4_enc` | Confidential / Restricted | AES-256-GCM + envelope KMS | `pci-card-tokens-prod`
| `invoices`         | `custom_private_note` (attorney work product, optional Tier 4 tag) | Restricted | AES-256-GCM (tenant-byok option) | `invoice-confidential-prod`
| `audit_logs`       | `actor_ip`, `additional_metadata` (may contain PII)  | Internal | AES-256-GCM | `audit-prod`
| `api_keys`         | `key_hash` (bcrypt+sha256 of raw API key), `last4_enc` | Confidential | bcrypt (hash) + AES-GCM (last4) | Transit not needed (bcrypt hash irreversible)
| `webhooks`         | `signing_secret_plaintext` (only available at creation via wrapped token) | Restricted | AES-256-GCM + wrap | `webhook-secrets-prod`

### Encryption Workflow (Pseudocode via Vault Transit)

```typescript
// Write path: before DB insert
async function encryptPii(orgId: string, plaintext: string, keyring: string): Promise<string> {
  const { data } = await vaultClient.write(`transit/encrypt/${keyring}`, {
    plaintext: Buffer.from(plaintext, 'utf8').toString('base64'),
    context: Buffer.from(`org:${orgId}`, 'utf8').toString('base64'),  // domain separation per tenant
    type: 'aes256-gcm96'
  });
  return data.ciphertext; // vault:v1:base64-encoded-ciphertext
}

// Read path: after DB fetch (only if caller has role:allow-cleartext-pii)
async function decryptPii(orgId: string, ciphertext: string, keyring: string): Promise<string> {
  const { data } = await vaultClient.write(`transit/decrypt/${keyring}`, {
    ciphertext,
    context: Buffer.from(`org:${orgId}`, 'utf8').toString('base64'),
  });
  return Buffer.from(data.plaintext, 'base64').toString('utf8');
}
```

Keyring `context` parameter ensures **domain separation**: ciphertext encrypted for tenant A context cannot be decrypted in the context of tenant B, even if an attacker swaps ciphertext blobs between rows (IDOR mitigation at the crypto layer).

### BYOK / Customer-Managed Keys (CMK) for Encryption at Rest

Enterprise tier customers who need "hold your own key" (HYOK) can provide their own AWS KMS or Azure Key Vault key. CromStel's Transit Engine wraps every generated Data Encryption Key (DEK) with your CMK before storing the wrapped DEK in our KMS metadata store.

```
DEK = CromStel generates AES-256 key (ephemeral in memory)
Wrapped DEK = RSA-OAEP-SHA256-encrypt(Customer CMK public, DEK)
Stored = [Wrapped DEK blob + CMK Key ARN reference]
Invoice ciphertext = AES-256-GCM(DEK, plaintext_invoice)
On read: Customer CMK private key unwraps DEK (CromStel never sees customer CMK private material)
```

If a customer revokes the grant on their CMK:
- Reads of existing encrypted data fail immediately (data at rest becomes unrecoverable by CromStel).
- Customer is still liable for SaaS subscription billing on non-data operations; but all tenant PII/financial data is cryptographically shredded by revocation action.
- Re-granting CMK restores normal operation (no data loss if key material itself wasn't destroyed).

---

## Key Management Lifecycle

| Key Type                       | Generation Location      | Rotation Period         | Destroy on Revoke | Backup
|--------------------------------|--------------------------|-------------------------|-------------------|-----------------------------------------
| TLS Leaf (public)              | ACM CA / Let's Encrypt   | Auto ~60 days (13 month max) | Auto          | Cross-sign backup CA
| Istio SPIFFE mTLS leaf         | Istio CA (self-signed root offline) | 1 hour (auto renew @ 50% life) | Auto | —
| AWS KMS CMK (volume)           | AWS KMS HSM             | Annual (auto + manual)  | Scheduled 7-30 days | Multi-region replica keys in DR
| S3 SSE-KMS Data Keys           | AWS KMS per-object      | Per-object unique       | Auto (transient) | N/A (envelope)
| Vault Transit Keyring (CLE)    | Vault Transit (exportable? No — never exported) | 90 days (rotated versions kept 1y for decryptability) | Per tenant deletion request | Shamir-sharded backup
| JWT / EdDSA signing keys       | Vault Transit           | 24 hours                | Auto after 14d    | N/A
| Invoice PDF signing (Ed25519)  | Vault Transit Signer    | 1 year                  | Scheduled 60 days | Public key published for offline verifiability

### Key Destruction / Crypto Shredding

Per GDPR "Right to be Forgotten," tenant offboarding flow performs cryptographic data shredding in addition to DB row deletion:

1. Mark tenant KMS grant as revoked (CMK disabled → wrapped DEKs become undecryptable).
2. Schedule destruction of tenant-associated KMS aliases in 30 days (AWS KMS mandatory wait).
3. Rotate any Vault Transit key version used by tenant; destroy old key versions.
4. Delete all S3 objects (WORM retention honored; for Legal Hold exceptions → shred via grant revocation instead).
5. Final confirmation: "shred verification report" sent to Security Contact (SHA-256 of CMK ARN + timestamp of grant revoke).

---

## Digital Signatures (Invoice Authenticity)

Every finalized invoice PDF has a **detached Ed25519 signature** stored alongside it. Customers can independently verify CromStel issued the invoice at the given timestamp and that no post-finalization tampering occurred:

```
1. Download PDF: https://assets.mytenant-invoice.cromstel.com/invoices/inv_xxx.pdf
2. Download signature: https://assets.mytenant-invoice.cromstel.com/invoices/inv_xxx.pdf.sig
3. Download JWKS: https://trust.cromstel.com/.well-known/invoice-signing.jwks (published public keys only)
4. Verify:
   openssl dgst -sha256 -verify <(jose jwk export --jwk jwks.json --kid sig-prod-v8) \
     -signature inv_xxx.pdf.sig inv_xxx.pdf
   → Verified OK
```

The signing key is HSM-backed via AWS CloudHSM (FIPS 140-2 Level 3); the private key never leaves the HSM boundary.

---

## Audit Logging of Crypto Operations

Every Vault Transit encrypt/decrypt/re-encrypt/sign call is audited to the three Vault audit devices (file + syslog + socket). SIEM alert rules:

| Rule ID   | Trigger                                                          | Severity
|-----------|------------------------------------------------------------------|-----------
| CRY-01    | Decrypt volume > 10,000 calls in 1 hour (exfiltration pattern)  | P1
| CRY-02    | Encrypt/decrypt from non-cluster-source IP (potential leak)     | P1
| CRY-03    | KMS CMK scheduled for deletion (customer byok offboarding)      | P2 info
| CRY-04    | Certificate transparency poisoning attempt (SCT mismatch)       | P1
| CRY-05    | KMS grant created by non-CF-Stack role (unexpected grant)       | P1
| CRY-06    | TLS handshake failure rate > 10% (MITM / client incompat?)      | P2

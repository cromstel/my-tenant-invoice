# Secrets Management

## Architecture

Secrets management in myTenant Invoice uses **HashiCorp Vault Enterprise (v1.17+)** deployed in active/standby mode across three availability zones with integrated auto-unseal via AWS KMS + Shamir backup shards held by four key persons (CISO, VP Infrastructure, 2 SRE leads — threshold 3-of-4).

Secret access follows the **zero-trust, zero-standing-permissions principle**: every workload authenticates to Vault via short-lived attestations, receives a short-lived Vault token, and retrieves only the minimal secrets required for its function. **No permanent secrets are stored on disk, in container images, or in CI environment variables.**

### Logical Components

```mermaid
flowchart LR
    subgraph WORKLOADS[Workloads / Consumers]
        A[fa:fa-server API Pod (K8s)]
        B[fa:fa-batch Job Worker]
        C[fa:fa-terminal GitHub Actions CI Runner]
        D[fa:fa-user-shield Break-Glass DBA]
        E[fa:fa-gateway Webhook Egress Proxy]
    end

    subgraph AUTH[Vault Auth Methods]
        A1[fa:fa-id-card K8s ServiceAccount JWT Auth]
        B1[fa:fa-id-card JWT/OIDC Auth]
        C1[fa:fa-id-card AppRole (CI)]
        D1[fa:fa-id-card Okta SAML MFA]
        E1[fa:fa-id-card AWS IAM Auth]
    end

    subgraph VAULT[HashiCorp Vault Enterprise Cluster]
        direction TB
        KV[fa:fa-key KV v2 Secrets Engine\n(General Secrets)]
        DB[fa:fa-database Database Secrets Engine\n(Dynamic Short-Lived DB Creds)]
        PKI[fa:fa-certificate PKI Secrets Engine\n(Service mTLS Certs)]
        ENC[fa:fa-lock Transit Secrets Engine\n(Sign + Encrypt-as-a-Service)]
        SSH[fa:fa-terminal SSH Secrets Engine\n(Signed Host/Client Certs)]
    end

    subgraph AUDIT[Vault Audit Devices]
        F1[fa:fa-file File Audit (local encrypted)]
        F2[fa:fa-stream Syslog → SIEM (Splunk)]
        F3[fa:fa-socket Socket → Fluentd → S3 WORM]
    end

    %% Edges
    A --> A1
    B --> A1
    C --> C1
    D --> D1
    E --> E1

    A1 --> VAULT
    B1 --> VAULT
    C1 --> VAULT
    D1 --> VAULT
    E1 --> VAULT

    VAULT --> AUDIT
```

---

## Secret Inventory & Classification

| Secret Type                | Engine         | Default TTL         | Max TTL       | Storage                          |
|----------------------------|----------------|---------------------|---------------|----------------------------------|
| API keys (customer issued) | Transit (encrypted at rest) | N/A (static)      | Up to customer config | Postgres `api_keys` table → column encrypted via KMS transit |
| Webhook signing secrets    | KV v2          | Customer rotation    | 90d recommended | Vault path: `secret/webhooks/{org_id}/{wh_id}` |
| Third-party API tokens (Stripe/Adyen/QuickBooks) | KV v2 | 30d | 90d | Vault path: `secret/integrations/{org_id}/{provider}` |
| Postgres user credentials  | DB Engine      | 1h                  | 24h           | Generated dynamically per pod (never reused) |
| Redis AUTH tokens          | KV v2          | 7d rotation         | 30d           | Vault: `secret/data/cache/redis-{cluster}` |
| SMTP / SES credentials     | KV v2          | 30d rotation        | 90d           | Vault: `secret/notification/smtp-{region}` |
| S3 IAM access keys         | AWS IAM Auth   | 15m STS AssumeRole  | 1h            | Never stored; temporary STS via Vault AWS role |
| Service mesh mTLS certs    | PKI Engine     | 24h                 | 72h           | Generated on pod startup, rotated via Vault agent |
| SSH bastion host certs     | SSH Engine     | 15m                 | 1h            | Signed per-session; never stored long term |
| HSM signing keys (invoice signature seal) | Transit | N/A (key never leaves Vault) | — | Vault Transit: keyring `invoice-sign-prod` |
| Break-glass DBA creds      | DB Engine + Okta MFA | 60 min + 1h grace | 2 hours | Wrapped response token + 2-person approval |
| JWT signing key (EdDSA)    | Transit engine | 24h rotation        | 7d key lifetime | Transit signer; public keys via JWKS endpoint. Rotated daily. |

---

## Access Control Model (Vault Policies)

Every Vault policy enforces **least privilege** on both the path and the operation. Example K8s API server policy:

```hcl
# vault policy write api-pod - <<POLICY
path "secret/data/api/config/*" {
  capabilities = ["read"]
}

# Dynamic DB credentials
path "database/creds/mytenant-app-role" {
  capabilities = ["read"]
}

# Transit encrypt/decrypt for PII columns
path "transit/encrypt/pii-column-encryption" {
  capabilities = ["update"]
}
path "transit/decrypt/pii-column-encryption" {
  capabilities = ["update"]
  min_wrapping_ttl = "30s"
  max_wrapping_ttl = "5m"
}

# Deny everything else implicitly (deny by default)
```

### Break-Glass / Emergency Access Policy

```hcl
path "database/creds/dba-break-glass" {
  capabilities   = ["read"]
  required_parameters = ["ticket_number"]
  allowed_parameters = {
    "ticket_number" = [".{8,}"]
  }
  mfa_methods      = ["okta-push","duo"]   # Two MFA methods required
  max_ttl          = "60m"
}
```

Accessing this policy additionally requires:
1. Two approvers on PagerDuty (not the requester) via Just-In-Time access workflow in Entra ID PIM.
2. Session video + keystroke recording via HashiCorp Boundary (recordings retained 1yr WORM).
3. Splunk alert fires to SOC with ticket number, user, and target.

---

## Secret Rotation Policy

| Class             | Rotation Method                                                                 | Frequency              | Automated |
|-------------------|---------------------------------------------------------------------------------|------------------------|-----------|
| Database creds    | Vault DB engine (NATURAL rotation on lease expiry; manual via API)              | 1h default             | ✅ Yes    |
| mTLS certs (PKI)  | PKI engine auto-renewal via Vault Agent sidecar (80% of lifetime)               | 24h cert, ~19h renew   | ✅ Yes    |
| Third-party tokens| Terraform rotation orchestration + webhook to refresh integration              | Every 30d              | ✅ Yes    |
| JWT signing keys  | Transit key rotation with key versioning; old key retained for 14d after swap  | Every 24h              | ✅ Yes    |
| Webhook secrets   | Dual-key window: create new secret, wait 48h for propagation, delete old        | 90d (customer action)  | 🟡 Advisory |
| SSH CA (host)     | Vault SSH Engine re-sign on reboot + every 30d cron                             | 30d max                | ✅ Yes    |
| API keys (customer) | Customer action via dashboard; dual-key window supports 2 active keys at once | Recommended 90d         | 🟡 Advisory |

### Dual-Key / Zero-Downtime Rotation Procedure

For API keys, webhook signing secrets, and any customer-facing credentials:

1. **T+0**: Operator creates new secret (v2) — both old (v1) and new (v2) accepted in parallel.
2. **T+0 to T+48h**: Customer updates integration code / configs to new secret.
3. **T+48h minimum**: Old secret (v1) marked for expiry (7-day grace). Dashboard banner + email sent to Security Contact.
4. **T+48h + 7d grace**: Old secret (v1) revoked permanently. Audit log entry.

We **never** force-rotate customer secrets without 14 days' notice unless there is evidence of a confirmed breach.

---

## Customer-Controlled Secrets (Security Tenants)

Enterprise tier customers can manage their own secrets via **HashiCorp Vault Cluster per tenant (BYOS — Bring Your Own Secrets)** or via **AWS Secrets Manager cross-account shared secret**:

```
Vault: `customer-vault/customer-a/mytenant-integration/*`
Role:  cromstel-integration-role → AWS IAM role with sts:AssumeRole + scoped policy
```

This allows customers to:
- Rotate Stripe credentials or NetSuite API tokens on their own schedule.
- Audit access by CromStel to customer-owned secrets (CloudTrail, Vault audit log).
- Instant revoke on breach without requiring CromStel support.

---

## Injection Prevention (How Secrets Get to Workloads)

### Anti-Patterns (FORBIDDEN)

❌ Hardcoded in `application.yml` or Dockerfile
❌ Embedded in container image layer (inspect via `docker history`)
❌ Stored in CI environment variables / GitHub repo secrets (only AppRole role_id used; secret_id is dynamic)
❌ Printed to STDOUT / application logs (log redactor pattern `secret_*` + `*_TOKEN`)

### Approved Patterns

1. **Kubernetes Pods (API, Workers, etc.) — Vault Agent Injector**

   Mutating webhook injects sidecar:

   ```yaml
   annotations:
     vault.hashicorp.com/agent-inject: "true"
     vault.hashicorp.com/role: "mytenant-api-pod-role"
     vault.hashicorp.com/agent-inject-secret-config.env: "secret/data/api/config/${ENVIRONMENT}"
     vault.hashicorp.com/agent-inject-template-config.env: |
       {{- with secret "secret/data/api/config/prod" -}}
       DATABASE_URL="{{ .Data.data.db_url }}"
       REDIS_PASSWORD="{{ .Data.data.redis_password }}"
       {{- end -}}
   ```
   Result: `/vault/secrets/config.env` (tmpfs, never written to disk; gone on pod shutdown) loaded via `dotenv`.

2. **Dynamic DB Credentials**

   Lease-based; no shared `postgres://app_user:changeme` user.
   ```
   vault read database/creds/mytenant-app-role
   Key                Value
   ---                -----
   lease_id           k8s-api-7f9c3d.x8s2kq
   lease_duration     1h
   lease_renewable    true
   password           A1a-B2b-C3c-D4d-E5e-F6f
   username           v-approle-mytenant-app-role-token-wx7yz9
   ```
   Pod renews lease at 50% TTL via Vault agent.

3. **CI/CD (GitHub Actions)**

   GitHub Actions uses Vault AppRole with response-wrapped single-use secret_id, 5 minute TTL:
   ```yaml
     - name: Get Vault Token
       uses: hashicorp/vault-action@v3
       with:
         url: ${{ secrets.VAULT_ADDR }}
         method: approle
         roleId: ${{ secrets.VAULT_ROLE_ID }}
         secretId: ${{ steps.wrap.outputs.secret_id }}  # unwrapped, single-use
         secrets: secret/data/ci/gpg key > GPG_SIGNING_KEY
   ```

4. **Break-Glass / Human Access**

   All human access via HashiCorp Boundary + SSO + YubiKey hardware MFA. No direct SSH / DB tunnel with static password ever.

---

## Audit & Monitoring

Every Vault operation (success AND failure) goes to all three audit devices for redundancy:

### Audit Device Configuration

```bash
vault audit enable file file_path=/vault/audit/vault-audit.log mode=0600 hmac_accessor=true hash_salted=true
vault audit enable syslog tag="vault" facility=LOCAL5
vault audit enable socket address=fluentd:5170 socket_type=tcp
```

### Critical Alert Rules (Splunk / Elastic)

| Rule                                       | Condition                                                      | Severity |
|--------------------------------------------|----------------------------------------------------------------|----------|
| VLT-01: Root token usage                    | Any call with `display_name=root`                              | Critical P1 |
| VLT-02: Policy modification                 | `path=sys/policy/*` AND `operation in (create,update,delete)` | Critical P1 |
| VLT-03: Break-glass creds accessed          | `path=database/creds/dba-break-glass` response_code=200        | High P2  |
| VLT-04: 5+ auth failures in 10 min          | Stats count by `source_ip,display_name` > threshold           | Medium P3 |
| VLT-05: Transit decrypt > baseline volume   | 3σ spike on `transit/decrypt/*` calls                          | High P2  |
| VLT-06: Seal state change                   | Vault seals/unseals unexpectedly                               | Critical P1 |
| VLT-07: AWS IAM auth from non-EKS source IP | `auth/aws/login` caller IP not in EKS CIDR block               | High P2  |

### Audit Log Entry Schema (Redacted)

```json
{
  "time": "2025-03-15T14:35:12.442Z",
  "type": "request",
  "auth": {
    "client_token": "hmac-sha256:9f2b[...]b7c1",   # always HMAC'd, never clear
    "accessor": "hmac-sha256:13fe[...]1c0a",
    "display_name": "kubernetes-api-pod-ns-default-sa-api",
    "policies": ["default", "api-pod-role"],
    "metadata": {
      "role": "mytenant-api-pod-role",
      "service_account_uid": "b31b949c-c71a-11e9-8abf-0a90d53e672b",
      "namespace": "default",
      "pod_name": "mytenant-api-deployment-569df5cf87-w2l5z"
    }
  },
  "request": {
    "operation": "read",
    "path": "database/creds/mytenant-app-role",
    "data": {"ticket_number": null},
    "remote_address": "10.21.48.132"
  },
  "response": {
    "data": { "username": "[redacted]", "password": "[redacted]" }  # secrets always redacted in audit
  },
  "error": ""
}
```

---

## Disaster Recovery

### Seal / Unseal Strategy

- **Auto-unseal**: AWS KMS key `vault-root-unseal-prod` (multi-region) with 3-of-4 Shamir shards backup stored in physical safes (CISO, CTO, CFO, SRE Lead homes — addresses listed in DR plan).
- **Auto-unseal bypass**: Requires quorum of 3 key holders to use Shamir shards if KMS is unavailable (offline procedure).

### Vault Backup & Restore

- **Raft snapshots**: Every 30 minutes → S3 `cromstel-vault-snapshots-prod` (WORM Object Lock retention 365 days, encrypted with separate CMK).
- **Disaster recovery**: Vault DR replication (1-minute RPO, 5-minute RTO target) to eu-west-2 standby region.
- **Restore DR test**: Quarterly; last test passed 2025-07-22 (restored snap from 7 days prior; full validation succeeded in 3m 42s).

---

## Incident Response for Secret Compromise

If a secret is suspected compromised (any confidence level):

1. **Immediate**: Call the Security Hotline (on PagerDuty → Security On-Call).
2. **0–15 minutes**: Revoke the affected secret(s) in Vault. For dynamic leases: `vault lease revoke -prefix <path>`.
3. **0–30 minutes**: Identify scope via SIEM audit — what data could have been accessed with that secret?
4. **15–60 minutes**: Notify affected customers via security@cromstel.com ticket (or breach protocol if PII at risk).
5. **0–4 hours**: Rotate all related secrets (super set of compromised one).
6. **Post-incident 5 days**: Root cause + 5-Why + corrective actions documented in post-mortem RFC.

*Zero standing secrets policy means compromise blast radius is limited to the lease duration (hours max), not permanent.*

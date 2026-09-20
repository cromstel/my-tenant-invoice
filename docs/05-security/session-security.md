# Session Security

## Session Model

MyTenant Invoice sessions combine two tokens for the interactive user flow:
1. **Access Token** (JWT, EdDSA signed, 15-minute lifetime) — stateless bearer token in `Authorization` header for API calls, or stored in memory by SPA app (NOT localStorage).
2. **Refresh Token** (opaque reference token stored server-side in Redis, 7-day rolling window) — stored in an HttpOnly+SameSite cookie, readable only by `/auth/refresh` endpoint.
3. **Session Identifier** (`sid` claim) — ties both tokens to a server-side session record that can be invalidated instantly (logout, MFA required, brute-force trigger).

Non-interactive flows (API keys, service accounts, PATs) do not use sessions — they rely directly on token scope + short lifetime; see authentication.md.

---

## Cookie Security Hardening

### Refresh Token Cookie Attributes (Interactive Login)

```
Set-Cookie: mytenant_refresh=ref_01HF944...;
  Path=/v1/auth/refresh;                     # Scope minimal path (never sent to /api!)
  Domain=auth.mytenant-invoice.cromstel.com; # Host cookie, no subdomain scope leak
  Secure;                                     # HTTPS ONLY
  HttpOnly;                                   # JS cannot read (XSS defense)
  SameSite=Lax;                               # CSRF defense (GET requests from cross-site allowed, POST/side effects blocked)
  Max-Age=604800;                             # 7 days (matches refresh token lifetime)
  Partitioned;                                # CHIPS support for 3P cross-partition isolation (Firefox 115+, Chrome 114+)
  Priority=High;                              # Cookie Priority reduces risk of browser eviction
```

### Anti-CSRF Double-Submit Cookie

All state-changing API calls (POST/PUT/PATCH/DELETE) require **two tokens that match**:

1. `XSRF-TOKEN` cookie (readable by JS, SameSite=Lax; value = 32 random bytes + signature)
2. `X-XSRF-TOKEN` HTTP header sent by the SPA on every mutation request

Server validates: header value equals cookie value (after HMAC signature verification). This prevents CSRF because cross-origin attacker can't read the cookie value to include the matching header.

```http
POST /v1/organizations/org_xxx/invoices HTTP/1.1
Cookie: XSRF-TOKEN=gAAAAABm...signed
X-XSRF-TOKEN: gAAAAABm...signed
```

Validation failure → 403 `csrf_mismatch` + security event.

---

## Session Lifetime & Rotation Policy

| Event                                  | Access Token Lifespan | Refresh Token Lifespan | Session Record
|----------------------------------------|----------------------|------------------------|-----------------------------
| Successful login with MFA + trusted device | 15m            | 7 days rolling         | 90 days max absolute life
| Login from new device / unknown GeoIP  | 15m                  | 12 hours               | Step-up MFA prompt required again after 12h
| Remember device = false                | 15m                  | Browser session (expires when tab closes, no Max-Age) | N/A
| Privilege elevation (`sudo` mode for >$10k void) | 5m        | N/A (not refreshable)  | Separate elevation token in Redis, auto-revokes after 5m or single use
| API key exchanged JWT                  | 15m                  | N/A (no refresh; re-exchange) | N/A (stateless)
| Service account OAuth client creds JWT| 15m                  | N/A                    | N/A (stateless)

### Refresh Token Rotation

Every call to `/v1/auth/refresh`:
1. **Issues a NEW access token + NEW refresh token.**
2. **Invalidates the consumed refresh token** (single-use).
3. **Old refresh token reuse → Replay detected:** immediately invalidate the entire session family, log the user out of ALL devices, fire security alert `session_refresh_replay_detected` P1, and lock the account pending verification.

```typescript
// refresh token flow (pseudocode)
async function refreshToken(oldRefreshToken: string) {
  const session = await redis.hgetall(`refresh:${oldRefreshToken}`);
  if (!session) {
    // REPLAY ATTACK? — token already used / doesn't exist
    const familyId = detectSessionFamily(oldRefreshToken);
    await invalidateSessionFamily(familyId);
    throw new SecurityError('session_replay_detected');
  }
  // Single-use: consume old token
  await redis.del(`refresh:${oldRefreshToken}`);
  const newAccessToken  = issueJWT(session.subject, { lifetime: 15*60 });
  const newRefreshToken = randomBytes(48).toString('hex');
  const expiresAtSecs = Math.floor(Date.now() / 1000) + 7*24*60*60;  // 7 days rolling
  await redis.setex(`refresh:${newRefreshToken}`, expiresAtSecs, JSON.stringify(session));
  await redis.sadd(`session_family:${session.family_id}`, newRefreshToken);
  return { access: newAccessToken, refresh: newRefreshToken };
}
```

---

## Device Trust & Contextual Authentication

Each login creates a device fingerprint using:
- User-Agent normalized (not raw) + screen resolution
- Timezone + locale
- Canvas / WebGL hashes (privacy-preserving, not cross-trackable)
- First-party persistent cookie `__Host-mytenant_device_id` (365 day)
- IP subnet (ASN + /24 for IPv4, /56 for IPv6)

Risk signals used by the adaptive authentication engine (Ory/Kratos custom):

| Signal                          | Risk Score Δ | Action Triggered
|---------------------------------|--------------|-----------------------------
| New device_id never seen before  | +30 pts      | Email confirmation + MFA step-up
| New GeoIP country (different than 90-day history) | +40 pts | MFA + device confirmation email
| 3+ failed logins in 10 min      | +60 pts      | Captcha + 30-minute account lock + security alert
| Tor exit node IP                 | +80 pts      | MFA mandatory + CAPTCHA (always for Tor)
| Known breached password (HIBP k-anonymity) | +100 | Password reset forced immediately; login denied
| Impossible travel (2 logins > 500 miles apart in < 2 hours) | +75 | Session flagged + step-up MFA on next sensitive action
| ASN known for abuse / VPN        | +20 pts      | MFA required (even if device is trusted)

Action thresholds:
- ≥ 40 points: MFA re-challenge (even with remembered device)
- ≥ 70 points: Support ticket + Security Contact notification (high-risk login blocked pending manual review Enterprise tier)
- ≥ 100 points: Hard block + user lockout (SOC P2 alert)

---

## Step-Up Authentication (Privilege Elevation)

Sensitive actions require the user to re-authenticate **within the last 5 minutes** (regardless of normal 15-minute access token):

| Action                                              | Step-Up Level
|-----------------------------------------------------|---------------
| Change org owner / invite new org owner             | Password + hardware MFA (YubiKey/WebAuthn)
| Delete organization / schedule offboarding          | Password + hardware MFA + 2-person approval (4-eyes)
| Issue invoice refund > $10,000 USD equivalent       | Password + any MFA
| Void invoice > $10,000                              | Password + any MFA
| Export all customer data (GDPR request)             | Password + any MFA
| Create or rotate API keys                           | MFA (TOTP/WebAuthn)
| Modify webhook endpoints (SSRF risk)                | MFA (TOTP/WebAuthn)
| Change SSO / SAML configuration                     | Password + hardware MFA
| Access audit logs (auditor role)                    | MFA per-session (1-hour grant)

Step-up flow:
1. Frontend receives 403 `authz_step_up_required` with header `X-Step-Up-Nonce: abc123...` and `error.links.step_up_url`.
2. User prompted for credentials + MFA again.
3. Backend issues short-lived (5 minute) `elevation_token` bound to the nonce, stored in Redis scoped to specific action only.
4. Repeat original request, now including: `X-Elevation-Token: xxx`
5. Token validated, nonce consumed → action executed.

All step-up actions are audited as `auth.stepup.succeeded` or `auth.stepup.failed` events.

---

## MFA (Multi-Factor) Methods Supported

| Method                 | Security Rating | Phishing-Resistant | Standard for org:owner |
|------------------------|-----------------|----------------------|-------------------------|
| WebAuthn / Passkey (YubiKey, Face ID, Touch ID, Windows Hello) | ⭐⭐⭐⭐⭐ | ✅ YES (FIDO2 CTAP2 + user verification) | **Mandatory from 2026-01-01** |
| TOTP (Authenticator App — Google, 1Password, Authy) | ⭐⭐⭐ | ❌ NO (vulnerable to real-time phishing) | Allowed transitionally
| SMS / Text Message     | ⭐             | ❌ NO (NIST discourages; SIM-swap vulnerable) | Allowed if other methods unavailable; deprecated 2026-06-01
| Duo Push / Okta Verify | ⭐⭐⭐⭐       | 🟡 Depends (number matching reduces phish) | Enterprise SSO push option
| Security Key via SSO (Entra ID certificate-based auth) | ⭐⭐⭐⭐⭐ | ✅ YES | Enterprise SSO tier

User recovery: 10 one-time recovery codes (SHA-256 hashed, 1 use each) shown only once at MFA enrollment. No "reset via email" path for MFA — requires manual identity verification via Support (3-factor: registered email + last 4 of payment card on file + ZIP/postal code of billing address + photo ID for Enterprise tier).

---

## Session Hijacking Defenses

Mitigations against session fixation, cookie tossing, and post-XSS token theft:

1. **Session Regeneration on Privilege Changes:** login, MFA enable/disable, password reset, role change → new session ID; old session invalidated.
2. **IP Pinning (Optional Policy — Enterprise):** session bound to /24 IPv4 subnet (toggle via org policy). Disabled by default because legitimate users (mobile, coffee shop Wi-Fi) roam IPs.
3. **Cross-Browser Signaling:** if same user account sees sessions in > 5 concurrent browsers, notification email + dashboard alert banner.
4. **Silent Invalidation Pattern on Token Exfiltration Suspected:** when XSS is detected via CSP report (below), we invalidate all user sessions proactively.

---

## Content Security Policy (CSP) — XSS & Session Theft Prevention

Dashboard CSP header (strict-dynamic + nonce-based):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{per-request-crypt-random-nonce}' 'strict-dynamic' https: 'self';
  style-src 'self' 'unsafe-hashes';  # hash-allowlisted dynamic style
  img-src 'self' https: blob: data:;
  font-src 'self' data:;
  connect-src 'self' https://api.mytenant-invoice.cromstel.com wss://*.cromstel.com https://o11y.cromstel.com;
  frame-ancestors 'none';                           # Prevent clickjacking (replaces X-Frame-Options: DENY)
  base-uri 'none';                                  # Prevent <base> injection
  form-action 'self';                               # Form submissions only to us
  frame-src 'none';
  object-src 'none';                                # No Flash/Java/Silverlight
  plugin-types 'none';
  upgrade-insecure-requests;
  require-trusted-types-for 'script';               # Trusted Types API (Chrome/Edge)
  report-uri https://o11y.cromstel.com/csp-report;
  report-to csp-report-group;
```

Per-request nonce (32 crypto random bytes) + `strict-dynamic` = robust XSS protection, even if an attacker finds a reflection bug in an HTML template.

Additional headers:
```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=('self'), usb=(), bluetooth=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
Cross-Origin-Embedder-Policy: require-corp
```

---

## Session End & Global Logout

User actions that invalidate session(s):

| Action                                          | Sessions Invalidated
|-------------------------------------------------|-------------------------------------------------
| User clicks "Sign Out"                          | Current device session only
| User chooses "Sign Out of All Devices" (Settings) | Every session for this user (SADD loop → invalidate all `session_family:*`)
| Password change                                 | All sessions (except current) + all refresh tokens
| MFA method change (added/removed)               | All sessions except current
| Account lockout (admin or brute-force)          | All sessions, all tokens, API keys put on probation
| Customer role removed / org membership revoked  | All sessions belonging to the (user, org) pair
| Security event (session replay, XSS CSP report, token theft indicator) | All sessions for affected users + org-wide forced re-login for all admins

Global logout propagation is sub-second (Redis PUBLISH → all API pods SUBSCRIBE → immediate JTI bloom filter updates).

---

## SSO & SAML Session Policy

Enterprise SSO via SAML 2.0 / OIDC (Okta, Entra ID, OneLogin, Google Workspace, Jumpcloud):

| SSO Setting                           | CromStel Policy
|---------------------------------------|----------------------------------------------
| SSO-only (Disable Password Login)     | ✅ Toggle per org (recommended for compliance)
| Force AuthnContext                    | `urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport` + hardware MFA if available
| Session NotOnOrAfter                  | Maximum 8 hours (CromStel ignores IdP session longer than 8h; forces re-auth)
| Signed AuthN Requests                 | ✅ Required + signed Assertions + encrypted NameID
| IdP-Initiated SSO                     | Allowed but subject to additional RelayState validation (must match known org URL)
| SCIM Deprovisioning                   | ✅ Supported — user disabled in IdP → session revoked in CromStel within 5 minutes

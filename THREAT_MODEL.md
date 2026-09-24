# Rest Assured prototype threat model

Status: hackathon/local prototype, September 24, 2026.

## Assets intentionally stored

- Team-local label (optional)
- Framing choice
- Operational aliases and optional role labels
- Team covenant text, version, and adoption timestamp
- Rota periods and revisions
- Bounded responsibility, start/end window, person stepping away, coverage receiver, coverage state
- Four short handover fields: current status, next bounded action, agreed limit, essential reference
- One shared team-level pulse per period, if the team chooses to record it
- Local settings for auto-lock and handover retention target

## Data the product is designed not to collect

- Individual mood, mental-health, wellness, recovery, or engagement scores
- Individual pulse ballots
- Streaks, points, badges, leaderboards, app-open counts, or performance rankings
- Beneficiary/client identities, case histories, personal stories, precise sensitive locations
- Passwords, publishing credentials, unrestricted attachments, private chat histories
- Central alias-to-legal-identity directory
- Social-account tokens
- Advertising identifiers or analytics telemetry

## Current trust boundary

One browser profile on one device. The encrypted vault is kept in browser local storage. The passphrase is never stored. While unlocked, decrypted state and the passphrase exist in page memory.

## Cryptography

The prototype uses the browser Web Crypto API:

- PBKDF2-HMAC-SHA256, 310,000 iterations, 128-bit random salt
- AES-256-GCM with a fresh 96-bit IV on every save
- The salt, IV, algorithm metadata, and ciphertext are stored; plaintext team data is not intentionally persisted by the application

This is standard platform cryptography. It is **not** a claim that the overall system is secure against a compromised endpoint.

## Primary threats

### Device loss, seizure, or unauthorized local access

Mitigations in prototype: encrypted vault, passphrase unlock, inactivity lock. Residual risk: weak passphrases, unlocked browser, OS/browser extraction, memory access, keylogging, or endpoint compromise.

### Screenshots and printed copies

Mitigation: print view includes period/revision to identify stale sheets and the UI warns that printing is deliberate exposure. Residual risk: the app cannot revoke paper, screenshots, printer spool/history, photos, or external copies.

### Insider misuse or overcollection

Mitigation: constrained fields, prominent warnings, no attachments/chat, no passive tracking. Residual risk: a user can still type identifying content into free-text fields or copy data elsewhere.

### Reidentification through metadata

Mitigation: aliases by default and optional roles. Residual risk: schedules, rare roles, repeated patterns, and local knowledge can reveal identities.

### Browser persistence and backups

Mitigation: ciphertext is stored instead of plaintext by the app, and an explicit erase action is available. Residual risk: browsers/OSes may back up storage; secure deletion from flash media cannot be guaranteed; exported backups may persist indefinitely.

### Software supply chain and update channel

Mitigation in this build: no third-party JavaScript packages, web fonts, analytics, or CDNs. Residual risk: the method used to distribute future builds and updates is not yet designed or authenticated.

### Network surveillance

The application makes no runtime API/data connections and has `connect-src 'none'`. A service worker caches same-origin static files. Residual risk: serving or updating the static files still has observable network metadata; a compromised server could deliver altered code.

### Multi-device synchronization

Not implemented. This is deliberate. Secure pairing, membership changes, revocation, key recovery, metadata, conflict handling, and device compromise must be designed before sync is added.

## Conflict-safety invariant

A proposed assignment never counts as accepted coverage. Accepted coverage requires a receiver, and the same receiver cannot silently accept overlapping assignments. A conflicting change must be revised rather than overwriting an accepted assignment.

## Pre-pilot requirements

1. Independent review of threat assumptions with the actual pilot population and likely adversaries.
2. Decide packaging/distribution model and authenticated update process.
3. Validate browser storage behavior, persistence, backup, clearing, and memory exposure on target devices.
4. Review KDF parameters and cryptographic implementation for target performance/security constraints.
5. Add a tested content-retention workflow appropriate to the pilot’s legal and operational context.
6. Test accessibility and usability with a nontechnical facilitator.
7. Red-team overcollection paths, screenshots/printing flow, and real-name mode.
8. If multi-device use is required, design sync separately; do not bolt it onto this storage model.
9. Document incident response for lost/unlocked devices and exposed printed copies.
10. Keep real team data out of any hackathon cloud AI demonstration unless a separate reviewed data flow explicitly permits it.

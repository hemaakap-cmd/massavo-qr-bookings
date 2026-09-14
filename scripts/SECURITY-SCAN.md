# Massavo live security scan — "safe to operate?" gate

A single command that attacks the **live production site** the way a real
attacker would, then tells you plainly whether any theft / fraud / tampering /
phishing path is open right now.

```sh
npm run security:scan
# or against another environment:
node scripts/security-scan.mjs --url https://massavo.com
```

## What it is safe to run

Every check uses only:

- reserved `example.com` addresses (belong to no real person)
- random UUIDs
- rejection / contract paths

It never reads a real customer's data, never creates a booking, never moves
money, and sends one request per check (no flooding). You can run it as often as
you like.

## How to read the result

Each line is one attacker question, with a verdict:

- `SAFE` — the attack was correctly rejected.
- `! VULNERABLE` — the path is **open in production**. Act on these.
- `INFO` — worth knowing, not a direct theft path.
- `NEEDS LOGIN` — cannot be judged without a test account; **never** treat as safe.

At the bottom:

- `VERDICT: NOT SAFE TO OPERATE` + a list of open paths, **or**
- `VERDICT: no OPEN theft/tampering/phishing path found` (still not a full
  clearance — see the NEEDS LOGIN list).

Exit code is `1` when any customer-data-theft, money/fraud, or tampering path is
open, so you can use it as a deploy gate:

```sh
npm run security:scan && echo "gate passed" || echo "gate FAILED — do not ship"
```

## The checks

| ID   | Threat it proves is closed (or open)                                   |
|------|------------------------------------------------------------------------|
| T1   | Customer bookings cannot be stolen with just an email address          |
| T2   | Sensitive tables are not readable anonymously                          |
| T3   | A stranger's website cannot read the API (CORS)                        |
| M1   | No cancel + refund of a stranger's booking via email + id              |
| M2   | The client cannot dictate the price                                    |
| M3   | Bookings cannot be minted without going through payment                |
| M4   | A forged (unsigned) payment webhook is rejected                        |
| Tp1  | Health data cannot be written to a stranger's booking                  |
| Tp2  | Reschedule requires the secret token                                   |
| Tp3  | Admin / role / GDPR functions reject anonymous callers                 |
| Ph1  | Login redirect stays on-origin (no `/\evil.com` phishing bypass)       |
| Ph2  | Pages cannot be framed (clickjacking)                                  |
| H1   | (info) which endpoints could burn third-party / LLM quota              |

## What it does NOT cover — needs test accounts

The whole logged-in surface is **NOT TESTED** here and must not be assumed safe:

- NL1 role escalation (client → therapist → admin → super_admin)
- NL2 authenticated RLS / cross-user data access
- NL3 cross-country / tenant isolation (incl. the AI and BI functions)
- NL4 authenticated payment / refund abuse with a real session
- NL5 OTP replay, session reuse, password reset
- NL6 25-way double-booking race on a disposable slot
- NL7 Stripe webhook replay with a valid signature

To close these, provide: one test account per role, a staging environment, a
controlled mailbox for OTP, Stripe **test** keys and a webhook secret, and a
disposable booking/slot.

## Relationship to the other suite

- `npm run security:scan` → **live** production check (this file). Run before you
  start working and after every deploy.
- `npm test` (`src/test/security-regression.test.ts`) → code-level invariants
  plus live regression cases; use it in CI so a fix cannot silently regress.

A finding is only truly closed when it is: **committed → deployed → this scan
reports it SAFE against production.**

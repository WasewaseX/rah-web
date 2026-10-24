# Email operations — configuration + validation runbook (Task 95, review P1 #6)

> The delivery machinery exists and is tested (`src/lib/mailer.ts`,
> `scripts/test-email-delivery.ts`: 7-pass battery on duplicate suppression,
> sliding-window expiry, ledger shape, and failure recording). What remains
> is exactly what the review named: real provider configuration, then
> delivery/failure/retry validation in that mode. This runbook is that path.

## Current modes (what the code does today)

| Mode | When | Behavior |
|---|---|---|
| DEV delivery | no `SMTP_HOST` | code logged loudly + surfaced in the API response's `devCode`; ledger records `status=dev`; `delivered=false` |
| SMTP | `SMTP_HOST` set (+ optional user/pass/from) | real nodemailer send; ledger records `status=sent` + the SMTP `messageId`; failures record `status=failed` + error, then rethrow |

The idempotency contract (pinned by the battery): ONE send per
(`kind`, recipient) per 60s, measured SLIDING from the first attempt — a
double-click, a route retry, or an orchestrator replay inside the window
gets the FIRST attempt's recorded outcome (`idempotent=true`), never a
second email. After the window, the same ledger row refreshes (one row per
address = the delivery report).

## Configuration (choose one)

### Option A — transactional SMTP provider (Resend, Postmark, SES, …)

1. Create the account, verify the sending domain (SPF + DKIM DNS records —
   the provider's dashboard walks through it; unverified domains are the
   #1 cause of "sent but never arrives").
2. Use the provider's SMTP bridge:
   ```bash
   # .env (gitignored - never commit credentials)
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=resend
   SMTP_PASS=<API key>
   SMTP_FROM=Rah <login@your-domain>
   ```
   (Resend's SMTP bridge is the smallest diff; if later migrating to
   Resend's HTTP API, keep the idempotency design — their API supports
   `Idempotency-Key` headers, which maps 1:1 onto the existing ledger-key
   idea for cross-instance dedupe.)
3. Restart the app (transport is built once at first use).

### Option B — Gmail SMTP (single-learner era only)

Gmail works as a recipient in every mode. As a SENDER it needs an app
password (2FA required) and is rate-limited — acceptable for the one-learner
deployment, not for any multi-user launch.

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465   # secure:true is wired to 465
SMTP_USER=<address@gmail.com>
SMTP_PASS=<16-char app password>
SMTP_FROM=<address@gmail.com>
```

## Validation after configuration (the review's four bullets)

```bash
# real-send check (delivers one live email to the address you name):
SMTP_HOST=... SMTP_USER=... SMTP_PASS=... MAIL_TEST_TO=you@example.com \
  bun scripts/test-email-delivery.ts
```

1. **Verification delivery** — the real-send check must return
   `delivered=true`, the inbox must show the code within ~1 minute, and the
   ledger row must carry the provider `messageId`.
2. **Delivery failures** — point `SMTP_PASS` at a deliberately wrong value
   and re-run: the check must record `status=failed` with the provider
   error, and the route must surface a speakable failure (never a silent
   devCode fallback while SMTP is configured — that would teach the learner
   to ignore the difference).
3. **Retries** — trigger the same login-code request twice quickly (double
   click the send button): exactly one email arrives; the second response
   reports `idempotent=true` with the first outcome. Then age the row
   (battery tests this with a 61s offset) and confirm a legitimate fresh
   send goes through.
4. **Duplicate suppression across restarts** — the ledger is the DB, not
   memory: repeat the double-click test after an app restart. One email is
   still the correct total.

## Alerting hook (Task 95's alert layer)

Once SMTP is live, wire provider-level failures into the alert log: a
cron'd `sqlite3 db/custom.db "SELECT COUNT(*) FROM MailLog WHERE
status='failed' AND at > datetime('now','-1 day')"` above 0 is a
`scripts/alert.sh WARN email "N failed deliveries in 24h"` — candidates for
the watchdog's daily tick in a follow-up task (kept out of this one to keep
the diff reviewable).

## Regression guard

The battery (`scripts/test-email-delivery.ts`) runs on a throwaway DB and
must stay green in CI-adjacent runs. Any change to `sendLoginCode` (window,
statuses, record shape) requires extending the battery in the same commit —
the ledger contract is what makes "did the email go out?" a query instead of
a support ticket.

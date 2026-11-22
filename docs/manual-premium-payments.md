# Manual Premium payments

Premium is not on sale by default: with `MANUAL_PAYMENTS={}` every method is off and the Premium tab says so. This page describes what turning it on involves. Turning it on is the owner's decision.

## How it works

- The Premium tab opens a payment form (RU/EN). The learner picks a country: Russia → SBP or PayPal; Turkey or another country → PayPal.
- Choosing an available method creates a payment request. Its UUID is the reference number. The request keeps an unchangeable copy of the payment details, instructions and activation terms it was issued with.
- The learner pays outside the app and reports the date and time, the amount and an optional transaction id. Reporting grants Premium immediately (`User.access_tier = premium`) and moves the request to `awaiting_review`. This is provisional access, not proof that money arrived.
- In the web admin, below the users, an admin sees the requests (50 per page) and confirms, rejects or cancels them. Rejecting or cancelling revokes Premium only if `User.premium_payment_id` points at that request.
- There is no payment provider API, no automatic check of incoming money and no country detection.

## Backend configuration

`MANUAL_PAYMENTS` is a backend-only JSON value validated by Pydantic (`backend/app/schemas/payments.py`). Never use a `VITE_` variable: the details reach only signed-in users through the API. Production does not set it yet. Enabling it means adding a sensitive Terraform variable in `infra/` fed from a `production` environment secret; the real details never go into a committed file.

Template, with no real details and no method enabled:

```json
{
  "activation": { "ru": "", "en": "" },
  "methods": {
    "sbp": { "amount": "", "currency": "RUB", "recipient": "", "phone": "", "bank": "", "instructions": { "ru": "", "en": "" } },
    "paypal": { "amount": "5.00", "currency": "EUR", "recipient": "", "paypal": "", "instructions": { "ru": "", "en": "" } }
  }
}
```

- A method is available only when the activation text, recipient, instructions in both languages, amount and currency are all filled.
- SBP also needs `phone`, `bank` and currency RUB.
- PayPal needs 5.00 EUR and either an email in `paypal` or a `paypal_url` (HTTPS on paypal.com or paypal.me).
- Wrong types, non-positive amounts and unsafe PayPal URLs fail at startup.
- Requests already issued keep their old details. After changing details, review pending requests and cancel them if needed.

## API

- `GET /api/payments/options`, `GET /api/payments`, `POST /api/payments` (country, method).
- `POST /api/payments/{id}/report` (`paid_at` with a timezone, `amount`, `transaction_id`), `POST /api/payments/{id}/cancel`.
- Admin only: `GET /api/admin/payments?offset=0`, `PATCH /api/admin/payments/{id}` (`confirmed`, `rejected`, `cancelled`).
- Responses are `Cache-Control: no-store`. Another user's request is indistinguishable from a missing one (404). Non-admins get 403 on admin routes.
- Changes are serialised by a per-user lock. A unique nullable `active_user_id` forbids two active requests per account.

# Wallet payments & deep-link callback

Integration guide for buying coins, payment redirects, and fetching transactions.

## App scheme (share with payment provider)

| Item | Value |
|------|--------|
| App scheme | `zeelove` |
| Callback path | `payment/callback` |
| Full redirect URL | `zeelove://payment/callback` |

### Success redirect (example)

```
zeelove://payment/callback?status=success&transactionId=TXN_ID&amount=250&reference=PAY-REF-123
```

### Failed redirect (example)

```
zeelove://payment/callback?status=failed&transactionId=TXN_ID&message=Payment+was+declined
```

### Supported query params

| Param | Required | Aliases | Notes |
|-------|----------|---------|--------|
| `status` | Yes | `payment_status`, `state` | Values: `success`, `failed`, `cancelled`, `pending` |
| `transactionId` | No | `transaction_id`, `id`, `txn_id` | Backend transaction id |
| `reference` | No | `ref`, `trx_ref`, `payment_reference` | Payment reference (same as id for Paystack/Flutterwave) |
| `amount` | No | `coins`, `quantity` | USD amount charged |
| `message` | No | `error`, `reason`, `description` | Human-readable failure reason |

> **Note:** The API emits the canonical names (`status`, `transactionId`, `reference`, `amount`, `message`). Aliases are for the mobile app parser.

---

## Buy coins

```http
POST /wallet/buy-coins
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "amount": 250,
  "callbackUrl": "zeelove://payment/callback",
  "provider": "paystack"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `amount` | Yes | USD amount (max `1000`) |
| `callbackUrl` | No | App deep link for post-payment redirect. Defaults to `zeelove://payment/callback` (or `EXPO_SCHEME/payment/callback` if set) |
| `provider` | No | `paystack` or `flutterwave`. If omitted, returns a hosted checkout page link |

### Response (with provider)

```json
{
  "message": "Payment link created successfully",
  "link": "https://checkout.paystack.com/...",
  "provider": "paystack",
  "transactionId": "paystack-xxxx",
  "reference": "paystack-xxxx",
  "amount": 250,
  "callbackUrl": "zeelove://payment/callback"
}
```

Open `link` in an auth browser session (`WebBrowser.openAuthSessionAsync`). After payment, the gateway hits the API, which verifies and redirects to:

```
zeelove://payment/callback?status=...&transactionId=...&amount=...&reference=...
```

### Flow

```
App                         API                         Gateway
 |                           |                             |
 |-- POST /wallet/buy-coins -->|                             |
 |   { amount, callbackUrl }   |                             |
 |<-- { link, transactionId }--|                             |
 |                           |                             |
 |-- openAuthSession(link) -------------------------------→|
 |                           |←-- redirect /wallet/callback-|
 |                           |    verify payment            |
 |←-- zeelove://payment/callback?status=success&... --------|
 |                           |                             |
 |-- GET /wallet/transactions/:id -->|                     |
 |<-- transaction details -----------|                     |
```

---

## Get transaction by ID

Used by the callback screen when `transactionId` is present.

```http
GET /wallet/transactions/:id
Authorization: Bearer <token>
```

### Example

```http
GET /wallet/transactions/paystack-abc123
```

### Response

```json
{
  "message": "Transaction retrieved successfully",
  "data": {
    "id": "paystack-abc123",
    "transactionId": "paystack-abc123",
    "reference": "paystack-abc123",
    "provider_ref": "123456789",
    "amount": 250,
    "fee": 0,
    "type": "credit",
    "description": "Purchase of coins (Paystack)",
    "status": "success",
    "currency": "USD",
    "payment_link": "https://...",
    "created_at": "2026-07-10T01:00:00.000Z",
    "updated_at": "2026-07-10T01:01:00.000Z",
    "userId": "..."
  }
}
```

`status` values: `success` | `failed` | `pending`

---

## Get transaction by payment reference

```http
GET /wallet/transactions/reference/:reference
Authorization: Bearer <token>
```

Looks up by transaction `id` **or** `provider_ref`.

### Example

```http
GET /wallet/transactions/reference/paystack-abc123
```

Response shape matches [Get transaction by ID](#get-transaction-by-id).

---

## List transactions

```http
GET /wallet/transactions?page=1&limit=20
Authorization: Bearer <token>
```

---

## Server callback (payment providers)

Gateways redirect here after checkout (not called by the app directly):

```http
GET /wallet/callback?tx_ref=...&reference=...&status=...&transaction_id=...&app_callback=zeelove%3A%2F%2Fpayment%2Fcallback
```

The API:

1. Verifies payment with Paystack or Flutterwave
2. Credits the wallet on success (`1 USD = 10 coins`)
3. HTTP-redirects to the app deep link with query params

---

## Wallet info

```http
GET /wallet
Authorization: Bearer <token>
```

Refresh balance after a successful payment callback.

---

## Test deep links

```bash
# Android
adb shell am start -a android.intent.action.VIEW -d "zeelove://payment/callback?status=success&transactionId=test-123&amount=250&reference=REF-001"

# iOS Simulator
xcrun simctl openurl booted "zeelove://payment/callback?status=success&transactionId=test-123&amount=250&reference=REF-001"
```

---

## Env vars

| Variable | Role |
|----------|------|
| `BASE_URL` | Public API base (gateway callback host) |
| `EXPO_SCHEME` | Optional default app scheme for callback URL |
| `PAYSTACK_SECRET_KEY` | Paystack |
| `FLU_SECRET_KEY` | Flutterwave |

---

## Related app files (mobile)

- `src/utils/paymentDeepLink.ts` — scheme helpers + URL parser
- `src/screens/wallet/TransactionCallbackScreen.tsx` — callback UI
- `src/navigation/linking.ts` — React Navigation deep links
- `BuyCoinsScreen.tsx` — sends `callbackUrl` and handles redirect
- `app.json` — Android intent filter for payment callback

Android intent filter changes need a native rebuild (`eas build` or dev client). JS-only reload is enough for callback screen logic.

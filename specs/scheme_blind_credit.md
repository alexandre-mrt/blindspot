# Scheme: `blind-credit`

## Summary

`blind-credit` lets a client pay for an x402 resource with a prepaid credit that the resource server can verify but cannot link to the client. Credits are Chaum blind signatures (RSA-FDH): the client buys a batch with any existing x402 scheme (here `exact` over Circle Gateway nanopayments), the mint signs blinded serials it never sees, and every later request spends one credit.

It is a privacy layer on top of x402, not a replacement for settlement: money still moves through a standard scheme, once per batch.

## Use Cases

- **Trading and research agents** whose data purchases would otherwise reveal their strategy (which feed, how often, when) to anyone watching the payer's address.
- **High-frequency machine-to-machine calls** where per-request settlement is overhead and the seller only needs "this request is prepaid".
- **Privacy-preserving API metering**: the seller knows how many paid requests it served, not who made them.

## Wire format

`PaymentRequirements` (one entry of `accepts`):

```json
{
  "scheme": "blind-credit",
  "network": "eip155:5042002",
  "asset": "odds-desk-credit",
  "amount": "1",
  "payTo": "0xc1232D14AE5f79922a5B7b4384023fAA89B074Fa",
  "extra": { "mint": "https://seller.example/credits/info", "paymentFlow": "upfront" }
}
```

`extra.mint` returns the mint public key `{ n, e }` (hex) and the batch terms. The batch is issued by a normal x402-protected route, e.g. `POST /credits/issue` priced `$0.01` for 5 credits with `exact`.

`PaymentPayload.payload`:

```json
{ "serial": "<32 random bytes, hex>", "signature": "<s, hex>" }
```

## Verification (facilitator)

1. `serial` is 64 hex chars.
2. `s^e mod n == FDH(serial)`, where `FDH` concatenates `SHA-256("odds-desk-credit:i:" || serial)` for `i = 0..7` and reduces mod `n`.
3. `serial` is not in the spent set.

`verify` returns `payer: "anonymous"`. `settle` atomically adds `serial` to the spent set and returns `transaction: "credit:<sha256(serial)[0..12]>"`.

## Issuance (client)

1. `serial ← random(32)`, `r ← random coprime to n`, `b = FDH(serial) · r^e mod n`.
2. Pay the issuance route with any x402 scheme, sending `b_1..b_k`.
3. Receive `s'_i = b_i^d mod n`, compute `s_i = s'_i · r_i^{-1} mod n`, check `s_i^e == FDH(serial_i)`.

## Security properties

| Property | Argument |
|---|---|
| Unlinkability | `b_i` is uniformly distributed for random `r_i`, so the mint learns nothing about `serial_i`; at redemption it sees `(serial, s)` for the first time |
| Unforgeability | Producing `s` for a fresh serial requires the RSA private key (RSA-FDH, one-more-RSA assumption) |
| Double spend | Spent set checked in `verify`, written in `settle` |
| Amount privacy | One credit per request regardless of the resource, so the payment does not identify the resource |

## Limits

- The batch purchase is linkable to the buyer (it is a normal `exact` payment). Gateway batching mixes it with other buyers' settlements but does not hide the buyer.
- Network metadata (IP, timing) is out of scope; pair with a relay.
- The mint key must persist (with epochs and expiry) for credits to survive restarts; the reference implementation keeps it in memory.

## Reference implementation

TypeScript, against `@x402/core` 2.31 interfaces: `src/credits/scheme.ts` (`BlindCreditClientScheme`, `BlindCreditServerScheme`, `BlindCreditFacilitator`), `src/credits/blind.ts`, `src/credits/mint.ts`.

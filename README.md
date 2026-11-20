# Odds Desk

An AI research agent that **buys prediction-market intelligence per request**, paying in **USDC on Arc** through an **x402** paywall, under hard spending guardrails, then delivers a spoken trade briefing.

- **Main track:** Agentic Payments and AI
- **Chain award:** Best use of Arc
- **Bounty:** Gemini Prediction Markets

**Private mode (default): Chaumian e-cash for agents.** The agent makes one USDC deposit on Arc, receives RSA blind-signed credits, then pays for every request with a credit the server can verify but can never link to the deposit, the wallet, or the other requests. On-chain observers see one deposit and nothing about what the agent consumes or when.

## The problem

Agents that pay for data are only useful if (1) the data is worth paying for and (2) a human can trust the agent with a wallet. Most "agent pays for API" demos sell toy data and give the agent an unlimited key. Odds Desk sells real quant signals derived from live Gemini prediction markets and wraps the agent in a policy engine with a budget, a per-call cap, an origin allowlist and human approval for larger payments.

## How it works

```
                 free                    HTTP 402 + requirements
 Agent ───────── GET /catalog ──────────► Odds Desk API ◄──── Gemini Prediction Markets API
   │                                         │                 (events, contracts, bid/ask,
   │ plan (LLM or heuristic)                 │                  Lukka index klines)
   │ policy.evaluate()  ── deny / approve / allow
   │ USDC.transfer(merchant, price) on Arc testnet
   │ GET /api/feeds/:id + X-PAYMENT {txHash, payer} ───────► verify receipt on Arc:
   │                                                         Transfer(payer → merchant ≥ price),
   │ ◄──────────────────── signal data ──────────────────── success, fresh, not replayed
   │ decide (edge / arb / hold, paper stake)
   └ briefing text → dashboard (read aloud by the browser)
```

### Paid feeds (sold by the Odds Desk API)

| Feed | Price | What it computes |
|---|---|---|
| `snapshot` | $0.01 | Bid/ask of every open Gemini prediction market contract |
| `arb` | $0.02 | Strike-ladder arbitrage: on "above K" ladders, flags any higher strike whose bid exceeds a lower strike's ask (a locked profit) |
| `edge` | $0.05 | Fair value of each crypto contract from a lognormal model fed by realized 1-minute volatility of the Lukka index Gemini settles against (`/v2/klines`), compared with the Gemini book. Ranked by tradable edge (model minus ask for YES, bid minus model for NO) |

The catalog also lists an unvetted third-party feed (`whale-alpha`, $0.50) so the guardrails can be seen rejecting it.

### Private payments: blind-signed credits

A trading agent that pays for data in the clear publishes its strategy: anyone watching its wallet sees which vendor, which feed (prices are unique), and when, and can copy or front-run it before it trades. Odds Desk removes that leak with Chaum's blind signatures (RSA-FDH, 2048-bit), settled in USDC on Arc.

```
Agent                                   Mint (Odds Desk)                      Arc
 serial_i ← random 32 bytes
 m_i = FDH(serial_i)
 r_i ← random, b_i = m_i · r_i^e mod n
 USDC.transfer(merchant, N × $0.02) ─────────────────────────────────────────► one public tx
 POST /credits/issue {b_1..b_N} + X-PAYMENT ──► verify deposit on Arc
                                               s'_i = b_i^d mod n  (sees only b_i)
 s_i = s'_i · r_i^-1 mod n  ◄─────────────────
 check s_i^e == FDH(serial_i)
 GET /api/feeds/x  X-PAYMENT {serial, s} ─────► verify s^e == FDH(serial), serial unspent
                                               serve data (no tx, no wallet, no link)
```

| Property | How |
|---|---|
| Unlinkability | The mint signs `b_i`, uniformly random to it. At redemption it sees `(serial, s)`, which it never saw before, so it cannot match a request to a deposit or to another request |
| Unforgeability | Only the mint's RSA private key can produce `s` with `s^e = FDH(serial)` |
| No double spend | Redeemed serials are stored; a second use is rejected |
| Uniform price | Every feed costs one credit, so a credit reveals nothing about what was bought |
| Guardrails still apply | The deposit goes through the same policy: allowlist, caps, budget, human approval |

What it does not hide yet (honest limits): the deposit itself is public (the agent is visibly a customer of Odds Desk), network metadata (IP, timing) is visible to the server, and the mint key is in memory, so credits do not survive a restart. Next: deposit to an ECDH stealth address (on Arc, USDC is gas, so a stealth address can sweep itself), redemption over a mixnet or relay, and a persistent key with epochs.

Toggle **Private mode** off on the dashboard to compare with plain per-request x402 payments, one public tx per call.

### The agent's decision loop

1. **Discover**: fetch the free `/catalog`.
2. **Plan**: choose feeds for the goal. Uses Claude when `ANTHROPIC_API_KEY` is set, otherwise a heuristic (wants everything, so the policy has to do its job).
3. **Guard**: each purchase goes through `policy.evaluate()` (see below).
4. **Pay**: on HTTP 402, pay the exact `maxAmountRequired` in USDC on Arc, wait for the receipt, retry with the `X-PAYMENT` proof.
5. **Decide**: a ladder arbitrage wins if any. Otherwise take the highest-edge contract, paper stake = min(10% of a $100 bankroll, bankroll × edge). Otherwise hold. Odds Desk never places real Gemini orders.
6. **Brief**: a short briefing (LLM or template) shown and read aloud on the dashboard.

Every step is streamed to the dashboard (SSE) with Arcscan links for each payment.

### Safety limits (`src/config.ts`, `src/agent/policy.ts`)

| Guardrail | Value | Effect |
|---|---|---|
| Origin allowlist | Odds Desk origin only | Payments to any other host are denied |
| Per-call cap | $0.10 | Anything pricier is denied outright |
| Session budget | $0.20 | A purchase that would exceed it is denied |
| Human approval | above $0.04 | The agent pauses; a human approves or rejects on the dashboard (auto-reject after 60 s) |
| Payment validation | client side | Only USDC on `arc-testnet` is accepted as a payment asset |
| Settlement checks | server side | Receipt must succeed, contain a USDC `Transfer` from the payer to the merchant ≥ price, be under 10 min old, and each tx hash is single-use |

Unit tests for the policy: `bun test`.

## How it uses Arc

Arc is Circle's stablecoin L1 where **USDC is the gas token**, so the agent holds one asset and reasons about one unit: every API call costs a known number of cents, gas included, with no volatile token to top up. Payments are plain ERC-20 `transfer`s of USDC on Arc testnet, verified by reading the receipt logs.

| Item | Value |
|---|---|
| Network | Arc testnet, chain id `5042002`, RPC `https://rpc.testnet.arc.network` |
| USDC (ERC-20 interface, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| Agent wallet | `0xa3dAa7D967629cc4a4B99c3Cc12fB3C2d7D20e05` |
| Merchant (payTo) | `0xc1232D14AE5f79922a5B7b4384023fAA89B074Fa` |
| Explorer | https://testnet.arcscan.app |

No custom contract is deployed: the protocol composes with Arc's native USDC.

Example run (Arc testnet, three x402 payments, $0.08 total):

- snapshot $0.01: [0xc4d9c7cf…](https://testnet.arcscan.app/tx/0xc4d9c7cf6ff78a8f86d9242a5451268a127649488bbec18d2196f600c9f1e974)
- arb $0.02: [0x8ac3669c…](https://testnet.arcscan.app/tx/0x8ac3669c966e537ee7e77fc910d393957833747e833fd992e2c57f6b5146da0d)
- edge $0.05, human-approved: [0xe3b9165e…](https://testnet.arcscan.app/tx/0xe3b9165e10721b03b2122189ab391415b849834d04221b44df426b6ff35b9e67)
- whale-alpha $0.50: denied by the origin allowlist, never paid

Private-mode run: one deposit for 3 blind credits, [0x2efacda8…](https://testnet.arcscan.app/tx/0x2efacda87dbbe6bc3156f5e546ee57b23ce69ac709049bbc12e0890128dbece2), then 3 feed requests with zero further transactions.

## How it uses Gemini Prediction Markets

- `GET /v1/prediction-markets/events?status=active&category=Crypto` for events, contracts, strikes, expiries and `bestBid`/`bestAsk`.
- `GET /v2/klines?agency=lukka&index=…` for the exact settlement index (`contract.source`), used for spot and realized volatility.

Market data only; no trading keys required.

## Run it

```bash
bun install
cp .env.example .env   # fill AGENT_PRIVATE_KEY, MERCHANT_ADDRESS (ANTHROPIC_API_KEY optional)
# fund the agent address with testnet USDC: https://faucet.circle.com (Arc Testnet)
bun run start          # http://localhost:4021
bun test
```

## Code map

| Path | Role |
|---|---|
| `src/server.ts` | Bun server: catalog, x402-paywalled feeds, SSE, agent run/approve endpoints |
| `src/x402.ts` | Payment requirements, proof decoding, on-chain settlement verification |
| `src/credits/blind.ts` | RSA-FDH blind signatures (blind, sign, unblind, verify) |
| `src/credits/mint.ts` | Credit issuance against an Arc deposit, redemption, double-spend set |
| `src/agent/credit-wallet.ts` | Agent side: blind, buy, unblind, verify, spend |
| `src/signals.ts` | Edge model, ladder arbitrage, snapshot |
| `src/gemini.ts` | Gemini Prediction Markets + klines client |
| `src/agent/agent.ts` | Decision loop |
| `src/agent/policy.ts` | Spend guardrails |
| `src/agent/pay-client.ts` | x402 client paying USDC on Arc |
| `public/` | Dashboard |

## What's next

- Stealth-address deposits and relayed redemption for full payer privacy.
- Settle through Circle Nanopayments / Gateway for batched, gasless sub-cent payments.
- Let the agent place real Gemini orders behind the same approval policy.
- Publish the feeds to an agent marketplace so third-party agents can buy them.

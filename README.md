# Odds Desk

**What if your competitor could read your trading agent's shopping list?** Today they can: every x402 payment an agent makes is public, so the feeds it buys, how often and when are all on-chain. Odds Desk is an AI trading-research agent that buys prediction-market signals per request for fractions of a cent, and pays **privately**.

- **Main track:** Agentic Payments and AI
- **Chain award:** Best use of Arc
- **Bounty:** Gemini Prediction Markets

## Problem

- **Who:** autonomous agents that pay for data per call (trading, research, monitoring).
- **How bad:** a paying agent's address is a live feed of its strategy. Prices identify the feed, timestamps give the cadence, and anyone can front-run the trade the data was bought for.
- **Why unsolved:** x402 settles every payment in the clear, and on-chain privacy tools (mixers, shielded pools) are too slow and too heavy for $0.001 calls.
- **Why now:** Circle Gateway Nanopayments (gasless, batched, live on Arc) make sub-cent payments practical, and x402 v2 lets anyone plug in a new payment scheme.

## Solution

**Odds Desk adds Chaumian e-cash to x402.** The agent buys a batch of blind-signed credits with one Circle Gateway nanopayment, then pays every request with a credit the seller can verify but can never link to the buyer.

```
                 1 gasless nanopayment ($0.01 for 5 credits)
  Agent  ────────────────────────────────────────────►  Odds Desk  ──►  Circle Gateway (Arc)
  blinds serials, unblinds signatures                   mint signs blind values only
     │
     │  each request: x402 "blind-credit" payment (serial, signature)
     └───────────────────────────────────────────────►  verifies signature + unspent
                                                         payer = "anonymous", no wallet, no tx
```

**Core insight:** settlement and authorization do not have to be the same event. Money moves once, publicly and cheaply, through Gateway. Access is proven many times, privately, with a signature the seller issued but cannot recognize.

### What it is built on (and what we added)

| Layer | What we used | Version |
|---|---|---|
| Settlement | Circle Gateway Nanopayments on Arc testnet: `GatewayClient`, `GatewayEvmScheme`, `BatchFacilitatorClient` | `@circle-fin/x402-batching` 4.0.0 |
| Seller | Stock x402 resource server with two schemes and two facilitators | `@x402/core`, `@x402/hono` 2.31 |
| Guardrails | x402 client lifecycle hook `onBeforePaymentCreation` + `spendControls` | 2.31 |
| **Added** | **`blind-credit`**, a new x402 scheme implementing the official `SchemeNetworkClient`, `SchemeNetworkServer` and `FacilitatorClient` interfaces. Spec: [`specs/scheme_blind_credit.md`](specs/scheme_blind_credit.md) | this repo |
| Data | Gemini Prediction Markets events + Lukka settlement-index klines | public API |

## What the agent does

1. **Fund**: tops up its Circle Gateway balance on Arc if it is under $0.05 (the only on-chain transaction).
2. **Discover**: reads the free `/catalog` of paid feeds.
3. **Plan**: picks feeds for its goal (Claude when `ANTHROPIC_API_KEY` is set, otherwise a heuristic that wants everything, so the guardrails have to work).
4. **Guard and pay**: every payment passes the policy hook. In private mode it buys one credit batch, then pays each feed with a credit.
5. **Decide**: ladder arbitrage if any, else the contract with the largest edge between its volatility model and the Gemini book, with a paper stake of min(10% of $100, $100 × edge). It never places real orders.
6. **Brief**: shows and reads aloud a 3-sentence call.

### Paid feeds

| Feed | Gateway price | Private price | What it computes |
|---|---|---|---|
| `snapshot` | $0.001 | 1 credit | Bid/ask of every open Gemini prediction market |
| `arb` | $0.002 | 1 credit | Strike-ladder arbitrage: a higher strike bid above a lower strike ask is a locked profit |
| `edge` | $0.005 | 1 credit | Fair value of each crypto contract from a lognormal model on 2h realized volatility of the exact Lukka index Gemini settles on, versus the Gemini book |
| `whale` | $0.50 | 1 credit | Listed under an unvetted origin to show the guardrails refusing it |

One credit buys any feed, so a credit payment does not reveal which feed was bought.

### Safety limits

| Guardrail | Value | Enforced by |
|---|---|---|
| Origin allowlist | Odds Desk only | `onBeforePaymentCreation` hook (aborts inside the SDK) and a pre-spend check for credits |
| Per-call cap | $0.01 | hook |
| Session budget | $0.05 | hook |
| Human approval | above $0.004 | hook waits for Approve / Reject on the dashboard, rejects after 60 s |
| Asset caps | credit asset only, 1 per payment | x402 `spendControls` |
| Double spend | spent-serial set | `BlindCreditFacilitator` |

## Privacy properties

| Property | Why it holds |
|---|---|
| Unlinkable | The mint only ever sees `b = FDH(serial) · r^e mod n`, uniformly random to it; at redemption it sees `(serial, s)` for the first time |
| Unforgeable | Producing `s` for a new serial needs the mint's RSA key (RSA-FDH, 2048-bit) |
| Feed-hiding | Every feed costs exactly one credit |
| Not a mixer | Money still settles through Circle Gateway; only access is private |

**Limits, stated plainly:** the batch purchase is linkable to the buyer, network metadata (IP, timing) is out of scope, and the mint key lives in memory.

## Backtest

Does the signal the agent pays for hold up? `bun backtest/calibration.ts` replays the model on every Gemini crypto strike ladder settled in the last 24h (84 events, 736 contracts), pricing each contract 60 minutes before expiry from Lukka settlement-index klines only, and scores it against the real resolution.

| Forecaster | Brier, all (n=736) | Brier, contested 10–90% (n=222) |
|---|---|---|
| Odds Desk volatility model | **0.112** | **0.217** |
| Naive: spot already past the strike | 0.152 | 0.342 |
| Coin flip | 0.250 | 0.250 |

Calibration (model says → realized): 0–20% → 3% vs 3%, 20–40% → 30% vs 27%, 40–60% → 49% vs 42%, 60–80% → 70% vs 60%, 80–100% → 97% vs 87%. The model is overconfident at the top (fat tails a 2h realized volatility misses), which is why the agent only acts on edges of 5 points or more and sizes small.

Gemini publishes no historical contract prices, so P&L against the book cannot be backtested from the API. `backtest/snapshot.ts` records live signals with their bid/ask and `backtest/settle.ts` scores them once the contracts resolve (forward paper test).

## Scale

Redeeming a credit costs **0.063 ms** (one RSA verification with e = 65537, measured on an M-series laptop core): about **16,000 private paid requests per second per core**, with no chain in the loop. Settlement load is one Gateway nanopayment per batch, which Circle settles in batches across all buyers.

## Arc details

| Item | Value |
|---|---|
| Network | Arc testnet, `eip155:5042002` |
| USDC | `0x3600000000000000000000000000000000000000` |
| Circle Gateway Wallet | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Gateway facilitator (testnet) | `https://gateway-api-testnet.circle.com` |
| Agent | `0xa3dAa7D967629cc4a4B99c3Cc12fB3C2d7D20e05` |
| Merchant | `0xc1232D14AE5f79922a5B7b4384023fAA89B074Fa` |
| Gateway deposit | [0xf02658cd…](https://testnet.arcscan.app/tx/0xf02658cd5718fe230e468e9f7bcd179359f2cdec8efeee678f67b1fc5d024d22) |

No custom contract is deployed. Arc uses USDC as gas, so the agent holds a single asset and every price is in cents.

## Gemini Prediction Markets usage

- `GET /v1/prediction-markets/events?status=active&category=Crypto`: events, contracts, strikes, expiries, `bestBid` / `bestAsk`.
- `GET /v2/klines?agency=lukka&index=…`: the settlement index of each contract, for spot and realized volatility.

## SDK friction we hit

- `BatchFacilitatorClient` defaults to the mainnet Gateway API. On Arc testnet the x402 server refuses to start (`Facilitator does not support scheme "exact" on network "eip155:5042002"`) until it is pointed at `https://gateway-api-testnet.circle.com`.
- `@circle-fin/x402-batching` 4.0 ships its own x402 types, which are not assignable to `@x402/core` 2.31's `FacilitatorClient`, so wiring it into `x402ResourceServer` needs a cast.
- Gemini lists 5-minute up/down markets first; a client reading only the first page sees no strike ladders.

## Run it

```bash
bun install
cp .env.example .env   # AGENT_PRIVATE_KEY, MERCHANT_ADDRESS, optional ANTHROPIC_API_KEY
# fund the agent with Arc testnet USDC: https://faucet.circle.com
bun run start          # http://localhost:4021
bun test
```

## Code map

| Path | Role |
|---|---|
| `src/credits/scheme.ts` | `blind-credit` x402 scheme: client, server, facilitator |
| `src/credits/blind.ts`, `src/credits/mint.ts` | RSA-FDH blind signatures, batch signing, spent set |
| `src/paywall.ts` | x402 resource server: Gateway + blind-credit, feed and issuance routes |
| `src/agent/gateway-payer.ts` | Circle `GatewayClient` with the policy hook |
| `src/agent/credit-wallet.ts` | Blind, buy, unblind, spend via `x402Client` |
| `src/agent/agent.ts`, `src/agent/policy.ts` | Decision loop and guardrails |
| `src/signals.ts`, `src/gemini.ts` | Gemini data and quant signals |
| `src/server.ts`, `public/` | Bun server, SSE, dashboard |
| `backtest/` | Calibration backtest and forward paper test |

## Next

We want to **upstream `blind-credit` into x402** as a mechanism package, and are looking for a **Circle Gateway design partner** to let sellers issue credits directly from Gateway balances, so the batch purchase itself stops being linkable.

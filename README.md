# Odds Desk

An AI research agent that **buys prediction-market intelligence per request** with **x402 + Circle Gateway Nanopayments on Arc** (gasless, sub-cent USDC), under spend guardrails enforced as native x402 hooks, and **privately**, through a new x402 payment scheme we added: **`blind-credit`** (Chaum blind signatures).

- **Main track:** Agentic Payments and AI
- **Chain award:** Best use of Arc
- **Bounty:** Gemini Prediction Markets

## The problem

1. **Agents paying for data leak their strategy.** A trading agent that pays per request in the clear tells anyone watching its address which vendor, which feed (prices are unique) and when. That is front-runnable alpha.
2. **Per-request on-chain payments don't scale** to $0.001 calls, and an agent with an unconstrained key is not something a human will fund.

## What we built

- **Seller**: a Gemini prediction-market signal API, monetized with the stock x402 resource server (`@x402/hono`) and Circle's Gateway scheme (`GatewayEvmScheme` + `BatchFacilitatorClient`, `@circle-fin/x402-batching` 4.0). Every feed also accepts our `blind-credit` scheme, registered on the same `x402ResourceServer`.
- **Buyer agent**: plans, pays and decides. Public payments go through Circle's `GatewayClient` (one on-chain deposit, then signed off-chain nanopayments settled in batches by Circle). Guardrails run inside the SDK as an `onBeforePaymentCreation` lifecycle hook. Private payments go through the stock `x402Client` + `wrapFetchWithPayment` with our `BlindCreditClientScheme` and x402 `spendControls`.
- **SDK extension**: `blind-credit`, a new x402 scheme implementing the official `SchemeNetworkClient`, `SchemeNetworkServer` and `FacilitatorClient` interfaces from `@x402/core`, with a spec in [`specs/scheme_blind_credit.md`](specs/scheme_blind_credit.md) following the x402 scheme template.

## Latest stack features used

| Feature | Package / version | Where |
|---|---|---|
| Circle Gateway Nanopayments on Arc testnet (gasless, batched) | `@circle-fin/x402-batching` 4.0.0 | all public payments, credit batch purchase |
| x402 client lifecycle hooks | `GatewayClient.onBeforePaymentCreation` | `src/agent/gateway-payer.ts`: allowlist, cap, budget, human approval |
| x402 `spendControls` (per-asset caps) | `@x402/core` 2.31 | `src/agent/credit-wallet.ts` |
| Pluggable schemes, multi-facilitator resource server | `@x402/core` 2.31, `@x402/hono` | `src/paywall.ts`: Gateway + blind-credit on one server |
| Server settle hooks | `x402ResourceServer.onAfterSettle` | `src/paywall.ts`: live merchant feed |

## How it works

```
Agent (buyer)                                Odds Desk (seller, @x402/hono)            Circle / Arc
 GatewayClient.deposit(0.5 USDC) ───────────────────────────────────────────────────► Gateway Wallet (1 on-chain tx)

 PUBLIC MODE
 GatewayClient.pay(feed) ─ GET ─────────────► 402 accepts [exact/Gateway, blind-credit]
  onBeforePaymentCreation: policy ─ deny / human approval / allow
  sign EIP-3009 authorization off-chain ─────► BatchFacilitatorClient.verify/settle ──► batched settlement
                               ◄──────────── signal data

 PRIVATE MODE
 blind serials b_1..b_5 ─ POST /credits/issue (paid $0.01 via Gateway, same hook) ─► mint signs b_i blind
 unblind + verify s_i
 x402Client(BlindCreditClientScheme) ─ GET ─► BlindCreditFacilitator: s^e == FDH(serial), unspent
                               ◄──────────── signal data, payer = "anonymous", no signature from the wallet
```

### Paid feeds

| Feed | Gateway price | Credit price | What it computes |
|---|---|---|---|
| `snapshot` | $0.001 | 1 credit | Bid/ask of every open Gemini prediction market contract |
| `arb` | $0.002 | 1 credit | Strike-ladder arbitrage: a higher strike whose bid exceeds a lower strike's ask is a locked profit |
| `edge` | $0.005 | 1 credit | Fair value of each crypto contract from a lognormal model fed by realized 1-minute volatility of the exact Lukka index Gemini settles against, compared with the Gemini book, ranked by tradable edge |
| `whale` | $0.50 | 1 credit | Listed under an unvetted origin so the guardrails can be seen refusing it |

### Privacy: the `blind-credit` scheme

The agent buys 5 credits for $0.01 in one Gateway nanopayment. Before paying it draws 5 random serials and blinds them (`b = FDH(serial) · r^e mod n`); the mint signs `b` without seeing the serial. Every later request pays with `(serial, s)`. The seller can check `s^e == FDH(serial)` and that the serial is unspent, but cannot link the request to the purchase, to the wallet, or to the other requests. One credit per request regardless of the feed, so the payment does not reveal what was bought. Full spec, properties and limits: [`specs/scheme_blind_credit.md`](specs/scheme_blind_credit.md).

Honest limits: the batch purchase is still linkable to the buyer, network metadata (IP, timing) is out of scope, and the mint key is in memory.

### The agent's decision loop

1. **Fund**: top up the Circle Gateway balance if it is below $0.05 (one on-chain deposit).
2. **Discover**: fetch the free `/catalog`.
3. **Plan**: choose feeds. Claude when `ANTHROPIC_API_KEY` is set, otherwise a heuristic that wants everything, so the guardrails have to do their job.
4. **Guard + pay**: public mode pays each feed through `GatewayClient.pay`, the policy hook can abort or wait for a human. Private mode checks each target against the same policy, buys one credit batch (through the same hook), then spends credits.
5. **Decide**: ladder arbitrage if any, else the highest-edge contract with paper stake min(10% of $100, $100 × edge), else hold. No real Gemini orders are placed.
6. **Brief**: a short briefing shown and read aloud on the dashboard.

Every step streams to the dashboard (SSE).

### Safety limits (`src/config.ts`, `src/agent/policy.ts`)

| Guardrail | Value | Enforced by |
|---|---|---|
| Origin allowlist | Odds Desk origin only | `onBeforePaymentCreation` hook (aborts payment creation) and pre-spend check for credits |
| Per-call cap | $0.01 | hook |
| Session budget | $0.05 | hook |
| Human approval | above $0.004 | hook waits for Approve / Reject on the dashboard, auto-reject after 60 s |
| Asset caps | credit asset only, 1 per payment | x402 `spendControls` |
| Double spend | spent-serial set | `BlindCreditFacilitator.verify/settle` |

## How it uses Arc

Arc is Circle's stablecoin L1 where USDC is the gas token, and Circle Gateway is live on Arc testnet: the agent deposits USDC once on Arc, then pays sub-cent amounts without gas, settled in batches by Circle. One asset, prices in cents, no volatile gas token.

| Item | Value |
|---|---|
| Network | Arc testnet, `eip155:5042002` |
| USDC | `0x3600000000000000000000000000000000000000` |
| Circle Gateway Wallet (Arc testnet) | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Gateway facilitator | `https://gateway-api-testnet.circle.com` |
| Agent (buyer) | `0xa3dAa7D967629cc4a4B99c3Cc12fB3C2d7D20e05` |
| Merchant (payTo) | `0xc1232D14AE5f79922a5B7b4384023fAA89B074Fa` |

Gateway deposit on Arc testnet: [0xf02658cd…](https://testnet.arcscan.app/tx/0xf02658cd5718fe230e468e9f7bcd179359f2cdec8efeee678f67b1fc5d024d22). No custom contract is deployed.

## How it uses Gemini Prediction Markets

- `GET /v1/prediction-markets/events?status=active&category=Crypto`: events, contracts, strikes, expiries, `bestBid` / `bestAsk`.
- `GET /v2/klines?agency=lukka&index=…`: the settlement index of each contract (`contract.source`), for spot and realized volatility.

## SDK friction we hit (and worked around)

- `BatchFacilitatorClient` defaults to the mainnet Gateway API; on Arc testnet it must be pointed at `https://gateway-api-testnet.circle.com`, otherwise the x402 server refuses to start (`Facilitator does not support scheme "exact" on network "eip155:5042002"`).
- `@circle-fin/x402-batching` 4.0 ships its own copies of the x402 types, which are not assignable to `@x402/core` 2.31's `FacilitatorClient`, so wiring it into `x402ResourceServer` needs a cast.

## Run it

```bash
bun install
cp .env.example .env   # AGENT_PRIVATE_KEY, MERCHANT_ADDRESS (ANTHROPIC_API_KEY optional)
# fund the agent with Arc testnet USDC: https://faucet.circle.com
bun run start          # http://localhost:4021
bun test
```

## Code map

| Path | Role |
|---|---|
| `src/paywall.ts` | x402 resource server: Circle Gateway scheme + blind-credit scheme, feed and credit-issuance routes |
| `src/credits/scheme.ts` | `blind-credit` x402 scheme: client, server, facilitator |
| `src/credits/blind.ts` | RSA-FDH blind signatures |
| `src/credits/mint.ts` | Batch signing, redemption, spent set |
| `src/agent/gateway-payer.ts` | Circle `GatewayClient` with the policy hook |
| `src/agent/credit-wallet.ts` | Blind, buy, unblind, spend with `x402Client` |
| `src/agent/agent.ts` | Decision loop |
| `src/agent/policy.ts` | Guardrails |
| `src/signals.ts`, `src/gemini.ts` | Gemini data and quant signals |
| `src/server.ts` | Bun server, SSE, dashboard |
| `specs/scheme_blind_credit.md` | Scheme spec |

## What's next

- Upstream `blind-credit` to the x402 repo (spec + TS mechanism package), with persistent mint keys and epochs.
- Deposit into Gateway from a fresh address per batch so the purchase is not linkable either.
- Let the agent place real Gemini orders behind the same approval hook.

# Odds Desk

An AI research agent that **buys prediction-market intelligence per request**, paying in **USDC on Arc** through an **x402** paywall, under hard spending guardrails, then briefs you **by voice with ElevenLabs**.

- **Main track:** Agentic Payments and AI
- **Chain award:** Best use of Arc
- **Bounties:** Gemini Prediction Markets, ElevenLabs

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
   └ briefing text → ElevenLabs TTS → dashboard audio
```

### Paid feeds (sold by the Odds Desk API)

| Feed | Price | What it computes |
|---|---|---|
| `snapshot` | $0.01 | Bid/ask of every open Gemini prediction market contract |
| `arb` | $0.02 | Strike-ladder arbitrage: on "above K" ladders, flags any higher strike whose bid exceeds a lower strike's ask (a locked profit) |
| `edge` | $0.05 | Fair value of each crypto contract from a lognormal model fed by realized 1-minute volatility of the Lukka index Gemini settles against (`/v2/klines`), compared with the Gemini book. Ranked by tradable edge (model minus ask for YES, bid minus model for NO) |

The catalog also lists an unvetted third-party feed (`whale-alpha`, $0.50) so the guardrails can be seen rejecting it.

### The agent's decision loop

1. **Discover**: fetch the free `/catalog`.
2. **Plan**: choose feeds for the goal. Uses Claude when `ANTHROPIC_API_KEY` is set, otherwise a heuristic (wants everything, so the policy has to do its job).
3. **Guard**: each purchase goes through `policy.evaluate()` (see below).
4. **Pay**: on HTTP 402, pay the exact `maxAmountRequired` in USDC on Arc, wait for the receipt, retry with the `X-PAYMENT` proof.
5. **Decide**: a ladder arbitrage wins if any. Otherwise take the highest-edge contract, paper stake = min(10% of a $100 bankroll, bankroll × edge). Otherwise hold. Odds Desk never places real Gemini orders.
6. **Brief**: a short spoken briefing (LLM or template) voiced by ElevenLabs and played on the dashboard.

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

## How it uses Gemini Prediction Markets

- `GET /v1/prediction-markets/events?status=active&category=Crypto` for events, contracts, strikes, expiries and `bestBid`/`bestAsk`.
- `GET /v2/klines?agency=lukka&index=…` for the exact settlement index (`contract.source`), used for spot and realized volatility.

Market data only; no trading keys required.

## How it uses ElevenLabs

Text-to-Speech API (`/v1/text-to-speech/{voice_id}`, model `eleven_flash_v2_5`) voices the agent's final briefing, so the desk "speaks" its call and what it spent. The audio plays automatically when the run ends.

## Run it

```bash
bun install
cp .env.example .env   # fill AGENT_PRIVATE_KEY, MERCHANT_ADDRESS, ELEVENLABS_API_KEY (ANTHROPIC_API_KEY optional)
# fund the agent address with testnet USDC: https://faucet.circle.com (Arc Testnet)
bun run start          # http://localhost:4021
bun test
```

## Code map

| Path | Role |
|---|---|
| `src/server.ts` | Bun server: catalog, x402-paywalled feeds, SSE, agent run/approve endpoints |
| `src/x402.ts` | Payment requirements, proof decoding, on-chain settlement verification |
| `src/signals.ts` | Edge model, ladder arbitrage, snapshot |
| `src/gemini.ts` | Gemini Prediction Markets + klines client |
| `src/agent/agent.ts` | Decision loop |
| `src/agent/policy.ts` | Spend guardrails |
| `src/agent/pay-client.ts` | x402 client paying USDC on Arc |
| `src/voice.ts` | ElevenLabs TTS |
| `public/` | Dashboard |

## What's next

- Settle through Circle Nanopayments / Gateway for batched, gasless sub-cent payments.
- Let the agent place real Gemini orders behind the same approval policy.
- Publish the feeds to an agent marketplace so third-party agents can buy them.

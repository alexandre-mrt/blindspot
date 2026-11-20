# Pitch and demo script (3 minutes)

One flow, shown well: **private mode**. The wow moment is the merchant log line `payer = anonymous` right after a gasless Circle Gateway payment.

## Before you record

- `bun run start`, open http://localhost:4021, run once (warms the Gemini cache and the Gateway balance).
- Check the Gateway balance tile shows ≥ $0.05; if not, the first run deposits (one Arc tx, ~10 s).
- Private mode **checked**. Browser zoom 125%. Close other tabs.
- Second tab: the GitHub repo on `specs/scheme_blind_credit.md`. Third tab: the backtest slide.
- Record a backup take before the live pitch.

## Script

| Time | Beat | On screen | Say |
|---|---|---|---|
| 0:00 | **Hook** | Dashboard, idle | “What if your competitor could read your trading agent’s shopping list? With x402 today, they can: every payment is public.” |
| 0:15 | **Problem** | Same | “An agent that pays per request leaks which feed it bought, how often, and when. That’s front-runnable alpha. Mixers are too slow for a $0.001 call, so nobody solves it.” |
| 0:45 | **Solution** | Point at the header | “Odds Desk adds Chaumian e-cash to x402. The agent buys credits once with a gasless Circle Gateway nanopayment on Arc, then pays every request with a blind-signed credit the seller can verify but never link back.” |
| 1:15 | **Demo 1: guardrails** | Click **Run agent** | “It discovers four paid Gemini feeds. The whale feed is on an unvetted origin: our policy runs inside the x402 SDK hook and aborts it before anything is signed.” |
| 1:30 | **Demo 2: human in the loop** | Approval card appears, click **Approve** | “Buying credits costs a cent, above the auto-approve limit, so it asks me.” |
| 1:40 | **Demo 3: the wow** | Log: `credits_blinded`, `mint_signed`, `merchant_redeemed … payer = anonymous`; counters Gasless 1 / Blind 3 | “It blinds five serials, the mint signs without seeing them, and now three paid requests: zero transactions, and the seller only knows ‘anonymous’.” |
| 2:05 | **Demo 4: the call** | Briefing panel, voice plays | “And the agent makes its call from the model.” Let the briefing play. |
| 2:15 | **Proof** | Backtest slide | “On 736 settled Gemini contracts the model beats the naive read by 26%, and we show where it’s overconfident.” |
| 2:30 | **Scale** | Spec tab on GitHub | “Redeeming a credit is one RSA check: 0.06 ms, about 16,000 private paid requests per second per core, no chain in the loop. It’s a real x402 scheme, written against the official interfaces, with a spec.” |
| 2:45 | **Ask** | Same | “We want to upstream blind-credit into x402, and we’re looking for a Circle Gateway design partner so the credit purchase itself becomes private.” |

## Slide outline (if a deck is required)

1. Title + hook question
2. Problem: who, how bad, why unsolved, why now (Gateway on Arc, x402 v2 schemes)
3. Solution: one sentence + the 4-box diagram from the README
4. Live demo
5. Backtest (done)
6. Scale: 0.06 ms per redemption, one Gateway payment per batch
7. Ask: upstream to x402, Gateway design partner

## Submission checklist

- [ ] Devpost: track Agentic Payments, chain award Arc, bounty Gemini Prediction Markets
- [ ] GitHub link (public) with README
- [ ] Demo video 2–3 min (YouTube unlisted or Drive, link sharing on)
- [ ] Backtest slide (export PDF from the deck)
- [ ] Written answers: copy Problem / Solution / Next from the README

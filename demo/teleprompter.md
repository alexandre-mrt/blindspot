What if your competitor could read your trading agent's shopping list?
[PAUSE]
With x402 today, they can.
---
Every x402 payment is public. Three things make that a real problem.
---
Who: agents that pay per call. Trading, research, monitoring, buying data for fractions of a cent.
---
How bad: the wallet leaks the strategy. Which feed, how often, when. Anyone can front-run the trade the data was bought for.
---
Why now: Circle Gateway just made sub-cent payments real on Arc. Mixers can't work at a tenth of a cent, so privacy has to be just as cheap.
---
So we built Odds Desk: Chaumian e-cash for x402.
Step one happens once, in public: the agent buys five credits with one gasless Circle Gateway nanopayment on Arc. One cent.
---
Step two: before paying, the agent blinds five random serials. Our mint signs them without ever seeing them.
---
Step three: every request after that is paid with a credit. It's a new x402 scheme we wrote. No wallet signature, no transaction.
---
Step four: the seller checks the signature and that the credit is unspent. It knows the request is paid. It does not know who paid.
Money moves once, publicly. Access is proven many times, privately.
---
Let me show you. Three things to watch: denied, approved, and payer anonymous.
[DEMO: switch to the Odds Desk dashboard]
Private mode is on. [CLICK: Run agent]
The agent finds four paid Gemini feeds. The whale feed sits on an unvetted origin, so our policy, running inside the x402 hook, refuses it before anything is signed.
[PAUSE: wait for the approval card]
The credit batch costs one cent, above my auto-approve limit, so it asks me. [CLICK: Approve]
Gasless nanopayment through Circle Gateway. The mint signs blind. And now three paid requests: zero transactions, and the seller only sees: anonymous.
[PAUSE: wait for the agent call]
And the agent makes its call.
[DEMO: switch back to the slides]
---
Is the signal worth paying for? On seven hundred thirty six settled Gemini contracts, our model beats the naive read by twenty six percent. And we show where it is overconfident.
---
What we built on: Circle Gateway nanopayments, the x402 v2 server and client with lifecycle hooks and spend controls, the Gemini prediction markets API, all on Arc testnet with USDC as gas. Plus one piece we added: the blind-credit scheme.
---
And it scales: verifying a credit takes six hundredths of a millisecond. About sixteen thousand private paid requests per second, per core, with no chain in the loop.
---
The model: data sellers pay the mint per redeemed credit. Agents pay the same price and stay private. And every batch is more Gateway volume on Arc.
---
Our ask: help us upstream blind-credit into x402. And we're looking for a Circle Gateway design partner to make the credit purchase itself private.
The code is open: github, alexandre-mrt, odds-desk.

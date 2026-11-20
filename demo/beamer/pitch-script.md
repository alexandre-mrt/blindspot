Your trading agent's wallet is its strategy.
Odds Desk lets an AI agent pay for data on Arc without telling anyone what it bought.
---
Today, with x402, every call an agent pays for is public. Which feed, how often, and what it did right after.
Anyone can copy that, or trade before it.
---
So here is what we built. The agent makes one payment of one cent through Circle Gateway, gasless, on Arc. That buys five credits.
---
Each credit pays for one call to the seller.
---
The seller knows the call is paid. It has no way to tell who paid, and every feed costs one credit, so it can't tell what you're after either.
And the agent's spending limits, and my approval, run inside the x402 client.
---
Let's see it live, on Arc testnet with live Gemini markets. [CLICK: Run agent]
The unvetted feed gets blocked before anything is signed. [PAUSE: approval card]
The credits cost more than my auto-approve limit, so it asks me. [CLICK: Approve]
One Gateway payment, three paid calls, and the seller only sees: anonymous. [PAUSE: the agent's call]
---
For the agent, the seller learns nothing but a valid credit, nothing shows up per call, and there's no gas.
---
And the data is worth buying. On 736 Gemini contracts that settled today, our model beat simply reading the spot price. It's overconfident when it's very sure, and we say so.
---
Built on Circle Gateway nanopayments, x402 version 2, Arc with USDC as gas, and the Gemini prediction markets API. The blind-credit scheme is ours.
---
Next, we want blind-credit in x402 itself, and a Circle Gateway design partner to make the credit purchase private too.
The code is on GitHub.

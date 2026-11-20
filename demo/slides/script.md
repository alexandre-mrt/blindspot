Quick show of hands in your head: who remembers Théo, the French whale on Polymarket?
He bet a fortune on Trump in 2024, and half of crypto Twitter spent the election refreshing his wallet. He ended up splitting his bets across several accounts just to get some privacy.
Now give that same problem to an AI agent. It can't open four accounts. It has one wallet, and it pays for every API call in public.
---
Here's what that looks like. Our agent buys data, one call at a time, a fraction of a cent each.
Anyone watching can see what it reads and when. Then they see it trade a few seconds later. You don't need to be smart to copy that, you just need to be fast.
---
So we built Blindspot. The agent pays once, one cent, through Circle Gateway on Arc. No gas. That gets it five credits.
---
Then it spends those credits, one per call.
---
And the seller? It knows it got paid. That's all it knows. Not which wallet, not which feed, because every feed costs the same one credit.
Basically, we gave the agent Théo's four accounts, without the hassle.
---
Let me show you, live on Arc testnet. [CLICK: Run agent]
First thing, the shady feed gets blocked. The agent never even signs that payment. [PAUSE: approval card]
The credits cost more than I let it spend alone, so it asks me. [CLICK: Approve]
One payment through Gateway, then three calls with credits. On the seller side, the payer is just: anonymous. [PAUSE: the agent's call]
And it comes back with its pick.
---
So for the agent, nothing changes on price. What changes is that nobody can watch it shop anymore.
---
And this isn't a niche. Agents already made hundreds of millions of these payments, and the big forecasts talk about trillions by 2030.
Right now, every single one of them is public. Sellers pay us a small fee per credit to fix that.
---
Quick sanity check that the data is worth buying: we tested our model on the Gemini markets that settled today, and it beat just reading the price chart. Not magic, just better.
---
All of this runs on Circle Gateway, x402, Arc and Gemini's prediction market API. The one piece we added is the credit scheme itself.
---
What we want next: get blind-credit into x402 itself, and work with Circle so agents can buy credits straight from their Gateway balance.
Théo needed four accounts. Your agent just needs Blindspot.

Hi, and thanks for taking a few minutes to watch this. I'll keep it quick and to the point.
Let's start with a story we've all lived.
Everyone has a spot like this. A quiet beach, a little restaurant, a cheap flight trick. You tell one friend. Next summer, the beach is packed.
A good tip is only worth something while nobody else knows it.
Now let's apply that logic to the current state of AI agents. They pay for data on their own, one request at a time, and they can't keep anything to themselves: every payment they make is public.
---
Here's what that looks like. Our agent buys market data, one call at a time, a fraction of a cent each.
Anyone can see what it reads and when, and then watch it trade a few seconds later. Copying it doesn't take skill, just speed.
---
So we built Blindspot. The agent pays once, one cent, through Circle Gateway on Arc. No gas. That gets it five credits.
---
Then it spends those credits, one per call.
---
And the seller? It knows it got paid. That's all it knows. Not which wallet, not which feed, because every feed costs the same one credit.
The agent keeps its good spots to itself.
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
So the next time your agent finds a quiet beach, it stays quiet. That's Blindspot.
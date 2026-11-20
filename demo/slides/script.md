Hi, and thanks for taking a few minutes to watch this. I'll keep it quick and to the point.
Let's start with a story we've all lived. You find a great spot: a quiet beach, a little restaurant. You tell one friend. Next summer, the beach is packed.
A good tip is only worth something while nobody else knows it.
AI agents live this every day. They pay for their data in public, so anyone can see their good spots.
Blindspot fixes that. Agents keep paying per request, but nobody can see what they buy. Let me show you the problem, then how we solve it.
---
Here is the problem. Our agent buys market data, one call at a time, a fraction of a cent each.
Every one of those payments is public. Anyone can see what it reads, how often, and then watch it trade a few seconds later. Copying it doesn't take skill, just speed.
---
So how do we fix it? First, the agent pays once, one cent, through Circle Gateway on Arc. No gas. That buys it five credits.
---
Then, every time it needs data, it pays with one of those credits instead of its wallet.
---
And here's the key part. The seller knows the request is paid, and that's all it knows. Not which wallet, not which feed, since every feed costs the same one credit.
The agent keeps its good spots to itself.
---
Let me show you, live on Arc testnet. [CLICK: Run agent]
First, a shady feed gets blocked. The agent never even signs that payment. [PAUSE: approval card]
The credits cost more than I let it spend alone, so it asks me. [CLICK: Approve]
One payment through Gateway, then three calls paid with credits. On the seller side, the payer is just: anonymous. [PAUSE: the agent's call]
And it comes back with its pick.
---
So what changes for the agent? Not the price. What changes is that nobody can watch it shop anymore.
---
And this matters at scale. Agents have already made hundreds of millions of these payments, and the forecasts talk about trillions by 2030.
Today, every single one of them is public. Sellers pay us a small fee per credit to change that.
---
Of course, privacy only matters if the data is worth buying. We tested our model on the Gemini markets that settled today, and it beat just reading the price chart.
---
Under the hood: Circle Gateway, x402, Arc and Gemini's prediction market API. The piece we added is the credit scheme itself.
---
Next, we want blind-credit in x402 itself, and to work with Circle so agents can buy credits straight from their Gateway balance.
So the next time your agent finds a quiet beach, it stays quiet. That's Blindspot. Thank you.

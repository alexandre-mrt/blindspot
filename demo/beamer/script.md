Hi, I'm Alexandre from EPFL. This is Odds Desk, a way for AI agents to pay per request without revealing who paid.
---
With x402, an agent pays for each API call with a stablecoin payment. Each of those payments shows who paid, who was paid, how much and when.
For an agent that buys market data, that history is its strategy.
---
So the question we worked on: can an agent keep paying per request, while the seller can no longer tell which agent made which request?
---
The setting. The agent buys data from a seller, who also runs a small mint. Payments settle through Circle Gateway on Arc. We assume the seller serves requests honestly but would like to link them to payers. Network metadata is out of scope.
---
Two building blocks. x402 itself: the server answers 402, the client sends a signed payment, a facilitator settles it. And Gateway nanopayments: one deposit on-chain, then off-chain authorizations that Circle settles in batches.
---
The third one is old: Chaum's blind signatures from 1983. The signer signs a blinded value. After unblinding, the agent holds a valid signature on a serial the signer never saw.
---
Issuance. The agent draws five serials, blinds them, and pays one cent through Gateway to have them signed. It unblinds and checks each signature.
---
Redemption. Every request is then paid with one serial and its signature, under a new x402 scheme we call blind-credit. The seller checks the signature and that the serial is unspent. We wrote it against the standard x402 client, server and facilitator interfaces.
---
What this gives. The seller cannot link a request to the purchase, credits cannot be forged, a credit can only be spent once, and every resource costs one credit, so the payment says nothing about what was bought.
The limits: the batch purchase itself is still linkable, and timing and IP are not hidden.
---
The agent also has a spending policy. It runs in the x402 hook that fires before a payment is created, so a refused payment is never signed: an origin allowlist, a cap per call, a session budget, and my approval above four tenths of a cent.
---
Here is a live run, on Arc testnet with live Gemini data. [CLICK: Run agent]
The unvetted feed is refused by the policy. [PAUSE: wait for the approval card]
The credit batch is above the approval limit, so it asks me. [CLICK: Approve]
One Gateway payment, then three requests paid with credits. The seller sees the payer as anonymous. [PAUSE: wait for the agent's call]
---
Is the data worth buying? We replayed the model on 736 Gemini contracts that settled in the last 24 hours. Its Brier score is 0.112, against 0.152 for simply reading the spot price. It is overconfident at the top, and we can only measure profit forward because Gemini does not publish contract price history.
---
On cost: checking a credit is one RSA verification, 0.063 milliseconds on a laptop core. Settlement is one Gateway payment per five credits.
---
The stack: Circle Gateway nanopayments with x402-batching 4.0, x402 version 2 for the client and server, Arc testnet with USDC as gas, and the Gemini prediction markets API. The blind-credit scheme is the part we added.
---
Next, we would like to propose blind-credit to the x402 specification, keep mint keys across restarts, and make the batch purchase unlinkable as well, for example with a fresh Gateway deposit per batch.
---
The references are on the slide, and the code is on GitHub. Thank you.

import { emit } from "../events";
import type { ArbSignal, EdgeSignal } from "../signals";
import { createCreditWallet } from "./credit-wallet";
import { createGatewayPayer } from "./gateway-payer";
import { complete } from "./llm";
import { defaultPolicy, evaluate } from "./policy";

export type CatalogItem = {
	id: string;
	url: string;
	priceUsd: number;
	description: string;
	provider: string;
};

const PAPER_BANKROLL_USD = 100;
const MAX_STAKE_FRACTION = 0.1;
const CREDIT_UNIT_USD = 0.002;

type Decision =
	| { kind: "hold" }
	| { kind: "arb"; arb: ArbSignal; stakeUsd: number }
	| { kind: "edge"; signal: EdgeSignal; stakeUsd: number };

async function plan(
	goal: string,
	catalog: CatalogItem[],
): Promise<Set<string>> {
	const listing = catalog
		.map((c) => `${c.id} | $${c.priceUsd} | ${c.provider} | ${c.description}`)
		.join("\n");
	const text = await complete(
		"You are a trading research agent. Choose which paid data feeds to buy. Reply with a JSON array of ids only.",
		`Goal: ${goal}\nCatalog:\n${listing}`,
	).catch(() => null);
	const ids = text
		? (JSON.parse(text.match(/\[.*\]/s)?.[0] ?? "[]") as string[])
		: catalog.map((c) => c.id);
	emit("plan", { goal, ids, planner: text ? "llm" : "heuristic" });
	return new Set(ids);
}

function decide(edges: EdgeSignal[], arbs: ArbSignal[]): Decision {
	const arb = arbs[0];
	if (arb)
		return {
			kind: "arb",
			arb,
			stakeUsd: PAPER_BANKROLL_USD * MAX_STAKE_FRACTION,
		};
	const best = edges[0];
	if (!best) return { kind: "hold" };
	const stakeUsd = Math.min(
		PAPER_BANKROLL_USD * MAX_STAKE_FRACTION,
		PAPER_BANKROLL_USD * best.edge,
	);
	return { kind: "edge", signal: best, stakeUsd: Number(stakeUsd.toFixed(2)) };
}

function templateBriefing(decision: Decision, spentUsd: number): string {
	const cost = `I spent ${(spentUsd * 100).toFixed(1)} cents of USDC on Arc for this research.`;
	if (decision.kind === "hold")
		return `No contract clears my edge threshold right now, so I am holding. ${cost}`;
	if (decision.kind === "arb") {
		const a = decision.arb;
		return `Ladder arbitrage on ${a.event}: buy above ${a.lowerStrike} at ${a.buyAsk}, sell above ${a.higherStrike} at ${a.sellBid}, locking ${(a.lockedProfit * 100).toFixed(0)} cents per contract. ${cost}`;
	}
	const s = decision.signal;
	const side = s.side === "BUY_YES" ? "yes" : "no";
	return `On ${s.event}, ${s.contract}: the market prices yes at ${(s.mid * 100).toFixed(0)} percent, my volatility model says ${(s.modelProb * 100).toFixed(0)} percent. I would buy ${side} with ${decision.stakeUsd} dollars of paper capital, an edge of ${(s.edge * 100).toFixed(0)} points. ${cost}`;
}

type Payer = ReturnType<typeof createGatewayPayer>;

const GATEWAY_MIN_USD = 0.05;
const GATEWAY_TOP_UP_USD = "0.5";

async function buyFeeds(payer: Payer, items: CatalogItem[]) {
	const bought: Record<string, unknown> = {};
	for (const item of items) {
		try {
			bought[item.id] = (await payer.pay<unknown>(item.url)).data;
		} catch (err) {
			emit("purchase_failed", { id: item.id, error: (err as Error).message });
		}
	}
	return bought;
}

async function buyFeedsPrivately(
	payer: Payer,
	items: CatalogItem[],
	origin: string,
) {
	const credits = createCreditWallet(origin);
	const eligible = items.filter((item) => {
		const decision = evaluate(defaultPolicy, item.url, CREDIT_UNIT_USD, 0);
		emit("policy", {
			resource: item.url,
			priceUsd: CREDIT_UNIT_USD,
			credit: true,
			...decision,
		});
		return decision.verdict !== "deny";
	});
	const bought: Record<string, unknown> = {};
	if (eligible.length === 0) return bought;
	await credits.buyBatch(payer);
	for (const item of eligible) {
		try {
			bought[item.id] = await credits.spend<unknown>(item.url);
		} catch (err) {
			emit("purchase_failed", { id: item.id, error: (err as Error).message });
		}
	}
	return bought;
}

export async function runAgent(opts: {
	privateKey: `0x${string}`;
	catalogUrl: string;
	goal: string;
	privateMode: boolean;
}) {
	const payer = createGatewayPayer(opts.privateKey, defaultPolicy);
	emit("start", {
		agent: payer.address,
		policy: defaultPolicy,
		privateMode: opts.privateMode,
	});
	await payer.ensureDeposit(GATEWAY_MIN_USD, GATEWAY_TOP_UP_USD);

	const catalog = (await (
		await fetch(opts.catalogUrl)
	).json()) as CatalogItem[];
	emit("catalog", { items: catalog });
	const chosenIds = await plan(opts.goal, catalog);
	const chosen = catalog.filter((c) => chosenIds.has(c.id));
	const bought = opts.privateMode
		? await buyFeedsPrivately(payer, chosen, new URL(opts.catalogUrl).origin)
		: await buyFeeds(payer, chosen);
	const spentUsd = payer.spent();

	const edges =
		(bought.edge as { signals?: EdgeSignal[] } | undefined)?.signals ?? [];
	const arbs =
		(bought.arb as { signals?: ArbSignal[] } | undefined)?.signals ?? [];
	const decision = decide(edges, arbs);
	emit("decision", { decision });

	const llmBriefing = await complete(
		"You are a calm trading desk voice. Write a 3 sentence spoken briefing, no markdown, no lists.",
		`Decision: ${JSON.stringify(decision)}. Research spend: $${spentUsd.toFixed(3)} USDC on Arc.`,
	).catch(() => null);
	const briefing = llmBriefing ?? templateBriefing(decision, spentUsd);
	emit("briefing", { text: briefing, spentUsd });
	emit("done", {});
}

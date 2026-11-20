import { txUrl } from "../chain";
import { emit } from "../events";
import type { ArbSignal, EdgeSignal } from "../signals";
import { requestApproval } from "./approvals";
import { createCreditWallet } from "./credit-wallet";
import { complete } from "./llm";
import { createPayer } from "./pay-client";
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

async function buyFeeds(
	payer: ReturnType<typeof createPayer>,
	items: CatalogItem[],
) {
	const bought: Record<string, unknown> = {};
	let spentUsd = 0;
	for (const item of items) {
		const decision = evaluate(defaultPolicy, item.url, item.priceUsd, spentUsd);
		emit("policy", { id: item.id, priceUsd: item.priceUsd, ...decision });
		if (decision.verdict === "deny") continue;
		const approver = async () =>
			decision.verdict === "allow" ||
			(await requestApproval({
				resource: item.id,
				priceUsd: item.priceUsd,
				reason: decision.reason,
			}));
		try {
			const result = await payer.fetchPaid<unknown>(item.url, approver);
			spentUsd += result.priceUsd;
			bought[item.id] = result.data;
			emit("purchased", {
				id: item.id,
				txHash: result.txHash,
				url: txUrl(result.txHash),
				spentUsd,
			});
		} catch (err) {
			emit("purchase_failed", { id: item.id, error: (err as Error).message });
		}
	}
	return { bought, spentUsd };
}

async function buyFeedsPrivately(
	payer: ReturnType<typeof createPayer>,
	items: CatalogItem[],
	origin: string,
) {
	const credits = createCreditWallet(origin);
	await credits.load();
	const creditUsd = credits.priceUsd();
	const eligible = items.filter((item) => {
		const decision = evaluate(defaultPolicy, item.url, item.priceUsd, 0);
		emit("policy", { id: item.id, priceUsd: item.priceUsd, ...decision });
		return decision.verdict !== "deny";
	});
	const bought: Record<string, unknown> = {};
	if (eligible.length === 0) return { bought, spentUsd: 0 };
	const depositUsd = Number((eligible.length * creditUsd).toFixed(6));
	const depositUrl = `${origin}/credits/issue`;
	const decision = evaluate(defaultPolicy, depositUrl, depositUsd, 0);
	emit("policy", { id: "credit-deposit", priceUsd: depositUsd, ...decision });
	if (decision.verdict === "deny") return { bought, spentUsd: 0 };
	const approver = async () =>
		decision.verdict === "allow" ||
		(await requestApproval({
			resource: `${eligible.length} private credits`,
			priceUsd: depositUsd,
			reason: decision.reason,
		}));
	const spentUsd = await credits.buy(payer, eligible.length, approver);
	for (const item of eligible) {
		try {
			bought[item.id] = await credits.spend<unknown>(item.url);
		} catch (err) {
			emit("purchase_failed", { id: item.id, error: (err as Error).message });
		}
	}
	return { bought, spentUsd };
}

export async function runAgent(opts: {
	privateKey: string;
	catalogUrl: string;
	goal: string;
	privateMode: boolean;
}) {
	const payer = createPayer(opts.privateKey);
	emit("start", {
		agent: payer.address,
		balanceUsd: await payer.balanceUsd(),
		policy: defaultPolicy,
		privateMode: opts.privateMode,
	});

	const catalog = (await (
		await fetch(opts.catalogUrl)
	).json()) as CatalogItem[];
	emit("catalog", { items: catalog });
	const chosenIds = await plan(opts.goal, catalog);
	const chosen = catalog.filter((c) => chosenIds.has(c.id));
	const { bought, spentUsd } = opts.privateMode
		? await buyFeedsPrivately(payer, chosen, new URL(opts.catalogUrl).origin)
		: await buyFeeds(payer, chosen);

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
	emit("briefing", {
		text: briefing,
		spentUsd,
		balanceUsd: await payer.balanceUsd(),
	});
	emit("done", {});
}

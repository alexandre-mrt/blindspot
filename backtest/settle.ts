import type { EdgeSignal } from "../src/signals";

const API =
	"https://api.gemini.com/v1/prediction-markets/events/recently-settled";
const PAGES = 10;
const PAGE = 100;

type Contract = {
	instrumentSymbol: string;
	resolutionSide?: "yes" | "no" | null;
};

const file = process.argv[2];
if (!file)
	throw new Error("Usage: bun backtest/settle.ts backtest/forward-<time>.json");
const { capturedAt, signals } = (await Bun.file(file).json()) as {
	capturedAt: string;
	signals: EdgeSignal[];
};

const pages = await Promise.all(
	Array.from({ length: PAGES }, async (_, i) => {
		const res = await fetch(
			`${API}?category=Crypto&limit=${PAGE}&offset=${i * PAGE}`,
		);
		if (!res.ok) throw new Error(`settled page ${i} failed: ${res.status}`);
		return ((await res.json()) as { data: { contracts: Contract[] }[] }).data;
	}),
);
const outcomes = new Map(
	pages
		.flat()
		.flatMap((e) => e.contracts)
		.filter((c) => c.resolutionSide)
		.map((c) => [c.instrumentSymbol, c.resolutionSide === "yes"]),
);

const trades = signals
	.filter((s) => outcomes.has(s.symbol))
	.map((s) => {
		const yes = outcomes.get(s.symbol) === true;
		const cost = s.side === "BUY_YES" ? s.ask : 1 - s.bid;
		const payout = (s.side === "BUY_YES") === yes ? 1 : 0;
		return {
			symbol: s.symbol,
			side: s.side,
			edge: s.edge,
			cost,
			payout,
			pnl: payout - cost,
		};
	});

const staked = trades.reduce((a, t) => a + t.cost, 0);
const pnl = trades.reduce((a, t) => a + t.pnl, 0);
const result = {
	capturedAt,
	rule: "take every signal with edge >= 5 pts, 1 contract at the quoted ask (YES) or 1 - bid (NO)",
	settled: trades.length,
	pending: signals.length - trades.length,
	hitRate: trades.length
		? trades.filter((t) => t.payout === 1).length / trades.length
		: null,
	stakedUsd: staked,
	pnlUsd: pnl,
	roi: staked ? pnl / staked : null,
	trades,
};
await Bun.write(
	file.replace("forward-", "forward-result-"),
	JSON.stringify(result, null, 2),
);
console.log(
	JSON.stringify({ ...result, trades: result.trades.length }, null, 2),
);

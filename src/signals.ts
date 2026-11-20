import { GEMINI, SIGNAL } from "./config";
import {
	type GeminiContract,
	type GeminiEvent,
	listActiveEvents,
	recentCloses,
} from "./gemini";

type MarketQuote = {
	event: string;
	contract: string;
	symbol: string;
	bid: number;
	ask: number;
	mid: number;
	expiry: string;
};

export type EdgeSignal = MarketQuote & {
	spot: number;
	strike: number;
	modelProb: number;
	edge: number;
	side: "BUY_YES" | "BUY_NO";
	annualVol: number;
};

export type ArbSignal = {
	event: string;
	lowerStrike: number;
	higherStrike: number;
	buyAsk: number;
	sellBid: number;
	lockedProfit: number;
};

const toNum = (value?: string) =>
	value === undefined ? Number.NaN : Number(value);

function quoteOf(event: GeminiEvent, c: GeminiContract): MarketQuote | null {
	const bid = toNum(c.prices?.bestBid);
	const ask = toNum(c.prices?.bestAsk);
	if (
		c.marketState !== "open" ||
		!Number.isFinite(bid) ||
		!Number.isFinite(ask)
	)
		return null;
	return {
		event: event.title,
		contract: c.label,
		symbol: c.instrumentSymbol,
		bid,
		ask,
		mid: (bid + ask) / 2,
		expiry: c.expiryDate,
	};
}

export async function marketSnapshot(
	category?: string,
): Promise<MarketQuote[]> {
	const events = await listActiveEvents(category, SIGNAL.maxEvents);
	return events.flatMap((e) =>
		e.contracts
			.map((c) => quoteOf(e, c))
			.filter((q): q is MarketQuote => q !== null),
	);
}

function normCdf(x: number): number {
	const t = 1 / (1 + 0.2316419 * Math.abs(x));
	const d = 0.3989423 * Math.exp((-x * x) / 2);
	const p =
		d *
		t *
		(0.3193815 +
			t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
	return x > 0 ? 1 - p : p;
}

function realizedVolPerMinute(closes: number[]): number {
	const returns = closes.slice(1).map((c, i) => Math.log(c / (closes[i] ?? c)));
	if (returns.length < 10)
		throw new Error("Not enough kline data to estimate volatility");
	const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
	const variance =
		returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
	return Math.sqrt(variance);
}

function probabilityAbove(
	spot: number,
	strike: number,
	volPerMin: number,
	minutes: number,
): number {
	if (minutes <= 0) return spot >= strike ? 1 : 0;
	const sigma = volPerMin * Math.sqrt(minutes);
	return normCdf((Math.log(spot / strike) - 0.5 * sigma * sigma) / sigma);
}

async function volContext(index: string) {
	const closes = await recentCloses(index, GEMINI.volLookbackMinutes);
	const spot = closes.at(-1);
	if (spot === undefined) throw new Error(`No spot price for ${index}`);
	return { spot, volPerMin: realizedVolPerMinute(closes) };
}

function edgeFor(
	event: GeminiEvent,
	c: GeminiContract,
	ctx: { spot: number; volPerMin: number },
): EdgeSignal | null {
	const quote = quoteOf(event, c);
	const type = c.strike?.type;
	if (!quote || (type !== "above" && type !== "below")) return null;
	const strike = Number(c.strike?.value);
	const minutes = (Date.parse(c.expiryDate) - Date.now()) / 60_000;
	const above = probabilityAbove(ctx.spot, strike, ctx.volPerMin, minutes);
	const modelProb = type === "above" ? above : 1 - above;
	const buyYesEdge = modelProb - quote.ask;
	const buyNoEdge = quote.bid - modelProb;
	const side = buyYesEdge >= buyNoEdge ? "BUY_YES" : "BUY_NO";
	return {
		...quote,
		spot: ctx.spot,
		strike,
		modelProb,
		edge: Math.max(buyYesEdge, buyNoEdge),
		side,
		annualVol: ctx.volPerMin * Math.sqrt(SIGNAL.minutesPerYear),
	};
}

export async function edgeSignals(): Promise<EdgeSignal[]> {
	const events = await listActiveEvents("Crypto", SIGNAL.maxEvents);
	const sources = [
		...new Set(
			events.flatMap((e) => e.contracts.map((c) => c.source)).filter(Boolean),
		),
	] as string[];
	const contexts = new Map(
		await Promise.all(
			sources.map(
				async (s) => [s, await volContext(s).catch(() => null)] as const,
			),
		),
	);
	return events
		.flatMap((e) =>
			e.contracts.map((c) => {
				const ctx = c.source ? contexts.get(c.source) : null;
				return ctx ? edgeFor(e, c, ctx) : null;
			}),
		)
		.filter((s): s is EdgeSignal => s !== null && s.edge >= SIGNAL.minEdge)
		.sort((a, b) => b.edge - a.edge);
}

function ladderArbs(event: GeminiEvent): ArbSignal[] {
	const rungs = event.contracts
		.filter((c) => c.strike?.type === "above")
		.map((c) => ({ strike: Number(c.strike?.value), quote: quoteOf(event, c) }))
		.filter(
			(r): r is { strike: number; quote: MarketQuote } => r.quote !== null,
		)
		.sort((a, b) => a.strike - b.strike);
	return rungs.slice(1).flatMap((higher, i) => {
		const lower = rungs[i];
		if (!lower || higher.quote.bid <= lower.quote.ask) return [];
		return [
			{
				event: event.title,
				lowerStrike: lower.strike,
				higherStrike: higher.strike,
				buyAsk: lower.quote.ask,
				sellBid: higher.quote.bid,
				lockedProfit: higher.quote.bid - lower.quote.ask,
			},
		];
	});
}

export async function arbSignals(): Promise<ArbSignal[]> {
	const events = await listActiveEvents("Crypto", SIGNAL.maxEvents);
	return events
		.flatMap(ladderArbs)
		.sort((a, b) => b.lockedProfit - a.lockedProfit);
}

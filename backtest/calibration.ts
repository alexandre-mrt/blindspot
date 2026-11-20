import { GEMINI } from "../src/config";
import { closesBetween } from "../src/gemini";
import { probabilityAbove, realizedVolPerMinute } from "../src/signals";

const API =
	"https://api.gemini.com/v1/prediction-markets/events/recently-settled";
const PAGE = 100;
const MAX_EVENTS = 1000;
const ENTRY_MINUTES_BEFORE_EXPIRY = 60;
const MINUTE = 60_000;

type Contract = {
	instrumentSymbol: string;
	expiryDate: string;
	resolutionSide?: "yes" | "no" | null;
	strike?: { type: string; value: string };
	source?: string;
};
type Event = { title: string; contracts: Contract[] };
type Sample = {
	asset: string;
	model: number;
	spotAbove: number;
	outcome: number;
};

async function settledEvents(): Promise<Event[]> {
	const pages = await Promise.all(
		Array.from({ length: MAX_EVENTS / PAGE }, async (_, i) => {
			const res = await fetch(
				`${API}?category=Crypto&limit=${PAGE}&offset=${i * PAGE}`,
			);
			if (!res.ok) throw new Error(`settled page ${i} failed: ${res.status}`);
			return ((await res.json()) as { data: Event[] }).data;
		}),
	);
	return pages.flat();
}

async function samplesFor(event: Event): Promise<Sample[]> {
	const ladder = event.contracts.filter(
		(c) =>
			(c.strike?.type === "above" || c.strike?.type === "below") &&
			c.resolutionSide &&
			c.source,
	);
	const first = ladder[0];
	if (!first?.source) return [];
	const entry =
		Date.parse(first.expiryDate) - ENTRY_MINUTES_BEFORE_EXPIRY * MINUTE;
	const closes = await closesBetween(
		first.source,
		entry - GEMINI.volLookbackMinutes * MINUTE,
		entry,
	);
	const spot = closes.at(-1);
	if (spot === undefined || closes.length < 10) return [];
	const vol = realizedVolPerMinute(closes);
	return ladder.map((c) => {
		const strike = Number(c.strike?.value);
		const above = probabilityAbove(
			spot,
			strike,
			vol,
			ENTRY_MINUTES_BEFORE_EXPIRY,
		);
		const isAbove = c.strike?.type === "above";
		return {
			asset: event.title.split(" ")[0] ?? "?",
			model: isAbove ? above : 1 - above,
			spotAbove: isAbove === spot >= strike ? 1 : 0,
			outcome: c.resolutionSide === "yes" ? 1 : 0,
		};
	});
}

const brier = (xs: Sample[], p: (s: Sample) => number) =>
	xs.reduce((a, s) => a + (p(s) - s.outcome) ** 2, 0) / xs.length;

function calibration(xs: Sample[]) {
	const buckets = Array.from({ length: 5 }, (_, i) =>
		xs.filter(
			(s) => s.model >= i / 5 && s.model < (i + 1) / 5 + (i === 4 ? 1e-9 : 0),
		),
	);
	return buckets.map((b, i) => ({
		bucket: `${i * 20}-${(i + 1) * 20}%`,
		n: b.length,
		predicted: b.length ? b.reduce((a, s) => a + s.model, 0) / b.length : null,
		realized: b.length ? b.reduce((a, s) => a + s.outcome, 0) / b.length : null,
	}));
}

const events = (await settledEvents()).filter((e) =>
	e.contracts.some((c) => c.strike?.type === "above"),
);
const samples = (
	await Promise.all(events.map((e) => samplesFor(e).catch(() => [])))
).flat();
const contested = samples.filter((s) => s.model > 0.1 && s.model < 0.9);
const report = (xs: Sample[]) => ({
	n: xs.length,
	brierModel: brier(xs, (s) => s.model),
	brierSpotSide: brier(xs, (s) => s.spotAbove),
	brierCoinFlip: brier(xs, () => 0.5),
});
const result = {
	window: "Gemini crypto strike ladders settled in the last 24h",
	entry: `${ENTRY_MINUTES_BEFORE_EXPIRY} min before expiry`,
	events: events.length,
	all: report(samples),
	contested: report(contested),
	calibration: calibration(samples),
};
await Bun.write(
	"backtest/calibration-result.json",
	JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));

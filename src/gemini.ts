import { GEMINI } from "./config";

type ContractPrices = { bestBid?: string; bestAsk?: string };
export type GeminiContract = {
	label: string;
	instrumentSymbol: string;
	marketState: string;
	expiryDate: string;
	prices?: ContractPrices;
	strike?: { type: string; value: string };
	source?: string;
};
export type GeminiEvent = {
	title: string;
	ticker: string;
	category: string;
	contracts: GeminiContract[];
};

async function getJson<T>(path: string): Promise<T> {
	const res = await fetch(`${GEMINI.baseUrl}${path}`);
	if (!res.ok) throw new Error(`Gemini ${path} failed: ${res.status}`);
	return (await res.json()) as T;
}

export async function listActiveEvents(
	category?: string,
	limit = 40,
): Promise<GeminiEvent[]> {
	const params = new URLSearchParams({
		status: "active",
		limit: String(limit),
	});
	if (category) params.set("category", category);
	const body = await getJson<{ data: GeminiEvent[] }>(
		`/v1/prediction-markets/events?${params}`,
	);
	return body.data;
}

export async function closesBetween(
	index: string,
	start: number,
	end: number,
): Promise<number[]> {
	const params = new URLSearchParams({
		agency: "lukka",
		index,
		interval: GEMINI.klineInterval,
		startTime: String(start),
		endTime: String(end),
	});
	const rows = await getJson<number[][]>(`/v2/klines?${params}`);
	return [...rows]
		.sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))
		.map((row) => Number(row[4]));
}

export const recentCloses = (index: string, minutes: number) =>
	closesBetween(index, Date.now() - minutes * 60_000, Date.now());

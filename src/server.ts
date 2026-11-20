import dashboard from "../public/index.html";
import { type CatalogItem, runAgent } from "./agent/agent";
import { resolveApproval } from "./agent/approvals";
import { requireEnv } from "./chain";
import { SERVER } from "./config";
import { clearHistory, emit, replay, subscribe } from "./events";
import { arbSignals, edgeSignals, marketSnapshot } from "./signals";
import {
	decodeProof,
	encodeHeader,
	requirementsFor,
	verifyPayment,
} from "./x402";

const MERCHANT = requireEnv("MERCHANT_ADDRESS");
const AGENT_KEY = requireEnv("AGENT_PRIVATE_KEY");
const DEFAULT_GOAL =
	"Find the most mispriced crypto prediction market on Gemini right now and brief me.";

type Feed = {
	id: string;
	priceUsd: number;
	description: string;
	produce: () => Promise<unknown>;
};

const FEEDS: Feed[] = [
	{
		id: "snapshot",
		priceUsd: 0.01,
		description: "Live bid/ask snapshot of every open Gemini prediction market",
		produce: async () => ({ quotes: await marketSnapshot() }),
	},
	{
		id: "arb",
		priceUsd: 0.02,
		description: "Strike-ladder arbitrage scanner on Gemini crypto markets",
		produce: async () => ({ signals: await arbSignals() }),
	},
	{
		id: "edge",
		priceUsd: 0.05,
		description: "Volatility-model fair value vs Gemini odds, ranked by edge",
		produce: async () => ({ signals: await edgeSignals() }),
	},
];

const EXTERNAL_LISTINGS: CatalogItem[] = [
	{
		id: "whale-alpha",
		url: "https://alpha-whales.example/api/insider",
		priceUsd: 0.5,
		description: "Unverified 'insider' whale feed",
		provider: "third-party",
	},
];

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		...init,
		headers: { "content-type": "application/json", ...init.headers },
	});

const catalog = (): CatalogItem[] => [
	...FEEDS.map((f) => ({
		id: f.id,
		url: `${SERVER.publicOrigin}/api/feeds/${f.id}`,
		priceUsd: f.priceUsd,
		description: f.description,
		provider: "odds-desk",
	})),
	...EXTERNAL_LISTINGS,
];

async function servePaidFeed(req: Request, feed: Feed): Promise<Response> {
	const requirements = requirementsFor(
		new URL(req.url).pathname,
		feed.priceUsd,
		MERCHANT,
		feed.description,
	);
	const header = req.headers.get(SERVER.paymentHeader);
	if (!header)
		return json(
			{ x402Version: 1, error: "payment required", accepts: [requirements] },
			{ status: 402 },
		);
	try {
		const proof = decodeProof(header);
		await verifyPayment(proof, requirements);
		emit("merchant_settled", {
			feed: feed.id,
			txHash: proof.txHash,
			payer: proof.payer,
		});
		return json(await feed.produce(), {
			headers: {
				[SERVER.paymentResponseHeader]: encodeHeader({
					success: true,
					txHash: proof.txHash,
				}),
			},
		});
	} catch (err) {
		return json(
			{
				x402Version: 1,
				error: (err as Error).message,
				accepts: [requirements],
			},
			{ status: 402 },
		);
	}
}

let running = false;

function sseStream(): Response {
	const encoder = new TextEncoder();
	let unsubscribe = () => {};
	const stream = new ReadableStream({
		start(controller) {
			const send = (e: unknown) =>
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
			for (const e of replay()) send(e);
			unsubscribe = subscribe(send);
		},
		cancel() {
			unsubscribe();
		},
	});
	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
		},
	});
}

Bun.serve({
	port: SERVER.port,
	idleTimeout: 0,
	routes: {
		"/": dashboard,
		"/catalog": () => json(catalog()),
		"/api/feeds/:id": (req) => {
			const feed = FEEDS.find((f) => f.id === req.params.id);
			return feed
				? servePaidFeed(req, feed)
				: json({ error: "unknown feed" }, { status: 404 });
		},
		"/events": () => sseStream(),
		"/agent/run": {
			POST: async (req) => {
				if (running)
					return json({ error: "agent already running" }, { status: 409 });
				const body = (await req.json().catch(() => ({}))) as { goal?: string };
				running = true;
				clearHistory();
				runAgent({
					privateKey: AGENT_KEY,
					catalogUrl: `${SERVER.publicOrigin}/catalog`,
					goal: body.goal?.trim() || DEFAULT_GOAL,
				})
					.catch((err: Error) => emit("error", { error: err.message }))
					.finally(() => {
						running = false;
					});
				return json({ started: true });
			},
		},
		"/agent/approve": {
			POST: async (req) => {
				const body = (await req.json()) as { id?: string; approved?: boolean };
				if (!body.id) return json({ error: "missing id" }, { status: 400 });
				return json({ ok: resolveApproval(body.id, body.approved === true) });
			},
		},
	},
});

console.log(`Odds Desk on ${SERVER.publicOrigin}`);

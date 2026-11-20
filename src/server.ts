import dashboard from "../public/index.html";
import { type CatalogItem, runAgent } from "./agent/agent";
import { resolveApproval } from "./agent/approvals";
import { requireEnv } from "./chain";
import { SERVER } from "./config";
import { clearHistory, emit, replay, subscribe } from "./events";
import { createPaywalledApp, FEEDS, feedPath } from "./paywall";

const MERCHANT = requireEnv("MERCHANT_ADDRESS");
const AGENT_KEY = requireEnv("AGENT_PRIVATE_KEY") as `0x${string}`;
const UNVETTED_ORIGIN = `http://127.0.0.1:${SERVER.port}`;
const UNVETTED_FEEDS = new Set(["whale"]);
const DEFAULT_GOAL =
	"Find the most mispriced crypto prediction market on Gemini right now and brief me.";

const paywalled = createPaywalledApp(MERCHANT, SERVER.publicOrigin);

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		...init,
		headers: { "content-type": "application/json", ...init.headers },
	});

const catalog = (): CatalogItem[] =>
	FEEDS.map((f) => {
		const unvetted = UNVETTED_FEEDS.has(f.id);
		return {
			id: f.id,
			url: `${unvetted ? UNVETTED_ORIGIN : SERVER.publicOrigin}${feedPath(f.id)}`,
			priceUsd: Number(f.price.replace("$", "")),
			description: f.description,
			provider: unvetted ? "third-party" : "odds-desk",
		};
	});

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

let running = false;

async function startRun(req: Request): Promise<Response> {
	if (running) return json({ error: "agent already running" }, { status: 409 });
	const body = (await req.json().catch(() => ({}))) as {
		goal?: string;
		privateMode?: boolean;
	};
	running = true;
	clearHistory();
	runAgent({
		privateKey: AGENT_KEY,
		catalogUrl: `${SERVER.publicOrigin}/catalog`,
		goal: body.goal?.trim() || DEFAULT_GOAL,
		privateMode: body.privateMode !== false,
	})
		.catch((err: Error) => emit("error", { error: err.message }))
		.finally(() => {
			running = false;
		});
	return json({ started: true });
}

Bun.serve({
	port: SERVER.port,
	idleTimeout: 0,
	routes: {
		"/": dashboard,
		"/catalog": () => json(catalog()),
		"/events": () => sseStream(),
		"/agent/run": { POST: startRun },
		"/agent/approve": {
			POST: async (req) => {
				const body = (await req.json()) as { id?: string; approved?: boolean };
				if (!body.id) return json({ error: "missing id" }, { status: 400 });
				return json({ ok: resolveApproval(body.id, body.approved === true) });
			},
		},
	},
	fetch: paywalled.fetch,
});

console.log(`Odds Desk on ${SERVER.publicOrigin}`);

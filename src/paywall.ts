import {
	BatchFacilitatorClient,
	GatewayEvmScheme,
} from "@circle-fin/x402-batching/server";
import type { FacilitatorClient } from "@x402/core/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { Hono } from "hono";
import { ARC } from "./config";
import { CREDIT_BATCH, createMint } from "./credits/mint";
import {
	BLIND_CREDIT_SCHEME,
	BlindCreditFacilitator,
	BlindCreditServerScheme,
} from "./credits/scheme";
import { emit } from "./events";
import { arbSignals, edgeSignals, marketSnapshot } from "./signals";

type RoutesConfig = Parameters<typeof paymentMiddleware>[0];

const GATEWAY_TESTNET_FACILITATOR = "https://gateway-api-testnet.circle.com";

type Feed = {
	id: string;
	price: string;
	description: string;
	produce: () => Promise<unknown>;
};

export const FEEDS: Feed[] = [
	{
		id: "snapshot",
		price: "$0.001",
		description: "Live bid/ask snapshot of every open Gemini prediction market",
		produce: async () => ({ quotes: await marketSnapshot() }),
	},
	{
		id: "arb",
		price: "$0.002",
		description: "Strike-ladder arbitrage scanner on Gemini crypto markets",
		produce: async () => ({ signals: await arbSignals() }),
	},
	{
		id: "edge",
		price: "$0.005",
		description: "Volatility-model fair value vs Gemini odds, ranked by edge",
		produce: async () => ({ signals: await edgeSignals() }),
	},
	{
		id: "whale",
		price: "$0.5",
		description: "Unverified 'insider' whale feed",
		produce: async () => ({ signals: [] }),
	},
];

export const feedPath = (id: string) => `/api/feeds/${id}`;
export const CREDITS_ISSUE_PATH = "/credits/issue";

function circleGatewayFacilitator(): FacilitatorClient {
	return new BatchFacilitatorClient({
		url: GATEWAY_TESTNET_FACILITATOR,
	}) as unknown as FacilitatorClient;
}

function routes(payTo: string): RoutesConfig {
	const gateway = (price: string) => ({
		scheme: "exact",
		price,
		network: ARC.caip2,
		payTo,
	});
	const credit = {
		scheme: BLIND_CREDIT_SCHEME,
		price: "1",
		network: ARC.caip2,
		payTo,
	};
	const feedRoutes = FEEDS.map((f) => [
		`GET ${feedPath(f.id)}`,
		{
			accepts: [gateway(f.price), credit],
			description: f.description,
			mimeType: "application/json",
		},
	]);
	return Object.fromEntries([
		...feedRoutes,
		[
			`POST ${CREDITS_ISSUE_PATH}`,
			{
				accepts: gateway(CREDIT_BATCH.price),
				description: `${CREDIT_BATCH.size} blind-signed credits`,
				mimeType: "application/json",
			},
		],
	]);
}

export function createPaywalledApp(payTo: string, origin: string) {
	const mint = createMint();
	const blindFacilitator = new BlindCreditFacilitator(mint, ARC.caip2, (tag) =>
		emit("merchant_redeemed", { serialTag: tag, payer: "anonymous" }),
	);
	const resourceServer = new x402ResourceServer([
		circleGatewayFacilitator(),
		blindFacilitator,
	])
		.register(ARC.caip2, new GatewayEvmScheme())
		.register(ARC.caip2, new BlindCreditServerScheme(`${origin}/credits/info`));
	resourceServer.onAfterSettle(async (ctx) => {
		if (ctx.requirements.scheme === BLIND_CREDIT_SCHEME) return;
		emit("merchant_settled", {
			amount: ctx.requirements.amount,
			settlement: ctx.result.transaction,
			payer: ctx.result.payer,
		});
	});

	const app = new Hono();
	app.get("/credits/info", (c) =>
		c.json({ ...mint.publicKey(), batch: CREDIT_BATCH }),
	);
	app.use(paymentMiddleware(routes(payTo), resourceServer));
	for (const feed of FEEDS)
		app.get(feedPath(feed.id), async (c) => c.json(await feed.produce()));
	app.post(CREDITS_ISSUE_PATH, async (c) => {
		const body = (await c.req.json()) as { blinded?: unknown };
		const signatures = mint.signBatch(body.blinded);
		emit("mint_signed", { count: signatures.length, sawSerials: false });
		return c.json({ signatures });
	});
	return app;
}

export const ARC = {
	chainId: 5042002,
	rpcUrl: process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
	explorer: "https://testnet.arcscan.app",
	usdc: "0x3600000000000000000000000000000000000000",
	usdcDecimals: 6,
	network: "arc-testnet",
} as const;

export const GEMINI = {
	baseUrl: "https://api.gemini.com",
	klineInterval: "1m",
	volLookbackMinutes: 120,
} as const;

export const SERVER = {
	port: Number(process.env.PORT ?? 4021),
	publicOrigin:
		process.env.PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 4021}`,
	paymentHeader: "x-payment",
	paymentResponseHeader: "x-payment-response",
	maxPaymentAgeSeconds: 600,
} as const;

export const POLICY = {
	sessionBudgetUsd: 0.2,
	perCallMaxUsd: 0.1,
	approvalThresholdUsd: 0.04,
	approvalTimeoutMs: 60_000,
	allowedOrigins: [SERVER.publicOrigin],
} as const;

export const SIGNAL = {
	minEdge: 0.05,
	maxEvents: 40,
	minutesPerYear: 525_600,
} as const;

export const VOICE = {
	voiceId: process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb",
	modelId: "eleven_flash_v2_5",
} as const;

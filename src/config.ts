export const ARC = {
	explorer: "https://testnet.arcscan.app",
	usdcDecimals: 6,
	caip2: "eip155:5042002",
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
} as const;

export const POLICY = {
	sessionBudgetUsd: 0.05,
	perCallMaxUsd: 0.01,
	approvalThresholdUsd: 0.004,
	approvalTimeoutMs: 60_000,
	allowedOrigins: [SERVER.publicOrigin],
} as const;

export const SIGNAL = {
	minEdge: 0.05,
	maxEvents: 100,
	minutesPerYear: 525_600,
} as const;

import {
	createPublicClient,
	createWalletClient,
	defineChain,
	http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC } from "./config";

export const arcTestnet = defineChain({
	id: ARC.chainId,
	name: "Arc Testnet",
	nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
	rpcUrls: { default: { http: [ARC.rpcUrl] } },
	blockExplorers: { default: { name: "ArcScan", url: ARC.explorer } },
	testnet: true,
});

export const publicClient = createPublicClient({
	chain: arcTestnet,
	transport: http(),
});

export function walletFromKey(privateKey: string) {
	if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey))
		throw new Error("Invalid private key format");
	const account = privateKeyToAccount(privateKey as `0x${string}`);
	return createWalletClient({ account, chain: arcTestnet, transport: http() });
}

export function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing env var ${name}`);
	return value;
}

export const txUrl = (hash: string) => `${ARC.explorer}/tx/${hash}`;

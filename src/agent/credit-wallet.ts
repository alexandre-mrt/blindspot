import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ARC } from "../config";
import {
	blind,
	hexToBig,
	newSerial,
	type PublicKey,
	type Token,
	unblind,
	verify,
} from "../credits/blind";
import { BlindCreditClientScheme, CREDIT_ASSET } from "../credits/scheme";
import { emit } from "../events";
import { CREDITS_ISSUE_PATH } from "../paywall";
import type { createGatewayPayer } from "./gateway-payer";

type MintInfo = {
	n: string;
	e: string;
	batch: { size: number; price: string };
};
type Payer = ReturnType<typeof createGatewayPayer>;

export function createCreditWallet(origin: string) {
	const tokens: Token[] = [];
	const client = x402Client.fromConfig({
		schemes: [
			{
				network: ARC.caip2,
				client: new BlindCreditClientScheme(() => tokens.shift()),
			},
		],
		spendControls: {
			allowedAssets: [
				{ network: ARC.caip2, asset: CREDIT_ASSET, maxAmountPerPayment: "1" },
			],
		},
	});
	const fetchWithCredit = wrapFetchWithPayment(fetch, client);

	async function buyBatch(payer: Payer): Promise<number> {
		const info = (await (
			await fetch(`${origin}/credits/info`)
		).json()) as MintInfo;
		const pk: PublicKey = { n: hexToBig(info.n), e: hexToBig(info.e) };
		const serials = Array.from({ length: info.batch.size }, newSerial);
		const blinded = serials.map((s) => blind(s, pk));
		emit("credits_blinded", {
			count: serials.length,
			preview: blinded[0]?.blinded.toString(16).slice(0, 24),
		});
		const { data, priceUsd } = await payer.pay<{ signatures: string[] }>(
			`${origin}${CREDITS_ISSUE_PATH}`,
			{
				method: "POST",
				body: { blinded: blinded.map((b) => b.blinded.toString(16)) },
			},
		);
		const fresh = data.signatures.map((sigHex, i) => {
			const entry = blinded[i];
			const serial = serials[i];
			if (!entry || !serial)
				throw new Error("Mint returned too many signatures");
			const signature = unblind(hexToBig(sigHex), entry.r, pk);
			if (!verify(serial, signature, pk))
				throw new Error("Mint returned an invalid blind signature");
			return { serial, signature: signature.toString(16) };
		});
		tokens.push(...fresh);
		emit("credits_ready", { count: fresh.length, priceUsd });
		return priceUsd;
	}

	async function spend<T>(url: string): Promise<T> {
		const res = await fetchWithCredit(url);
		if (!res.ok) throw new Error(`${url} rejected credit: ${res.status}`);
		emit("credit_spent", {
			resource: new URL(url).pathname,
			left: tokens.length,
			onchain: false,
		});
		return (await res.json()) as T;
	}

	return { buyBatch, spend, remaining: () => tokens.length };
}

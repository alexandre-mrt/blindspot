import { txUrl } from "../chain";
import { SERVER } from "../config";
import {
	blind,
	hexToBig,
	newSerial,
	type PublicKey,
	type Token,
	unblind,
	verify,
} from "../credits/blind";
import { emit } from "../events";
import type { PaymentRequirements } from "../x402";
import type { createPayer } from "./pay-client";

type MintInfo = {
	n: string;
	e: string;
	priceUsdPerCredit: number;
	maxBatch: number;
};
type Payer = ReturnType<typeof createPayer>;

export function createCreditWallet(origin: string) {
	const tokens: Token[] = [];
	let key: PublicKey | null = null;
	let creditPriceUsd = 0;

	async function load(): Promise<MintInfo> {
		const info = (await (
			await fetch(`${origin}/credits/info`)
		).json()) as MintInfo;
		key = { n: hexToBig(info.n), e: hexToBig(info.e) };
		creditPriceUsd = info.priceUsdPerCredit;
		return info;
	}

	async function buy(
		payer: Payer,
		count: number,
		approve: (req: PaymentRequirements) => Promise<boolean>,
	) {
		const info = await load();
		const pk = key;
		if (!pk) throw new Error("Mint key not loaded");
		const serials = Array.from(
			{ length: Math.min(count, info.maxBatch) },
			newSerial,
		);
		const blinded = serials.map((s) => blind(s, pk));
		emit("credits_blinded", {
			count: serials.length,
			preview: blinded[0]?.blinded.toString(16).slice(0, 24),
		});
		const result = await payer.postPaid<{ signatures: string[] }>(
			`${origin}/credits/issue`,
			{ blinded: blinded.map((b) => b.blinded.toString(16)) },
			approve,
		);
		const fresh = result.data.signatures.map((sigHex, i) => {
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
		emit("credits_ready", {
			count: fresh.length,
			txHash: result.txHash,
			url: txUrl(result.txHash),
			priceUsd: result.priceUsd,
		});
		return result.priceUsd;
	}

	async function spend<T>(url: string): Promise<T> {
		const token = tokens.shift();
		if (!token) throw new Error("No private credits left");
		const header = Buffer.from(
			JSON.stringify({ scheme: "blind-credit", ...token }),
		).toString("base64");
		const res = await fetch(url, {
			headers: { [SERVER.paymentHeader]: header },
		});
		if (!res.ok)
			throw new Error(
				`${url} rejected credit: ${res.status} ${await res.text()}`,
			);
		emit("credit_spent", {
			resource: new URL(url).pathname,
			left: tokens.length,
			onchain: false,
		});
		return (await res.json()) as T;
	}

	return {
		load,
		buy,
		spend,
		remaining: () => tokens.length,
		priceUsd: () => creditPriceUsd,
	};
}

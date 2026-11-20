import { createHash } from "node:crypto";
import {
	bigToHex,
	generateKeyPair,
	hexToBig,
	signBlinded,
	type Token,
	verify,
} from "./blind";

export const CREDIT_BATCH = { size: 5, price: "$0.01" } as const;

export type Mint = ReturnType<typeof createMint>;

export function createMint() {
	const keyPair = generateKeyPair();
	const spent = new Set<string>();

	const publicKey = () => ({ n: bigToHex(keyPair.n), e: bigToHex(keyPair.e) });

	function signBatch(blindedHex: unknown): string[] {
		if (!Array.isArray(blindedHex) || blindedHex.length !== CREDIT_BATCH.size) {
			throw new Error(`Expected exactly ${CREDIT_BATCH.size} blinded values`);
		}
		return blindedHex.map((h) =>
			bigToHex(signBlinded(hexToBig(String(h)), keyPair)),
		);
	}

	function check(token: Token): string | null {
		if (!/^[0-9a-f]{64}$/.test(token.serial)) return "malformed_serial";
		if (spent.has(token.serial)) return "credit_already_spent";
		if (!verify(token.serial, hexToBig(token.signature), keyPair))
			return "invalid_credit_signature";
		return null;
	}

	function redeem(token: Token): string {
		const reason = check(token);
		if (reason) throw new Error(reason);
		spent.add(token.serial);
		return createHash("sha256").update(token.serial).digest("hex").slice(0, 12);
	}

	return { publicKey, signBatch, check, redeem };
}

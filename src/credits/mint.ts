import { createHash } from "node:crypto";
import { emit } from "../events";
import {
	decodeProof,
	type PaymentRequirements,
	requirementsFor,
	verifyPayment,
} from "../x402";
import {
	bigToHex,
	generateKeyPair,
	hexToBig,
	signBlinded,
	type Token,
	verify,
} from "./blind";

export const CREDIT = { priceUsd: 0.02, maxBatch: 20 } as const;

const keyPair = generateKeyPair();
const spent = new Set<string>();

export const mintInfo = (payTo: string) => ({
	scheme: "blind-credit",
	n: bigToHex(keyPair.n),
	e: bigToHex(keyPair.e),
	priceUsdPerCredit: CREDIT.priceUsd,
	maxBatch: CREDIT.maxBatch,
	payTo,
});

export function depositRequirements(
	count: number,
	payTo: string,
): PaymentRequirements {
	if (!Number.isInteger(count) || count < 1 || count > CREDIT.maxBatch) {
		throw new Error(`Credit batch must be 1..${CREDIT.maxBatch}`);
	}
	return requirementsFor(
		"/credits/issue",
		Number((count * CREDIT.priceUsd).toFixed(6)),
		payTo,
		`${count} blind credits`,
	);
}

export async function issue(
	paymentHeader: string,
	blindedHex: string[],
	payTo: string,
): Promise<string[]> {
	const requirements = depositRequirements(blindedHex.length, payTo);
	const proof = decodeProof(paymentHeader);
	await verifyPayment(proof, requirements);
	const signatures = blindedHex.map((h) =>
		bigToHex(signBlinded(hexToBig(h), keyPair)),
	);
	emit("mint_signed", {
		count: signatures.length,
		txHash: proof.txHash,
		sawSerials: false,
	});
	return signatures;
}

const serialTag = (serial: string) =>
	createHash("sha256").update(serial).digest("hex").slice(0, 12);

export function redeem(token: Token): string {
	if (!/^[0-9a-f]{64}$/.test(token.serial))
		throw new Error("Malformed credit serial");
	if (spent.has(token.serial)) throw new Error("Credit already spent");
	if (!verify(token.serial, hexToBig(token.signature), keyPair))
		throw new Error("Invalid credit signature");
	spent.add(token.serial);
	return serialTag(token.serial);
}

import { decodeEventLog, erc20Abi, getAddress, parseUnits } from "viem";
import { publicClient } from "./chain";
import { ARC, SERVER } from "./config";

export type PaymentRequirements = {
	scheme: "exact";
	network: string;
	asset: string;
	payTo: string;
	maxAmountRequired: string;
	priceUsd: number;
	resource: string;
	description: string;
};

export type PaymentProof = { txHash: `0x${string}`; payer: string };

const settled = new Set<string>();

export function requirementsFor(
	resource: string,
	priceUsd: number,
	payTo: string,
	description: string,
): PaymentRequirements {
	return {
		scheme: "exact",
		network: ARC.network,
		asset: ARC.usdc,
		payTo: getAddress(payTo),
		maxAmountRequired: parseUnits(
			priceUsd.toString(),
			ARC.usdcDecimals,
		).toString(),
		priceUsd,
		resource,
		description,
	};
}

export const encodeHeader = (value: unknown) =>
	Buffer.from(JSON.stringify(value)).toString("base64");

export function decodeProof(header: string): PaymentProof {
	const parsed = JSON.parse(
		Buffer.from(header, "base64").toString("utf8"),
	) as Partial<PaymentProof>;
	if (!parsed.txHash || !/^0x[0-9a-fA-F]{64}$/.test(parsed.txHash))
		throw new Error("Malformed payment proof");
	if (!parsed.payer) throw new Error("Payment proof missing payer");
	return {
		txHash: parsed.txHash as `0x${string}`,
		payer: getAddress(parsed.payer),
	};
}

export async function verifyPayment(
	proof: PaymentProof,
	req: PaymentRequirements,
): Promise<void> {
	const key = proof.txHash.toLowerCase();
	if (settled.has(key)) throw new Error("Payment already used");
	const receipt = await publicClient.getTransactionReceipt({
		hash: proof.txHash,
	});
	if (receipt.status !== "success")
		throw new Error("Payment transaction reverted");
	const block = await publicClient.getBlock({
		blockNumber: receipt.blockNumber,
	});
	const age = Date.now() / 1000 - Number(block.timestamp);
	if (age > SERVER.maxPaymentAgeSeconds) throw new Error("Payment too old");
	const paid = receipt.logs
		.filter((log) => getAddress(log.address) === getAddress(req.asset))
		.map((log) =>
			decodeEventLog({ abi: erc20Abi, data: log.data, topics: log.topics }),
		)
		.filter((e) => e.eventName === "Transfer")
		.some(
			(e) =>
				e.eventName === "Transfer" &&
				getAddress(e.args.from) === proof.payer &&
				getAddress(e.args.to) === req.payTo &&
				e.args.value >= BigInt(req.maxAmountRequired),
		);
	if (!paid) throw new Error("No matching USDC transfer to merchant");
	settled.add(key);
}

import { erc20Abi, formatUnits, getAddress } from "viem";
import { publicClient, txUrl, walletFromKey } from "../chain";
import { ARC, SERVER } from "../config";
import { emit } from "../events";
import { encodeHeader, type PaymentRequirements } from "../x402";

export type PaidResult<T> = { data: T; txHash: string; priceUsd: number };

export function createPayer(privateKey: string) {
	const wallet = walletFromKey(privateKey);
	const address = wallet.account.address;

	async function balanceUsd(): Promise<number> {
		const raw = await publicClient.readContract({
			address: ARC.usdc,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [address],
		});
		return Number(formatUnits(raw, ARC.usdcDecimals));
	}

	async function pay(req: PaymentRequirements): Promise<`0x${string}`> {
		if (getAddress(req.asset) !== getAddress(ARC.usdc))
			throw new Error(`Unsupported asset ${req.asset}`);
		if (req.network !== ARC.network)
			throw new Error(`Unsupported network ${req.network}`);
		const hash = await wallet.writeContract({
			address: ARC.usdc,
			abi: erc20Abi,
			functionName: "transfer",
			args: [getAddress(req.payTo), BigInt(req.maxAmountRequired)],
		});
		emit("payment_sent", {
			txHash: hash,
			url: txUrl(hash),
			priceUsd: req.priceUsd,
			resource: req.resource,
		});
		const receipt = await publicClient.waitForTransactionReceipt({ hash });
		if (receipt.status !== "success")
			throw new Error(`Payment ${hash} reverted`);
		emit("payment_confirmed", {
			txHash: hash,
			block: Number(receipt.blockNumber),
		});
		return hash;
	}

	async function fetchPaid<T>(
		url: string,
		approve: (req: PaymentRequirements) => Promise<boolean>,
		init: RequestInit = {},
	): Promise<PaidResult<T>> {
		const first = await fetch(url, init);
		if (first.ok)
			return { data: (await first.json()) as T, txHash: "", priceUsd: 0 };
		if (first.status !== 402) throw new Error(`${url} failed: ${first.status}`);
		const body = (await first.json()) as { accepts: PaymentRequirements[] };
		const req = body.accepts[0];
		if (!req)
			throw new Error(`${url} returned 402 without payment requirements`);
		emit("payment_required", {
			resource: url,
			priceUsd: req.priceUsd,
			payTo: req.payTo,
		});
		if (!(await approve(req)))
			throw new Error(`Payment for ${url} not approved`);
		const txHash = await pay(req);
		const second = await fetch(url, {
			...init,
			headers: {
				[SERVER.paymentHeader]: encodeHeader({ txHash, payer: address }),
			},
		});
		if (!second.ok)
			throw new Error(
				`${url} rejected payment: ${second.status} ${await second.text()}`,
			);
		return { data: (await second.json()) as T, txHash, priceUsd: req.priceUsd };
	}

	const postPaid = <T>(
		url: string,
		body: unknown,
		approve: (req: PaymentRequirements) => Promise<boolean>,
	) =>
		fetchPaid<T>(url, approve, { method: "POST", body: JSON.stringify(body) });

	return { address, balanceUsd, fetchPaid, postPaid };
}

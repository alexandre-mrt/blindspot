import { GatewayClient } from "@circle-fin/x402-batching/client";
import { formatUnits } from "viem";
import { txUrl } from "../chain";
import { ARC } from "../config";
import { emit } from "../events";
import { requestApproval } from "./approvals";
import { evaluate, type SpendPolicy } from "./policy";

export function createGatewayPayer(
	privateKey: `0x${string}`,
	policy: SpendPolicy,
) {
	const client = new GatewayClient({ chain: "arcTestnet", privateKey });
	let spentUsd = 0;
	let currentUrl = "";

	client.onBeforePaymentCreation(async (ctx) => {
		const priceUsd = Number(
			formatUnits(BigInt(ctx.selectedRequirements.amount), ARC.usdcDecimals),
		);
		const resource = new URL(
			ctx.paymentRequired.resource?.url ?? currentUrl,
			currentUrl,
		).toString();
		const decision = evaluate(policy, resource, priceUsd, spentUsd);
		emit("policy", { resource, priceUsd, ...decision });
		if (decision.verdict === "deny")
			return { abort: true, reason: decision.reason };
		if (decision.verdict === "needs_approval") {
			const approved = await requestApproval({
				resource,
				priceUsd,
				reason: decision.reason,
			});
			if (!approved) return { abort: true, reason: "rejected by human" };
		}
	});

	client.onAfterPaymentCreation(async (ctx) => {
		emit("payment_signed", {
			resource: currentUrl,
			scheme: ctx.selectedRequirements.scheme,
			gasless: true,
		});
	});

	async function ensureDeposit(minUsd: number, topUpUsd: string) {
		const balances = await client.getBalances();
		const available = Number(balances.gateway.formattedAvailable);
		emit("gateway_balance", {
			availableUsd: available,
			walletUsd: Number(balances.wallet.formatted),
		});
		if (available >= minUsd) return;
		const result = await client.deposit(topUpUsd);
		emit("gateway_deposit", {
			amountUsd: topUpUsd,
			txHash: result.depositTxHash,
			url: txUrl(result.depositTxHash),
		});
	}

	async function pay<T>(
		url: string,
		init: { method?: "GET" | "POST"; body?: unknown } = {},
	) {
		currentUrl = url;
		const result = await client.pay<T>(url, init);
		const priceUsd = Number(result.formattedAmount);
		spentUsd += priceUsd;
		emit("payment_settled", {
			resource: url,
			priceUsd,
			settlement: result.transaction,
			spentUsd,
		});
		return { data: result.data, priceUsd };
	}

	return { address: client.address, ensureDeposit, pay, spent: () => spentUsd };
}

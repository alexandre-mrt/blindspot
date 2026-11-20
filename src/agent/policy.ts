import { POLICY } from "../config";

export type PolicyDecision =
	| { verdict: "allow" }
	| { verdict: "needs_approval"; reason: string }
	| { verdict: "deny"; reason: string };

export type SpendPolicy = {
	sessionBudgetUsd: number;
	perCallMaxUsd: number;
	approvalThresholdUsd: number;
	allowedOrigins: readonly string[];
};

export const defaultPolicy: SpendPolicy = POLICY;

export function evaluate(
	policy: SpendPolicy,
	url: string,
	priceUsd: number,
	spentUsd: number,
): PolicyDecision {
	const origin = new URL(url).origin;
	if (!policy.allowedOrigins.includes(origin))
		return { verdict: "deny", reason: `origin ${origin} not on allowlist` };
	if (priceUsd > policy.perCallMaxUsd) {
		return {
			verdict: "deny",
			reason: `price $${priceUsd} exceeds per-call cap $${policy.perCallMaxUsd}`,
		};
	}
	if (spentUsd + priceUsd > policy.sessionBudgetUsd) {
		return {
			verdict: "deny",
			reason: `would exceed session budget $${policy.sessionBudgetUsd}`,
		};
	}
	if (priceUsd > policy.approvalThresholdUsd) {
		return {
			verdict: "needs_approval",
			reason: `price $${priceUsd} above auto-approve limit $${policy.approvalThresholdUsd}`,
		};
	}
	return { verdict: "allow" };
}

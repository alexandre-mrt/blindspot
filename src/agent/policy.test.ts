import { expect, test } from "bun:test";
import { evaluate, type SpendPolicy } from "./policy";

const policy: SpendPolicy = {
	sessionBudgetUsd: 0.2,
	perCallMaxUsd: 0.1,
	approvalThresholdUsd: 0.04,
	allowedOrigins: ["http://localhost:4021"],
};
const url = "http://localhost:4021/api/feeds/edge";

test("allows a cheap allowlisted call", () => {
	expect(evaluate(policy, url, 0.01, 0).verdict).toBe("allow");
});

test("denies origins outside the allowlist", () => {
	expect(
		evaluate(policy, "https://alpha-whales.example/x", 0.01, 0).verdict,
	).toBe("deny");
});

test("denies calls above the per-call cap", () => {
	expect(evaluate(policy, url, 0.5, 0).verdict).toBe("deny");
});

test("denies calls that would exceed the session budget", () => {
	expect(evaluate(policy, url, 0.03, 0.18).verdict).toBe("deny");
});

test("asks a human above the approval threshold", () => {
	expect(evaluate(policy, url, 0.05, 0).verdict).toBe("needs_approval");
});

const EXPLORER = "https://testnet.arcscan.app";
const TONE = {
	payment_settled: "ok",
	merchant_settled: "ok",
	gateway_deposit: "ok",
	briefing: "ok",
	credits_blinded: "priv",
	credits_ready: "priv",
	mint_signed: "priv",
	credit_spent: "priv",
	merchant_redeemed: "priv",
	approval_required: "warn",
	purchase_failed: "err",
	error: "err",
	approval_timeout: "err",
};

const $ = (id) => document.getElementById(id);
const usd = (n) => `$${Number(n).toFixed(3)}`;

function link(url, text) {
	const a = document.createElement("a");
	a.href = url;
	a.target = "_blank";
	a.textContent = text;
	return a;
}

function summarize(e) {
	switch (e.type) {
		case "start":
			return `agent ${e.agent.slice(0, 10)}… on Arc testnet, private mode ${e.privateMode ? "ON" : "OFF"}`;
		case "gateway_balance":
			return `Circle Gateway balance ${usd(e.availableUsd)} USDC (wallet ${usd(e.walletUsd)})`;
		case "gateway_deposit":
			return `deposited ${e.amountUsd} USDC into Circle Gateway (one on-chain tx)`;
		case "catalog":
			return `discovered ${e.items.length} paid feeds: ${e.items.map((i) => `${i.id} (${usd(i.priceUsd)})`).join(", ")}`;
		case "plan":
			return `${e.planner} planner chose: ${e.ids.join(", ")}`;
		case "policy":
			return `${new URL(e.resource).pathname}${e.credit ? " (1 credit)" : ""} ${usd(e.priceUsd)} → ${e.verdict.toUpperCase()}${e.reason ? ` (${e.reason})` : ""}`;
		case "payment_signed":
			return `x402 ${e.scheme} payment signed off-chain via Circle Gateway: no gas, no tx`;
		case "payment_settled":
			return `nanopayment ${usd(e.priceUsd)} settled by Circle facilitator (batch ${e.settlement.slice(0, 8)}…), total ${usd(e.spentUsd)}`;
		case "merchant_settled":
			return `merchant received ${Number(e.amount) / 1e6} USDC via Gateway batch`;
		case "decision":
			return describeDecision(e.decision);
		case "credits_blinded":
			return `generated ${e.count} secret serials, blinded them (server sees only 0x${e.preview}…)`;
		case "mint_signed":
			return `mint signed ${e.count} blinded tokens without ever seeing their serials`;
		case "credits_ready":
			return `unblinded + verified ${e.count} credits, paid with one ${usd(e.priceUsd)} Gateway nanopayment`;
		case "credit_spent":
			return `x402 blind-credit payment for ${e.resource}: no signature from the wallet, ${e.left} left`;
		case "merchant_redeemed":
			return `merchant redeemed credit #${e.serialTag}: payer = anonymous, unlinkable to any wallet or deposit`;
		case "briefing":
			return "briefing ready";
		case "approval_decision":
			return e.approved ? "human approved" : "human rejected";
		default:
			return e.error ?? e.reason ?? "";
	}
}

function describeDecision(d) {
	if (d.kind === "hold") return "HOLD: nothing clears the edge threshold";
	if (d.kind === "arb")
		return `ARB ${d.arb.event}: +${(d.arb.lockedProfit * 100).toFixed(0)}¢ locked`;
	const s = d.signal;
	return `${s.side} ${s.contract} (${s.event}) market ${(s.mid * 100).toFixed(0)}% vs model ${(s.modelProb * 100).toFixed(0)}%, stake $${d.stakeUsd}`;
}

function appendLog(e) {
	const li = document.createElement("li");
	li.innerHTML = `<span class="t">${e.at.slice(11, 19)}</span><span class="ev ${TONE[e.type] ?? ""}">${e.type}</span>`;
	li.append(document.createTextNode(summarize(e)));
	const tx = e.url ?? (e.txHash ? `${EXPLORER}/tx/${e.txHash}` : null);
	if (tx && e.txHash) li.append(" ", link(tx, "arcscan ↗"));
	$("log").append(li);
	$("log").scrollTop = $("log").scrollHeight;
}

function showApproval(e) {
	const box = $("approvals");
	if (box.classList.contains("empty")) {
		box.classList.remove("empty");
		box.textContent = "";
	}
	const card = document.createElement("div");
	card.className = "approval";
	card.id = `ap-${e.id}`;
	card.textContent = `Agent wants to pay ${usd(e.priceUsd)} for "${e.resource}": ${e.reason}`;
	const row = document.createElement("div");
	for (const [label, approved, cls] of [
		["Approve", true, "yes"],
		["Reject", false, "no"],
	]) {
		const b = document.createElement("button");
		b.textContent = label;
		b.className = cls;
		b.onclick = async () => {
			await fetch("/agent/approve", {
				method: "POST",
				body: JSON.stringify({ id: e.id, approved }),
			});
			card.remove();
		};
		row.append(b);
	}
	card.append(row);
	box.append(card);
}

function handle(e) {
	appendLog(e);
	if (e.type === "start") {
		$("wallet").textContent = e.agent;
		$("wallet").href = `${EXPLORER}/address/${e.agent}`;
		$("budget").textContent = usd(e.policy.sessionBudgetUsd);
		$("policy").textContent =
			`Guardrails (x402 onBeforePaymentCreation hook): per-call cap ${usd(e.policy.perCallMaxUsd)}, human approval above ${usd(e.policy.approvalThresholdUsd)}, allowlist ${e.policy.allowedOrigins.join(", ")}`;
	}
	if (e.type === "gateway_balance")
		$("balance").textContent = usd(e.availableUsd);
	if (e.type === "payment_settled") {
		$("spent").textContent = usd(e.spentUsd);
		$("onchain").textContent = String(Number($("onchain").textContent) + 1);
	}
	if (e.type === "credit_spent")
		$("offchain").textContent = String(Number($("offchain").textContent) + 1);
	if (e.type === "approval_required") showApproval(e);
	if (e.type === "approval_decision" || e.type === "approval_timeout")
		$(`ap-${e.id}`)?.remove();
	if (e.type === "briefing") {
		$("briefing").classList.remove("empty");
		$("briefing").textContent = e.text;
		if ("speechSynthesis" in window) {
			speechSynthesis.speak(new SpeechSynthesisUtterance(e.text));
		}
	}
	if (e.type === "done" || e.type === "error") $("run").disabled = false;
}

$("run").onclick = async () => {
	$("run").disabled = true;
	$("log").textContent = "";
	$("onchain").textContent = "0";
	$("offchain").textContent = "0";
	$("spent").textContent = "$0.000";
	$("approvals").className = "empty";
	$("approvals").textContent = "Nothing waiting.";
	const res = await fetch("/agent/run", {
		method: "POST",
		body: JSON.stringify({
			goal: $("goal").value,
			privateMode: $("private").checked,
		}),
	});
	if (!res.ok) $("run").disabled = false;
};

new EventSource("/events").onmessage = (m) => handle(JSON.parse(m.data));

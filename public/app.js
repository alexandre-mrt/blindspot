import { createChart } from "./chart.js";
import { glow, initStage, midpoint, pop, send } from "./stage.js";

const EXPLORER = "https://testnet.arcscan.app";
const TYPE_MS = 7;
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const layer of ["far", "near"]) {
	const img = document.createElement("img");
	img.className = `city ${layer}`;
	img.alt = "";
	img.src = `/sprites/city-${layer}.png`;
	img.onerror = () => img.remove();
	$("sky").prepend(img);
}

initStage($("stage"));
const chart = createChart($("chart"));

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

async function typeLine(e) {
	const li = document.createElement("li");
	li.innerHTML = `<span class="t">${e.at.slice(11, 19)}</span><span class="ev ${TONE[e.type] ?? ""}">${e.type}</span>`;
	const text = document.createTextNode("");
	const cursor = document.createElement("span");
	cursor.className = "cursor";
	li.append(text, cursor);
	$("log").append(li);
	const full = summarize(e);
	const step = queue.length > 1 ? 12 : 3;
	for (let i = 1; i <= full.length; i += step) {
		text.data = full.slice(0, i);
		$("log").scrollTop = $("log").scrollHeight;
		await sleep(TYPE_MS);
	}
	text.data = full;
	cursor.remove();
	if (e.url && e.txHash) li.append(" ", link(e.url, "arcscan ↗"));
	$("log").scrollTop = $("log").scrollHeight;
}

function animate(e) {
	switch (e.type) {
		case "start":
			glow("agent");
			break;
		case "gateway_balance":
			glow("gateway");
			break;
		case "catalog":
			send("merchant-agent", "data", { tone: "gold" });
			break;
		case "policy":
			if (e.verdict === "deny") {
				send("agent-whale", "request", { tone: "red", stopAt: 0.55 });
				setTimeout(() => pop("denied", midpoint("agent", "whale", 0.55)), 600);
				glow("whale", "lit-red", 2200);
				chart.bump("denied");
			}
			if (e.verdict === "needs_approval") glow("human", "lit", 2400);
			break;
		case "approval_decision":
			if (e.approved) {
				pop("approved", "human");
				send("human-agent", "data", { tone: "gold" });
			} else pop("denied", "human");
			break;
		case "payment_signed":
			send("agent-gateway", "coin", { tone: "gold" });
			setTimeout(() => pop("gasless", "gateway"), 900);
			break;
		case "payment_settled":
			send("gateway-merchant", "coin", { tone: "gold" });
			glow("merchant");
			chart.bump("public");
			break;
		case "credits_blinded":
			for (let i = 0; i < 3; i++)
				send("agent-mint", "blinded", { tone: "violet", delay: i * 250 });
			glow("mint", "lit-violet", 2400);
			break;
		case "mint_signed":
			for (let i = 0; i < 3; i++)
				send("mint-agent", "credit", { tone: "violet", delay: 600 + i * 250 });
			break;
		case "merchant_redeemed":
			send("agent-merchant", "credit", { tone: "violet" }).then(() => {
				pop("anonymous", "merchant");
				glow("merchant", "lit-violet");
			});
			chart.bump("private");
			break;
		case "decision":
			send("oracle-merchant", "data", { tone: "gold" });
			send("merchant-agent", "data", { tone: "gold", delay: 700 });
			glow("oracle");
			break;
		case "briefing":
			glow("agent", "lit", 3000);
			break;
		default:
			break;
	}
}

function updateState(e) {
	if (e.type === "start") {
		$("wallet").textContent = e.agent;
		$("wallet").href = `${EXPLORER}/address/${e.agent}`;
		$("policy").textContent =
			`Guardrails in the x402 hook: cap ${usd(e.policy.perCallMaxUsd)}/call, human approval above ${usd(e.policy.approvalThresholdUsd)}, budget ${usd(e.policy.sessionBudgetUsd)}`;
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
	if (e.type === "approval_decision" || e.type === "approval_timeout") {
		$("approvals").className = "empty";
		$("approvals").textContent = e.approved ? "Approved by you." : "Rejected.";
	}
	if (e.type === "briefing") {
		$("briefing").classList.remove("empty");
		$("briefing").textContent = e.text;
		if (window.speechSynthesis)
			window.speechSynthesis.speak(new SpeechSynthesisUtterance(e.text));
	}
	if (e.type === "done" || e.type === "error") $("run").disabled = false;
}

const queue = [];
let draining = false;

async function drain() {
	if (draining) return;
	draining = true;
	while (queue.length > 0) {
		const e = queue.shift();
		animate(e);
		await typeLine(e);
	}
	draining = false;
}

function handle(e) {
	updateState(e);
	queue.push(e);
	drain();
}

$("run").onclick = async () => {
	$("run").disabled = true;
	$("log").textContent = "";
	queue.length = 0;
	chart.reset();
	$("onchain").textContent = "0";
	$("offchain").textContent = "0";
	$("spent").textContent = "$0.000";
	$("approvals").className = "empty";
	$("approvals").textContent = "No approval pending.";
	$("briefing").className = "empty";
	$("briefing").textContent = "Thinking…";
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

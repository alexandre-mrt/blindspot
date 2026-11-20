const SPRITES = "/sprites";
const STAGE_W = 1000;
const STAGE_H = 760;
const TRAVEL_MS = 1100;

const NODES = {
	human: { x: 150, y: 110, label: "YOU · APPROVER", glyph: "✋" },
	agent: { x: 150, y: 380, label: "AGENT", glyph: "🤖" },
	gateway: { x: 500, y: 130, label: "CIRCLE GATEWAY · ARC", glyph: "⛩" },
	mint: { x: 500, y: 640, label: "BLIND MINT", glyph: "🖋" },
	oracle: { x: 850, y: 110, label: "GEMINI MARKETS", glyph: "📈" },
	merchant: { x: 850, y: 380, label: "ODDS DESK API", glyph: "🏪" },
	whale: { x: 850, y: 640, label: "UNVETTED FEED", glyph: "🐋" },
};

const LANES = {
	"human-agent": "M150 110 L150 380",
	"agent-gateway": "M150 380 Q260 140 500 130",
	"gateway-merchant": "M500 130 Q740 140 850 380",
	"agent-mint": "M150 380 Q260 630 500 640",
	"mint-agent": "M500 640 Q260 630 150 380",
	"agent-merchant": "M150 380 L850 380",
	"merchant-agent": "M850 380 L150 380",
	"oracle-merchant": "M850 110 L850 380",
	"agent-whale": "M150 380 Q420 560 850 640",
};

const PACKETS = {
	coin: { sprite: "coin", glyph: "🪙" },
	credit: { sprite: "credit", glyph: "🎟" },
	blinded: { sprite: "blinded", glyph: "🧊" },
	data: { sprite: "arrow-gold", glyph: "▶" },
	request: { sprite: "arrow-violet", glyph: "▶" },
};

const POPS = {
	denied: { sprite: "stamp-denied", text: "DENIED", color: "#e0563f" },
	approved: { sprite: "stamp-approved", text: "APPROVED", color: "#ffcc6f" },
	anonymous: { sprite: "mask", text: "ANONYMOUS", color: "#c9a7ff" },
	gasless: { sprite: "lightning-off", text: "NO GAS", color: "#acc6e9" },
	guard: { sprite: "shield", text: "GUARDRAIL", color: "#acc6e9" },
};

let root = null;
const lanes = {};
const nodes = {};

function spriteOr(name, fallback, className) {
	const img = document.createElement("img");
	img.src = `${SPRITES}/${name}.png`;
	img.alt = "";
	img.className = className;
	img.onerror = () => img.replaceWith(fallback());
	return img;
}

function glyphBox(glyph, className) {
	const div = document.createElement("div");
	div.className = className;
	div.textContent = glyph;
	return div;
}

function buildLanes() {
	const ns = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("class", "lanes");
	svg.setAttribute("viewBox", `0 0 ${STAGE_W} ${STAGE_H}`);
	for (const [id, d] of Object.entries(LANES)) {
		if (id === "mint-agent" || id === "merchant-agent") continue;
		const path = document.createElementNS(ns, "path");
		path.setAttribute("d", d);
		path.setAttribute("class", "lane");
		svg.append(path);
		lanes[id] = path;
	}
	lanes["mint-agent"] = lanes["agent-mint"];
	lanes["merchant-agent"] = lanes["agent-merchant"];
	root.append(svg);
}

function buildNodes() {
	for (const [id, n] of Object.entries(NODES)) {
		const el = document.createElement("div");
		el.className = "node";
		el.style.left = `${n.x}px`;
		el.style.top = `${n.y}px`;
		el.append(spriteOr(id, () => glyphBox(n.glyph, "ph"), ""));
		const label = document.createElement("p");
		label.textContent = n.label;
		el.append(label);
		root.append(el);
		nodes[id] = el;
	}
}

export function initStage(el) {
	root = el;
	buildLanes();
	buildNodes();
	const fit = () => {
		const box = el.parentElement.getBoundingClientRect();
		const scale = Math.min(
			1,
			(box.width - 24) / STAGE_W,
			(box.height - 60) / STAGE_H,
		);
		el.style.transform = `scale(${scale})`;
	};
	fit();
	window.addEventListener("resize", fit);
}

export function glow(id, tone = "lit", ms = 1600) {
	const el = nodes[id];
	if (!el) return;
	el.classList.add(tone);
	setTimeout(() => el.classList.remove(tone), ms);
}

function heat(laneId, tone, ms) {
	const lane = lanes[laneId];
	if (!lane) return;
	lane.classList.add("hot", tone);
	setTimeout(() => lane.classList.remove("hot", tone), ms);
}

export function send(
	laneId,
	kind,
	{ tone = "gold", stopAt = 1, delay = 0 } = {},
) {
	const d = LANES[laneId];
	const spec = PACKETS[kind];
	if (!d || !spec) return Promise.resolve();
	return new Promise((resolve) => {
		setTimeout(() => {
			const packet = document.createElement("div");
			packet.className = "packet";
			packet.append(
				spriteOr(spec.sprite, () => glyphBox(spec.glyph, "ph"), ""),
			);
			packet.style.offsetPath = `path('${d}')`;
			packet.style.offsetRotate = "0deg";
			root.append(packet);
			heat(laneId, tone, TRAVEL_MS + 300);
			const anim = packet.animate(
				[{ offsetDistance: "0%" }, { offsetDistance: `${stopAt * 100}%` }],
				{
					duration: TRAVEL_MS * stopAt,
					easing: "cubic-bezier(.45,0,.2,1)",
					fill: "forwards",
				},
			);
			anim.onfinish = () => {
				setTimeout(() => packet.remove(), 250);
				resolve();
			};
		}, delay);
	});
}

export function pop(kind, at) {
	const spec = POPS[kind];
	const n = NODES[at] ?? at;
	if (!spec || !n) return;
	const el = spriteOr(
		spec.sprite,
		() => {
			const box = glyphBox(spec.text, "pop ph");
			box.style.color = spec.color;
			box.style.left = `${n.x}px`;
			box.style.top = `${n.y}px`;
			return box;
		},
		"pop",
	);
	el.style.left = `${n.x}px`;
	el.style.top = `${n.y}px`;
	root.append(el);
	setTimeout(() => el.remove(), 1900);
}

export const midpoint = (a, b, t = 0.5) => ({
	x: NODES[a].x + (NODES[b].x - NODES[a].x) * t,
	y: NODES[a].y + (NODES[b].y - NODES[a].y) * t,
});

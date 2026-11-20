const NS = "http://www.w3.org/2000/svg";
const ROWS = [
	{ key: "public", label: "Gateway (payer known)", color: "#e9a13f" },
	{ key: "private", label: "Blind credit (anonymous)", color: "#c9a7ff" },
	{ key: "denied", label: "Denied by guardrail", color: "#e0563f" },
];
const BAR_X = 0;
const BAR_MAX = 230;
const ROW_H = 48;

export function createChart(svg) {
	const counts = { public: 0, private: 0, denied: 0 };
	const bars = {};
	const values = {};
	svg.setAttribute("viewBox", `0 0 300 ${ROWS.length * ROW_H}`);
	ROWS.forEach((row, i) => {
		const y = i * ROW_H;
		const label = document.createElementNS(NS, "text");
		label.setAttribute("x", "0");
		label.setAttribute("y", String(y + 14));
		label.textContent = row.label;
		const track = document.createElementNS(NS, "rect");
		track.setAttribute("x", String(BAR_X));
		track.setAttribute("y", String(y + 20));
		track.setAttribute("width", String(BAR_MAX));
		track.setAttribute("height", "16");
		track.setAttribute("fill", "#1b3158");
		const bar = document.createElementNS(NS, "rect");
		bar.setAttribute("x", String(BAR_X));
		bar.setAttribute("y", String(y + 20));
		bar.setAttribute("height", "16");
		bar.setAttribute("width", "0");
		bar.setAttribute("fill", row.color);
		bar.style.transition = "width 500ms steps(6)";
		const value = document.createElementNS(NS, "text");
		value.setAttribute("x", String(BAR_MAX + 10));
		value.setAttribute("y", String(y + 34));
		value.textContent = "0";
		svg.append(label, track, bar, value);
		bars[row.key] = bar;
		values[row.key] = value;
	});

	function render() {
		const max = Math.max(4, ...Object.values(counts));
		for (const row of ROWS) {
			bars[row.key].setAttribute(
				"width",
				String((counts[row.key] / max) * BAR_MAX),
			);
			values[row.key].textContent = String(counts[row.key]);
		}
	}

	return {
		bump(key) {
			counts[key] += 1;
			render();
		},
		reset() {
			for (const key of Object.keys(counts)) counts[key] = 0;
			render();
		},
	};
}

import { edgeSignals } from "../src/signals";

const signals = await edgeSignals();
const out = `backtest/forward-${new Date().toISOString().slice(0, 16).replace(":", "")}.json`;
await Bun.write(
	out,
	JSON.stringify({ capturedAt: new Date().toISOString(), signals }, null, 2),
);
console.log(`${signals.length} signals saved to ${out}`);

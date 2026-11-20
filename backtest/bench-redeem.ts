import { blind, newSerial, type Token, unblind } from "../src/credits/blind";
import { CREDIT_BATCH, createMint } from "../src/credits/mint";

const mint = createMint();
const pk = {
	n: BigInt(`0x${mint.publicKey().n}`),
	e: BigInt(`0x${mint.publicKey().e}`),
};
const tokens: Token[] = [];
for (let k = 0; k < 40; k++) {
	const serials = Array.from({ length: CREDIT_BATCH.size }, newSerial);
	const bl = serials.map((s) => blind(s, pk));
	const sigs = mint.signBatch(bl.map((b) => b.blinded.toString(16)));
	sigs.forEach((h, i) =>
		tokens.push({
			serial: serials[i]!,
			signature: unblind(BigInt(`0x${h}`), bl[i]!.r, pk).toString(16),
		}),
	);
}
const t0 = performance.now();
for (const t of tokens) mint.redeem(t);
const dt = (performance.now() - t0) / tokens.length;
console.log(
	`${tokens.length} redemptions, ${dt.toFixed(3)} ms each, ~${Math.round(1000 / dt)}/s on one core`,
);

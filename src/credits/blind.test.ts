import { expect, test } from "bun:test";
import {
	blind,
	generateKeyPair,
	newSerial,
	signBlinded,
	unblind,
	verify,
} from "./blind";

const kp = generateKeyPair();

test("unblinded signature verifies on the original serial", () => {
	const serial = newSerial();
	const { blinded, r } = blind(serial, kp);
	expect(verify(serial, unblind(signBlinded(blinded, kp), r, kp), kp)).toBe(
		true,
	);
});

test("signer never sees the serial: blinded value differs per blinding", () => {
	const serial = newSerial();
	expect(blind(serial, kp).blinded).not.toBe(blind(serial, kp).blinded);
});

test("signature does not verify for another serial", () => {
	const serial = newSerial();
	const { blinded, r } = blind(serial, kp);
	expect(
		verify(newSerial(), unblind(signBlinded(blinded, kp), r, kp), kp),
	).toBe(false);
});

test("signer rejects out-of-range input", () => {
	expect(() => signBlinded(kp.n, kp)).toThrow();
});

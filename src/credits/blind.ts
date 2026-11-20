import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";

export type PublicKey = { n: bigint; e: bigint };
type KeyPair = PublicKey & { d: bigint };
export type Token = { serial: string; signature: string };

const FDH_BLOCKS = 8;

const b64ToBig = (b64url: string) =>
	BigInt(`0x${Buffer.from(b64url, "base64url").toString("hex")}`);
export const bigToHex = (x: bigint) => x.toString(16);
export const hexToBig = (hex: string) => {
	if (!/^[0-9a-f]+$/i.test(hex)) throw new Error("Invalid hex integer");
	return BigInt(`0x${hex}`);
};

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
	let result = 1n;
	let b = base % mod;
	let e = exp;
	while (e > 0n) {
		if (e & 1n) result = (result * b) % mod;
		b = (b * b) % mod;
		e >>= 1n;
	}
	return result;
}

function modInverse(a: bigint, m: bigint): bigint {
	let [oldR, r] = [((a % m) + m) % m, m];
	let [oldS, s] = [1n, 0n];
	while (r !== 0n) {
		const q = oldR / r;
		[oldR, r] = [r, oldR - q * r];
		[oldS, s] = [s, oldS - q * s];
	}
	if (oldR !== 1n) throw new Error("Value not invertible");
	return ((oldS % m) + m) % m;
}

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

export function generateKeyPair(): KeyPair {
	const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
	const jwk = privateKey.export({ format: "jwk" });
	if (!jwk.n || !jwk.e || !jwk.d) throw new Error("RSA key export failed");
	return { n: b64ToBig(jwk.n), e: b64ToBig(jwk.e), d: b64ToBig(jwk.d) };
}

function hashToDomain(serial: string, n: bigint): bigint {
	const blocks = Array.from({ length: FDH_BLOCKS }, (_, i) =>
		createHash("sha256")
			.update(`odds-desk-credit:${i}:${serial}`)
			.digest("hex"),
	);
	return BigInt(`0x${blocks.join("")}`) % n;
}

function randomCoprime(n: bigint): bigint {
	for (;;) {
		const r = BigInt(`0x${randomBytes(256).toString("hex")}`) % n;
		if (r > 1n && gcd(r, n) === 1n) return r;
	}
}

export function blind(serial: string, pk: PublicKey) {
	const r = randomCoprime(pk.n);
	const blinded = (hashToDomain(serial, pk.n) * modPow(r, pk.e, pk.n)) % pk.n;
	return { blinded, r };
}

export const signBlinded = (blinded: bigint, kp: KeyPair) => {
	if (blinded <= 0n || blinded >= kp.n)
		throw new Error("Blinded value out of range");
	return modPow(blinded, kp.d, kp.n);
};

export const unblind = (blindSig: bigint, r: bigint, pk: PublicKey) =>
	(blindSig * modInverse(r, pk.n)) % pk.n;

export const verify = (serial: string, signature: bigint, pk: PublicKey) =>
	modPow(signature, pk.e, pk.n) === hashToDomain(serial, pk.n);

export const newSerial = () => randomBytes(32).toString("hex");

import type { FacilitatorClient } from "@x402/core/server";
import type {
	AssetAmount,
	Network,
	PaymentPayload,
	PaymentPayloadResult,
	PaymentRequirements,
	SchemeNetworkClient,
	SchemeNetworkServer,
	SettleResponse,
	SupportedKind,
	SupportedResponse,
	VerifyResponse,
} from "@x402/core/types";
import type { Token } from "./blind";
import type { Mint } from "./mint";

export const BLIND_CREDIT_SCHEME = "blind-credit";
export const CREDIT_ASSET = "odds-desk-credit";
const ANONYMOUS = "anonymous";

const toToken = (payload: PaymentPayload): Token => {
	const { serial, signature } = payload.payload as Partial<Token>;
	return { serial: String(serial ?? ""), signature: String(signature ?? "") };
};

export class BlindCreditServerScheme implements SchemeNetworkServer {
	readonly scheme = BLIND_CREDIT_SCHEME;
	readonly defaultAssetTransferMethod = "blind-token";
	readonly paymentFlows = {
		"blind-token": { supported: ["upfront"], default: "upfront" },
	} as const;

	constructor(private readonly mintUrl: string) {}

	async parsePrice(): Promise<AssetAmount> {
		return { asset: CREDIT_ASSET, amount: "1" };
	}

	async enhancePaymentRequirements(
		requirements: PaymentRequirements,
	): Promise<PaymentRequirements> {
		return {
			...requirements,
			extra: { ...requirements.extra, mint: this.mintUrl },
		};
	}
}

export class BlindCreditFacilitator implements FacilitatorClient {
	constructor(
		private readonly mint: Mint,
		private readonly network: Network,
		private readonly onRedeem: (tag: string) => void,
	) {}

	async getSupported(): Promise<SupportedResponse> {
		const kind: SupportedKind = {
			x402Version: 2,
			scheme: BLIND_CREDIT_SCHEME,
			network: this.network,
		};
		return { kinds: [kind], extensions: [], signers: {} };
	}

	async verify(payload: PaymentPayload): Promise<VerifyResponse> {
		const reason = this.mint.check(toToken(payload));
		return reason
			? { isValid: false, invalidReason: reason }
			: { isValid: true, payer: ANONYMOUS };
	}

	async settle(payload: PaymentPayload): Promise<SettleResponse> {
		try {
			const tag = this.mint.redeem(toToken(payload));
			this.onRedeem(tag);
			return {
				success: true,
				transaction: `credit:${tag}`,
				network: this.network,
				payer: ANONYMOUS,
			};
		} catch (err) {
			return {
				success: false,
				errorReason: (err as Error).message,
				transaction: "",
				network: this.network,
			};
		}
	}
}

export class BlindCreditClientScheme implements SchemeNetworkClient {
	readonly scheme = BLIND_CREDIT_SCHEME;

	constructor(private readonly takeToken: () => Token | undefined) {}

	async createPaymentPayload(
		x402Version: number,
	): Promise<PaymentPayloadResult> {
		const token = this.takeToken();
		if (!token) throw new Error("No blind credits left");
		return { x402Version, payload: { ...token } };
	}
}

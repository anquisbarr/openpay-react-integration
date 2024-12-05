export { OpenPayClient, createOpenPay } from "./openpay-client";

export const getEnvironment = () => ({
	isDevelopment: process.env.NODE_ENV === "development",
	isBun: typeof process !== "undefined" && process.versions && process.versions.bun,
	isNode: typeof process !== "undefined" && process.versions && process.versions.node,
});

export const DEV = {
	testConfig: {
		merchantId: "test-merchant-id",
		publicKey: "test-public-key",
		isSandbox: true,
	},
	validateConfig: (config: unknown) => {
		try {
			const { merchantId, publicKey, isSandbox } = config as {
				merchantId: string;
				publicKey: string;
				isSandbox: boolean;
			};
			return {
				isValid: Boolean(merchantId && publicKey !== undefined && isSandbox !== undefined),
				config: { merchantId, publicKey, isSandbox },
			};
		} catch {
			return { isValid: false, config: null };
		}
	},
};

export type {
	Address,
	Card, CardFieldStatus, CardOperations, CardType, CardValidation, CardValidationResult, DeviceSession, ErrorCallback, FieldStatusRecord, OpenPayConfig, OpenPayError, OpenPayInstance, SuccessCallback, Token, TokenOperations, UseOpenPayOptions, UseOpenPayResult
} from "./types/openpay";


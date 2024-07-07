import type { OpenPay } from "openpay";

declare global {
	interface Window {
		OpenPay: OpenPay;
	}
}

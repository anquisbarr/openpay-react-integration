import type { OpenPayInstance } from "./openpay";

declare global {
	interface Window {
		OpenPay: OpenPayInstance;
		_sift?: unknown;
		btoa: (data: string) => string;
		atob: (data: string) => string;
	}
}

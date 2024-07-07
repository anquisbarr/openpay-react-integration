/**
 * @fileoverview TypeScript declarations for the OpenPay library.
 * @module openpay
 */

declare module "openpay" {
	/**
	 * Represents an OpenPay error.
	 */
	export interface OpenPayError {
		category: string;
		description: string;
		error_code: number;
		http_code: number;
		request_id: string;
	}

	/**
	 * Represents a card object.
	 */
	export interface Card {
		id: string;
		type: string;
		brand: string;
		allows_charges: boolean;
		allows_payouts: boolean;
		creation_date: string;
		bank_name: string;
		holder_name: string;
		card_number: string;
		expiration_month: string;
		expiration_year: string;
		cvv2?: string;
		address?: Address;
	}

	/**
	 * Represents an address object.
	 */
	export interface Address {
		city: string;
		country_code: string;
		postal_code: string;
		line1: string;
		line2?: string;
		line3?: string;
		state: string;
	}

	/**
	 * Represents the data of a token object.
	 */
	export interface TokenData {
		id: string;
		card: Card;
		creation_date: string;
	}

	/**
	 * Represents a token object.
	 */
	export interface Token {
		data: TokenData;
	}

	/**
	 * Represents a success callback function.
	 * @template T - The type of the response.
	 * @param response - The response object.
	 */
	export type SuccessCallback<T> = (response: T) => void;

	/**
	 * Represents an error callback function.
	 * @param error - The OpenPay error object.
	 */
	export type ErrorCallback = (error: OpenPayError) => void;

	/**
	 * Represents the options for a JSONP request.
	 * @template TData - The type of the response data.
	 * @template TError - The type of the error data.
	 */
	export interface JsonpOptions<TData = unknown, TError = unknown> {
		callbackName: string;
		onSuccess: (data: TData) => void;
		onError: (error: TError) => void;
		timeout: number;
		url: string;
		data: TData;
	}

	/**
	 * Represents a JSONP utility.
	 */
	export interface Jsonp {
		/**
		 * Sends a JSONP request.
		 * @template TData - The type of the response data.
		 * @template TError - The type of the error data.
		 * @param options - The options for the JSONP request.
		 */
		request<TData = unknown, TError = unknown>(
			options: JsonpOptions<TData, TError>,
		): void;
	}

	/**
	 * Represents the OpenPay library.
	 */
	export interface OpenPay {
		setId(merchantId: string): void;
		setApiKey(apiKey: string): void;
		setSandboxMode(sandbox: boolean): void;
		token: {
			/**
			 * Creates a new token.
			 * @param data - The card data.
			 * @param onSuccess - The success callback.
			 * @param onError - The error callback.
			 */
			create(
				data: Card,
				onSuccess: SuccessCallback<Token>,
				onError: ErrorCallback,
			): void;
		};
		deviceData: {
			/**
			 * Sets up the device data.
			 * @param elementId - The ID of the element to attach the device data.
			 * @param deviceIdFieldName - The name of the device ID field.
			 * @returns The device data.
			 */
			setup(elementId: string, deviceIdFieldName?: string): string;
		};
	}

	/**
	 * The OpenPay library instance.
	 */
	const openpay: OpenPay;
	export default openpay;
}

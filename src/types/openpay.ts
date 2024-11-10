import type { z } from 'zod';
import type { addressSchema, cardSchema, tokenSchema } from '../utils/validator';

/**
 * OpenPay Configuration
 */
export interface OpenPayConfig {
	merchantId: string;
	publicKey: string;
	isSandbox: boolean;
	formId?: string;
	deviceIdFieldName?: string;
}

/**
 * Hook Options
 */
export interface UseOpenPayOptions extends OpenPayConfig {
	formId?: string;
}

/**
 * Address type from Zod schema
 */
export type Address = z.infer<typeof addressSchema>;

/**
 * Card type from Zod schema
 */
export type Card = z.infer<typeof cardSchema>;

/**
 * Token type from Zod schema
 */
export type Token = z.infer<typeof tokenSchema>;

/**
 * Card Field Status for real-time validation
 */
export interface CardFieldStatus {
	isValid: boolean;
	message: string;
	cardType?: CardType;
	isDirty?: boolean;
	value?: string;
}

/**
 * Card Validation Result
 */
export interface CardValidationResult {
	isValid: boolean;
	errors: {
		cardNumber?: boolean;
		cvv?: boolean;
		expiry?: boolean;
		holderName?: boolean;
	};
	cardType?: CardType;
}

/**
 * OpenPay Error Structure
 */
export interface OpenPayError {
	message: string;
	data: {
		category: string;
		description: string;
		error_code: number;
		http_code: number;
		request_id: string;
	};
	status: number;
}

/**
 * Card Field Validation Interface
 */
export interface CardFieldValidation {
	validateField: (fieldName: keyof Card, value: string, cardNumber?: string) => CardFieldStatus;
	validateCardNumber: (value: string) => CardFieldStatus;
	validateCVC: (value: string, cardNumber?: string) => CardFieldStatus;
	validateExpiry: (month: string, year: string) => CardFieldStatus;
	validateHolderName: (value: string) => CardFieldStatus;
}

/**
 * Card Validation Interface
 */
export interface CardValidation {
	validateCardNumber: (cardNumber: string) => boolean;
	validateCVC: (cvc: string, cardNumber?: string) => boolean;
	validateExpiry: (month: string, year: string) => boolean;
	cardType: (cardNumber: string) => string;
	validateCard: (card: Card) => CardValidationResult;
	getType?: (cardNumber: string) => CardType;
}

/**
 * Success and Error Callbacks
 */
export type SuccessCallback<T> = (response: T) => void;
export type ErrorCallback = (error: OpenPayError) => void;

/**
 * Device Session Interface
 */
export interface DeviceSession {
	setup(elementId: string, deviceIdFieldName?: string): string;
}

/**
 * Token Operations Interface
 */
export interface TokenOperations {
	create(data: Card, successCallback: SuccessCallback<Token>, errorCallback: ErrorCallback): void;
	extractFormAndCreate(
		form: HTMLFormElement | string,
		successCallback: SuccessCallback<Token>,
		errorCallback: ErrorCallback,
	): void;
}

/**
 * Card Operations Interface with Field Validation
 */
export interface CardOperations extends CardValidation {
	fields: CardFieldValidation;
	update(
		data: Partial<Card>,
		successCallback: SuccessCallback<Card>,
		errorCallback: ErrorCallback,
		customerId?: string,
		cardId?: string,
	): void;
}

/**
 * OpenPay Instance Interface
 */
export interface OpenPayInstance {
	setId(merchantId: string): void;
	getId(): string;
	setApiKey(apiKey: string): void;
	getApiKey(): string;
	setSandboxMode(enabled: boolean): void;
	getSandboxMode(): boolean;
	card: CardOperations;
	token: TokenOperations;
	deviceData: DeviceSession;
	extractFormInfo(form: HTMLFormElement | string): Record<string, string | number | boolean>;
}

/**
 * Hook Result Interface with Field Validation
 */
export interface UseOpenPayResult {
	loading: boolean;
	error: OpenPayError | null;
	isInitialized: boolean;
	deviceSessionId: string;
	createToken: (cardData: Card) => Promise<Token>;
	validateCard: {
		number: (cardNumber: string) => boolean;
		cvv: (cvv: string, cardNumber?: string) => boolean;
		expiry: (month: string, year: string) => boolean;
		fields: CardFieldValidation;
	};
	resetError: () => void;
}

/**
 * Supported Card Types
 */
export type CardType =
	| 'visa'
	| 'mastercard'
	| 'american_express'
	| 'diners_club'
	| 'discover'
	| 'visa_electron'
	| 'maestro'
	| 'unknown';

/**
 * Field Status Record Type
 */
export type FieldStatusRecord = Record<keyof Card, CardFieldStatus>;

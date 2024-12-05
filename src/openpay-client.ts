import type {
	Card,
	CardFieldStatus,
	CardType,
	CardValidationResult,
	OpenPayConfig,
	OpenPayError,
	OpenPayFormError,
	Token,
} from "./types/openpay";
import { cardUtils } from "./utils/card";


export class OpenPayClient {
	private initialized = false;
	private deviceSessionId = "";
	private maxRetries = 3;
	private retryDelay = 2000;
	private maxRetryDelay = 10000;
	private retryTimeout?: number;
	private healthCheckInterval?: number;
	private retryAttempts = 0;

	// Core functionality
	public async initialize(): Promise<void> {
		await this.initializeWithRetry();
	}

	private readonly OPENPAY_SCRIPTS = {
		core: {
			src: "https://js.openpay.pe/openpay.v1.min.js",
		},
		data: {
			src: "https://js.openpay.pe/openpay-data.v1.min.js",
		},
	} as const;

	private scriptCache: Map<
		string,
		{
			status: "loading" | "loaded" | "error";
			promise: Promise<void>;
			retries: number;
		}
	> = new Map();

	private readonly OPENPAY_FORM_FIELDS = {
		CARD_NUMBER: "card_number",
		HOLDER_NAME: "holder_name",
		EXPIRATION_MONTH: "expiration_month",
		EXPIRATION_YEAR: "expiration_year",
		CVV2: "cvv2",
	} as const;

	constructor(private config: OpenPayConfig) {
		this.initialize();
		this.startHealthCheck();
	}

	private async initializeWithRetry(silent = false): Promise<void> {
		try {
			await this.loadScripts();

			// Verify OpenPay global object
			if (typeof window.OpenPay === "undefined") {
				throw new Error("OpenPay global object not initialized");
			}

			// Configure OpenPay instance
			window.OpenPay.setId(this.config.merchantId);
			window.OpenPay.setApiKey(this.config.publicKey);
			window.OpenPay.setSandboxMode(this.config.isSandbox);

			// Setup device session
			this.deviceSessionId = (await this.setupDeviceSession()) || "";

			if (!this.deviceSessionId) {
				throw new Error("Device session setup failed");
			}

			this.initialized = true;
			this.retryAttempts = 0;
		} catch (error) {
			this.retryAttempts++;

			if (!silent) {
				console.warn(`OpenPay initialization attempt ${this.retryAttempts} failed:`, error);
			}

			if (this.retryAttempts < this.maxRetries) {
				this.scheduleRetry();
				return;
			}

			throw new Error(
				`Failed to initialize after ${this.maxRetries} attempts: ${(error as Error).message}`,
			);
		}
	}

	private async setupDeviceSession(): Promise<string | null> {
		try {
			const formId = this.config.formId || "openpay-payment-form";
			let formElement = document.getElementById(formId);

			// If form doesn't exist, create a temporary one
			if (!formElement) {
				formElement = document.createElement("form");
				formElement.id = formId;
				formElement.style.display = "none";
				document.body.appendChild(formElement);
			}

			const deviceSessionId = window.OpenPay.deviceData.setup(
				formId,
				this.config.deviceIdFieldName,
			);

			// Clean up temporary form if we created it
			if (!this.config.formId) {
				formElement.remove();
			}

			return deviceSessionId || null;
		} catch (error) {
			console.debug("Device session setup failed:", error);
			return null;
		}
	}

	private scheduleRetry(): void {
		if (this.retryTimeout) {
			clearTimeout(this.retryTimeout);
		}

		const delay = Math.min(this.retryDelay * 2 ** this.retryAttempts, this.maxRetryDelay);
		this.retryTimeout = window.setTimeout(() => this.initializeWithRetry(true), delay);
	}

	private startHealthCheck(): void {
		// Check every 30 seconds
		this.healthCheckInterval = window.setInterval(() => {
			if (!this.initialized || !this.deviceSessionId) {
				this.initialize();
			}
		}, 30000);
	}

	private async loadScripts(): Promise<void> {
		try {
			const loadPromises = Object.entries(this.OPENPAY_SCRIPTS).map(([key, config]) => {
				const cached = this.scriptCache.get(key);
				if (cached?.status === "loaded") {
					return cached.promise;
				}

				if (cached?.status === "loading") {
					return cached.promise;
				}

				const promise = new Promise<void>((resolve, reject) => {
					const script = document.createElement("script");
					script.src = config.src;
					script.async = true;
					script.defer = true;

					const timeoutId = setTimeout(() => {
						handleError(new Error("Script load timeout"));
					}, 10000);

					const cleanup = () => {
						script.removeEventListener("load", handleLoad);
						script.removeEventListener("error", handleError);
						clearTimeout(timeoutId);
					};

					const handleLoad = () => {
						cleanup();
						const cached = this.scriptCache.get(key);
						if (!cached) {
							throw new Error("Script cache entry not found");
						}
						this.scriptCache.set(key, {
							...cached,
							status: "loaded",
						});
						resolve();
					};

					const handleError = (_: Error | Event) => {
						cleanup();
						script.remove();
						const cached = this.scriptCache.get(key);

						if (cached && cached.retries < this.maxRetries) {
							this.scriptCache.set(key, {
								...cached,
								status: "error",
								retries: cached.retries + 1,
							});
							// Retry with exponential backoff
							setTimeout(
								() => {
									this.loadScripts().then(resolve).catch(reject);
								},
								this.retryDelay * 2 ** cached.retries,
							);
						} else {
							reject(new Error(`Failed to load ${key} script after ${this.maxRetries} attempts`));
						}
					};

					script.addEventListener("load", handleLoad);
					script.addEventListener("error", handleError);

					document.head.appendChild(script);
				});

				this.scriptCache.set(key, {
					status: "loading",
					promise,
					retries: 0,
				});

				return promise;
			});

			await Promise.all(loadPromises);
		} catch (error) {
			this.scriptCache.clear();
			throw new Error(`Script loading failed: ${(error as Error).message}`);
		}
	}

	public async ensureInitialized(): Promise<void> {
		if (!this.initialized || !this.deviceSessionId) {
			await this.initializeWithRetry(false);
		}

		// Verify initialization state
		if (!window.OpenPay?.card?.validateCardNumber) {
			this.initialized = false;
			throw new Error("OpenPay methods not available");
		}
	}

	public async getFormCardInformation(form: HTMLFormElement | string): Promise<Card> {
		await this.ensureInitialized();

		const formElement = typeof form === "string" ? document.getElementById(form) : form;
		if (!formElement) {
			throw new Error("Form element not found");
		}

		// Validate required attributes
		const missingAttributes = this.validateFormAttributes(formElement);
		if (missingAttributes.length > 0) {
			const error = new Error("Missing required form attributes") as unknown as OpenPayFormError;
			error.missingAttributes = missingAttributes;
			throw error;
		}

		const formInfo = window.OpenPay.extractFormInfo(formElement as HTMLFormElement);

		return {
			card_number: String(formInfo.card_number || ""),
			holder_name: String(formInfo.holder_name || ""),
			expiration_year: String(formInfo.expiration_year || ""),
			expiration_month: String(formInfo.expiration_month || ""),
			cvv2: String(formInfo.cvv2 || ""),
		} as const;
	}

	public async createToken(card: Card): Promise<Token> {
		await this.ensureInitialized();

		// Clean card data before sending to OpenPay
		const cleanCard: Card = {
			card_number: card.card_number.replace(/\s+/g, ""),
			expiration_month: card.expiration_month.trim(),
			expiration_year: card.expiration_year.trim(),
			holder_name: card.holder_name.trim(),
			cvv2: card.cvv2.trim()
		};

		return new Promise((resolve, reject) => {
			window.OpenPay.token.create(cleanCard, resolve, reject);
		});
	}

	public async createTokenFromForm(form: HTMLFormElement | string): Promise<Token> {
		await this.ensureInitialized();
		return new Promise((resolve, reject) => {
			window.OpenPay.token.extractFormAndCreate(
				form,
				(response: Token) => resolve(response),
				(error: OpenPayError) => reject(error),
			);
		});
	}

	public getDeviceSessionId(): string {
		return this.deviceSessionId;
	}

	public card = {
		fields: {
			validateField: (
				fieldName: keyof Card,
				value: string,
				cardNumber?: string,
			): CardFieldStatus => {
				// Try initialization but don't await
				this.ensureInitialized();

				// Cache card type results
				const getCardTypeSync = (number: string): CardType => {
					try {
						if (!this.initialized) return "unknown";
						const type = window.OpenPay.card.cardType(number);
						return type && typeof type === "string" ? (type as CardType) : "unknown";
					} catch {
						return "unknown";
					}
				};

				switch (fieldName) {
					case "card_number": {
						const isValid = this.initialized && window.OpenPay.card.validateCardNumber(value);
						const cardType = getCardTypeSync(value);
						return {
							isValid,
							cardType,
							message: isValid
								? `Valid ${cardType} card`
								: value.length > 0
									? "Invalid card number"
									: "",
							isDirty: true,
							value,
						};
					}

					case "cvv2": {
						const isValid = this.initialized && window.OpenPay.card.validateCVC(value, cardNumber);
						const cardType = cardNumber ? getCardTypeSync(cardNumber) : undefined;
						return {
							isValid,
							cardType,
							message: isValid
								? "Valid CVV"
								: value.length > 0
									? `Invalid CVV (${cardType === "american_express" ? "4" : "3"} digits required)`
									: "",
							isDirty: true,
							value,
						};
					}
					case "holder_name": {
						const isValid = this.card.validateHolderName(value);
						return {
							isValid,
							message: isValid
								? "Valid name"
								: value.length > 0
									? "Name must contain only letters and spaces (min 3 characters)"
									: "",
							isDirty: true,
							value,
						};
					}
					case "expiration_month":
					case "expiration_year": {
						const month = fieldName === "expiration_month" ? value : cardNumber || "";
						const year = fieldName === "expiration_year" ? value : cardNumber || "";
						const isValid = this.initialized && window.OpenPay.card.validateExpiry(month, year);
						return {
							isValid,
							message: isValid
								? "Valid expiration date"
								: month.length > 0 && year.length > 0
									? "Invalid expiration date"
									: "",
							isDirty: true,
							value,
						};
					}
					default:
						return {
							isValid: false,
							message: "Invalid field",
							isDirty: true,
							value,
						};
				}
			},
		},

		validateNumber: (number: string): boolean => {
			const cleanNumber = number.replace(/\s+/g, "");
			return window.OpenPay?.card?.validateCardNumber?.(cleanNumber) ?? false;
		},

		validateCVC: (cvc: string, cardType?: CardType): boolean => {
			return window.OpenPay?.card?.validateCVC?.(cvc, cardType) ?? false;
		},

		validateExpiryDate: (month: string, year: string): boolean => {
			const expMonth = Number.parseInt(month, 10);
			const expYear = Number.parseInt(year, 10);

			if (Number.isNaN(expMonth) || Number.isNaN(expYear)) return false;

			const currentDate = new Date();
			const currentYear = currentDate.getFullYear() % 100;
			const currentMonth = currentDate.getMonth() + 1;

			// Check if year is valid (not in the past)
			if (expYear < currentYear) return false;

			// If it's the current year, check if month is valid
			if (expYear === currentYear && expMonth < currentMonth) return false;

			// Check if month is between 1 and 12
			if (expMonth < 1 || expMonth > 12) return false;

			return window.OpenPay?.card?.validateExpiry?.(month, year) ?? false;
		},

		getCardType: (number: string): CardType | undefined => {
			const cleanNumber = number.replace(/\s+/g, "");
			const type = window.OpenPay?.card?.cardType?.(cleanNumber);
			return type ? (type as CardType) : undefined;
		},

		validateHolderName: (name: string): boolean => {
			return Boolean(name && name.trim().length >= 3 && /^[a-zA-Z\s]+$/.test(name));
		},

		validateCard: async (card: Card): Promise<CardValidationResult> => {
			await this.ensureInitialized();

			const result: CardValidationResult = {
				isValid: false,
				fieldErrors: {
					hasCardNumberError: false,
					hasCvvError: false,
					hasExpiryError: false,
					hasHolderNameError: false
				},
				cardType: undefined,
			};

			const isCardNumberValid = await this.card.validateNumber(card.card_number);
			if (!isCardNumberValid) {
				result.fieldErrors.hasCardNumberError = true;
			}

			result.cardType = await this.card.getCardType(card.card_number);

			const isCvvValid = await this.card.validateCVC(card.cvv2, result.cardType);
			if (!isCvvValid) {
				result.fieldErrors.hasCvvError = true;
			}

			const isExpiryValid = await this.card.validateExpiryDate(
				card.expiration_month,
				card.expiration_year
			);
			if (!isExpiryValid) {
				result.fieldErrors.hasExpiryError = true;
			}

			const isHolderNameValid = this.card.validateHolderName(card.holder_name);
			if (!isHolderNameValid) {
				result.fieldErrors.hasHolderNameError = true;
			}

			result.isValid = isCardNumberValid && isCvvValid && isExpiryValid && isHolderNameValid;

			return result;
		},
	};

	public cleanup(): void {
		if (this.retryTimeout) {
			clearTimeout(this.retryTimeout);
		}
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
		}
		for (const config of Object.values(this.OPENPAY_SCRIPTS)) {
			const script = document.querySelector(`script[src="${config.src}"]`);
			if (script) script.remove();
		}
		this.scriptCache.clear();
		this.initialized = false;
		this.deviceSessionId = "";
	}

	private validateFormAttributes(form: HTMLElement): string[] {
		const requiredAttributes = Object.values(this.OPENPAY_FORM_FIELDS);
		return requiredAttributes.filter(
			(attr) => !form.querySelector(`[data-openpay-card="${attr}"]`),
		);
	}

	public async createTokenWithValidation(cardData: Card): Promise<Token> {
		try {
			await this.ensureInitialized();

			// Validate card data before creating token
			const validationErrors = this.validateCardData(cardData);
			if (validationErrors.length > 0) {
				throw new Error(`Invalid card data: ${validationErrors.join(", ")}`);
			}

			return await this.createToken(cardData);
		} catch (error: unknown) {
			const err = error as OpenPayError;
			console.error("Token creation failed:", {
				message: err.message,
				data: err.data,
				status: err.status,
			});
			throw err;
		}
	}

	private validateCardData(card: Card): string[] {
		const errors: string[] = [];

		if (!card.card_number?.replace(/\s/g, "").match(/^\d{15,16}$/)) {
			errors.push("Invalid card number");
		}

		if (card.holder_name && card.holder_name.trim().length < 3) {
			errors.push("Name must be at least 3 characters");
		}

		const month = Number.parseInt(card.expiration_month);
		if (Number.isNaN(month) || month < 1 || month > 12) {
			errors.push("Invalid expiration month");
		}

		const year = Number.parseInt(card.expiration_year);
		const currentYear = new Date().getFullYear() % 100;
		if (Number.isNaN(year) || year < currentYear) {
			errors.push("Invalid expiration year");
		}

		if (!card.cvv2?.match(/^\d{3,4}$/)) {
			errors.push("Invalid CVV");
		}

		return errors;
	}

	public validateCard(card: Partial<Card>): CardValidationResult {
		const result: CardValidationResult = {
			isValid: true,
			fieldErrors: {
				hasCardNumberError: false,
				hasCvvError: false,
				hasExpiryError: false,
				hasHolderNameError: false
			},
			cardType: undefined
		};

		// Card number validation
		if (card.card_number) {
			const cleanNumber = card.card_number.replace(/\s+/g, "");
			const isNumberValid = this.card.validateNumber(cleanNumber);
			result.isValid = result.isValid && isNumberValid;
			result.fieldErrors.hasCardNumberError = !isNumberValid;
			result.cardType = this.card.getCardType(cleanNumber);
		}

		// CVV validation
		if (card.cvv2) {
			const isCvvValid = this.card.validateCVC(card.cvv2, result.cardType);
			result.isValid = result.isValid && isCvvValid;
			result.fieldErrors.hasCvvError = !isCvvValid;
		}

		// Expiry validation
		if (card.expiration_month && card.expiration_year) {
			const isExpiryValid = this.card.validateExpiryDate(
				card.expiration_month,
				card.expiration_year
			);
			result.isValid = result.isValid && isExpiryValid;
			result.fieldErrors.hasExpiryError = !isExpiryValid;
		}

		// Holder name validation
		if (card.holder_name) {
			const isNameValid = card.holder_name.trim().length >= 3;
			result.isValid = result.isValid && isNameValid;
			result.fieldErrors.hasHolderNameError = !isNameValid;
		}

		return result;
	}
}

export const createOpenPay = (config: OpenPayConfig): OpenPayClient => {
	return new OpenPayClient(config);
};

export const openPayUtils = {
	formatters: {
		cardNumber: cardUtils.formatCardNumber,
		expiryDate: cardUtils.formatExpiryDate,
	},
	validators: {
		card: (card: Partial<Card>) => {
			const errors: Record<keyof Card, string | undefined> = {
				card_number: undefined,
				holder_name: undefined,
				expiration_month: undefined,
				expiration_year: undefined,
				cvv2: undefined,
				address: undefined
			};

			if (card.card_number && !window.OpenPay?.card?.validateCardNumber?.(card.card_number.replace(/\s+/g, ""))) {
				errors.card_number = "Invalid card number";
			}

			if (card.holder_name && card.holder_name.trim().length < 3) {
				errors.holder_name = "Name must be at least 3 characters";
			}

			if (card.expiration_month && card.expiration_year) {
				const month = Number.parseInt(card.expiration_month, 10);
				const year = Number.parseInt(card.expiration_year, 10);
				const currentDate = new Date();
				const currentYear = currentDate.getFullYear() % 100;
				const currentMonth = currentDate.getMonth() + 1;

				if (Number.isNaN(month) || month < 1 || month > 12) {
					errors.expiration_month = "Invalid month";
				} else if (year < currentYear || (year === currentYear && month < currentMonth)) {
					errors.expiration_month = "Card has expired";
					errors.expiration_year = "Card has expired";
				}
			}

			if (card.cvv2 && !/^\d{3,4}$/.test(card.cvv2)) {
				errors.cvv2 = "Invalid CVV";
			}

			return {
				isValid: !Object.values(errors).some(Boolean),
				errors
			};
		},
		cardType: (cardNumber: string): CardType | undefined => {
			return window.OpenPay?.card?.cardType?.(cardNumber.replace(/\s+/g, "")) as CardType | undefined;
		}
	}
};

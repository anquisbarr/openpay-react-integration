import type {
	Card,
	CardFieldStatus,
	CardType,
	CardValidationResult,
	OpenPayConfig,
	OpenPayError,
	Token,
} from "./types/openpay";

export class OpenPayClient {
	private initialized = false;
	private deviceSessionId = "";
	private maxRetries = 3;
	private retryDelay = 2000;
	private maxRetryDelay = 10000;
	private retryTimeout?: number;
	private healthCheckInterval?: number;

	constructor(private config: OpenPayConfig) {
		this.initialize();
		this.startHealthCheck();
	}

	private async initialize(): Promise<void> {
		try {
			await this.initializeWithRetry();
		} catch (error) {
			// Silent fail, will retry in background
			console.debug("OpenPay initialization attempt failed, retrying in background...");
			this.scheduleRetry();
		}
	}

	private async initializeWithRetry(silent = false): Promise<void> {
		let retryCount = 0;
		let lastError: Error | null = null;

		while (retryCount < this.maxRetries) {
			try {
				await this.loadScripts();

				if (!window.OpenPay) {
					throw new Error("OpenPay not loaded");
				}

				// Configure OpenPay
				window.OpenPay.setId(this.config.merchantId);
				window.OpenPay.setApiKey(this.config.publicKey);
				window.OpenPay.setSandboxMode(this.config.isSandbox);

				// Try to setup device session
				const sessionId = await this.setupDeviceSession();
				if (!sessionId) {
					throw new Error("Failed to setup device session");
				}

				this.deviceSessionId = sessionId;
				this.initialized = true;
				return;
			} catch (error) {
				lastError = error as Error;
				retryCount++;

				if (retryCount < this.maxRetries) {
					// Exponential backoff with jitter
					const jitter = Math.random() * 1000;
					const delay = Math.min(
						this.retryDelay * 2 ** (retryCount - 1) + jitter,
						this.maxRetryDelay,
					);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		if (!silent) {
			throw lastError;
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

		this.retryTimeout = window.setTimeout(() => {
			this.initialize();
		}, this.retryDelay);
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
		const OPENPAY_SCRIPTS = [
			"https://js.openpay.pe/openpay.v1.min.js",
			"https://js.openpay.pe/openpay-data.v1.min.js",
		];

		await Promise.all(OPENPAY_SCRIPTS.map((src) => this.loadScript(src)));
	}

	private loadScript(src: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (document.querySelector(`script[src="${src}"]`)) {
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src = src;
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
			document.head.appendChild(script);
		});
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized || !this.deviceSessionId) {
			await this.initializeWithRetry(false);
		}
	}

	public async createToken(card: Card): Promise<Token> {
		await this.ensureInitialized();
		return new Promise((resolve, reject) => {
			window.OpenPay.token.create(
				card,
				(response: Token) => resolve(response),
				(error: OpenPayError) => reject(error),
			);
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
						if (!this.initialized) return 'unknown';
						const type = window.OpenPay.card.cardType(number);
						return (type && typeof type === 'string') ? type as CardType : 'unknown';
					} catch {
						return 'unknown';
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

		validateNumber: async (cardNumber: string): Promise<boolean> => {
			await this.ensureInitialized();
			return window.OpenPay.card.validateCardNumber(cardNumber);
		},

		validateCVC: async (cvc: string, cardNumber?: string): Promise<boolean> => {
			await this.ensureInitialized();
			return window.OpenPay.card.validateCVC(cvc, cardNumber);
		},

		validateExpiry: async (month: string, year: string): Promise<boolean> => {
			await this.ensureInitialized();
			return window.OpenPay.card.validateExpiry(month, year);
		},

		getType: async (cardNumber: string): Promise<CardType> => {
			await this.ensureInitialized();
			return window.OpenPay.card.cardType(cardNumber) as CardType;
		},

		validateHolderName: (name: string): boolean => {
			return Boolean(name && name.trim().length >= 3 && /^[a-zA-Z\s]+$/.test(name));
		},

		validateCard: async (card: Card): Promise<CardValidationResult> => {
			await this.ensureInitialized();

			const result: CardValidationResult = {
				isValid: false,
				errors: {},
				cardType: undefined,
			};

			const isCardNumberValid = await this.card.validateNumber(card.card_number);
			if (!isCardNumberValid) {
				result.errors.cardNumber = true;
			}

			result.cardType = await this.card.getType(card.card_number);

			const isCvvValid = await this.card.validateCVC(card.cvv2, card.card_number);
			if (!isCvvValid) {
				result.errors.cvv = true;
			}

			const isExpiryValid = await this.card.validateExpiry(
				card.expiration_month,
				card.expiration_year,
			);
			if (!isExpiryValid) {
				result.errors.expiry = true;
			}

			const isHolderNameValid = this.card.validateHolderName(card.holder_name);
			if (!isHolderNameValid) {
				result.errors.holderName = true;
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
		const scripts = document.querySelectorAll('script[src*="openpay.pe"]');
		for (const script of scripts) {
			script.remove();
		}
		this.initialized = false;
		this.deviceSessionId = "";
	}
}

export const createOpenPay = (config: OpenPayConfig): OpenPayClient => {
	return new OpenPayClient(config);
};

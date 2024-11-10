import type {
	Card,
	CardFieldStatus,
	CardType,
	CardValidationResult,
	OpenPayConfig,
	OpenPayError,
	Token,
} from './types/openpay';

export class OpenPayClient {
	private initialized = false;
	private deviceSessionId = '';

	constructor(private config: OpenPayConfig) {
		this.initialize();
	}

	private async initialize(): Promise<void> {
		try {
			await this.loadScripts();

			if (!window.OpenPay) {
				throw new Error('OpenPay failed to initialize');
			}

			window.OpenPay.setId(this.config.merchantId);
			window.OpenPay.setApiKey(this.config.publicKey);
			window.OpenPay.setSandboxMode(this.config.isSandbox);

			this.deviceSessionId = window.OpenPay.deviceData.setup('openpay-payment-form');
			this.initialized = true;
		} catch (error) {
			throw new Error(`OpenPay initialization failed: ${error}`);
		}
	}

	private async loadScripts(): Promise<void> {
		const OPENPAY_SCRIPTS = [
			'https://js.openpay.pe/openpay.v1.min.js',
			'https://js.openpay.pe/openpay-data.v1.min.js',
		];

		await Promise.all(OPENPAY_SCRIPTS.map((src) => this.loadScript(src)));
	}

	private loadScript(src: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (document.querySelector(`script[src="${src}"]`)) {
				resolve();
				return;
			}

			const script = document.createElement('script');
			script.src = src;
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
			document.head.appendChild(script);
		});
	}

	private checkInitialization(): void {
		if (!this.initialized || !window.OpenPay) {
			throw new Error('OpenPay not initialized');
		}
	}

	public async createToken(card: Card): Promise<Token> {
		this.checkInitialization();
		return new Promise((resolve, reject) => {
			window.OpenPay.token.create(
				card,
				(response: Token) => resolve(response),
				(error: OpenPayError) => reject(error),
			);
		});
	}

	public async createTokenFromForm(form: HTMLFormElement | string): Promise<Token> {
		this.checkInitialization();
		return new Promise((resolve, reject) => {
			window.OpenPay.token.extractFormAndCreate(
				form,
				(response: Token) => resolve(response),
				(error: OpenPayError) => reject(error),
			);
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	public getFormCardInformation(form: HTMLFormElement | string): Record<string, any> {
		this.checkInitialization();
		return window.OpenPay.extractFormInfo(form);
	}

	public getDeviceSessionId(): string {
		this.checkInitialization();
		return this.deviceSessionId;
	}

	public card = {
		fields: {
			validateField: (
				fieldName: keyof Card,
				value: string,
				cardNumber?: string,
			): CardFieldStatus => {
				this.checkInitialization();
				switch (fieldName) {
					case 'card_number':
						return {
							isValid: this.card.validateNumber(value),
							cardType: this.card.getType(value),
							message: this.card.validateNumber(value)
								? `Valid ${this.card.getType(value)} card`
								: value.length > 0
									? 'Invalid card number'
									: '',
							isDirty: true,
							value,
						};
					case 'cvv2':
						return {
							isValid: this.card.validateCVC(value, cardNumber),
							cardType: cardNumber ? this.card.getType(cardNumber) : undefined,
							message: this.card.validateCVC(value, cardNumber)
								? 'Valid CVV'
								: value.length > 0
									? `Invalid CVV (${cardNumber && this.card.getType(cardNumber) === 'american_express' ? '4' : '3'} digits required)`
									: '',
							isDirty: true,
							value,
						};
					case 'holder_name':
						return {
							isValid: this.card.validateHolderName(value),
							message: this.card.validateHolderName(value)
								? 'Valid name'
								: value.length > 0
									? 'Name must contain only letters and spaces (min 3 characters)'
									: '',
							isDirty: true,
							value,
						};
					case 'expiration_month':
					case 'expiration_year': {
						const month = fieldName === 'expiration_month' ? value : cardNumber || '';
						const year = fieldName === 'expiration_year' ? value : cardNumber || '';
						const isValidExpiry = this.card.validateExpiry(month, year);
						return {
							isValid: isValidExpiry,
							message: isValidExpiry
								? 'Valid expiration date'
								: month.length > 0 && year.length > 0
									? 'Invalid expiration date'
									: '',
							isDirty: true,
							value,
						};
					}
					default:
						return {
							isValid: false,
							message: 'Invalid field',
							isDirty: true,
							value,
						};
				}
			},
		},

		validateNumber: (cardNumber: string): boolean => {
			this.checkInitialization();
			return window.OpenPay.card.validateCardNumber(cardNumber);
		},

		validateCVC: (cvc: string, cardNumber?: string): boolean => {
			this.checkInitialization();
			return window.OpenPay.card.validateCVC(cvc, cardNumber);
		},

		validateExpiry: (month: string, year: string): boolean => {
			this.checkInitialization();
			return window.OpenPay.card.validateExpiry(month, year);
		},

		getType: (cardNumber: string): CardType => {
			this.checkInitialization();
			return window.OpenPay.card.cardType(cardNumber) as CardType;
		},

		validateHolderName: (name: string): boolean => {
			return Boolean(name && name.trim().length >= 3 && /^[a-zA-Z\s]+$/.test(name));
		},

		// Complete card validation
		validateCard: (card: Card): CardValidationResult => {
			this.checkInitialization();

			const result: CardValidationResult = {
				isValid: false,
				errors: {},
				cardType: undefined,
			};

			const isCardNumberValid = this.card.validateNumber(card.card_number);
			if (!isCardNumberValid) {
				result.errors.cardNumber = true;
			}

			// Get and store card type
			result.cardType = this.card.getType(card.card_number);

			// Validate CVV
			const isCvvValid = this.card.validateCVC(card.cvv2, card.card_number);
			if (!isCvvValid) {
				result.errors.cvv = true;
			}

			// Validate expiry
			const isExpiryValid = this.card.validateExpiry(card.expiration_month, card.expiration_year);
			if (!isExpiryValid) {
				result.errors.expiry = true;
			}

			// Validate holder name
			const isHolderNameValid = this.card.validateHolderName(card.holder_name);
			if (!isHolderNameValid) {
				result.errors.holderName = true;
			}

			// Set overall validity
			result.isValid = isCardNumberValid && isCvvValid && isExpiryValid && isHolderNameValid;

			return result;
		},
	};

	public cleanup(): void {
		const scripts = document.querySelectorAll('script[src*="openpay.pe"]');
		for (const script of scripts) {
			script.remove();
		}
		this.initialized = false;
		this.deviceSessionId = '';
	}
}

export const createOpenPay = (config: OpenPayConfig): OpenPayClient => {
	return new OpenPayClient(config);
};

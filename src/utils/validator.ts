import { z } from "zod";

/**
 * Regular expressions for card validation
 */
export const CARD_PATTERNS = {
	visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
	mastercard: /^5[1-5][0-9]{14}$/,
	amex: /^3[47][0-9]{13}$/,
	diners: /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/,
	discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
	visa_electron: /^(4026|417500|4508|4844|491(3|7))/,
	maestro: /^(5018|5020|5038|6304|6759|676[1-3])/,
} as const;

/**
 * Card Types based on patterns
 */
export type CardPatternType = keyof typeof CARD_PATTERNS;

/**
 * Address Schema
 */
export const addressSchema = z
	.object({
		city: z.string().min(1, "City is required"),
		country_code: z.string().length(2, "Country code must be 2 characters"),
		postal_code: z.string().min(1, "Postal code is required"),
		line1: z.string().min(1, "Address line 1 is required"),
		line2: z.string().optional(),
		line3: z.string().optional(),
		state: z.string().min(1, "State is required"),
	})
	.strict();

/**
 * Card Schema
 */
export const cardSchema = z
	.object({
		card_number: z
			.string()
			.min(13, "Card number must be at least 13 digits")
			.max(19, "Card number must not exceed 19 digits")
			.refine((val) => {
				const number = val.replace(/\s+/g, "");
				return Object.values(CARD_PATTERNS).some((pattern) => pattern.test(number));
			}, "Invalid card number format"),

		holder_name: z
			.string()
			.min(3, "Holder name must be at least 3 characters")
			.max(100, "Holder name must not exceed 100 characters")
			.regex(/^[a-zA-Z\s]+$/, "Holder name must contain only letters and spaces"),

		expiration_year: z
			.string()
			.length(2, "Expiration year must be 2 digits")
			.regex(/^[0-9]{2}$/, "Expiration year must be numeric")
			.refine((val) => {
				const year = Number.parseInt(val, 10);
				const currentYear = new Date().getFullYear() % 100;
				return year >= currentYear;
			}, "Expiration year must not be in the past"),

		expiration_month: z
			.string()
			.length(2, "Expiration month must be 2 digits")
			.regex(/^(0[1-9]|1[0-2])$/, "Expiration month must be between 01 and 12"),

		cvv2: z
			.string()
			.min(3, "CVV must be at least 3 digits")
			.max(4, "CVV must not exceed 4 digits")
			.regex(/^\d+$/, "CVV must be numeric"),

		address: addressSchema.optional(),
	})
	.superRefine((data, ctx) => {
		const cardNumber = data.card_number.replace(/\s+/g, "");
		const cvvLength = data.cvv2.length;

		if (CARD_PATTERNS.amex.test(cardNumber)) {
			if (cvvLength !== 4) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["cvv2"],
					message: "Invalid CVV length for American Express card",
				});
			}
		} else {
			if (cvvLength !== 3) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["cvv2"],
					message: "Invalid CVV length for card type",
				});
			}
		}
	});

/**
 * Token Response Schema
 */
export const tokenSchema = z
	.object({
		data: z.object({
			id: z.string(),
			card: z.object({
				id: z.string(),
				type: z.string(),
				brand: z.string(),
				allows_charges: z.boolean(),
				allows_payouts: z.boolean(),
				creation_date: z.string(),
				bank_name: z.string(),
				holder_name: z.string(),
				expiration_year: z.string(),
				expiration_month: z.string(),
				address: addressSchema.optional(),
			}),
		}),
	})
	.strict();

/**
 * Validation Result Types
 */
export type ValidateCardResult = z.SafeParseReturnType<unknown, z.infer<typeof cardSchema>>;
export type ValidateAddressResult = z.SafeParseReturnType<unknown, z.infer<typeof addressSchema>>;
export type ValidateTokenResult = z.SafeParseReturnType<unknown, z.infer<typeof tokenSchema>>;

/**
 * Inferred Types
 */
export type Card = z.infer<typeof cardSchema>;
export type Address = z.infer<typeof addressSchema>;
export type Token = z.infer<typeof tokenSchema>;

/**
 * Validation Helper Functions
 */
export const validators = {
	/**
	 * Luhn Algorithm for card number validation
	 */
	luhnCheck: (cardNumber: string): boolean => {
		const digits = cardNumber.replace(/\D/g, "");
		let sum = 0;
		let isEven = false;

		for (let i = digits.length - 1; i >= 0; i--) {
			let digit = Number.parseInt(digits.charAt(i), 10);

			if (isEven) {
				digit *= 2;
				if (digit > 9) {
					digit -= 9;
				}
			}

			sum += digit;
			isEven = !isEven;
		}

		return sum % 10 === 0;
	},

	/**
	 * Validate card expiration
	 */
	isExpirationValid: (month: string, year: string): boolean => {
		const currentDate = new Date();
		const currentYear = currentDate.getFullYear() % 100;
		const currentMonth = currentDate.getMonth() + 1;

		const expMonth = Number.parseInt(month, 10);
		const expYear = Number.parseInt(year, 10);

		if (expYear < currentYear) return false;
		if (expYear === currentYear && expMonth < currentMonth) return false;

		return true;
	},

	/**
	 * Determine card type from number
	 */
	getCardType: (cardNumber: string): CardPatternType | "unknown" => {
		for (const [type, pattern] of Object.entries(CARD_PATTERNS)) {
			if (pattern.test(cardNumber)) {
				return type as CardPatternType;
			}
		}
		return "unknown";
	},

	/**
	 * Validate card data using Zod schema
	 */
	validateCard: (cardData: unknown) => {
		return cardSchema.safeParse(cardData);
	},

	/**
	 * Validate address using Zod schema
	 */
	validateAddress: (addressData: unknown) => {
		return addressSchema.safeParse(addressData);
	},

	/**
	 * Validate token response using Zod schema
	 */
	validateTokenResponse: (tokenData: unknown) => {
		return tokenSchema.safeParse(tokenData);
	},

	/**
	 * Check if a card number matches a specific card type
	 */
	matchesCardType: (cardNumber: string, type: CardPatternType): boolean => {
		const pattern = CARD_PATTERNS[type];
		return pattern.test(cardNumber);
	},
} as const;

// Export everything as named exports
export default validators;

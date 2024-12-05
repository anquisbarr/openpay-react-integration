import type React from "react";
import { useState } from "react";
import { createOpenPay, openPayUtils } from "../openpay-client";
import type { Card, CardType } from "../types/openpay";

interface CardFieldStatus {
	isValid: boolean;
	message: string;
	cardType?: CardType;
}

const merchantId = import.meta.env.VITE_OPENPAY_MERCHANT_ID;
const publicKey = import.meta.env.VITE_OPENPAY_PUBLIC_KEY;

if (!merchantId || !publicKey) {
	throw new Error('Missing OpenPay credentials. Please set VITE_OPENPAY_MERCHANT_ID and VITE_OPENPAY_PUBLIC_KEY in your .env file');
}

const openPay = createOpenPay({
	merchantId,
	publicKey,
	isSandbox: true,
});

const DevelopmentPlayground: React.FC = () => {
	const [cardData, setCardData] = useState<Card>({
		card_number: "",
		holder_name: "",
		expiration_year: "",
		expiration_month: "",
		cvv2: "",
	});

	const [cardStatus, setCardStatus] = useState<CardFieldStatus>({
		isValid: false,
		cardType: undefined,
		message: ""
	});

	// Handle real-time card validation
	const handleCardNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const { value } = e.target;
		const formattedValue = openPayUtils.formatters.cardNumber(value);
		
		setCardData(prev => ({
			...prev,
			card_number: formattedValue
		}));

		const validation = openPay.validateCard({ card_number: formattedValue });
		
		setCardStatus({
			isValid: !validation.fieldErrors.hasCardNumberError,
			cardType: validation.cardType,
			message: validation.fieldErrors.hasCardNumberError 
				? "Invalid card number" 
				: validation.cardType 
					? `Valid ${validation.cardType} card` 
					: ""
		});
	};

	// Handle payment submission
	const handlePayment = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			// Validate all fields first
			const validation = openPay.validateCard(cardData);
			if (!validation.isValid) {
				console.error("Card validation failed:", validation.fieldErrors);
				return;
			}

			const token = await openPay.createToken(cardData);
			console.log("Token created:", token);
		} catch (error) {
			console.error("Payment processing failed:", error);
		}
	};

	return (
		<div className="payment-container">
			<h2>OpenPay Payment Integration</h2>
			<form id="payment-form" onSubmit={handlePayment}>
				<div className="form-group">
					<label htmlFor="card-number">Card Number</label>
					<input
						id="card-number"
						data-openpay-card="card_number"
						value={cardData.card_number}
						onChange={handleCardNumberChange}
						placeholder="4111 1111 1111 1111"
					/>
					{cardStatus.cardType && (
						<span className="card-type">{cardStatus.cardType}</span>
					)}
				</div>

				<div className="form-group">
					<label htmlFor="holder-name">Holder Name</label>
					<input
						data-openpay-card="holder_name"
						value={cardData.holder_name}
						onChange={e => setCardData(prev => ({ ...prev, holder_name: e.target.value }))}
						placeholder="JOHN DOE"
					/>
				</div>

				<div className="form-row">
					<div className="form-group">
						<label htmlFor="expiration-month">Expiry Month</label>
						<input
							data-openpay-card="expiration_month"
							value={cardData.expiration_month}
							onChange={e => setCardData(prev => ({ ...prev, expiration_month: e.target.value }))}
							placeholder="12"
							maxLength={2}
						/>
					</div>
					<div className="form-group">
						<label htmlFor="expiration-year">Expiry Year</label>
						<input
							data-openpay-card="expiration_year"
							value={cardData.expiration_year}
							onChange={e => setCardData(prev => ({ ...prev, expiration_year: e.target.value }))}
							placeholder="25"
							maxLength={2}
						/>
					</div>
					<div className="form-group">
						<label htmlFor="cvv">CVV</label>
						<input
							id="cvv"
							data-openpay-card="cvv2"
							value={cardData.cvv2}
							onChange={e => setCardData(prev => ({ ...prev, cvv2: e.target.value }))}
							placeholder="123"
							maxLength={4}
						/>
					</div>
				</div>

				<button 
					type="submit"
					disabled={!cardStatus.isValid}
				>
					Process Payment
				</button>
			</form>
		</div>
	);
};

export default DevelopmentPlayground;

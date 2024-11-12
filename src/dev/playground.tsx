import { useEffect, useState } from "react";
import { type Card, type CardType, type OpenPayError, createOpenPay } from "../index";
// import { createOpenPay, type Card, type CardType, type OpenPayError } from 'openpay-react-integration';

interface CardFieldStatus {
	isValid: boolean;
	message: string;
	cardType?: CardType;
}

const merchantId = import.meta.env.VITE_OPENPAY_MERCHANT_ID;
const publicKey = import.meta.env.VITE_OPENPAY_PUBLIC_KEY;

const openPay = createOpenPay({
	merchantId,
	publicKey,
	isSandbox: true,
});

const DevelopmentPlayground: React.FC = () => {
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	const [testResults, setTestResults] = useState<Record<string, any>>({});
	const [error, setError] = useState<OpenPayError | null>(null);
	const [cardData, setCardData] = useState<Card>({
		card_number: "",
		holder_name: "",
		expiration_year: "",
		expiration_month: "",
		cvv2: "",
	});

	const [cardStatus, setCardStatus] = useState<CardFieldStatus>({
		isValid: false,
		message: "",
		cardType: undefined,
	});

	useEffect(() => {
		async function validateCard() {
			if (cardData.card_number) {
				const isValid = await openPay.card.validateNumber(cardData.card_number);
				const cardType = await openPay.card.getType(cardData.card_number);

				setCardStatus({
					isValid,
					cardType: cardType,
					message: isValid ? `Valid ${cardType} card` : "Invalid card number",
				});
			} else {
				setCardStatus({
					isValid: false,
					message: "",
					cardType: undefined,
				});
			}
		}

		validateCard();
	}, [cardData.card_number]);

	const validateFields = async () => {
		const validation = await openPay.card.validateCard(cardData);
		if (!validation.isValid) {
			console.error("Validation Errors:", validation.errors);
			setTestResults({
				...testResults,
				validation: {
					success: false,
					errors: validation.errors,
				},
			});
			return false;
		}

		const cardType = await openPay.card.getType(cardData.card_number);
		setTestResults({
			...testResults,
			validation: {
				success: true,
				cardType,
			},
		});
		return true;
	};

	const handleTestPayment = async () => {
		try {
			setError(null);
			// Validate fields first
			if (!validateFields()) return;

			// Create token
			const token = await openPay.createToken(cardData);
			console.log("Token created:", token);
			setTestResults({
				...testResults,
				token: token,
			});
		} catch (err) {
			console.error("Token creation failed:", err);
			setError(err as OpenPayError);
		}
	};

	const handleValidateOnly = () => {
		validateFields();
	};

	const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setCardData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const getCardTypeStyles = () => {
		if (!cardStatus.cardType) return {};

		const baseStyles = {
			padding: "4px 8px",
			borderRadius: "4px",
			fontSize: "14px",
			fontWeight: "bold" as const,
			marginLeft: "8px",
		};

		const colorMap: Record<string, { bg: string; text: string }> = {
			visa: { bg: "#1A1F71", text: "white" },
			mastercard: { bg: "#EB001B", text: "white" },
			american_express: { bg: "#006FCF", text: "white" },
			discover: { bg: "#FF6000", text: "white" },
			default: { bg: "#E5E7EB", text: "#374151" },
		};

		const colors = colorMap[cardStatus.cardType ?? "default"];

		return {
			...baseStyles,
			backgroundColor: colors?.bg,
			color: colors?.text,
		};
	};

	return (
		<div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
			<h1>OpenPay Development Playground</h1>

			<div style={{ marginBottom: "20px" }}>
				<h2>Test Card Form</h2>
				<form style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
					<div>
						<div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
							{/* biome-ignore lint/a11y/noLabelWithoutControl: <explanation> */}
							<label>Card Number</label>
							{cardData.card_number && (
								<span style={getCardTypeStyles()}>{cardStatus.cardType?.toUpperCase()}</span>
							)}
						</div>
						<div style={{ position: "relative" }}>
							<input
								name="card_number"
								value={cardData.card_number}
								onChange={handleFieldChange}
								placeholder="Card Number"
								style={{
									padding: "8px",
									width: "100%",
									borderRadius: "4px",
									border: `2px solid ${
										cardData.card_number ? (cardStatus.isValid ? "#10B981" : "#EF4444") : "#E5E7EB"
									}`,
									outline: "none",
								}}
							/>
							{cardData.card_number && (
								<span
									style={{
										position: "absolute",
										right: "8px",
										top: "50%",
										transform: "translateY(-50%)",
										color: cardStatus.isValid ? "#10B981" : "#EF4444",
										fontSize: "14px",
									}}
								>
									{cardStatus.isValid ? "✓" : "✗"}
								</span>
							)}
						</div>
					</div>
					<input
						name="holder_name"
						value={cardData.holder_name}
						onChange={handleFieldChange}
						placeholder="Holder Name"
						style={{ padding: "8px" }}
					/>
					<div style={{ display: "flex", gap: "10px" }}>
						<input
							name="expiration_month"
							value={cardData.expiration_month}
							onChange={handleFieldChange}
							placeholder="MM"
							style={{ padding: "8px", width: "60px" }}
							maxLength={2}
						/>
						<input
							name="expiration_year"
							value={cardData.expiration_year}
							onChange={handleFieldChange}
							placeholder="YY"
							style={{ padding: "8px", width: "60px" }}
							maxLength={2}
						/>
					</div>
					<input
						name="cvv2"
						value={cardData.cvv2}
						onChange={handleFieldChange}
						placeholder="CVV"
						style={{ padding: "8px", width: "80px" }}
						maxLength={4}
					/>
				</form>
			</div>

			<div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
				<button type="button" onClick={handleValidateOnly} style={{ padding: "8px 16px" }}>
					Validate Only
				</button>
				<button type="button" onClick={handleTestPayment} style={{ padding: "8px 16px" }}>
					Create Token
				</button>
			</div>

			{Object.keys(testResults).length > 0 && (
				<div style={{ marginBottom: "20px" }}>
					<h2>Test Results</h2>
					<pre
						style={{
							background: "#f5f5f5",
							padding: "10px",
							borderRadius: "4px",
							overflow: "auto",
						}}
					>
						{JSON.stringify(testResults, null, 2)}
					</pre>
				</div>
			)}

			{error && (
				<div style={{ marginBottom: "20px", color: "red" }}>
					<h2>Error</h2>
					<pre
						style={{
							background: "#fff5f5",
							padding: "10px",
							borderRadius: "4px",
							overflow: "auto",
						}}
					>
						{JSON.stringify(error, null, 2)}
					</pre>
				</div>
			)}

			<div style={{ marginTop: "20px" }}>
				<h2>Device Session ID</h2>
				<pre
					style={{
						background: "#f5f5f5",
						padding: "10px",
						borderRadius: "4px",
						overflow: "auto",
					}}
				>
					{openPay.getDeviceSessionId()}
				</pre>
			</div>
		</div>
	);
};

export default DevelopmentPlayground;

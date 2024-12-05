import type { OpenPayClient } from "@/openpay-client";
import type { Card } from "@/types/openpay";
import { useEffect, useState } from "react";

export const useOpenPay = (client: OpenPayClient) => {
	const [error, setError] = useState<Error | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);

	useEffect(() => {
		return () => {
			client.cleanup();
		};
	}, [client]);

	const handleToken = async (cardData: Card) => {
		setIsProcessing(true);
		try {
			const token = await client.createTokenWithValidation(cardData);
			setError(null);
			return token;
		} catch (err) {
			setError(err as Error);
			throw err;
		} finally {
			setIsProcessing(false);
		}
	};

	const formatCardNumber = (value: string): string => {
		const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
		const matches = v.match(/\d{4,16}/g);
		const match = matches?.[0] || '';
		const parts = [];

		for (let i = 0, len = match.length; i < len; i += 4) {
			parts.push(match.substring(i, i + 4));
		}

		return parts.length > 0 ? parts.join(' ') : value;
	};

	const formatExpiryDate = (value: string): string => {
		const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
		if (v.length >= 2) {
			return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
		}
		return v;
	};

	return {
		error,
		isProcessing,
		createToken: handleToken,
		card: client.card,
		deviceSessionId: client.getDeviceSessionId(),
		resetError: () => setError(null),
		formatters: {
			formatCardNumber,
			formatExpiryDate
		}
	};
};

import type { OpenPayClient } from "@/openpay-client";
import type { Card } from "@/types/openpay";
import { useEffect, useState } from "react";

export const useOpenPay = (client: OpenPayClient) => {
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		return () => {
			client.cleanup();
		};
	}, [client]);

	const handleToken = async (cardData: Card) => {
		try {
			const token = await client.createToken(cardData);
			return token;
		} catch (err) {
			setError(err as Error);
			throw err;
		}
	};

	return {
		error,
		createToken: handleToken,
		card: client.card,
		deviceSessionId: client.getDeviceSessionId(),
		resetError: () => setError(null),
	};
};

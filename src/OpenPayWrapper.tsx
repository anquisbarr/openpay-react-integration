import type React from 'react';
import { useEffect } from 'react';

export interface OpenPayWrapperProps {
	merchantId: string;
	apiKey: string;
	sandboxMode: boolean;
	setDeviceSessionId: React.Dispatch<React.SetStateAction<string>>;
	children: React.ReactNode;
}

const OpenPayWrapper: React.FC<OpenPayWrapperProps> = ({
	merchantId,
	apiKey,
	sandboxMode,
	setDeviceSessionId,
	children,
}) => {
	useEffect(() => {
		const loadScript = (src: string): Promise<void> => {
			return new Promise((resolve, reject) => {
				const script = document.createElement('script');
				script.src = src;
				script.onload = () => resolve();
				script.onerror = () => reject(new Error(`Script load error for ${src}`));
				document.body.appendChild(script);
			});
		};

		const initializeOpenPay = async () => {
			try {
				await loadScript('https://js.openpay.pe/openpay.v1.min.js');
				await loadScript('https://js.openpay.pe/openpay-data.v1.min.js');

				window.OpenPay.setId(merchantId);
				window.OpenPay.setApiKey(apiKey);
				window.OpenPay.setSandboxMode(sandboxMode);

				const sessionId = window.OpenPay.deviceData.setup(
					'payment-form',
					'deviceIdHiddenFieldName',
				);
				setDeviceSessionId(sessionId);
			} catch (error) {
				console.error('Error initializing OpenPay:', error);
			}
		};

		initializeOpenPay();
	}, [merchantId, apiKey, sandboxMode, setDeviceSessionId]);

	return <>{children}</>;
};

export default OpenPayWrapper;

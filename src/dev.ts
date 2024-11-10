import { DEV, createOpenPay, getEnvironment } from './index';
import { validators } from './utils/validator';

const runDevMode = async () => {
	console.log('OpenPay React Library - Development Mode');
	console.log('Environment:', getEnvironment());

	// Test configuration validation
	const testConfig = DEV.testConfig;
	const validationResult = DEV.validateConfig(testConfig);
	console.log('Config Validation:', validationResult);

	// Test card validation
	const testCard = {
		card_number: '4111111111111111',
		holder_name: 'John Doe',
		expiration_year: '25',
		expiration_month: '12',
		cvv2: '123',
	};

	const cardValidation = validators.validateCard(testCard);
	console.log('Card Validation:', cardValidation.success ? 'Valid' : 'Invalid');

	// Initialize OpenPay client
	const openPay = createOpenPay(DEV.testConfig);
	console.log('OpenPay Client:', openPay);
};

// Run development tests
runDevMode().catch(console.error);

// Export everything for development purposes
export * from './index';

# OpenPay React

React integration for OpenPay payment processing.

## Installation

```bash
npm install openpay-react
# or
yarn add openpay-react
# or
bun add openpay-react
```

## Usage

```typescript
import { createOpenPay } from 'openpay-react';

const openPay = createOpenPay({
  merchantId: 'YOUR_MERCHANT_ID',
  publicKey: 'YOUR_PUBLIC_KEY',
  isSandbox: true
});

// Form example
const PaymentForm = () => {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const form = e.currentTarget as HTMLFormElement;
      const token = await openPay.createTokenFromForm(form);
      console.log('Token:', token);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <input
        data-openpay-card="card_number"
        placeholder="Card Number"
      />
      {/* Add other fields */}
    </form>
  );
};
```

## Development

To build the library:

```bash
npm run build
```

## License

MIT
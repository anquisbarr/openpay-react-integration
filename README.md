# OpenPay React Integration

A React component and TypeScript types for integrating OpenPay's anti-fraud system.

## Installation

```bash
npm install openpay-react-integration
```

## Usage

```tsx
import React from 'react';
import { OpenPayWrapper } from 'openpay-react-integration';

const App = () => {
  const [deviceSessionId, setDeviceSessionId] = React.useState('');

  return (
    <OpenPayWrapper 
      merchantId={process.env.REACT_APP_OPENPAY_MERCHANT_ID!} 
      apiKey={process.env.REACT_APP_OPENPAY_PUBLIC_KEY!}
      sandboxMode={true}
      setDeviceSessionId={setDeviceSessionId}
    >
      <form id="payment-form">
        {/* Your custom form fields here */}
        <input type="hidden" id="deviceIdHiddenFieldName" value={deviceSessionId} />
      </form>
    </OpenPayWrapper>
  );
};

export default App;
```
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_placeholder';
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={CLERK_KEY}>
        <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'AUD', intent: 'capture' }}>
          <App />
        </PayPalScriptProvider>
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

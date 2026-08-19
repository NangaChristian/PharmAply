import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import { AuthProvider } from './components/AuthProvider';
import { CartProvider } from './components/CartProvider';
import './index.css';
import './lib/i18n';

(window as any).gm_authFailure = function() {
  console.warn("Google Maps JS API Authentication or Billing Error detected. Switching map components to fallback view.");
  (window as any).__googleMapsAuthFailed = true;
  window.dispatchEvent(new Event('google-maps-auth-failed'));
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && (
    args[0].includes('[vite]') || 
    args[0].includes('Refresh Token') || 
    args[0].includes('WebSocket') || 
    args[0].includes('invalid_grant') ||
    args[0].includes('BillingNotEnabledMapError') ||
    args[0].includes('Google Maps JavaScript API error') ||
    args[0].includes('Error with geolocation') ||
    args[0].includes('Error getting user location')
  )) {
    return;
  }
  if (args[0] && args[0].message && (args[0].message.includes('Refresh Token') || args[0].message.includes('Invalid Refresh Token') || args[0].message.includes('invalid_grant'))) {
    return;
  }
  originalConsoleError(...args);
};

window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('[vite]') || e.message.includes('Refresh Token') || e.message.includes('Invalid Refresh Token'))) {
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && (e.reason.message.includes('[vite]') || e.reason.message.includes('Refresh Token') || e.reason.message.includes('Invalid Refresh Token'))) {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <Toaster position="top-center" />
        <App />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
);


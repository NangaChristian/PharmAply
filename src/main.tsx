import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import { AuthProvider } from './components/AuthProvider';
import { CartProvider } from './components/CartProvider';
import { NotificationListener } from './components/NotificationListener';
import './index.css';
import './lib/i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <Toaster position="top-center" />
        <NotificationListener />
        <App />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
);

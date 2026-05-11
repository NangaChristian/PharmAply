import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import { AuthProvider } from './components/AuthProvider';
import { NotificationListener } from './components/NotificationListener';
import './index.css';
import './lib/i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Toaster position="top-center" />
      <NotificationListener />
      <App />
    </AuthProvider>
  </StrictMode>,
);

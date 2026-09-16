import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/globals.css';
import './styles/components.css';
import App from './App.tsx';
import { AppStateProvider } from './state/AppState.tsx';
import { ToastProvider } from './state/ToastProvider.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

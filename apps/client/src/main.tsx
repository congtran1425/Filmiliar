import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import SiteApp from './SiteApp.tsx';
import { SessionProvider } from './lib/session.tsx';
import { CartProvider } from './lib/CartContext.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider><CartProvider><SiteApp /></CartProvider></SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

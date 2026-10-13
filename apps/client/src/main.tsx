import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import SiteApp from './SiteApp.tsx';
import { SessionProvider } from './lib/session.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider><SiteApp /></SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

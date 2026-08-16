import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppChromeEnhancements } from './AppChromeEnhancements';
import { installBookieBallFetchCache } from './lib/fetchCache';
import './styles.css';
import './laptop-fit.css';

installBookieBallFetchCache();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppChromeEnhancements />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

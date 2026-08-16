import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppChromeEnhancements } from './AppChromeEnhancements';
import { TeamJourneyBridge } from './components/TeamJourneyBridge';
import { installBookieBallFetchCache } from './lib/fetchCache';
import './styles.css';
import './laptop-fit.css';
import './competition-enhancements.css';
import './command-centre-v2.css';

installBookieBallFetchCache();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppChromeEnhancements />
      <TeamJourneyBridge />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

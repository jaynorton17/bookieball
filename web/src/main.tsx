import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppChromeEnhancements } from './AppChromeEnhancements';
import { TeamJourneyBridge } from './components/TeamJourneyBridge';
import { BookieBallDataProvider } from './lib/BookieBallDataContext';
import { installBookieBallFetchCache } from './lib/fetchCache';
import './styles.css';
import './laptop-fit.css';
import './competition-enhancements.css';
import './command-centre-v2.css';
import './gameshow-entertainment.css';
import './fixture-market.css';
import './no-zoom-overrides.css';

installBookieBallFetchCache();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <BookieBallDataProvider>
        <AppChromeEnhancements />
        <TeamJourneyBridge />
        <App />
      </BookieBallDataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

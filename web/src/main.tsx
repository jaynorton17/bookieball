import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppChromeEnhancements } from './AppChromeEnhancements';
import { PredictionBroadcastEnhancements } from './components/PredictionBroadcastEnhancements';
import { TeamJourneyBridge } from './components/TeamJourneyBridge';
import { GameshowTombolaCentrepiece } from './components/GameshowTombolaCentrepiece';
import { BookieBallDataProvider } from './lib/BookieBallDataContext';
import { installBookieBallFetchCache } from './lib/fetchCache';
import './styles.css';
import './laptop-fit.css';
import './competition-enhancements.css';
import './command-centre-v2.css';
import './gameshow-entertainment.css';
import './fixture-market.css';
import './prediction-broadcast.css';
import './no-zoom-overrides.css';
import './gameshow-clean.css';
import './tombola-centrepiece.css';
import './product-pass.css';

installBookieBallFetchCache();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <BookieBallDataProvider>
        <AppChromeEnhancements />
        <TeamJourneyBridge />
        <PredictionBroadcastEnhancements />
        <GameshowTombolaCentrepiece />
        <App />
      </BookieBallDataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
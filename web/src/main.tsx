import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AppChromeEnhancements } from './AppChromeEnhancements';
import { EntryKeyboardEnhancements } from './components/EntryKeyboardEnhancements';
import { PredictionBroadcastEnhancements } from './components/PredictionBroadcastEnhancements';
import { TeamJourneyBridge } from './components/TeamJourneyBridge';
import { GameshowTombolaCentrepiece } from './components/GameshowTombolaCentrepiece';
import { installBookieBallFetchCache } from './lib/fetchCache';
import './styles.css';
import './laptop-fit.css';
import './competition-enhancements.css';
import './command-centre-v2.css';
import './gameshow-entertainment.css';
import './fixture-market.css';
import './prediction-broadcast.css';
import './gameshow-clean.css';
import './tombola-centrepiece.css';
import './tombola-manual-pick.css';
import './product-pass.css';
import './competition-identities.css';
import './analytics-pass.css';
import './home-product-pass.css';
import './home-analytics-graphics.css';
import './tools-hub.css';
import './viewport-fixes.css';
import './visual-polish-pass.css';
import './final-hub-polish.css';
import './division-final-polish.css';
import './viewport-final-polish.css';

installBookieBallFetchCache();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppChromeEnhancements />
      <EntryKeyboardEnhancements />
      <TeamJourneyBridge />
      <PredictionBroadcastEnhancements />
      <GameshowTombolaCentrepiece />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

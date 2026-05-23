import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ChokiChokiOrigamiPrototype from './ChokiChokiOrigamiPrototype.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChokiChokiOrigamiPrototype />
  </React.StrictMode>,
);

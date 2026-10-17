import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { requestPersistentStorage } from './lib/db';
import { initNative } from './lib/native-bootstrap';
import { applyPlatform } from './lib/platform';

applyPlatform();
void initNative();

void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

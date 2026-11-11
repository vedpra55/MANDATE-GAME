import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/hind/400.css';
import '@fontsource/hind/600.css';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource/rozha-one/400.css';
import { App } from './App.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

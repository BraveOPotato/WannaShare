import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import './styles/theme.css';
import './styles/base.css';
import './styles/components.css';

import App from './App';
import { ThemeProvider } from './state/ThemeProvider';
import { SettingsProvider } from './state/SettingsProvider';
import { IdentityProvider } from './state/IdentityProvider';
import { FavoritesProvider } from './state/FavoritesProvider';
import { SessionProvider } from './state/SessionProvider';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <SettingsProvider>
          <IdentityProvider>
            <FavoritesProvider>
              <SessionProvider>
                <App />
              </SessionProvider>
            </FavoritesProvider>
          </IdentityProvider>
        </SettingsProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './queryClient';
import App from './App';
import './index.css';

// Catch Worker errors (e.g. Monaco editor language-service workers) so they don't show as uncaught.
window.addEventListener(
  'error',
  (event) => {
    if (event.target && typeof Worker !== 'undefined' && event.target instanceof Worker) {
      event.preventDefault();
      event.stopPropagation();
      console.warn('[Editor] A background worker reported an error. The editor may still work.', event);
    }
  },
  true
);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </React.StrictMode>
);

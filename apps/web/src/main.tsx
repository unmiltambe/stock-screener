import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import './index.css'
import App from './App.tsx'
import { oidcConfig } from './auth/cognito'
import { ThemeProvider } from './lib/theme'

const queryClient = new QueryClient()

// AuthProvider sits OUTSIDE StrictMode: its one-time callback processing must not
// be double-invoked by StrictMode's dev remount (a cause of "No matching state").
createRoot(document.getElementById('root')!).render(
  <AuthProvider {...oidcConfig}>
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>
  </AuthProvider>,
)

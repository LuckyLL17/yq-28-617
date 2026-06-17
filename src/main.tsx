import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import DevTools from '@/components/DevTools'
import { errorLogger } from '@/lib/errorLogger'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary
    onError={(error, errorInfo) => {
      errorLogger.log({
        level: 'error',
        type: 'ReactRenderError',
        message: error.message,
        stack: error.stack,
        metadata: { componentStack: errorInfo.componentStack },
      })
    }}
  >
    <App />
    {import.meta.env.DEV && <DevTools />}
  </ErrorBoundary>,
)

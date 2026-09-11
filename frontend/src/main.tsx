import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import App from './App.tsx'
import './index.css'

const storedTheme = localStorage.getItem('rolloutguard.theme')
document.documentElement.classList.toggle(
  'dark',
  storedTheme !== 'light',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="bottom-left" richColors closeButton />
  </StrictMode>,
)

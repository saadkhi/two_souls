import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initBootLoader } from '@/lib/bootLoader'

initBootLoader()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

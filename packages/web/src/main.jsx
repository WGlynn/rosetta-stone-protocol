import React from 'react'
import { createRoot } from 'react-dom/client'
import RosettaApp from './RosettaApp.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RosettaApp />
  </React.StrictMode>,
)

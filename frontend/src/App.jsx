import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import HealthInput from './pages/HealthInput'
import Analytics from './pages/Analytics'
import Datasets from './pages/Datasets'
import { AuthProvider, useAuth } from './hooks/useAuth'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="chat" element={<Chat />} />
            <Route path="health" element={<HealthInput />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="datasets" element={<Datasets />} />
          </Route>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

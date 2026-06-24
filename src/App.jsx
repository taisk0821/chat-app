import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUser } from './context/UserContext'
import { DMProvider } from './context/DMContext'
import Layout from './components/Layout'
import EnterPage from './pages/EnterPage'
import GlobalChatPage from './pages/GlobalChatPage'
import TalksPage from './pages/TalksPage'
import UsersPage from './pages/UsersPage'
import DMPage from './pages/DMPage'
import ProfilePage from './pages/ProfilePage'
import UserProfilePage from './pages/UserProfilePage'

function PrivateRoute({ children }) {
  const { user } = useUser()
  return user ? children : <Navigate to="/" replace />
}

function PublicRoute({ children }) {
  const { user } = useUser()
  return !user ? children : <Navigate to="/chat" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><EnterPage /></PublicRoute>} />
      <Route path="/chat" element={<PrivateRoute><Layout><GlobalChatPage /></Layout></PrivateRoute>} />
      <Route path="/talks" element={<PrivateRoute><Layout><TalksPage /></Layout></PrivateRoute>} />
      <Route path="/dm/:userId" element={<PrivateRoute><Layout><DMPage /></Layout></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute><Layout><UsersPage /></Layout></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Layout><ProfilePage /></Layout></PrivateRoute>} />
      <Route path="/profile/:userId" element={<PrivateRoute><Layout><UserProfilePage /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <DMProvider>
          <AppRoutes />
        </DMProvider>
      </BrowserRouter>
    </UserProvider>
  )
}

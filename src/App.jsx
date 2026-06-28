import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UserProvider, useUser } from './context/UserContext'
import { DMProvider } from './context/DMContext'
import Layout from './components/Layout'
import EnterPage from './pages/EnterPage'
import ThreadsPage from './pages/ThreadsPage'
import ThreadPage from './pages/ThreadPage'
import TalksPage from './pages/TalksPage'
import UsersPage from './pages/UsersPage'
import DMPage from './pages/DMPage'
import ProfilePage from './pages/ProfilePage'
import UserProfilePage from './pages/UserProfilePage'
import FollowListPage from './pages/FollowListPage'
import RequestsPage from './pages/RequestsPage'
import AdminPage from './pages/AdminPage'
import SettingsPage from './pages/SettingsPage'

function PrivateRoute({ children }) {
  const { user } = useUser()
  return user ? children : <Navigate to="/" replace />
}

function PublicRoute({ children }) {
  const { user } = useUser()
  return !user ? children : <Navigate to="/chat" replace />
}

function ChatApp() {
  return (
    <UserProvider>
      <DMProvider>
        <Routes>
          <Route path="/" element={<PublicRoute><EnterPage /></PublicRoute>} />
          <Route path="/chat" element={<PrivateRoute><Layout><ThreadsPage /></Layout></PrivateRoute>} />
          <Route path="/chat/:threadId" element={<PrivateRoute><Layout><ThreadPage /></Layout></PrivateRoute>} />
          <Route path="/talks" element={<PrivateRoute><Layout><TalksPage /></Layout></PrivateRoute>} />
          <Route path="/dm/:userId" element={<PrivateRoute><Layout><DMPage /></Layout></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><Layout><UsersPage /></Layout></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Layout><ProfilePage /></Layout></PrivateRoute>} />
          <Route path="/profile/:userId" element={<PrivateRoute><Layout><UserProfilePage /></Layout></PrivateRoute>} />
          <Route path="/follows/:userId/:type" element={<PrivateRoute><Layout><FollowListPage /></Layout></PrivateRoute>} />
          <Route path="/requests" element={<PrivateRoute><Layout><RequestsPage /></Layout></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Layout><SettingsPage /></Layout></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </DMProvider>
    </UserProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 管理者ページは認証システムと完全分離 */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/*" element={<ChatApp />} />
      </Routes>
    </BrowserRouter>
  )
}

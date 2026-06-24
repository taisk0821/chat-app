import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

const NAV = [
  { to: '/chat', label: 'チャット', icon: '💬' },
  { to: '/users', label: 'ユーザー', icon: '👥' },
  { to: '/profile', label: 'プロフィール', icon: '👤' },
]

export default function Layout({ children }) {
  const { user, logout } = useUser()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (to) => {
    if (to === '/users') return location.pathname === '/users' || location.pathname.startsWith('/dm/')
    return location.pathname === to
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 h-[57px]">
        <span className="font-bold text-gray-800 text-sm">💬 匿名チャット</span>
        <div className="flex items-center gap-1">
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition ${
                  isActive(item.to)
                    ? 'bg-indigo-100 text-indigo-700 font-semibold'
                    : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-400 transition border border-gray-200 hover:border-red-200 rounded-lg px-2 py-1.5 ml-1"
          >
            退室
          </button>
        </div>
      </header>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  )
}

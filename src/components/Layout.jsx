import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useDM } from '../context/DMContext'
import {
  usePushNotifications,
  usePushBannerDismissed,
  isPushSupported,
  isIOS,
  isStandalone,
} from '../hooks/usePushNotifications'

export default function Layout({ children }) {
  const { user, logout } = useUser()
  const { totalUnread, notification, setNotification } = useDM()
  const location = useLocation()
  const navigate = useNavigate()

  const { permission, subscribed, loading, errorMsg, subscribe } = usePushNotifications(user?.id)
  const [bannerDismissed, dismissBanner] = usePushBannerDismissed()

  const isActive = (to) => {
    if (to === '/talks') return location.pathname === '/talks' || location.pathname.startsWith('/dm/')
    if (to === '/users') return location.pathname === '/users' || location.pathname.startsWith('/profile/')
    return location.pathname === to
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleNotifyClick = () => {
    if (!notification) return
    navigate(`/dm/${notification.senderId}`)
    setNotification(null)
  }

  const NAV = [
    { to: '/chat', label: 'チャット', icon: '💬' },
    {
      to: '/talks',
      label: 'トーク',
      icon: '📨',
      badge: totalUnread > 0 ? (totalUnread > 9 ? '9+' : String(totalUnread)) : null,
    },
    { to: '/users', label: 'ユーザー', icon: '👥' },
    { to: '/profile', label: 'マイページ', icon: '👤' },
  ]

  // iOS でホーム画面未追加の場合にガイドを表示
  const showIOSGuide = isIOS() && !isStandalone() && !bannerDismissed

  // 通知許可バナーを表示するか（iOS ガイドより優先度低）
  const showPermissionBanner =
    !showIOSGuide &&
    !bannerDismissed &&
    !subscribed &&
    permission !== 'granted' &&
    permission !== 'denied' &&
    isPushSupported()

  // 通知が拒否されているときの案内
  const showDeniedNote = !bannerDismissed && permission === 'denied' && isPushSupported()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 px-3 py-3 flex items-center justify-between sticky top-0 z-10 h-[57px]">
        <span className="font-bold text-gray-800 text-sm shrink-0">💬 匿名チャット</span>
        <div className="flex items-center gap-1 min-w-0">
          <nav className="flex gap-0.5">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`relative text-xs px-2 py-1.5 rounded-lg transition whitespace-nowrap ${
                  isActive(item.to)
                    ? 'bg-indigo-100 text-indigo-700 font-semibold'
                    : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                {item.icon} {item.label}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-400 transition border border-gray-200 hover:border-red-200 rounded-lg px-2 py-1.5 ml-1 shrink-0"
          >
            退室
          </button>
        </div>
      </header>

      {/* iOS: ホーム画面追加ガイド */}
      {showIOSGuide && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-start justify-between gap-3">
          <div className="text-xs leading-relaxed">
            <p className="font-semibold">📲 iPhoneでプッシュ通知を受け取るには</p>
            <p className="text-indigo-200 mt-0.5">
              Safari の共有ボタン →「ホーム画面に追加」してアプリを起動してください（iOS 16.4 以降）
            </p>
          </div>
          <button
            onClick={dismissBanner}
            className="text-indigo-300 hover:text-white shrink-0 text-xl leading-none mt-0.5"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      )}

      {/* 通知許可バナー */}
      {showPermissionBanner && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold">🔔 DMプッシュ通知</p>
            {errorMsg ? (
              <p className="text-xs text-red-300 mt-0.5">{errorMsg}</p>
            ) : (
              <p className="text-xs text-indigo-200 mt-0.5">
                アプリを閉じていてもDMが届いたら通知します
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={subscribe}
              disabled={loading}
              className="bg-white text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 transition whitespace-nowrap"
            >
              {loading ? '設定中...' : '許可する'}
            </button>
            <button
              onClick={dismissBanner}
              className="text-indigo-300 hover:text-white text-xl leading-none"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 通知許可済みバナー（一瞬表示してすぐ消える） */}
      {subscribed && permission === 'granted' && !bannerDismissed && (
        <div className="bg-green-500 text-white px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs">通知が有効になりました</p>
          <button onClick={dismissBanner} className="text-green-100 hover:text-white text-xl leading-none">×</button>
        </div>
      )}

      {/* 通知ブロック案内 */}
      {showDeniedNote && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-700">
            通知がブロックされています。ブラウザのアドレスバー左の🔒から許可に変更してください。
          </p>
          <button onClick={dismissBanner} className="text-amber-400 hover:text-amber-700 text-xl leading-none shrink-0">×</button>
        </div>
      )}

      <div className="flex-1 flex flex-col">{children}</div>

      {/* DM通知トースト（アプリ内） */}
      {notification && location.pathname !== `/dm/${notification.senderId}` && (
        <div
          onClick={handleNotifyClick}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-xl cursor-pointer flex items-center gap-3 z-50"
        >
          <div className="w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
            {notification.senderName[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{notification.senderName} からメッセージ</p>
            <p className="text-xs text-gray-300 truncate mt-0.5">{notification.content}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setNotification(null) }}
            className="text-gray-400 hover:text-white shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

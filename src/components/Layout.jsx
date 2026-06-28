import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { useDM } from '../context/DMContext'
import { supabase } from '../supabaseClient'
import {
  usePushNotifications,
  usePushBannerDismissed,
  isPushSupported,
  isIOS,
  isStandalone,
} from '../hooks/usePushNotifications'

// タブ定義
const TABS = [
  { to: '/chat',     label: 'チャット',  icon: ChatIcon },
  { to: '/talks',    label: 'トーク',    icon: TalkIcon },
  { to: '/requests', label: '申請',      icon: RequestIcon },
  { to: '/users',    label: 'ユーザー',  icon: UsersIcon },
  { to: '/profile',  label: 'マイページ', icon: ProfileIcon },
]

// ── SVG アイコン ────────────────────────────────────────────
function ChatIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={active ? 0 : 1.8} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  )
}

function TalkIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={active ? 0 : 1.8} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  )
}

function UsersIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={active ? 0 : 1.8} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function ProfileIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={active ? 0 : 1.8} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function RequestIcon({ active }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill={active ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={active ? 0 : 1.8} className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
    </svg>
  )
}
// ────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const { user, logout } = useUser()
  const { totalUnread, notification, setNotification } = useDM()
  const location = useLocation()
  const navigate = useNavigate()

  // DM申請のバッジ数 + トースト通知
  const [pendingRequests, setPendingRequests] = useState(0)
  const [requestNotif, setRequestNotif] = useState(null) // { senderNickname }

  useEffect(() => {
    if (!user?.id) return
    const fetchCount = () =>
      supabase
        .from('dm_requests')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .then(({ count }) => setPendingRequests(count ?? 0))

    fetchCount()

    const ch = supabase
      .channel('layout_dm_requests')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'dm_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, (payload) => {
        setPendingRequests((n) => n + 1)
        setRequestNotif({ senderNickname: payload.new.sender_nickname })
        setTimeout(() => setRequestNotif(null), 5000)
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'dm_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, fetchCount)
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [user?.id])

  const { permission, subscribed, loading, errorMsg, subscribe } = usePushNotifications(user?.id)
  const [bannerDismissed, dismissBanner] = usePushBannerDismissed()

  const isActive = (to) => {
    if (to === '/chat')     return location.pathname === '/chat' || location.pathname.startsWith('/chat/')
    if (to === '/talks')    return location.pathname === '/talks' || location.pathname.startsWith('/dm/')
    if (to === '/requests') return location.pathname === '/requests'
    if (to === '/users')    return location.pathname === '/users' || location.pathname.startsWith('/profile/')
    return location.pathname === to
  }

  const handleLogout = () => { logout(); navigate('/') }
  const handleNotifyClick = () => {
    if (!notification) return
    navigate(`/dm/${notification.senderId}`)
    setNotification(null)
  }

  const showIOSGuide       = isIOS() && !isStandalone() && !bannerDismissed
  const showPermissionBanner =
    !showIOSGuide && !bannerDismissed && !subscribed &&
    permission !== 'granted' && permission !== 'denied' && isPushSupported()
  const showGrantedNote    = subscribed && permission === 'granted' && !bannerDismissed
  const showDeniedNote     = !bannerDismissed && permission === 'denied' && isPushSupported()

  // タブバー高さ (px) — コンテンツの下端パディングに使用
  const TAB_H = 56

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col">

      {/* ── ヘッダー (タイトル + 退室) ── */}
      <header className="bg-white/80 backdrop-blur border-b border-gray-100 px-4 flex items-center justify-between sticky top-0 z-10 shrink-0 h-[52px]">
        <span className="font-bold text-gray-800 text-[15px]">💬 匿名チャット</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition border border-gray-200 hover:border-red-200 rounded-lg px-2.5 py-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M6 10a.75.75 0 01.75-.75h9.546l-1.048-.943a.75.75 0 111.004-1.114l2.5 2.25a.75.75 0 010 1.114l-2.5 2.25a.75.75 0 11-1.004-1.114l1.048-.943H6.75A.75.75 0 016 10z" clipRule="evenodd" />
          </svg>
          退室
        </button>
      </header>

      {/* ── 通知バナー類 ── */}
      {showIOSGuide && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-start justify-between gap-3 shrink-0">
          <div className="text-xs leading-relaxed">
            <p className="font-semibold">📲 iPhoneでプッシュ通知を受け取るには</p>
            <p className="text-indigo-200 mt-0.5">Safari の共有ボタン →「ホーム画面に追加」してアプリを起動してください（iOS 16.4 以降）</p>
          </div>
          <button onClick={dismissBanner} className="text-indigo-300 hover:text-white shrink-0 text-xl leading-none mt-0.5">×</button>
        </div>
      )}
      {showPermissionBanner && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold">🔔 DMプッシュ通知</p>
            {errorMsg
              ? <p className="text-xs text-red-300 mt-0.5">{errorMsg}</p>
              : <p className="text-xs text-indigo-200 mt-0.5">アプリを閉じていてもDMが届いたら通知します</p>
            }
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={subscribe} disabled={loading}
              className="bg-white text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 whitespace-nowrap">
              {loading ? '設定中...' : '許可する'}
            </button>
            <button onClick={dismissBanner} className="text-indigo-300 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>
      )}
      {showGrantedNote && (
        <div className="bg-green-500 text-white px-4 py-2 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs">通知が有効になりました</p>
          <button onClick={dismissBanner} className="text-green-100 hover:text-white text-xl leading-none">×</button>
        </div>
      )}
      {showDeniedNote && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-amber-700">通知がブロックされています。ブラウザのアドレスバー左の🔒から許可に変更してください。</p>
          <button onClick={dismissBanner} className="text-amber-400 hover:text-amber-700 text-xl leading-none shrink-0">×</button>
        </div>
      )}

      {/* ── メインコンテンツ (タブバー分の余白を確保) ── */}
      <main
        className="flex-1 flex flex-col overflow-auto"
        style={{ paddingBottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px))` }}
      >
        {children}
      </main>

      {/* ── DM 通知トースト (タブバーの上に表示) ── */}
      {notification && location.pathname !== `/dm/${notification.senderId}` && (
        <div
          onClick={handleNotifyClick}
          style={{ bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px) + 12px)` }}
          className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-xl cursor-pointer flex items-center gap-3 z-50"
        >
          <div className="w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
            {notification.senderName[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{notification.senderName} からメッセージ</p>
            <p className="text-xs text-gray-300 truncate mt-0.5">{notification.content}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setNotification(null) }}
            className="text-gray-400 hover:text-white shrink-0 text-lg leading-none">×</button>
        </div>
      )}

      {/* ── DM申請トースト ── */}
      {requestNotif && location.pathname !== '/requests' && (
        <div
          onClick={() => { navigate('/requests'); setRequestNotif(null) }}
          style={{ bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px) + 12px)` }}
          className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-xl cursor-pointer flex items-center gap-3 z-50"
        >
          <div className="w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
            🔒
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{requestNotif.senderNickname} からDM申請</p>
            <p className="text-xs text-gray-300 mt-0.5">タップして確認する</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setRequestNotif(null) }}
            className="text-gray-400 hover:text-white shrink-0 text-lg leading-none">×</button>
        </div>
      )}

      {/* ── ボトムタブバー ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t border-gray-100 z-20 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch justify-around" style={{ height: `${TAB_H}px` }}>
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = isActive(to)
            const badgeNum =
              to === '/talks'    ? totalUnread :
              to === '/requests' ? pendingRequests :
              0
            const badge = badgeNum > 0 ? (badgeNum > 9 ? '9+' : String(badgeNum)) : null

            return (
              <Link
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative select-none ${
                  active ? 'text-indigo-600' : 'text-gray-400 active:text-indigo-400'
                }`}
              >
                {/* アクティブインジケーター */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-indigo-500 rounded-full" />
                )}

                {/* アイコン + バッジ */}
                <div className="relative">
                  <Icon active={active} />
                  {badge && (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                      {badge}
                    </span>
                  )}
                </div>

                {/* ラベル */}
                <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

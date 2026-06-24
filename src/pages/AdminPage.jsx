import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ---- ログインフォーム ----
function LoginForm({ onAuth }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password === ADMIN_PASS) {
      sessionStorage.setItem('admin_authed', '1')
      onAuth()
    } else {
      setError('パスワードが違います')
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🔒</div>
          <h1 className="text-xl font-bold text-gray-800">管理者ログイン</h1>
        </div>
        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 transition"
          />
          <button
            type="submit"
            disabled={!password}
            className="w-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white font-semibold rounded-xl py-2.5 text-sm transition"
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  )
}

// ---- 削除ボタン（2段確認）----
function DeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => { setConfirming(false); onConfirm() }}
          className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg"
        >
          削除
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg border border-gray-200"
        >
          キャンセル
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition"
    >
      削除
    </button>
  )
}

// ---- ユーザー管理タブ ----
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { setError(error.message); setLoading(false); return }
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteUser = async (u) => {
    // 関連DM削除 → グローバルメッセージ削除（ニックネーム一致） → ユーザー削除
    await supabase.from('direct_messages').delete().eq('sender_id', u.id)
    await supabase.from('direct_messages').delete().eq('receiver_id', u.id)
    await supabase.from('messages').delete().eq('nickname', u.nickname)
    const { error } = await supabase.from('users').delete().eq('id', u.id)
    if (error) { alert(`削除失敗: ${error.message}`); return }
    setUsers((prev) => prev.filter((x) => x.id !== u.id))
  }

  const filtered = users.filter(
    (u) => !search || u.nickname.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="ニックネームで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 transition"
        />
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 transition">
          更新
        </button>
        <span className="text-sm text-gray-400 shrink-0">{filtered.length} 人</span>
      </div>

      {error && <p className="text-red-500 text-sm">エラー: {error}</p>}
      {loading && <p className="text-gray-400 text-sm">読み込み中...</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">ユーザー</th>
                <th className="px-4 py-3 text-left">自己紹介</th>
                <th className="px-4 py-3 text-left">登録日時</th>
                <th className="px-4 py-3 text-left">最終ログイン</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                          {u.nickname[0].toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-gray-800 whitespace-nowrap">{u.nickname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">
                    {u.bio || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(u.last_seen_at)}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteButton onConfirm={() => deleteUser(u)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <p className="text-center text-gray-400 text-sm py-8">ユーザーが見つかりません</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---- グローバルチャット管理タブ ----
function MessagesTab() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) { setError(error.message); setLoading(false); return }
    setMessages(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteMessage = async (id) => {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) { alert(`削除失敗: ${error.message}`); return }
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  const filtered = messages.filter(
    (m) =>
      !search ||
      m.nickname.toLowerCase().includes(search.toLowerCase()) ||
      m.content.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="ニックネームまたはメッセージ内容で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 transition"
        />
        <button onClick={load} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 transition">
          更新
        </button>
        <span className="text-sm text-gray-400 shrink-0">{filtered.length} 件</span>
      </div>

      {error && <p className="text-red-500 text-sm">エラー: {error}</p>}
      {loading && <p className="text-gray-400 text-sm">読み込み中...</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">投稿者</th>
                <th className="px-4 py-3 text-left">メッセージ内容</th>
                <th className="px-4 py-3 text-left">投稿日時</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{m.nickname}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[240px]">
                    <span className="line-clamp-2 break-all">{m.content}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(m.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteButton onConfirm={() => deleteMessage(m.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <p className="text-center text-gray-400 text-sm py-8">メッセージが見つかりません</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---- 管理ダッシュボード ----
function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState('users')

  const TABS = [
    { key: 'users', label: '👥 ユーザー管理' },
    { key: 'messages', label: '💬 チャット管理' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">⚙️ 管理者パネル</h1>
          <p className="text-xs text-gray-400 mt-0.5">匿名チャット 管理画面</p>
        </div>
        <button
          onClick={onLogout}
          className="text-sm text-gray-400 hover:text-red-400 border border-gray-200 hover:border-red-200 rounded-lg px-3 py-1.5 transition"
        >
          ログアウト
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm px-4 py-2 rounded-xl font-medium transition ${
                tab === t.key
                  ? 'bg-gray-800 text-white shadow'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {tab === 'users' && <UsersTab />}
          {tab === 'messages' && <MessagesTab />}
        </div>
      </div>
    </div>
  )
}

// ---- エントリーポイント ----
export default function AdminPage() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('admin_authed') === '1'
  )

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authed')
    setAuthed(false)
  }

  if (!authed) return <LoginForm onAuth={() => setAuthed(true)} />
  return <AdminDashboard onLogout={handleLogout} />
}

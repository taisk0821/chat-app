import { useState, useEffect, useCallback, useRef } from 'react'
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
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
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

// ---- 削除ボタン（2段確認） ----
function DeleteButton({ onConfirm, onClick }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false); onConfirm() }}
          className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg"
        >
          削除
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false) }}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg border border-gray-200"
        >
          戻る
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
      className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-2 py-1 rounded-lg transition"
    >
      削除
    </button>
  )
}

// ---- DM履歴モーダル ----
function DMHistoryModal({ user, onClose }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState([])
  const [partnerFilter, setPartnerFilter] = useState('all')
  const bottomRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // 対象ユーザーが絡む全DMを時刻昇順で取得
      const { data: msgs } = await supabase
        .from('direct_messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: true })
        .limit(500)

      if (!msgs || msgs.length === 0) { setLoading(false); return }

      // 関係するユーザーIDを収集してニックネームを一括取得
      const ids = [...new Set(msgs.flatMap((m) => [m.sender_id, m.receiver_id]))]
      const { data: users } = await supabase
        .from('users').select('id, nickname').in('id', ids)
      const nameMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.nickname]))

      const enriched = msgs.map((m) => ({
        ...m,
        senderName: nameMap[m.sender_id] ?? '不明',
        receiverName: nameMap[m.receiver_id] ?? '不明',
      }))

      // 会話相手一覧（重複なし・送受信件数付き）
      const partnerCount = {}
      for (const m of msgs) {
        const pid = m.sender_id === user.id ? m.receiver_id : m.sender_id
        partnerCount[pid] = (partnerCount[pid] || 0) + 1
      }
      setPartners(
        Object.entries(partnerCount).map(([id, count]) => ({
          id,
          name: nameMap[id] ?? '不明',
          count,
        }))
      )

      setMessages(enriched)
      setLoading(false)
    }
    load()
  }, [user.id])

  // メッセージ末尾に自動スクロール
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [loading, partnerFilter])

  const filtered =
    partnerFilter === 'all'
      ? messages
      : messages.filter(
          (m) => m.sender_id === partnerFilter || m.receiver_id === partnerFilter
        )

  const deleteDM = async (id) => {
    const { error } = await supabase.from('direct_messages').delete().eq('id', id)
    if (error) { alert(`削除失敗: ${error.message}`); return }
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-base">
              {user.nickname} のDM履歴
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? '読み込み中...' : `全 ${messages.length} 件`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition text-xl leading-none shrink-0 ml-2"
          >
            ×
          </button>
        </div>

        {/* 会話相手フィルター */}
        {!loading && partners.length > 0 && (
          <div className="px-4 py-2.5 border-b border-gray-100 flex gap-2 overflow-x-auto shrink-0">
            <button
              onClick={() => setPartnerFilter('all')}
              className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition shrink-0 ${
                partnerFilter === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              すべて（{messages.length}件）
            </button>
            {partners.map((p) => (
              <button
                key={p.id}
                onClick={() => setPartnerFilter(p.id)}
                className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition shrink-0 ${
                  partnerFilter === p.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.name}（{p.count}件）
              </button>
            ))}
          </div>
        )}

        {/* メッセージ一覧 */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2.5">
          {loading && (
            <p className="text-gray-400 text-sm text-center py-10">読み込み中...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-10">DMがありません</p>
          )}

          {filtered.map((m) => {
            const isFromUser = m.sender_id === user.id
            return (
              <div
                key={m.id}
                className={`flex flex-col group ${isFromUser ? 'items-end' : 'items-start'}`}
              >
                {/* 送信者→受信者ラベル */}
                <p className="text-[10px] text-gray-400 mb-0.5 px-1">
                  <span className="font-medium text-gray-600">{m.senderName}</span>
                  <span className="mx-1">→</span>
                  <span className="font-medium text-gray-600">{m.receiverName}</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  {formatDate(m.created_at)}
                </p>

                <div className={`flex items-end gap-1.5 ${isFromUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* メッセージバブル */}
                  <div
                    className={`max-w-[72%] px-3.5 py-2 rounded-2xl text-sm break-words leading-relaxed ${
                      isFromUser
                        ? 'bg-indigo-500 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    }`}
                  >
                    {m.content}
                  </div>

                  {/* 削除ボタン（ホバー時に表示） */}
                  <div className="opacity-0 group-hover:opacity-100 transition">
                    <DeleteButton onConfirm={() => deleteDM(m.id)} />
                  </div>
                </div>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

// ---- ユーザー管理タブ ----
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteStatus, setDeleteStatus] = useState(null) // { type: 'success'|'error', msg }

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
    setDeletingId(u.id)
    setDeleteStatus(null)

    // Step 1: 送受信DM をまとめて削除
    const { error: dmErr } = await supabase
      .from('direct_messages')
      .delete()
      .or(`sender_id.eq.${u.id},receiver_id.eq.${u.id}`)
    if (dmErr) {
      setDeleteStatus({ type: 'error', msg: `DM削除失敗: ${dmErr.message}` })
      setDeletingId(null)
      return
    }

    // Step 2: グローバルチャットメッセージを削除
    const { error: msgErr } = await supabase
      .from('messages')
      .delete()
      .eq('nickname', u.nickname)
    if (msgErr) {
      setDeleteStatus({ type: 'error', msg: `チャットメッセージ削除失敗: ${msgErr.message}` })
      setDeletingId(null)
      return
    }

    // Step 3: ユーザー本体を削除
    const { error: userErr } = await supabase
      .from('users')
      .delete()
      .eq('id', u.id)
    if (userErr) {
      setDeleteStatus({ type: 'error', msg: `ユーザー削除失敗: ${userErr.message}` })
      setDeletingId(null)
      return
    }

    setUsers((prev) => prev.filter((x) => x.id !== u.id))
    if (selectedUser?.id === u.id) setSelectedUser(null)
    setDeleteStatus({ type: 'success', msg: `「${u.nickname}」と関連データをすべて削除しました` })
    setDeletingId(null)
    setTimeout(() => setDeleteStatus(null), 4000)
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
        <button
          onClick={load}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 transition"
        >
          更新
        </button>
        <span className="text-sm text-gray-400 shrink-0">{filtered.length} 人</span>
      </div>

      {error && <p className="text-red-500 text-sm">エラー: {error}</p>}
      {loading && <p className="text-gray-400 text-sm">読み込み中...</p>}

      {deleteStatus && (
        <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
          deleteStatus.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {deleteStatus.type === 'success' ? '✓ ' : '⚠ '}{deleteStatus.msg}
        </div>
      )}

      {!loading && (
        <>
          <p className="text-xs text-gray-400">行をクリックするとDM履歴を確認できます</p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm min-w-[620px]">
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
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="hover:bg-indigo-50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                            {u.nickname[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-gray-800 whitespace-nowrap">
                          {u.nickname}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">
                      {u.bio || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(u.last_seen_at)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {deletingId === u.id ? (
                        <span className="text-xs text-gray-400 animate-pulse">削除中...</span>
                      ) : (
                        <DeleteButton onConfirm={() => deleteUser(u)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">
                ユーザーが見つかりません
              </p>
            )}
          </div>
        </>
      )}

      {/* DM履歴モーダル */}
      {selectedUser && (
        <DMHistoryModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
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
        <button
          onClick={load}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 transition"
        >
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
                  <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                    {m.nickname}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[240px]">
                    <span className="break-all line-clamp-2">{m.content}</span>
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
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">
              メッセージが見つかりません
            </p>
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

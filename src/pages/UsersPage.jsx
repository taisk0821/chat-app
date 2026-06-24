import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}

function Avatar({ u }) {
  if (u.avatar_url) {
    return <img src={u.avatar_url} alt={u.nickname} className="w-10 h-10 rounded-full object-cover" />
  }
  return (
    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
      {u.nickname[0].toUpperCase()}
    </div>
  )
}

// Supabase の状態を直接確認するパネル
function DiagPanel({ user, onRetryRegister }) {
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    const out = {}

    // SELECT テスト
    const { data: rows, error: selErr } = await supabase
      .from('users').select('id, nickname, created_at').limit(10)
    out.select = selErr
      ? { error: `${selErr.code}: ${selErr.message}` }
      : { count: rows.length, rows }

    // INSERT テスト（現在ユーザー）
    const { error: insErr } = await supabase.from('users').insert({
      id: user.id,
      nickname: user.nickname,
      bio: user.bio || '',
      hobbies: user.hobbies || '',
      last_seen_at: new Date().toISOString(),
    })
    if (insErr?.code === '23505') {
      out.insert = '既に存在（正常）'
    } else if (insErr) {
      out.insert = { error: `${insErr.code}: ${insErr.message}` }
    } else {
      out.insert = '新規登録成功'
    }

    setResult(out)
    setRunning(false)
    onRetryRegister()
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-600">🔍 DB診断</span>
        <button
          onClick={run}
          disabled={running}
          className="bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white px-3 py-1 rounded-lg"
        >
          {running ? '診断中...' : '診断を実行'}
        </button>
      </div>
      <div className="text-gray-500">
        <p>ユーザーID: <span className="font-mono text-gray-700 break-all">{user.id}</span></p>
        <p>ニックネーム: {user.nickname}</p>
      </div>
      {result && (
        <pre className="bg-white border border-gray-200 rounded-lg p-2 overflow-auto max-h-48 text-gray-700">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function UsersPage() {
  const { user, dbError } = useUser()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('last_seen_at', { ascending: false })

    if (error) {
      console.error('[UsersPage] fetch失敗:', error)
      setFetchError(`${error.code}: ${error.message}`)
      setLoading(false)
      return
    }

    setFetchError(null)
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()

    const channel = supabase
      .channel('realtime:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchUsers])

  const anyError = dbError || fetchError
  const showDiag = anyError || (!loading && users.length === 0)

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">👥 ユーザー一覧</p>
        <button
          onClick={fetchUsers}
          className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-lg px-2.5 py-1 transition"
        >
          再読み込み
        </button>
      </div>

      {anyError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
          <p className="font-semibold">⚠ エラー: {anyError}</p>
        </div>
      )}

      {loading && (
        <p className="text-center text-gray-400 text-sm py-4">読み込み中...</p>
      )}

      {!loading && users.length === 0 && !anyError && (
        <p className="text-center text-gray-400 text-sm py-4">ユーザーがいません</p>
      )}

      {users.map((u) => (
        <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <Avatar u={u} />
              {isOnline(u.last_seen_at) && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-800 text-sm">{u.nickname}</span>
                {u.id === user.id && (
                  <span className="text-xs text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">あなた</span>
                )}
                {isOnline(u.last_seen_at) && (
                  <span className="text-xs text-green-500">オンライン</span>
                )}
              </div>
            </div>
          </div>
          {u.id !== user.id && (
            <button
              onClick={() => navigate(`/dm/${u.id}`)}
              className="shrink-0 text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-xl transition"
            >
              話しかける
            </button>
          )}
        </div>
      ))}

      {showDiag && (
        <DiagPanel user={user} onRetryRegister={fetchUsers} />
      )}
    </div>
  )
}

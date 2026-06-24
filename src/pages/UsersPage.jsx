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
      console.error('[chat] fetchUsers 失敗:', error.code, error.message)
      setFetchError(`${error.code}: ${error.message}`)
      setLoading(false)
      return
    }

    console.log('[chat] fetchUsers 成功:', data?.length, '件')
    setFetchError(null)
    setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()

    const channel = supabase
      .channel('realtime:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchUsers())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchUsers])

  // DBエラーバナー（Supabase接続・RLS等の問題を表示）
  const anyError = dbError || fetchError

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
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 space-y-1">
          <p className="font-semibold">⚠ Supabase エラー</p>
          <p>{anyError}</p>
          <p className="text-red-400">
            usersテーブルが存在しない、またはRLSポリシーが未設定の可能性があります。
            下記のSQLをSupabaseで実行してください。
          </p>
        </div>
      )}

      {loading && (
        <p className="text-center text-gray-400 text-sm py-8">読み込み中...</p>
      )}

      {!loading && !anyError && users.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">ユーザーがいません</p>
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
    </div>
  )
}

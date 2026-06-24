import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}

export default function UsersPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('last_seen_at', { ascending: false })
      if (data) setUsers(data)
    }
    fetchUsers()

    const channel = supabase
      .channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">👥 ユーザー一覧</p>
      {users.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-8">ユーザーがいません</p>
      )}
      {users.map((u) => (
        <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                {u.nickname[0].toUpperCase()}
              </div>
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
              {u.bio && <p className="text-xs text-gray-500 mt-0.5 truncate">{u.bio}</p>}
              {u.hobbies && <p className="text-xs text-gray-400 mt-0.5 truncate">趣味: {u.hobbies}</p>}
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

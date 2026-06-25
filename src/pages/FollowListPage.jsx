import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

export default function FollowListPage() {
  const { userId, type } = useParams() // type: 'followers' | 'following'
  const { user } = useUser()
  const navigate = useNavigate()
  const [users, setUsers]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [ownerNickname, setOwnerNickname] = useState('')

  const title = type === 'followers' ? 'フォロワー' : 'フォロー中'

  useEffect(() => {
    const load = async () => {
      // オーナーのニックネームを取得
      const { data: owner } = await supabase
        .from('users').select('nickname').eq('id', userId).single()
      setOwnerNickname(owner?.nickname ?? '')

      // follows テーブルから対象ユーザーIDを取得
      let userIds = []
      if (type === 'followers') {
        const { data } = await supabase.from('follows').select('follower_id').eq('following_id', userId)
        userIds = (data ?? []).map((f) => f.follower_id)
      } else {
        const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
        userIds = (data ?? []).map((f) => f.following_id)
      }

      if (userIds.length === 0) { setLoading(false); return }

      const { data: usersData } = await supabase
        .from('users')
        .select('id, nickname, avatar_url, bio')
        .in('id', userIds)
      setUsers(usersData ?? [])
      setLoading(false)
    }
    load()
  }, [userId, type])

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition"
      >
        ← 戻る
      </button>

      <p className="text-sm font-semibold text-gray-700 mb-3">
        {ownerNickname} の{title}
        {!loading && <span className="ml-1.5 text-gray-400 font-normal">（{users.length}人）</span>}
      </p>

      {loading && (
        <p className="text-center text-gray-400 text-sm py-8">読み込み中...</p>
      )}

      {!loading && users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">まだ{title}がいません</p>
        </div>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => navigate(u.id === user.id ? '/profile' : `/profile/${u.id}`)}
            className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 hover:bg-indigo-50 transition text-left"
          >
            {u.avatar_url ? (
              <img
                src={u.avatar_url}
                alt={u.nickname}
                className="w-11 h-11 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-11 h-11 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                {u.nickname[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-800 text-sm">{u.nickname}</p>
              {u.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{u.bio}</p>}
            </div>
            {u.id === user.id && (
              <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0">
                あなた
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

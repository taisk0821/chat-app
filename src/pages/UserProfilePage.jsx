import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}

export default function UserProfilePage() {
  const { userId } = useParams()
  const { user } = useUser()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', userId).single()
      if (!data) navigate('/users')
      else setProfile(data)
      setLoading(false)
    }
    fetch()
  }, [userId, navigate])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto w-full px-4 py-8 text-center text-gray-400 text-sm">
        読み込み中...
      </div>
    )
  }

  if (!profile) return null

  const online = isOnline(profile.last_seen_at)
  const isMe = profile.id === user.id

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4">
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition"
      >
        ← ユーザー一覧に戻る
      </button>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* ヘッダー背景 */}
        <div className="h-20 bg-gradient-to-r from-indigo-400 to-purple-400" />

        <div className="px-6 pb-6">
          {/* アバター */}
          <div className="relative -mt-10 mb-3 inline-block">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.nickname}
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-indigo-100 border-4 border-white shadow flex items-center justify-center text-indigo-600 font-bold text-3xl">
                {profile.nickname[0].toUpperCase()}
              </div>
            )}
            {online && (
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
            )}
          </div>

          {/* 名前・ステータス */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-gray-800">{profile.nickname}</h1>
            {isMe && (
              <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">あなた</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {online ? '🟢 オンライン' : '⚫ オフライン'}
          </p>

          {/* 自己紹介 */}
          {profile.bio ? (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">自己紹介</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.bio}</p>
            </div>
          ) : null}

          {/* 趣味 */}
          {profile.hobbies ? (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-1">趣味</p>
              <p className="text-sm text-gray-700">{profile.hobbies}</p>
            </div>
          ) : null}

          {/* ボタン */}
          {isMe ? (
            <button
              onClick={() => navigate('/profile')}
              className="w-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-xl py-2.5 text-sm transition"
            >
              プロフィールを編集
            </button>
          ) : (
            <button
              onClick={() => navigate(`/dm/${profile.id}`)}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl py-2.5 text-sm transition"
            >
              💬 話しかける
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

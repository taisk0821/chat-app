import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'
import ReportModal from '../components/ReportModal'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}

export default function UserProfilePage() {
  const { userId } = useParams()
  const { user } = useUser()
  const navigate = useNavigate()
  const [profile, setProfile]             = useState(null)
  const [loading, setLoading]             = useState(true)
  const [requestStatus, setRequestStatus] = useState(null) // null|'none'|'pending'|'accepted'|'rejected'
  const [requestLoading, setRequestLoading] = useState(false)
  const [reportOpen, setReportOpen]       = useState(false)
  // フォロー
  const [isFollowing, setIsFollowing]       = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followLoading, setFollowLoading]   = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', userId).single()
      if (!data) { navigate('/users'); return }
      setProfile(data)
      setLoading(false)
    }
    fetchProfile()
  }, [userId, navigate])

  // フォロー数・フォロワー数・自分のフォロー状態を取得
  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profile.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile.id),
      profile.id !== user.id
        ? supabase.from('follows').select('id', { count: 'exact', head: true })
            .eq('follower_id', user.id).eq('following_id', profile.id)
        : Promise.resolve({ count: 0 }),
    ]).then(([followers, following, selfFollow]) => {
      setFollowersCount(followers.count ?? 0)
      setFollowingCount(following.count ?? 0)
      setIsFollowing((selfFollow.count ?? 0) > 0)
    })
  }, [profile?.id, user.id])

  const toggleFollow = async () => {
    if (!profile || followLoading) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id).eq('following_id', profile.id)
      setIsFollowing(false)
      setFollowersCount((n) => Math.max(0, n - 1))
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id })
      setIsFollowing(true)
      setFollowersCount((n) => n + 1)
    }
    setFollowLoading(false)
  }

  // 鍵アカウントの場合、DM申請状態を確認
  useEffect(() => {
    if (!profile || profile.id === user.id || !profile.is_private) return
    supabase
      .from('dm_requests')
      .select('status')
      .eq('sender_id', user.id)
      .eq('receiver_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        setRequestStatus(data?.status ?? 'none')
      })
  }, [profile, user.id])

  const sendDMRequest = async () => {
    if (!profile) return
    setRequestLoading(true)
    // upsert で「却下後の再申請」も対応（status を pending に戻す）
    await supabase.from('dm_requests').upsert(
      {
        sender_id: user.id,
        sender_nickname: user.nickname,
        receiver_id: profile.id,
        status: 'pending',
      },
      { onConflict: 'sender_id,receiver_id' }
    )
    setRequestStatus('pending')
    setRequestLoading(false)
  }

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

  // DM ボタンの内容を決定
  const renderDMButton = () => {
    if (isMe) {
      return (
        <button
          onClick={() => navigate('/profile')}
          className="w-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-xl py-2.5 text-sm transition"
        >
          プロフィールを編集
        </button>
      )
    }
    if (!profile.is_private) {
      return (
        <button
          onClick={() => navigate(`/dm/${profile.id}`)}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl py-2.5 text-sm transition"
        >
          💬 話しかける
        </button>
      )
    }
    // 鍵アカウント — ステータス別ボタン
    if (requestStatus === null) return null
    if (requestStatus === 'accepted') {
      return (
        <button
          onClick={() => navigate(`/dm/${profile.id}`)}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl py-2.5 text-sm transition"
        >
          💬 話しかける
        </button>
      )
    }
    if (requestStatus === 'pending') {
      return (
        <button disabled className="w-full bg-gray-100 text-gray-400 font-semibold rounded-xl py-2.5 text-sm cursor-not-allowed">
          🕐 申請済み（承認待ち）
        </button>
      )
    }
    if (requestStatus === 'rejected') {
      return (
        <button
          onClick={sendDMRequest}
          disabled={requestLoading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 text-white font-semibold rounded-xl py-2.5 text-sm transition"
        >
          {requestLoading ? '送信中...' : '🔒 再申請する'}
        </button>
      )
    }
    // 'none' — 未申請
    return (
      <button
        onClick={sendDMRequest}
        disabled={requestLoading}
        className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white font-semibold rounded-xl py-2.5 text-sm transition"
      >
        {requestLoading ? '送信中...' : '🔒 DMの申請を送る'}
      </button>
    )
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4">
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition"
      >
        ← ユーザー一覧に戻る
      </button>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
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

          {/* 名前・バッジ */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-gray-800">{profile.nickname}</h1>
            {profile.is_private && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">🔒 鍵</span>
            )}
            {isMe && (
              <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">あなた</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">
            {online ? '🟢 オンライン' : '⚫ オフライン'}
          </p>

          {/* フォロー数・フォロワー数 */}
          <div className="flex gap-5 mb-4">
            <button
              onClick={() => navigate(`/follows/${profile.id}/followers`)}
              className="text-center hover:opacity-70 transition"
            >
              <p className="font-bold text-gray-800 text-sm">{followersCount}</p>
              <p className="text-xs text-gray-500">フォロワー</p>
            </button>
            <button
              onClick={() => navigate(`/follows/${profile.id}/following`)}
              className="text-center hover:opacity-70 transition"
            >
              <p className="font-bold text-gray-800 text-sm">{followingCount}</p>
              <p className="text-xs text-gray-500">フォロー中</p>
            </button>
          </div>

          {profile.bio && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">自己紹介</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.bio}</p>
            </div>
          )}
          {profile.hobbies && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 mb-1">趣味</p>
              <p className="text-sm text-gray-700">{profile.hobbies}</p>
            </div>
          )}

          <div className="space-y-2.5">
            {/* フォローボタン（自分以外） */}
            {!isMe && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`w-full font-semibold rounded-xl py-2.5 text-sm transition ${
                  isFollowing
                    ? 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                    : 'bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white'
                }`}
              >
                {followLoading ? '...' : isFollowing ? '✓ フォロー中' : 'フォローする'}
              </button>
            )}
            {renderDMButton()}
            {!isMe && (
              <button
                onClick={() => setReportOpen(true)}
                className="w-full border border-red-200 text-red-400 hover:text-red-600 hover:border-red-400 hover:bg-red-50 font-medium rounded-xl py-2 text-sm transition"
              >
                通報する
              </button>
            )}
          </div>
        </div>
      </div>

      {reportOpen && (
        <ReportModal
          targetType="user"
          targetId={profile.id}
          targetNickname={profile.nickname}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}

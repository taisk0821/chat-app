import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'
import ReportModal from '../components/ReportModal'
import PostCard from '../components/PostCard'
import { triggerPushNotification } from '../hooks/usePushNotifications'

function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000
}


export default function UserProfilePage() {
  const { userId } = useParams()
  const { user } = useUser()
  const navigate = useNavigate()

  const [profile, setProfile]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [requestStatus, setRequestStatus]   = useState(null)
  const [requestLoading, setRequestLoading] = useState(false)
  const [dmRequestError, setDmRequestError] = useState('')
  const [reportOpen, setReportOpen]         = useState(false)
  const [isBlocked, setIsBlocked]           = useState(false)
  const [isHidden, setIsHidden]             = useState(false)
  const [blockLoading, setBlockLoading]     = useState(false)
  const [hideLoading, setHideLoading]       = useState(false)
  const [isFollowing, setIsFollowing]       = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [followLoading, setFollowLoading]   = useState(false)
  const [posts, setPosts]                   = useState([])
  const [postsLoading, setPostsLoading]     = useState(true)
  const [postsError, setPostsError]         = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', userId).single()
      if (!data) { navigate('/users'); return }
      setProfile(data)
      setLoading(false)
    }
    fetchProfile()
  }, [userId, navigate])

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

  // ブロック・非表示状態を取得
  useEffect(() => {
    if (!profile || profile.id === user.id) return
    Promise.all([
      supabase.from('blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', profile.id).maybeSingle(),
      supabase.from('hidden_users').select('id').eq('hider_id', user.id).eq('hidden_id', profile.id).maybeSingle(),
    ]).then(([blockRes, hideRes]) => {
      setIsBlocked(!!blockRes.data)
      setIsHidden(!!hideRes.data)
    })
  }, [profile?.id, user.id])

  const toggleBlock = async () => {
    if (!profile || blockLoading) return
    setBlockLoading(true)
    if (isBlocked) {
      await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', profile.id)
      setIsBlocked(false)
    } else {
      await supabase.from('blocks').insert({
        blocker_id: user.id,
        blocked_id: profile.id,
        blocked_nickname: profile.nickname,
      })
      setIsBlocked(true)
    }
    setBlockLoading(false)
  }

  const toggleHide = async () => {
    if (!profile || hideLoading) return
    setHideLoading(true)
    if (isHidden) {
      await supabase.from('hidden_users').delete().eq('hider_id', user.id).eq('hidden_id', profile.id)
      setIsHidden(false)
    } else {
      await supabase.from('hidden_users').insert({
        hider_id: user.id,
        hidden_id: profile.id,
        hidden_nickname: profile.nickname,
      })
      setIsHidden(true)
    }
    setHideLoading(false)
  }

  const loadPosts = useCallback(async () => {
    if (!profile) return
    setPostsLoading(true)
    setPostsError('')
    const { data: raw, error: fetchErr } = await supabase
      .from('posts').select('*').eq('author_id', profile.id)
      .order('created_at', { ascending: false }).limit(50)
    if (fetchErr) {
      console.error('[posts] fetch失敗:', fetchErr.code, fetchErr.message)
      setPostsError(fetchErr.message)
      setPostsLoading(false)
      return
    }
    if (!raw?.length) { setPosts([]); setPostsLoading(false); return }
    const ids = raw.map((p) => p.id)
    const [{ data: allLikes }, { data: myLikes }, { data: allReplies }] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', ids),
      supabase.from('post_likes').select('post_id').in('post_id', ids).eq('user_id', user.id),
      supabase.from('post_replies').select('post_id').in('post_id', ids),
    ])
    const lc = {}; (allLikes ?? []).forEach((l) => { lc[l.post_id] = (lc[l.post_id] ?? 0) + 1 })
    const liked = new Set((myLikes ?? []).map((l) => l.post_id))
    const rc = {}; (allReplies ?? []).forEach((r) => { rc[r.post_id] = (rc[r.post_id] ?? 0) + 1 })
    setPosts(raw.map((p) => ({ ...p, like_count: lc[p.id] ?? 0, liked: liked.has(p.id), reply_count: rc[p.id] ?? 0 })))
    setPostsLoading(false)
  }, [profile?.id, user.id])

  useEffect(() => { loadPosts() }, [loadPosts])

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

  useEffect(() => {
    if (!profile || profile.id === user.id || !profile.is_private) return
    supabase.from('dm_requests').select('status')
      .eq('sender_id', user.id).eq('receiver_id', profile.id).maybeSingle()
      .then(({ data }) => setRequestStatus(data?.status ?? 'none'))
  }, [profile, user.id])

  const sendDMRequest = async () => {
    if (!profile) return
    setRequestLoading(true); setDmRequestError('')
    const { error } = await supabase.from('dm_requests').upsert(
      { sender_id: user.id, sender_nickname: user.nickname, receiver_id: profile.id, status: 'pending' },
      { onConflict: 'sender_id,receiver_id' }
    )
    setRequestLoading(false)
    if (error) { setDmRequestError(`申請の送信に失敗しました: ${error.message}`); return }
    setRequestStatus('pending')
    triggerPushNotification({ receiverId: profile.id, senderName: user.nickname, senderId: user.id, content: 'DMの申請が届いています' })
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

  const renderDMButton = () => {
    if (isMe) {
      return (
        <button onClick={() => navigate('/profile')}
          className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-full py-2 text-sm transition">
          プロフィールを編集
        </button>
      )
    }
    if (!profile.is_private) {
      return (
        <button onClick={() => navigate(`/dm/${profile.id}`)}
          className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-full py-2 text-sm transition">
          💬 話しかける
        </button>
      )
    }
    if (requestStatus === null) return null
    if (requestStatus === 'accepted') {
      return (
        <button onClick={() => navigate(`/dm/${profile.id}`)}
          className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-full py-2 text-sm transition">
          💬 話しかける
        </button>
      )
    }
    if (requestStatus === 'pending') {
      return (
        <button disabled
          className="flex-1 bg-gray-100 text-gray-400 font-semibold rounded-full py-2 text-sm cursor-not-allowed">
          🕐 申請済み
        </button>
      )
    }
    return (
      <button onClick={sendDMRequest} disabled={requestLoading}
        className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white font-semibold rounded-full py-2 text-sm transition">
        {requestLoading ? '送信中...' : (requestStatus === 'rejected' ? '🔒 再申請する' : '🔒 DMの申請を送る')}
      </button>
    )
  }

  return (
    <div className="max-w-lg mx-auto w-full pb-8">

      {/* ── カバー写真 ── */}
      <div className="relative h-36 bg-gradient-to-r from-indigo-400 to-purple-500 overflow-hidden">
        {profile.cover_url && (
          <img src={profile.cover_url} alt="cover" className="w-full h-full object-cover" />
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white text-sm hover:bg-black/60 transition"
        >
          ←
        </button>
      </div>

      <div className="px-4">
        {/* ── アバター + ボタン ── */}
        <div className="flex items-end justify-between -mt-10 mb-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-full ring-4 ring-white shadow-md overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.nickname} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-3xl">
                  {profile.nickname[0].toUpperCase()}
                </div>
              )}
            </div>
            {online && (
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
            )}
          </div>

          {/* ボタン群 */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {!isMe && (
              <button
                onClick={() => setReportOpen(true)}
                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-200 transition text-sm"
                title="通報する"
              >
                🚩
              </button>
            )}
            {!isMe && (
              <button
                onClick={toggleHide}
                disabled={hideLoading}
                title={isHidden ? '非表示を解除' : '非表示にする'}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition text-sm disabled:opacity-50 ${
                  isHidden
                    ? 'bg-gray-100 border-gray-300 text-gray-500'
                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300'
                }`}
              >
                {isHidden ? '👁' : '🙈'}
              </button>
            )}
            {!isMe && (
              <button
                onClick={toggleBlock}
                disabled={blockLoading}
                title={isBlocked ? 'ブロックを解除' : 'ブロックする'}
                className={`w-9 h-9 rounded-full border flex items-center justify-center transition text-sm disabled:opacity-50 ${
                  isBlocked
                    ? 'bg-red-50 border-red-300 text-red-500'
                    : 'border-gray-200 text-gray-400 hover:text-red-400 hover:border-red-200'
                }`}
              >
                🚫
              </button>
            )}
            {!isMe && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`font-semibold rounded-full px-4 py-2 text-sm transition ${
                  isFollowing
                    ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'bg-gray-900 hover:bg-gray-700 text-white'
                }`}
              >
                {followLoading ? '...' : isFollowing ? 'フォロー中' : 'フォロー'}
              </button>
            )}
            {renderDMButton()}
          </div>
        </div>

        {/* ── プロフィール情報 ── */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900">{profile.nickname}</h1>
            {profile.is_private && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">🔒 鍵</span>
            )}
            {isMe && (
              <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">あなた</span>
            )}
            <span className="text-xs text-gray-400">{online ? '🟢' : '⚫'}</span>
          </div>

          {profile.bio && (
            <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {profile.prefecture && (
              <span className="text-xs text-gray-500 flex items-center gap-1">📍 {profile.prefecture}</span>
            )}
            {profile.age && (
              <span className="text-xs text-gray-500">{profile.age}歳</span>
            )}
            {profile.hobbies && (
              <span className="text-xs text-gray-500">🎯 {profile.hobbies}</span>
            )}
          </div>

          <div className="flex gap-4 mt-3">
            <button onClick={() => navigate(`/follows/${profile.id}/following`)}
              className="text-xs text-gray-500 hover:underline">
              <span className="font-bold text-gray-800">{followingCount}</span> フォロー中
            </button>
            <button onClick={() => navigate(`/follows/${profile.id}/followers`)}
              className="text-xs text-gray-500 hover:underline">
              <span className="font-bold text-gray-800">{followersCount}</span> フォロワー
            </button>
          </div>

          {dmRequestError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              <p className="font-semibold">⚠ {dmRequestError}</p>
            </div>
          )}
        </div>

        {/* ── 区切り ── */}
        <div className="border-t border-gray-100 mb-4" />

        {/* ── 投稿タイムライン ── */}
        <div className="space-y-3">
          {postsLoading && (
            <p className="text-center text-gray-400 text-sm py-6">読み込み中...</p>
          )}
          {!postsLoading && postsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-red-700">⚠ 投稿の読み込みに失敗しました</p>
              <p className="text-xs text-red-500 font-mono break-all">{postsError}</p>
              <p className="text-xs text-red-400">postsテーブルが存在しない可能性があります。管理者にご連絡ください。</p>
            </div>
          )}
          {!postsLoading && !postsError && posts.length === 0 && (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-gray-500 text-sm">まだ投稿がありません</p>
            </div>
          )}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
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

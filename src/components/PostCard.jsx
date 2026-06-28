import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function relativeTime(iso) {
  const d = new Date(iso)
  const s = (Date.now() - d) / 1000
  if (s < 60) return 'たった今'
  if (s < 3600) return `${Math.floor(s / 60)}分前`
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}日前`
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export default function PostCard({ post, onDelete }) {
  const { user } = useUser()
  const navigate = useNavigate()

  const [liked, setLiked]           = useState(post.liked ?? false)
  const [likeCount, setLikeCount]   = useState(post.like_count ?? 0)
  const [replyCount, setReplyCount] = useState(post.reply_count ?? 0)
  const [showForm, setShowForm]     = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies]       = useState([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [replyInput, setReplyInput] = useState('')
  const [sending, setSending]       = useState(false)

  const goToAuthor = () => {
    if (post.author_id === user.id) navigate('/profile')
    else navigate(`/profile/${post.author_id}`)
  }

  const toggleLike = async () => {
    if (liked) {
      await supabase.from('post_likes').delete()
        .eq('post_id', post.id).eq('user_id', user.id)
      setLiked(false)
      setLikeCount((n) => Math.max(0, n - 1))
    } else {
      await supabase.from('post_likes').upsert(
        { post_id: post.id, user_id: user.id },
        { onConflict: 'post_id,user_id' }
      )
      setLiked(true)
      setLikeCount((n) => n + 1)
    }
  }

  const loadReplies = async () => {
    if (repliesLoaded) return
    const { data } = await supabase
      .from('post_replies')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setReplies(data ?? [])
    setRepliesLoaded(true)
  }

  const toggleReplies = async () => {
    if (!showReplies) await loadReplies()
    setShowReplies((v) => !v)
  }

  const submitReply = async (e) => {
    e.preventDefault()
    const text = replyInput.trim()
    if (!text || sending) return
    setSending(true)
    const { data } = await supabase.from('post_replies').insert({
      post_id: post.id,
      author_id: user.id,
      author_nickname: user.nickname,
      content: text,
    }).select().single()
    if (data) {
      setReplies((prev) => [...prev, data])
      setReplyCount((n) => n + 1)
      setRepliesLoaded(true)
      setShowReplies(true)
      setReplyInput('')
      setShowForm(false)
    }
    setSending(false)
  }

  const isMyPost = post.author_id === user.id

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* 本文 */}
      <div className="px-4 pt-4 pb-2.5">
        <div className="flex gap-3">
          <button onClick={goToAuthor} className="shrink-0 mt-0.5">
            {post.author_avatar_url ? (
              <img src={post.author_avatar_url} alt={post.author_nickname}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                {post.author_nickname[0].toUpperCase()}
              </div>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <button onClick={goToAuthor}
                  className="font-bold text-sm text-gray-900 hover:underline truncate">
                  {post.author_nickname}
                </button>
                <span className="text-[11px] text-gray-400 shrink-0">{relativeTime(post.created_at)}</span>
              </div>
              {isMyPost && onDelete && (
                <button
                  onClick={() => onDelete(post.id)}
                  className="text-gray-300 hover:text-red-400 transition shrink-0 text-xs"
                  title="削除"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-sm text-gray-800 mt-1.5 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          </div>
        </div>
      </div>

      {/* アクション */}
      <div className="px-4 pb-3 flex items-center gap-5">
        {/* いいね */}
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4"
            fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>

        {/* 返信 */}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-indigo-500 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          {replyCount > 0 && <span>{replyCount}</span>}
        </button>

        {replyCount > 0 && (
          <button onClick={toggleReplies}
            className="ml-auto text-[11px] text-indigo-400 hover:text-indigo-600 transition">
            {showReplies ? '▲ 非表示' : `▼ 返信${replyCount}件`}
          </button>
        )}
      </div>

      {/* 返信フォーム */}
      {showForm && (
        <div className="px-4 pb-3 border-t border-gray-50 pt-3">
          <form onSubmit={submitReply} className="flex gap-2">
            <input
              type="text"
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              placeholder={`${post.author_nickname}に返信...`}
              maxLength={200}
              autoFocus
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            />
            <button type="submit" disabled={!replyInput.trim() || sending}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white rounded-xl px-3 text-xs font-semibold transition shrink-0">
              返信
            </button>
          </form>
        </div>
      )}

      {/* 返信一覧 */}
      {showReplies && replies.length > 0 && (
        <div className="border-t border-gray-50">
          {replies.map((reply) => (
            <div key={reply.id}
              className="px-4 py-3 flex gap-2.5 border-b border-gray-50 last:border-0 bg-gray-50/60">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                {reply.author_nickname[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <button
                    onClick={() => reply.author_id === user.id
                      ? navigate('/profile')
                      : navigate(`/profile/${reply.author_id}`)
                    }
                    className="font-semibold text-xs text-gray-800 hover:underline"
                  >
                    {reply.author_nickname}
                  </button>
                  <span className="text-[10px] text-gray-400">{relativeTime(reply.created_at)}</span>
                </div>
                <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

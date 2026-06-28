import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function formatTime(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  const diffH = (now - d) / 1000 / 3600
  if (diffH < 24) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  if (diffH < 24 * 7) return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

export default function ThreadsPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [threads, setThreads]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [posting, setPosting]   = useState(false)
  const [postError, setPostError] = useState('')

  const fetchThreads = useCallback(async () => {
    const { data } = await supabase
      .from('threads')
      .select('*, thread_messages(count)')
      .order('is_pinned', { ascending: false })
      .order('last_replied_at', { ascending: false })
    setThreads(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchThreads()
    const ch = supabase
      .channel('threads_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, fetchThreads)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thread_messages' }, fetchThreads)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchThreads])

  const handlePost = async (e) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    setPosting(true)
    setPostError('')
    const { error } = await supabase.from('threads').insert({
      title: trimmedTitle,
      body: body.trim(),
      author_id: user.id,
      author_nickname: user.nickname,
    })
    if (error) {
      setPostError(error.message)
    } else {
      setTitle('')
      setBody('')
      setShowForm(false)
    }
    setPosting(false)
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">💬 スレッド一覧</p>
        <button
          onClick={() => { setShowForm((v) => !v); setPostError('') }}
          className={`text-xs px-3 py-1.5 rounded-xl transition font-medium ${
            showForm
              ? 'border border-gray-200 text-gray-500 hover:bg-gray-50'
              : 'bg-indigo-500 hover:bg-indigo-600 text-white'
          }`}
        >
          {showForm ? 'キャンセル' : '+ スレッドを立てる'}
        </button>
      </div>

      {/* スレッド作成フォーム */}
      {showForm && (
        <form onSubmit={handlePost} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">タイトル <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="スレッドのタイトルを入力"
              maxLength={100}
              required
              autoFocus
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{title.length}/100</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">本文（任意）</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="スレッドの説明や最初のメッセージ"
              maxLength={500}
              rows={3}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{body.length}/500</p>
          </div>
          {postError && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">⚠ {postError}</p>
          )}
          <button
            type="submit"
            disabled={posting || !title.trim()}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white font-semibold rounded-xl py-2.5 text-sm transition"
          >
            {posting ? '投稿中...' : '投稿する'}
          </button>
        </form>
      )}

      {loading && <p className="text-center text-gray-400 text-sm py-8">読み込み中...</p>}

      {/* スレッド一覧 */}
      {threads.map((thread) => {
        const replyCount = thread.thread_messages?.[0]?.count ?? 0
        return (
          <button
            key={thread.id}
            onClick={() => navigate(`/chat/${thread.id}`)}
            className="w-full bg-white rounded-2xl px-4 py-3.5 shadow-sm hover:bg-indigo-50 active:bg-indigo-100 transition text-left"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {thread.is_pinned && (
                    <span className="shrink-0 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                      📌 固定
                    </span>
                  )}
                  <p className="font-semibold text-gray-800 text-sm">{thread.title}</p>
                </div>
                {thread.body && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{thread.body}</p>
                )}
              </div>
              <span className="text-[11px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">
                {formatTime(thread.last_replied_at)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="truncate">{thread.author_nickname}</span>
              <span className="shrink-0 flex items-center gap-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M1 8.74c0 .983.875 1.76 1.958 1.76h.524l-.084 1.899a.75.75 0 001.242.594L7.107 10.5H12.5c1.025 0 1.875-.806 1.875-1.76V3.26c0-.954-.85-1.76-1.875-1.76h-9.5C1.875 1.5 1 2.306 1 3.26v5.48z" clipRule="evenodd" />
                </svg>
                {replyCount}
              </span>
            </div>
          </button>
        )
      })}

      {!loading && threads.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">📝</p>
          <p className="text-gray-500 text-sm font-medium">スレッドがありません</p>
          <p className="text-gray-400 text-xs mt-1">最初のスレッドを立ててみましょう！</p>
        </div>
      )}
    </div>
  )
}

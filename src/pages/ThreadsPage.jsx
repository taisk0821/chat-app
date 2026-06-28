import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function formatTime(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  const diffH = (now - d) / 1000 / 3600
  if (diffH < 1)  return 'たった今'
  if (diffH < 24) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  if (diffH < 24 * 7) return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

const CREATE_TABLE_SQL = `-- Supabase SQL Editor で実行してください

-- ① threads テーブル
CREATE TABLE IF NOT EXISTS public.threads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL DEFAULT '',
  author_id       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  author_nickname TEXT        NOT NULL,
  is_pinned       BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_replied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads_allow_all" ON public.threads
  FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.threads;

-- ② thread_messages テーブル
CREATE TABLE IF NOT EXISTS public.thread_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       UUID        NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  author_id       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  author_nickname TEXT        NOT NULL,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread_messages_allow_all" ON public.thread_messages
  FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_messages;

-- ③ 雑談スレッドを挿入
INSERT INTO public.threads (title, body, author_nickname, is_pinned)
VALUES ('雑談', 'みんなで自由に話しましょう！', 'システム', true);`

export default function ThreadsPage() {
  const { user } = useUser()
  const navigate = useNavigate()

  const [threads, setThreads]         = useState([])
  const [replyCounts, setReplyCounts] = useState({}) // { threadId: number }
  const [loading, setLoading]         = useState(true)
  const [fetchError, setFetchError]   = useState('')

  const [showForm, setShowForm]   = useState(false)
  const [title, setTitle]         = useState('')
  const [body, setBody]           = useState('')
  const [posting, setPosting]     = useState(false)
  const [postError, setPostError] = useState('')

  // ---- スレッド一覧取得 ----
  const fetchThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from('threads')
      .select('*')
      .order('last_replied_at', { ascending: false })

    if (error) {
      console.error('[threads] fetch失敗:', error.code, error.message)
      setFetchError(error.message)
      setLoading(false)
      return
    }

    // is_pinned でクライアントソート（DBカラムが後から追加された場合も安全）
    const sorted = [...(data ?? [])].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      return 0
    })

    setFetchError('')
    setThreads(sorted)
    setLoading(false)
  }, [])

  // ---- 返信数を別クエリで取得 ----
  const fetchReplyCounts = useCallback(async (threadList) => {
    if (threadList.length === 0) return
    const ids = threadList.map((t) => t.id)
    const { data } = await supabase
      .from('thread_messages')
      .select('thread_id')
      .in('thread_id', ids)
    const counts = {}
    ;(data ?? []).forEach((m) => {
      counts[m.thread_id] = (counts[m.thread_id] ?? 0) + 1
    })
    setReplyCounts(counts)
  }, [])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  useEffect(() => {
    fetchReplyCounts(threads)
  }, [threads, fetchReplyCounts])

  // ---- リアルタイム購読 ----
  useEffect(() => {
    const ch = supabase
      .channel('threads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, fetchThreads)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'thread_messages' }, () => {
        fetchThreads()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchThreads])

  // ---- スレッド作成 ----
  const handlePost = async (e) => {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    setPosting(true)
    setPostError('')

    const { data: inserted, error } = await supabase
      .from('threads')
      .insert({
        title: trimmedTitle,
        body: body.trim(),
        author_id: user.id,
        author_nickname: user.nickname,
      })
      .select()
      .single()

    if (error) {
      console.error('[threads] insert失敗:', error.code, error.message)
      setPostError(error.message)
      setPosting(false)
      return
    }

    // 作成したスレッドの中に遷移
    navigate(`/chat/${inserted.id}`)
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
            <label className="text-xs font-medium text-gray-600">
              タイトル <span className="text-red-400">*</span>
            </label>
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
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 space-y-1">
              <p className="text-xs font-semibold text-red-700">⚠ 投稿に失敗しました</p>
              <p className="text-xs text-red-500 font-mono break-all">{postError}</p>
              <p className="text-xs text-red-400">threadsテーブルが存在しない場合は下記SQLを実行してください。</p>
              <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-2 overflow-x-auto mt-1 whitespace-pre-wrap leading-relaxed">{CREATE_TABLE_SQL}</pre>
            </div>
          )}
          <button
            type="submit"
            disabled={posting || !title.trim()}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white font-semibold rounded-xl py-2.5 text-sm transition"
          >
            {posting ? '投稿中...' : '投稿してスレッドに入る'}
          </button>
        </form>
      )}

      {/* テーブルが存在しない場合のエラー */}
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-red-700">⚠ スレッドの読み込みに失敗しました</p>
          <p className="text-xs text-red-500 font-mono break-all">{fetchError}</p>
          <p className="text-xs text-red-400">Supabase の SQL Editor で以下を実行してください：</p>
          <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-2 overflow-x-auto whitespace-pre-wrap leading-relaxed">{CREATE_TABLE_SQL}</pre>
          <button
            onClick={fetchThreads}
            className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition"
          >
            再試行
          </button>
        </div>
      )}

      {loading && (
        <p className="text-center text-gray-400 text-sm py-8">読み込み中...</p>
      )}

      {/* スレッド一覧 */}
      {!loading && !fetchError && threads.map((thread) => (
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
              {replyCounts[thread.id] ?? 0}
            </span>
          </div>
        </button>
      ))}

      {!loading && !fetchError && threads.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">📝</p>
          <p className="text-gray-500 text-sm font-medium">スレッドがありません</p>
          <p className="text-gray-400 text-xs mt-1">最初のスレッドを立ててみましょう！</p>
        </div>
      )}
    </div>
  )
}

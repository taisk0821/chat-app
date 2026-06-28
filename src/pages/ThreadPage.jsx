import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function formatTime(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  const diffH = (now - d) / 1000 / 3600
  if (diffH < 24) return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function ThreadPage() {
  const { threadId } = useParams()
  const { user } = useUser()
  const navigate = useNavigate()

  const [thread, setThread]         = useState(null)
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [sending, setSending]       = useState(false)
  const [nicknameToId, setNicknameToId] = useState({})
  const bottomRef = useRef(null)

  // スレッド本体を取得
  useEffect(() => {
    supabase.from('threads').select('*').eq('id', threadId).single()
      .then(({ data }) => {
        if (!data) navigate('/chat', { replace: true })
        else setThread(data)
      })
  }, [threadId, navigate])

  // メッセージ取得 + リアルタイム購読
  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('thread_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(300)
    if (data) setMessages(data)
  }, [threadId])

  useEffect(() => {
    fetchMessages()
    const ch = supabase
      .channel(`thread:${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'thread_messages',
        filter: `thread_id=eq.${threadId}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchMessages, threadId])

  // ニックネーム→ID マップ（プロフィールリンク用）
  useEffect(() => {
    if (messages.length === 0) return
    const unique = [...new Set(messages.map((m) => m.author_nickname))]
    const unknown = unique.filter((n) => !(n in nicknameToId))
    if (unknown.length === 0) return
    supabase.from('users').select('id, nickname').in('nickname', unknown)
      .then(({ data }) => {
        if (!data) return
        setNicknameToId((prev) => {
          const next = { ...prev }
          data.forEach((u) => { next[u.nickname] = u.id })
          return next
        })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleNicknameClick = (nickname) => {
    if (nickname === user.nickname) {
      navigate('/profile')
    } else {
      const id = nicknameToId[nickname]
      if (id) navigate(`/profile/${id}`)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    const { error } = await supabase.from('thread_messages').insert({
      thread_id: threadId,
      author_id: user.id,
      author_nickname: user.nickname,
      content: text,
    })
    if (!error) {
      // last_replied_at を更新してスレッド一覧の並び順を更新
      supabase.from('threads')
        .update({ last_replied_at: new Date().toISOString() })
        .eq('id', threadId)
    }
    setSending(false)
  }

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pb-4"
      style={{ height: 'calc(100dvh - 52px - 56px - env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden mt-4">

        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <button
            onClick={() => navigate('/chat')}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-800 text-sm truncate">{thread.title}</p>
            <p className="text-xs text-gray-400">
              {thread.author_nickname} · {formatDate(thread.created_at)}
            </p>
          </div>
        </div>

        {/* スレッド本文（bodyがある場合） */}
        {thread.body && (
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 shrink-0">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{thread.body}</p>
          </div>
        )}

        {/* メッセージ一覧 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm mt-8">
              まだ返信がありません。最初に返信しましょう！
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.author_nickname === user.nickname
            return (
              <div key={msg.id} className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-1.5 w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm break-words ${
                    isMe
                      ? 'bg-indigo-500 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    <button
                      onClick={() => handleNicknameClick(msg.author_nickname)}
                      className={`text-xs font-semibold hover:underline text-left block mb-0.5 ${
                        isMe ? 'text-indigo-200' : 'text-indigo-500'
                      }`}
                    >
                      {msg.author_nickname}
                    </button>
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 mt-0.5 px-1">
                  {formatTime(msg.created_at)}
                </span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* 返信入力 */}
        <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
          <input
            type="text"
            placeholder="返信を入力..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white rounded-xl px-4 py-2.5 transition font-medium text-sm shrink-0"
          >
            送信
          </button>
        </form>
      </div>
    </div>
  )
}

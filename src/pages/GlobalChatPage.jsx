import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'
import ReportModal from '../components/ReportModal'

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

export default function GlobalChatPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [messages, setMessages]         = useState([])
  const [input, setInput]               = useState('')
  const [sending, setSending]           = useState(false)
  const [nicknameToId, setNicknameToId] = useState({})
  const [followingIds, setFollowingIds] = useState(new Set())
  const [reporting, setReporting]       = useState(null) // 通報対象メッセージ
  const bottomRef = useRef(null)

  // フォロー中ユーザーIDセットを取得
  useEffect(() => {
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .then(({ data }) => {
        setFollowingIds(new Set((data ?? []).map((f) => f.following_id)))
      })
  }, [user.id])

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)
      if (!error) setMessages(data)
    }
    fetchMessages()

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // メッセージが増えたとき、まだ ID が不明なニックネームだけ Supabase に問い合わせる
  useEffect(() => {
    if (messages.length === 0) return
    const uniqueNicknames = [...new Set(messages.map((m) => m.nickname))]
    const unknown = uniqueNicknames.filter((n) => !nicknameToId[n])
    if (unknown.length === 0) return

    supabase
      .from('users')
      .select('id, nickname')
      .in('nickname', unknown)
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

  const sendMessage = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    await supabase.from('messages').insert({ nickname: user.nickname, content: text })
    setSending(false)
  }

  return (
    <div
      className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pb-4"
      style={{ height: 'calc(100dvh - 52px - 56px - env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">🌐 みんなのチャット</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm mt-8">まだメッセージがありません</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.nickname === user.nickname
            const msgUserId = nicknameToId[msg.nickname]
            const isFollowed = !isMe && msgUserId && followingIds.has(msgUserId)
            return (
              <div key={msg.id} className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-1.5 w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm break-words ${
                    isMe ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {/* 投稿者名 — クリックでプロフィールへ */}
                    {!isMe && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <button
                          onClick={() => handleNicknameClick(msg.nickname)}
                          className={`text-xs font-semibold hover:underline text-left ${
                            isFollowed ? 'text-indigo-600' : 'text-indigo-500'
                          }`}
                        >
                          {msg.nickname}
                        </button>
                        {isFollowed && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1 py-0.5 rounded-full leading-none font-medium">
                            フォロー中
                          </span>
                        )}
                      </div>
                    )}
                    {isMe && (
                      <button
                        onClick={() => handleNicknameClick(msg.nickname)}
                        className="text-xs font-semibold text-indigo-200 mb-0.5 hover:underline text-left block"
                      >
                        {msg.nickname}
                      </button>
                    )}
                    <p>{msg.content}</p>
                  </div>

                  {/* 通報ボタン（他人のメッセージのみ） */}
                  {!isMe && (
                    <button
                      onClick={() => setReporting(msg)}
                      title="通報する"
                      className="shrink-0 text-gray-300 hover:text-red-400 transition mb-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M3.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0v-4.392l1.657-.348a6.449 6.449 0 014.271.572 7.948 7.948 0 005.965.524l2.078-.64A.75.75 0 0018 12.25v-8.5a.75.75 0 00-.904-.734l-2.38.501a7.25 7.25 0 01-4.186-.363l-.502-.2a8.75 8.75 0 00-5.053-.439l-1.475.31V2.75z" />
                      </svg>
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={sendMessage} className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <input
            type="text"
            placeholder="メッセージを入力..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white rounded-xl px-4 py-2.5 transition font-medium text-sm"
          >
            送信
          </button>
        </form>
      </div>

      {/* 通報モーダル */}
      {reporting && (
        <ReportModal
          targetType="message"
          targetId={reporting.id}
          targetNickname={reporting.nickname}
          targetContent={reporting.content}
          onClose={() => setReporting(null)}
        />
      )}
    </div>
  )
}

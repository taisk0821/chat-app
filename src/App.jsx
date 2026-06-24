import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

function formatTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

function NicknameForm({ onJoin }) {
  const [nickname, setNickname] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (trimmed) onJoin(trimmed)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">💬</div>
          <h1 className="text-2xl font-bold text-gray-800">匿名チャット</h1>
          <p className="text-gray-500 text-sm mt-1">ニックネームを入力して入室</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="ニックネーム"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={!nickname.trim()}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white font-semibold rounded-xl py-3 transition"
          >
            入室する
          </button>
        </form>
      </div>
    </div>
  )
}

function ChatRoom({ nickname, onLeave }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    await supabase.from('messages').insert({ nickname, content: text })
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg flex flex-col" style={{ height: '90vh', maxHeight: '700px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <span className="font-bold text-gray-800">匿名チャット</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              <span className="font-medium text-indigo-600">{nickname}</span> として入室中
            </span>
            <button
              onClick={onLeave}
              className="text-xs text-gray-400 hover:text-red-400 transition border border-gray-200 hover:border-red-200 rounded-lg px-2 py-1"
            >
              退室
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm mt-8">まだメッセージがありません</p>
          )}
          {messages.map((msg) => {
            const isMe = msg.nickname === nickname
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm break-words ${
                      isMe
                        ? 'bg-indigo-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {!isMe && (
                      <p className="text-xs font-semibold text-indigo-500 mb-0.5">{msg.nickname}</p>
                    )}
                    <p>{msg.content}</p>
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

        {/* Input */}
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
    </div>
  )
}

export default function App() {
  const [nickname, setNickname] = useState(() => sessionStorage.getItem('chat_nickname') || '')

  const handleJoin = (name) => {
    sessionStorage.setItem('chat_nickname', name)
    setNickname(name)
  }

  const handleLeave = () => {
    sessionStorage.removeItem('chat_nickname')
    setNickname('')
  }

  if (!nickname) return <NicknameForm onJoin={handleJoin} />
  return <ChatRoom nickname={nickname} onLeave={handleLeave} />
}

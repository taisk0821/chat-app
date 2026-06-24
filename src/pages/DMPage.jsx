import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

export default function DMPage() {
  const { userId } = useParams()
  const { user } = useUser()
  const navigate = useNavigate()
  const [partner, setPartner] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const fetchPartner = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', userId).single()
      if (!data) navigate('/users')
      else setPartner(data)
    }
    fetchPartner()
  }, [userId, navigate])

  useEffect(() => {
    if (!user) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true })
        .limit(100)
      if (data) setMessages(data)
    }
    fetchMessages()

    const channelName = `dm:${[user.id, userId].sort().join(':')}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const msg = payload.new
        const relevant =
          (msg.sender_id === user.id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === user.id)
        if (!relevant) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id, userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: userId,
      content: text,
    })
    setSending(false)
  }

  return (
    <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pb-4" style={{ height: 'calc(100vh - 57px)' }}>
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden mt-4">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => navigate('/users')}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ←
          </button>
          {partner && (
            <>
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                {partner.nickname[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{partner.nickname}</p>
                {partner.bio && <p className="text-xs text-gray-400 truncate">{partner.bio}</p>}
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-400 text-sm mt-8">
              {partner ? `${partner.nickname} さんへ最初のメッセージを送ってみましょう` : 'メッセージはまだありません'}
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user.id
            return (
              <div key={msg.id} className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-end gap-2 w-full ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm break-words ${
                    isMe ? 'bg-indigo-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    <p>{msg.content}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <input
            type="text"
            placeholder={`${partner?.nickname ?? ''}さんにメッセージ...`}
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

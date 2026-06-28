import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

function Avatar({ nickname, avatarUrl }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={nickname} className="w-12 h-12 rounded-full object-cover shrink-0" />
  }
  return (
    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
      {nickname[0].toUpperCase()}
    </div>
  )
}

const DM_REQUESTS_SQL = `CREATE TABLE IF NOT EXISTS public.dm_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_nickname TEXT        NOT NULL,
  receiver_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','accepted','rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);
ALTER TABLE public.dm_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm_requests_allow_all" ON public.dm_requests
  FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_requests;`

export default function RequestsPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [tableError, setTableError] = useState('')
  // senderIdとアバターURLのマップ
  const [avatarMap, setAvatarMap] = useState({})

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('dm_requests')
      .select('*')
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[dm_requests] fetch失敗:', error.code, error.message)
      setTableError(error.message)
      setLoading(false)
      return
    }
    setTableError('')
    const reqs = data ?? []
    setRequests(reqs)
    setLoading(false)

    // 送信者のアバターURLを取得
    if (reqs.length > 0) {
      const ids = reqs.map((r) => r.sender_id)
      supabase.from('users').select('id, avatar_url').in('id', ids).then(({ data: users }) => {
        const map = {}
        ;(users ?? []).forEach((u) => { map[u.id] = u.avatar_url })
        setAvatarMap(map)
      })
    }
  }, [user.id])

  useEffect(() => {
    fetchRequests()
    const ch = supabase
      .channel('requests_page')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dm_requests',
        filter: `receiver_id=eq.${user.id}`,
      }, fetchRequests)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [fetchRequests])

  const respond = async (requestId, senderId, status) => {
    await supabase.from('dm_requests').update({ status }).eq('id', requestId)
    setRequests((prev) => prev.filter((r) => r.id !== requestId))
    if (status === 'accepted') navigate(`/dm/${senderId}`)
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">📬 DM申請一覧</p>
        {!loading && (
          <span className="text-xs text-gray-400">{requests.length} 件</span>
        )}
      </div>

      {loading && (
        <p className="text-center text-gray-400 text-sm py-8">読み込み中...</p>
      )}

      {tableError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-2">
          <p className="font-semibold">⚠ dm_requestsテーブルが見つかりません</p>
          <p className="text-red-500 font-mono break-all">{tableError}</p>
          <p className="text-red-400">Supabase の SQL Editor で以下を実行してください：</p>
          <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-2 overflow-x-auto whitespace-pre-wrap leading-relaxed">{DM_REQUESTS_SQL}</pre>
        </div>
      )}

      {!loading && !tableError && requests.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 text-sm font-medium">申請はありません</p>
          <p className="text-gray-400 text-xs mt-1">DM申請が届くとここに表示されます</p>
        </div>
      )}

      {requests.map((req) => (
        <div key={req.id} className="bg-white rounded-2xl px-4 py-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/profile/${req.sender_id}`)}
              className="shrink-0"
            >
              <Avatar nickname={req.sender_nickname} avatarUrl={avatarMap[req.sender_id]} />
            </button>
            <div className="min-w-0 flex-1">
              <button
                onClick={() => navigate(`/profile/${req.sender_id}`)}
                className="text-left hover:opacity-70 transition"
              >
                <p className="font-semibold text-gray-800 text-sm">{req.sender_nickname}</p>
                <p className="text-xs text-gray-400 mt-0.5">DMを送りたがっています</p>
              </button>
            </div>
            <span className="text-xs text-gray-300 shrink-0">
              {new Date(req.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => respond(req.id, req.sender_id, 'accepted')}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl py-2.5 text-sm transition"
            >
              許可する
            </button>
            <button
              onClick={() => respond(req.id, req.sender_id, 'rejected')}
              className="flex-1 border border-gray-200 text-gray-500 hover:bg-gray-50 font-medium rounded-xl py-2.5 text-sm transition"
            >
              拒否する
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

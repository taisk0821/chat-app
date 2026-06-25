import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

const REASONS = [
  { value: 'spam',          label: 'スパム' },
  { value: 'inappropriate', label: '不適切な内容' },
  { value: 'harassment',    label: '嫌がらせ' },
  { value: 'other',         label: 'その他' },
]

// targetType: 'message' | 'user'
// targetId: message.id or user.id
// targetNickname: 通報対象のニックネーム
// targetContent: メッセージ内容（user 通報の場合は undefined）
export default function ReportModal({ targetType, targetId, targetNickname, targetContent, onClose }) {
  const { user } = useUser()
  const [reason, setReason]   = useState('')
  const [detail, setDetail]   = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason) return
    setSending(true)
    await supabase.from('reports').insert({
      reporter_id: user.id,
      reporter_nickname: user.nickname,
      target_type: targetType,
      target_id: String(targetId),
      target_nickname: targetNickname ?? null,
      target_content: targetContent ?? null,
      reason,
      detail: detail.trim() || null,
    })
    setSending(false)
    setSent(true)
    setTimeout(onClose, 2000)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-bold text-gray-800">通報しました</p>
            <p className="text-sm text-gray-500 mt-1">ご報告ありがとうございます</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-500">
                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a3 3 0 110 6H6a3 3 0 01-3-3zM3.293 9.293a1 1 0 011.414 0L10 14.586l5.293-5.293a1 1 0 011.414 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800">通報する</h2>
                <p className="text-xs text-gray-500">
                  {targetType === 'user'
                    ? `${targetNickname} さんを通報`
                    : `${targetNickname} さんのメッセージを通報`}
                </p>
              </div>
            </div>

            {targetContent && (
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-600 border border-gray-100 line-clamp-3">
                {targetContent}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2.5">通報理由</p>
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <label
                      key={r.value}
                      className={`flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2.5 border transition ${
                        reason === r.value
                          ? 'border-red-400 bg-red-50'
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="accent-red-500 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-gray-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">詳細（任意）</label>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="詳細があれば入力してください"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300 transition"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl py-2.5 text-sm font-medium transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={!reason || sending}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-200 text-white rounded-xl py-2.5 text-sm font-semibold transition"
                >
                  {sending ? '送信中...' : '通報する'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

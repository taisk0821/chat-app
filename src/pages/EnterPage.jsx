import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export default function EnterPage() {
  const { login } = useUser()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [hobbies, setHobbies] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!nickname.trim()) return
    setLoading(true)
    setError(null)

    const { ok, errMsg } = await login(nickname.trim(), bio.trim(), hobbies.trim())

    if (!ok) {
      // DB保存に失敗してもローカルには保存済みなので画面遷移はするが警告を出す
      setError(`DB保存エラー: ${errMsg}`)
      setLoading(false)
      // 3秒後に遷移
      setTimeout(() => navigate('/chat'), 3000)
      return
    }

    navigate('/chat')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">💬</div>
          <h1 className="text-2xl font-bold text-gray-800">匿名チャット</h1>
          <p className="text-gray-500 text-sm mt-1">プロフィールを入力して入室</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
            <p className="font-semibold">⚠ エラーが発生しました</p>
            <p className="mt-0.5">{error}</p>
            <p className="mt-0.5 text-red-400">3秒後に自動的に画面を移動します...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500">ニックネーム *</label>
            <input
              type="text"
              placeholder="ニックネームを入力"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              autoFocus
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">自己紹介（任意）</label>
            <textarea
              placeholder="どんな人か教えてください"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">趣味（任意）</label>
            <input
              type="text"
              placeholder="例: 読書・映画・料理"
              value={hobbies}
              onChange={(e) => setHobbies(e.target.value)}
              maxLength={100}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>
          <button
            type="submit"
            disabled={!nickname.trim() || loading}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white font-semibold rounded-xl py-3 transition mt-2"
          >
            {loading ? '登録中...' : '入室する'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useUser } from '../context/UserContext'

export default function ProfilePage() {
  const { user, updateProfile } = useUser()
  const [bio, setBio] = useState(user?.bio || '')
  const [hobbies, setHobbies] = useState(user?.hobbies || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await updateProfile(bio.trim(), hobbies.trim())
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4">
      <p className="text-sm font-semibold text-gray-700 mb-4">👤 プロフィール編集</p>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-100">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xl shrink-0">
            {user?.nickname[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-gray-800 text-lg">{user?.nickname}</p>
            <p className="text-xs text-gray-400 mt-0.5">ニックネームは変更できません</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">自己紹介</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="自己紹介を入力してください"
              maxLength={200}
              rows={3}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{bio.length}/200</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">趣味</label>
            <input
              type="text"
              value={hobbies}
              onChange={(e) => setHobbies(e.target.value)}
              placeholder="例: 読書・映画・料理"
              maxLength={100}
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`w-full font-semibold rounded-xl py-2.5 transition ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white'
            }`}
          >
            {saving ? '保存中...' : saved ? '✓ 保存しました' : '保存する'}
          </button>
        </form>
      </div>
    </div>
  )
}

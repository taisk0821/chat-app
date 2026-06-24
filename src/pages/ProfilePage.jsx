import { useState, useRef } from 'react'
import { useUser } from '../context/UserContext'
import { supabase } from '../supabaseClient'

function AvatarUpload({ user, onUploaded }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('5MB以下の画像を選択してください')
      return
    }
    setError('')
    setUploading(true)

    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError('アップロードに失敗しました')
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // cache-busting to force browser reload
    const url = `${data.publicUrl}?t=${Date.now()}`
    await onUploaded(url)
    setUploading(false)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer group"
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-3xl">
            {user.nickname[0].toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-full">
          <span className="text-white text-xs font-medium">
            {uploading ? '...' : '変更'}
          </span>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-xs text-gray-400">クリックして写真を変更（5MB以下）</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export default function ProfilePage() {
  const { user, updateProfile, updateAvatar } = useUser()
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
      <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center pb-5 border-b border-gray-100">
          <AvatarUpload user={user} onUploaded={updateAvatar} />
          <p className="font-bold text-gray-800 text-lg mt-3">{user?.nickname}</p>
          <p className="text-xs text-gray-400">ニックネームは変更できません</p>
        </div>

        {/* Profile form */}
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

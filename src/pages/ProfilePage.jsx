import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { supabase } from '../supabaseClient'

// ---- アバターアップロード ----
function AvatarUpload({ user, onUploaded }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('画像ファイルを選択してください'); return }
    if (file.size > 5 * 1024 * 1024) { setError('5MB以下の画像を選択してください'); return }
    setError('')
    setUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) { setError('アップロードに失敗しました'); setUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await onUploaded(`${data.publicUrl}?t=${Date.now()}`)
    setUploading(false)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div onClick={() => !uploading && fileRef.current?.click()}
        className="relative w-24 h-24 rounded-full overflow-hidden cursor-pointer group">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-3xl">
            {user.nickname[0].toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-full">
          <span className="text-white text-xs font-medium">{uploading ? '...' : '変更'}</span>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <p className="text-xs text-gray-400">クリックして写真を変更（5MB以下）</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ---- RLS未設定時に表示するSQL案内 ----
const DELETE_SQL = `-- Supabase SQL Editor で実行してください
create policy "allow_delete_users"
  on public.users for delete using (true);

create policy "allow_delete_messages"
  on public.messages for delete using (true);

create policy "allow_delete_direct_messages"
  on public.direct_messages for delete using (true);`

function RlsErrorGuide() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(DELETE_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2 text-left">
      <p className="text-xs font-semibold text-amber-800">
        ⚠ Supabase の DELETE ポリシーが未設定です
      </p>
      <p className="text-xs text-amber-700">
        Supabase ダッシュボード → <strong>SQL Editor</strong> で以下を実行後、再度お試しください。
      </p>
      <div className="relative">
        <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
{DELETE_SQL}
        </pre>
        <button onClick={copy}
          className="absolute top-1.5 right-1.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded transition">
          {copied ? '✓ コピー済' : 'コピー'}
        </button>
      </div>
    </div>
  )
}

// ---- アカウント削除確認モーダル ----
function DeleteAccountModal({ user, onClose, onDeleted }) {
  const [input, setInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [rlsBlocked, setRlsBlocked] = useState(false)

  const confirmed = input === user.nickname

  const handleDelete = async () => {
    if (!confirmed) return
    setDeleting(true)
    setError(null)
    setRlsBlocked(false)

    // Step 1: DM削除
    const { data: deletedDMs, error: dmErr } = await supabase
      .from('direct_messages')
      .delete()
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .select('id')
    if (dmErr) {
      setError(`DM削除エラー: ${dmErr.message}`)
      setDeleting(false); return
    }

    // Step 2: チャットメッセージ削除
    const { data: deletedMsgs, error: msgErr } = await supabase
      .from('messages')
      .delete()
      .eq('nickname', user.nickname)
      .select('id')
    if (msgErr) {
      setError(`メッセージ削除エラー: ${msgErr.message}`)
      setDeleting(false); return
    }

    // Step 3: ユーザー削除 — .select('id') で実際に削除されたか確認
    const { data: deletedUser, error: userErr } = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)
      .select('id')
    if (userErr) {
      setError(`アカウント削除エラー: ${userErr.message}`)
      setDeleting(false); return
    }

    // 0件 = RLS が DELETE をブロックしている
    if (!deletedUser || deletedUser.length === 0) {
      setRlsBlocked(true)
      setDeleting(false); return
    }

    // Step 4: アバター画像を削除（失敗しても続行）
    await Promise.allSettled(
      ['jpg', 'jpeg', 'png', 'webp', 'gif'].map((ext) =>
        supabase.storage.from('avatars').remove([`${user.id}.${ext}`])
      )
    )

    onDeleted()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🗑</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800">アカウントを削除しますか？</h2>
          <p className="text-sm text-gray-500 mt-1">この操作は取り消せません。</p>
        </div>

        <ul className="text-xs text-gray-600 bg-gray-50 rounded-xl px-4 py-3 space-y-1">
          <li>・プロフィール情報（ニックネーム・自己紹介・アイコン）</li>
          <li>・送受信したDMメッセージ</li>
          <li>・投稿したチャットメッセージ</li>
        </ul>

        <div>
          <label className="text-xs font-medium text-gray-600">
            確認のため <span className="font-bold text-gray-800">「{user.nickname}」</span> と入力してください
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={user.nickname}
            autoFocus
            className="w-full mt-1.5 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</p>
        )}

        {/* RLS未設定ガイド */}
        {rlsBlocked && <RlsErrorGuide />}

        <div className="flex gap-2">
          <button onClick={onClose} disabled={deleting}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl py-2.5 text-sm font-medium transition">
            キャンセル
          </button>
          <button onClick={handleDelete} disabled={!confirmed || deleting}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-200 text-white rounded-xl py-2.5 text-sm font-semibold transition">
            {deleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- プロフィール編集ページ ----
export default function ProfilePage() {
  const { user, updateProfile, updateAvatar, clearAccountStorage } = useUser()
  const navigate = useNavigate()
  const [bio, setBio] = useState(user?.bio || '')
  const [hobbies, setHobbies] = useState(user?.hobbies || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await updateProfile(bio.trim(), hobbies.trim())
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleDeleted = () => {
    // chat_user / chat_user_id / dm_read_* を全消去してReact stateもリセット
    clearAccountStorage(user.id)
    navigate('/')
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
          <button type="submit" disabled={saving}
            className={`w-full font-semibold rounded-xl py-2.5 transition ${
              saved ? 'bg-green-500 text-white'
                    : 'bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white'
            }`}>
            {saving ? '保存中...' : saved ? '✓ 保存しました' : '保存する'}
          </button>
        </form>

        {/* アカウント削除 */}
        <div className="pt-4 border-t border-gray-100">
          <button onClick={() => setShowDeleteModal(true)}
            className="w-full text-sm text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 hover:bg-red-50 rounded-xl py-2.5 font-medium transition">
            アカウントを削除する
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          user={user}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}

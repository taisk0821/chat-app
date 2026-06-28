import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { supabase } from '../supabaseClient'
import { PREFECTURES, GENDERS } from '../constants/profile'
import PostCard from '../components/PostCard'


// ---- アバターアップロード ----
function AvatarUpload({ user, onUploaded }) {
  const ref = useRef(null)
  const [uploading, setUploading] = useState(false)
  const handleChange = async (e) => {
    const file = e.target.files[0]
    if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return
    setUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await onUploaded(`${data.publicUrl}?t=${Date.now()}`)
    }
    setUploading(false)
  }
  return (
    <div onClick={() => !uploading && ref.current?.click()} className="cursor-pointer group relative">
      <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-white shadow-md">
        {user.avatar_url
          ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-3xl">
              {user.nickname[0].toUpperCase()}
            </div>
        }
      </div>
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
        <span className="text-white text-[10px] font-medium">{uploading ? '...' : '変更'}</span>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  )
}

// ---- カバー画像アップロード ----
function CoverUpload({ user, onUploaded }) {
  const ref = useRef(null)
  const [uploading, setUploading] = useState(false)
  const handleChange = async (e) => {
    const file = e.target.files[0]
    if (!file || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return
    setUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}.${ext}`
    const { error } = await supabase.storage.from('covers').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data } = supabase.storage.from('covers').getPublicUrl(path)
      await onUploaded(`${data.publicUrl}?t=${Date.now()}`)
    }
    setUploading(false)
  }
  return (
    <>
      <div
        onClick={() => !uploading && ref.current?.click()}
        className="relative h-36 bg-gradient-to-r from-indigo-400 to-purple-500 cursor-pointer group overflow-hidden"
      >
        {user.cover_url
          ? <img src={user.cover_url} alt="cover" className="w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <span className="text-white text-xs font-medium bg-black/40 px-3 py-1.5 rounded-full">
                {uploading ? 'アップロード中...' : '📷 カバー写真を変更'}
              </span>
            </div>
        }
        {user.cover_url && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="text-white text-xs font-medium bg-black/50 px-3 py-1.5 rounded-full">
              {uploading ? 'アップロード中...' : '📷 カバー写真を変更'}
            </span>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </>
  )
}

// ---- アカウント削除 ----
const DELETE_SQL = `create policy "allow_delete_users" on public.users for delete using (true);
create policy "allow_delete_messages" on public.messages for delete using (true);
create policy "allow_delete_direct_messages" on public.direct_messages for delete using (true);`

function DeleteAccountModal({ user, onClose, onDeleted }) {
  const [input, setInput]     = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState(null)
  const [rlsBlocked, setRlsBlocked] = useState(false)
  const [copied, setCopied]   = useState(false)

  const handleDelete = async () => {
    if (input !== user.nickname) return
    setDeleting(true); setError(null); setRlsBlocked(false)
    const { error: dmErr } = await supabase.from('direct_messages').delete()
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    if (dmErr) { setError(`DM削除エラー: ${dmErr.message}`); setDeleting(false); return }
    await supabase.from('messages').delete().eq('nickname', user.nickname)
    const { data: deletedUser, error: userErr } = await supabase.from('users').delete().eq('id', user.id).select('id')
    if (userErr) { setError(`アカウント削除エラー: ${userErr.message}`); setDeleting(false); return }
    if (!deletedUser?.length) { setRlsBlocked(true); setDeleting(false); return }
    await Promise.allSettled(['jpg','jpeg','png','webp','gif'].map((ext) =>
      supabase.storage.from('avatars').remove([`${user.id}.${ext}`])
    ))
    onDeleted()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🗑</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800">アカウントを削除しますか？</h2>
          <p className="text-sm text-gray-500 mt-1">この操作は取り消せません。</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">
            確認のため <span className="font-bold text-gray-800">「{user.nickname}」</span> と入力してください
          </label>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={user.nickname} autoFocus
            className="w-full mt-1.5 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition" />
        </div>
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</p>}
        {rlsBlocked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2 text-left">
            <p className="text-xs font-semibold text-amber-800">⚠ Supabase の DELETE ポリシーが未設定です</p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{DELETE_SQL}</pre>
              <button onClick={() => { navigator.clipboard.writeText(DELETE_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="absolute top-1.5 right-1.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded transition">
                {copied ? '✓' : 'コピー'}
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} disabled={deleting}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl py-2.5 text-sm font-medium transition">
            キャンセル
          </button>
          <button onClick={handleDelete} disabled={input !== user.nickname || deleting}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-200 text-white rounded-xl py-2.5 text-sm font-semibold transition">
            {deleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- SQL ----
const POSTS_SQL = `-- Supabase SQL Editor で実行してください（全部まとめて実行OK）

-- ① postsテーブル（新規 or 既存どちらでもOK）
CREATE TABLE IF NOT EXISTS public.posts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_nickname   TEXT        NOT NULL,
  author_avatar_url TEXT,
  content           TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 既存テーブルに author_avatar_url がない場合は追加
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS author_avatar_url TEXT;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
-- 既存ポリシーを削除してから再作成（重複エラー回避）
DROP POLICY IF EXISTS "posts_allow_all" ON public.posts;
CREATE POLICY "posts_allow_all" ON public.posts FOR ALL USING (true) WITH CHECK (true);

-- ② post_likesテーブル
CREATE TABLE IF NOT EXISTS public.post_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_likes_allow_all" ON public.post_likes;
CREATE POLICY "post_likes_allow_all" ON public.post_likes FOR ALL USING (true) WITH CHECK (true);

-- ③ post_repliesテーブル
CREATE TABLE IF NOT EXISTS public.post_replies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_nickname TEXT        NOT NULL,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.post_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "post_replies_allow_all" ON public.post_replies;
CREATE POLICY "post_replies_allow_all" ON public.post_replies FOR ALL USING (true) WITH CHECK (true);

-- ④ usersテーブルにcover_urlカラムを追加
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- ⑤ coversストレージバケット
INSERT INTO storage.buckets (id, name, public)
VALUES ('covers', 'covers', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "covers_allow_all" ON storage.objects;
CREATE POLICY "covers_allow_all" ON storage.objects
FOR ALL USING (bucket_id = 'covers') WITH CHECK (bucket_id = 'covers');`

// ---- メイン ----
const inputCls = 'w-full mt-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition bg-white'

export default function ProfilePage() {
  const { user, updateProfile, updateAvatar, updateCover, clearAccountStorage } = useUser()
  const navigate = useNavigate()

  // プロフィール編集
  const [editOpen, setEditOpen]       = useState(false)
  const [bio, setBio]                 = useState(user?.bio || '')
  const [hobbies, setHobbies]         = useState(user?.hobbies || '')
  const [age, setAge]                 = useState(user?.age ?? '')
  const [gender, setGender]           = useState(user?.gender ?? '')
  const [prefecture, setPrefecture]   = useState(user?.prefecture ?? '')
  const [isPrivate, setIsPrivate]     = useState(user?.is_private ?? false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [saveError, setSaveError]     = useState('')

  // 投稿
  const [postInput, setPostInput]     = useState('')
  const [posting, setPosting]         = useState(false)
  const [postError, setPostError]     = useState('')
  const [posts, setPosts]             = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError]   = useState('')

  // フォロー数
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  // その他
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const loadPosts = useCallback(async () => {
    setPostsLoading(true)
    setPostsError('')
    // まず posts テーブルの存在を確認しながら取得
    const { data: raw, error: fetchErr } = await supabase
      .from('posts').select('*').eq('author_id', user.id)
      .order('created_at', { ascending: false }).limit(50)
    if (fetchErr) {
      console.error('[posts] fetch失敗:', fetchErr.code, fetchErr.message)
      setPostsError(fetchErr.message)
      setPostsLoading(false)
      return
    }
    if (!raw?.length) { setPosts([]); setPostsLoading(false); return }
    const ids = raw.map((p) => p.id)
    const [{ data: allLikes }, { data: myLikes }, { data: allReplies }] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', ids),
      supabase.from('post_likes').select('post_id').in('post_id', ids).eq('user_id', user.id),
      supabase.from('post_replies').select('post_id').in('post_id', ids),
    ])
    const lc = {}; (allLikes ?? []).forEach((l) => { lc[l.post_id] = (lc[l.post_id] ?? 0) + 1 })
    const liked = new Set((myLikes ?? []).map((l) => l.post_id))
    const rc = {}; (allReplies ?? []).forEach((r) => { rc[r.post_id] = (rc[r.post_id] ?? 0) + 1 })
    setPosts(raw.map((p) => ({ ...p, like_count: lc[p.id] ?? 0, liked: liked.has(p.id), reply_count: rc[p.id] ?? 0 })))
    setPostsLoading(false)
  }, [user.id])

  useEffect(() => { loadPosts() }, [loadPosts])

  useEffect(() => {
    Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
    ]).then(([followers, following]) => {
      setFollowersCount(followers.count ?? 0)
      setFollowingCount(following.count ?? 0)
    })
  }, [user.id])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (age !== '' && (Number(age) < 0 || Number(age) > 120)) return
    setSaving(true); setSaveError(''); setSaved(false)
    const { ok, error } = await updateProfile(bio.trim(), hobbies.trim(), age, gender, prefecture, isPrivate)
    setSaving(false)
    if (ok) { setSaved(true); setTimeout(() => { setSaved(false); setEditOpen(false) }, 1500) }
    else setSaveError(error ?? '保存に失敗しました')
  }

  const handlePost = async (e) => {
    e.preventDefault()
    const text = postInput.trim()
    if (!text || posting) return
    setPosting(true)
    setPostError('')

    // insert のみ実行（.select().single() は付けない — 0件返しで無音失敗するため）
    const { error } = await supabase.from('posts').insert({
      author_id: user.id,
      author_nickname: user.nickname,
      author_avatar_url: user.avatar_url ?? null,
      content: text,
    })

    if (error) {
      console.error('[posts] insert失敗:', error.code, error.message)
      setPostError(`${error.message}（code: ${error.code}）`)
      setPosting(false)
      return
    }

    // 成功 → 入力クリア後にタイムラインをDBから再取得
    setPostInput('')
    await loadPosts()
    setPosting(false)
  }

  const handleDeletePost = async (postId) => {
    await supabase.from('posts').delete().eq('id', postId)
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  const handleDeleted = () => {
    clearAccountStorage(user.id)
    navigate('/')
  }

  return (
    <div className="max-w-lg mx-auto w-full pb-8">

      {/* ── カバー写真 ── */}
      <CoverUpload user={user} onUploaded={updateCover} />

      {/* ── アバター + プロフィール情報 ── */}
      <div className="px-4">
        <div className="flex items-end justify-between -mt-10 mb-3">
          <AvatarUpload user={user} onUploaded={updateAvatar} />
          <button
            onClick={() => setEditOpen((v) => !v)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition ${
              editOpen
                ? 'border-gray-300 text-gray-500 hover:bg-gray-50'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {editOpen ? 'キャンセル' : 'プロフィールを編集'}
          </button>
        </div>

        {/* 名前 + 情報 */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">{user.nickname}</h1>
            {user.is_private && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">🔒 鍵</span>
            )}
          </div>
          {user.bio && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{user.bio}</p>}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {user.prefecture && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                📍 {user.prefecture}
              </span>
            )}
            {user.age && (
              <span className="text-xs text-gray-500">{user.age}歳</span>
            )}
          </div>
          <div className="flex gap-4 mt-3">
            <button onClick={() => navigate(`/follows/${user.id}/following`)}
              className="text-xs text-gray-500 hover:underline">
              <span className="font-bold text-gray-800">{followingCount}</span> フォロー中
            </button>
            <button onClick={() => navigate(`/follows/${user.id}/followers`)}
              className="text-xs text-gray-500 hover:underline">
              <span className="font-bold text-gray-800">{followersCount}</span> フォロワー
            </button>
          </div>
        </div>

        {/* ── プロフィール編集フォーム ── */}
        {editOpen && (
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 mb-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-2">プロフィールを編集</p>
            <div>
              <label className="text-xs font-medium text-gray-600">自己紹介</label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                placeholder="自己紹介を入力" maxLength={200} rows={3}
                className={`${inputCls} resize-none`} />
              <p className="text-xs text-gray-400 text-right">{bio.length}/200</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">趣味</label>
              <input type="text" value={hobbies} onChange={(e) => setHobbies(e.target.value)}
                placeholder="例: 読書・映画" maxLength={100} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">年齢</label>
                <input type="number" value={age}
                  onChange={(e) => setAge(e.target.value === '' ? '' : e.target.value)}
                  min={0} max={120} placeholder="例: 24" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">性別</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
                  <option value="">未設定</option>
                  {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">居住地</label>
              <select value={prefecture} onChange={(e) => setPrefecture(e.target.value)} className={inputCls}>
                <option value="">未設定</option>
                {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">🔒 鍵アカウント</p>
                <p className="text-xs text-gray-400 mt-0.5">ONにするとDMに申請が必要</p>
              </div>
              <button type="button" onClick={() => setIsPrivate((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${isPrivate ? 'bg-indigo-500' : 'bg-gray-200'}`}>
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {saveError && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">⚠ {saveError}</p>
            )}
            <button type="submit" disabled={saving}
              className={`w-full font-semibold rounded-xl py-2.5 text-sm transition ${
                saved ? 'bg-green-500 text-white' : 'bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white'
              }`}>
              {saving ? '保存中...' : saved ? '✓ 保存しました' : '保存する'}
            </button>
            <button type="button" onClick={() => setShowDeleteModal(true)}
              className="w-full text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-xl py-2 transition mt-1">
              アカウントを削除する
            </button>
          </form>
        )}

        {/* ── 投稿フォーム ── */}
        {!editOpen && (
          <form onSubmit={handlePost} className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 shadow-sm">
            <div className="flex gap-3">
              <div className="shrink-0">
                {user.avatar_url
                  ? <img src={user.avatar_url} className="w-9 h-9 rounded-full object-cover" />
                  : <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {user.nickname[0].toUpperCase()}
                    </div>
                }
              </div>
              <div className="flex-1">
                <textarea
                  value={postInput}
                  onChange={(e) => { setPostInput(e.target.value); setPostError('') }}
                  placeholder="いまどうしてる？"
                  maxLength={280}
                  rows={2}
                  className="w-full text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <span className={`text-xs ${postInput.length > 260 ? 'text-orange-500' : 'text-gray-400'}`}>
                    {postInput.length}/280
                  </span>
                  <button type="submit" disabled={!postInput.trim() || posting}
                    className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white font-semibold rounded-full px-5 py-1.5 text-sm transition">
                    {posting ? '投稿中...' : '投稿'}
                  </button>
                </div>
              </div>
            </div>
            {/* 投稿エラー */}
            {postError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-red-700">⚠ 投稿に失敗しました</p>
                <p className="text-xs text-red-500 font-mono break-all">{postError}</p>
                <p className="text-xs text-red-400">postsテーブルが存在しない場合は以下のSQLを実行してください：</p>
                <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">{POSTS_SQL}</pre>
                <button type="button" onClick={() => { setPostError(''); loadPosts() }}
                  className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition">
                  再試行
                </button>
              </div>
            )}
          </form>
        )}

        {/* ── 投稿タイムライン ── */}
        <div className="space-y-3">
          {postsLoading && (
            <p className="text-center text-gray-400 text-sm py-6">読み込み中...</p>
          )}
          {/* フェッチエラー */}
          {!postsLoading && postsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-red-700">⚠ 投稿の読み込みに失敗しました</p>
              <p className="text-xs text-red-500 font-mono break-all">{postsError}</p>
              <p className="text-xs text-red-400">Supabase SQL Editor で以下を実行してください：</p>
              <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">{POSTS_SQL}</pre>
              <button onClick={loadPosts}
                className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg transition">
                再試行
              </button>
            </div>
          )}
          {!postsLoading && !postsError && posts.length === 0 && (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">✍️</p>
              <p className="text-gray-500 text-sm">まだ投稿がありません</p>
            </div>
          )}
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDeletePost} />
          ))}
        </div>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal user={user} onClose={() => setShowDeleteModal(false)} onDeleted={handleDeleted} />
      )}
    </div>
  )
}

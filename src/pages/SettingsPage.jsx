import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useUser } from '../context/UserContext'

// ── SQL定数 ───────────────────────────────────────────────────

const SETUP_SQL = `-- Supabase SQL Editor で実行してください

-- ① ブロックテーブル
CREATE TABLE IF NOT EXISTS public.blocks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id       UUID        NOT NULL,
  blocked_id       UUID        NOT NULL,
  blocked_nickname TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocks_allow_all" ON public.blocks;
CREATE POLICY "blocks_allow_all" ON public.blocks
  FOR ALL USING (true) WITH CHECK (true);

-- ② 非表示テーブル
CREATE TABLE IF NOT EXISTS public.hidden_users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hider_id        UUID        NOT NULL,
  hidden_id       UUID        NOT NULL,
  hidden_nickname TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hider_id, hidden_id)
);
ALTER TABLE public.hidden_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hidden_users_allow_all" ON public.hidden_users;
CREATE POLICY "hidden_users_allow_all" ON public.hidden_users
  FOR ALL USING (true) WITH CHECK (true);

-- ③ お問い合わせテーブル
CREATE TABLE IF NOT EXISTS public.inquiries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID,
  nickname   TEXT,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inquiries_allow_all" ON public.inquiries;
CREATE POLICY "inquiries_allow_all" ON public.inquiries
  FOR ALL USING (true) WITH CHECK (true);`

const DELETE_SQL = `create policy "allow_delete_users" on public.users for delete using (true);
create policy "allow_delete_messages" on public.messages for delete using (true);
create policy "allow_delete_direct_messages" on public.direct_messages for delete using (true);`

// ── 法的コンテンツ ────────────────────────────────────────────

const TERMS_TEXT = `制定日：2026年6月28日


第1条（目的）

本規約は、本サービス（以下「当サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意した上でご利用ください。


第2条（利用資格）

・18歳以上の方のみご利用いただけます
・18歳未満の方は保護者の同意が必要です
・日本国内在住の方を対象としています


第3条（禁止事項）

以下の行為を禁止します。違反した場合はアカウントを削除することがあります。

・他のユーザーへの誹謗中傷・ハラスメント・脅迫
・わいせつ・暴力的・差別的なコンテンツの投稿
・個人情報（氏名・住所・電話番号等）の無断公開
・スパム・宣伝目的の投稿
・なりすまし行為
・違法薬物・危険物に関する情報の投稿
・未成年者への性的なアプローチ
・出会い目的での利用（当サービスは出会い系サービスではありません）
・著作権・肖像権等の知的財産権を侵害する行為
・当サービスのシステムへの不正アクセス・改ざん
・その他、法令または公序良俗に反する行為


第4条（コンテンツの権利）

・投稿コンテンツの著作権はユーザーに帰属します
・ユーザーは当サービスに対し、サービス改善・運営に必要な範囲でコンテンツを利用する権利を許諾するものとします
・違法または規約違反のコンテンツは運営が削除できるものとします


第5条（免責事項）

・当サービスはユーザー間のトラブルについて責任を負いません
・システム障害・データ損失による損害について責任を負いません
・当サービスは予告なく変更・停止・終了する場合があります
・ユーザーが投稿したコンテンツの正確性・安全性について保証しません


第6条（アカウントの管理）

・アカウントの管理はユーザー自身の責任で行ってください
・アカウントの譲渡・売買は禁止します
・長期間ログインのないアカウントは削除される場合があります


第7条（サービスの変更・終了）

・運営は予告なく本サービスの内容を変更できるものとします
・サービス終了の際はアプリ内にて通知します


第8条（規約の変更）

・本規約はサービス改善のため変更する場合があります
・変更後もサービスを利用された場合、変更後の規約に同意したものとみなします


第9条（準拠法・管轄裁判所）

・本規約は日本法に準拠します
・紛争が生じた場合は、運営者の所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします`

const PRIVACY_TEXT = `プライバシーポリシー

【収集する情報】
ニックネーム・投稿内容・プロフィール情報（任意）

【情報の利用目的】
サービス提供・改善のため

【第三者への提供】
法令に基づく場合を除き提供しません

【データの保管】
Supabase（米国）のサーバーに保管されます

【退会について】
退会するとデータは削除されます`

const COPYRIGHT_TEXT = `著作権情報

・投稿されたコンテンツの著作権は投稿者に帰属します。

・サービスのデザイン・コードの著作権は運営に帰属します。`

// ── 汎用UIコンポーネント ───────────────────────────────────────

function Section({ title, children }) {
  return (
    <section className="space-y-1.5">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1">{title}</p>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
        {children}
      </div>
    </section>
  )
}

function Row({ label, desc, right, onClick, danger }) {
  const base = 'w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition'
  const hover = onClick
    ? (danger ? 'hover:bg-red-50 active:bg-red-100 cursor-pointer' : 'hover:bg-gray-50/80 active:bg-gray-100 cursor-pointer')
    : ''
  return (
    <div className={`${base} ${hover}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-gray-800'}`}>{label}</p>
        {desc && <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!on) }}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${on ? 'bg-indigo-500' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

function Chevron() {
  return (
    <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function TableNotFoundBanner({ onShowSql }) {
  return (
    <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
      <span className="shrink-0 mt-0.5">⚠</span>
      <span>
        テーブルが未作成です。
        <button className="underline font-semibold ml-1" onClick={onShowSql}>
          セットアップSQLを確認する
        </button>
      </span>
    </div>
  )
}

// ── モーダル ─────────────────────────────────────────────────

function TextModal({ title, body, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition text-sm"
          >✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="text-sm text-gray-700 leading-loose whitespace-pre-wrap">{body}</p>
        </div>
      </div>
    </div>
  )
}

function SetupSQLModal({ onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-800">初期セットアップSQL</h2>
            <p className="text-xs text-gray-400 mt-0.5">Supabase SQL Editor で実行してください</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition text-sm">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="relative">
            <pre className="bg-gray-900 text-green-300 text-[10px] rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
              {SETUP_SQL}
            </pre>
            <button
              onClick={() => { navigator.clipboard.writeText(SETUP_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              className="absolute top-2.5 right-2.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2.5 py-1 rounded-lg transition font-mono"
            >
              {copied ? '✓ コピー済み' : 'コピー'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ icon, iconBg, title, desc, confirmLabel, confirmClass, onConfirm, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-3`}>
            <span className="text-2xl">{icon}</span>
          </div>
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          {desc && <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{desc}</p>}
        </div>
        {children}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl py-2.5 text-sm font-medium transition">
            キャンセル
          </button>
          <button onClick={onConfirm} className={`flex-1 ${confirmClass} text-white rounded-xl py-2.5 text-sm font-semibold transition`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 退会モーダル ──────────────────────────────────────────────

function DeleteAccountModal({ user, onClose, onDeleted }) {
  const [input, setInput]           = useState('')
  const [deleting, setDeleting]     = useState(false)
  const [error, setError]           = useState(null)
  const [rlsBlocked, setRlsBlocked] = useState(false)
  const [copied, setCopied]         = useState(false)

  const handleDelete = async () => {
    if (input !== user.nickname) return
    setDeleting(true); setError(null); setRlsBlocked(false)

    const { error: dmErr } = await supabase.from('direct_messages').delete()
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    if (dmErr) { setError(`DM削除エラー: ${dmErr.message}`); setDeleting(false); return }

    await supabase.from('messages').delete().eq('nickname', user.nickname)

    const { data: deletedUser, error: userErr } = await supabase
      .from('users').delete().eq('id', user.id).select('id')
    if (userErr) { setError(`アカウント削除エラー: ${userErr.message}`); setDeleting(false); return }
    if (!deletedUser?.length) { setRlsBlocked(true); setDeleting(false); return }

    await Promise.allSettled(
      ['jpg','jpeg','png','webp','gif'].map((ext) =>
        supabase.storage.from('avatars').remove([`${user.id}.${ext}`])
      )
    )
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
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={user.nickname}
            autoFocus
            className="w-full mt-1.5 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 transition"
          />
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</p>}
        {rlsBlocked && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2 text-left">
            <p className="text-xs font-semibold text-amber-800">⚠ Supabase の DELETE ポリシーが未設定です</p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-300 text-[10px] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">{DELETE_SQL}</pre>
              <button
                onClick={() => { navigator.clipboard.writeText(DELETE_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="absolute top-1.5 right-1.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded transition"
              >
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
          <button
            onClick={handleDelete}
            disabled={input !== user.nickname || deleting}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-200 text-white rounded-xl py-2.5 text-sm font-semibold transition"
          >
            {deleting ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── メインページ ─────────────────────────────────────────────

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, clearAccountStorage } = useUser()

  // プライバシーリスト
  const [blocks, setBlocks]         = useState([])
  const [hidden, setHidden]         = useState([])
  const [blocksLoading, setBlocksLoading] = useState(true)
  const [hiddenLoading, setHiddenLoading] = useState(true)
  const [blocksErr, setBlocksErr]   = useState('')
  const [hiddenErr, setHiddenErr]   = useState('')

  // 通知設定
  const [notifyOn, setNotifyOn]       = useState(() => localStorage.getItem('settings_notify') !== 'false')
  const [vibrationOn, setVibrationOn] = useState(() => localStorage.getItem('settings_vibration') !== 'false')

  // お問い合わせ
  const [inquiryText, setInquiryText]   = useState('')
  const [inquirySending, setInquirySending] = useState(false)
  const [inquirySent, setInquirySent]   = useState(false)
  const [inquiryErr, setInquiryErr]     = useState('')

  // モーダル管理
  const [modal, setModal] = useState(null)

  // ── データ取得 ───────────────────────────────────────────

  const fetchBlocks = useCallback(async () => {
    if (!user) return
    setBlocksLoading(true); setBlocksErr('')
    const { data, error } = await supabase
      .from('blocks')
      .select('id, blocked_id, blocked_nickname, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      setBlocksErr(error.code === '42P01' || error.message?.includes('relation') ? 'TABLE_NOT_FOUND' : error.message)
    } else {
      setBlocks(data ?? [])
    }
    setBlocksLoading(false)
  }, [user?.id])

  const fetchHidden = useCallback(async () => {
    if (!user) return
    setHiddenLoading(true); setHiddenErr('')
    const { data, error } = await supabase
      .from('hidden_users')
      .select('id, hidden_id, hidden_nickname, created_at')
      .eq('hider_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      setHiddenErr(error.code === '42P01' || error.message?.includes('relation') ? 'TABLE_NOT_FOUND' : error.message)
    } else {
      setHidden(data ?? [])
    }
    setHiddenLoading(false)
  }, [user?.id])

  useEffect(() => {
    fetchBlocks()
    fetchHidden()
  }, [fetchBlocks, fetchHidden])

  // ── 通知設定 ────────────────────────────────────────────

  const handleNotifyToggle = (on) => {
    setNotifyOn(on)
    localStorage.setItem('settings_notify', on ? 'true' : 'false')
  }

  const handleVibrationToggle = (on) => {
    setVibrationOn(on)
    localStorage.setItem('settings_vibration', on ? 'true' : 'false')
  }

  // ── 解除処理 ────────────────────────────────────────────

  const handleUnblock = async (id) => {
    const { error } = await supabase.from('blocks').delete().eq('id', id).eq('blocker_id', user.id)
    if (!error) setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const handleUnhide = async (id) => {
    const { error } = await supabase.from('hidden_users').delete().eq('id', id).eq('hider_id', user.id)
    if (!error) setHidden((prev) => prev.filter((h) => h.id !== id))
  }

  // ── お問い合わせ ─────────────────────────────────────────

  const handleInquiry = async (e) => {
    e.preventDefault()
    const text = inquiryText.trim()
    if (!text || inquirySending) return
    setInquirySending(true); setInquiryErr('')
    const { error } = await supabase.from('inquiries').insert({
      user_id: user.id,
      nickname: user.nickname,
      content: text,
    })
    if (error) {
      setInquiryErr(error.code === '42P01' || error.message?.includes('relation') ? 'TABLE_NOT_FOUND' : error.message)
      setInquirySending(false)
      return
    }
    setInquirySent(true)
    setInquiryText('')
    setInquirySending(false)
  }

  // ── キャッシュクリア ─────────────────────────────────────

  const handleClearCache = () => {
    localStorage.clear()
    navigate('/', { replace: true })
  }

  // ── 退会後 ──────────────────────────────────────────────

  const handleDeleted = () => {
    clearAccountStorage(user.id)
    navigate('/', { replace: true })
  }

  // ── ユーザー行コンポーネント ─────────────────────────────

  const UserListItem = ({ name, userId, onRelease, releaseLabel, releaseClass }) => (
    <div className="flex items-center justify-between gap-3 py-2.5 px-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs shrink-0">
          {(name || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-800 font-medium truncate">{name ?? userId?.slice(0, 12)}</p>
        </div>
      </div>
      <button
        onClick={onRelease}
        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition shrink-0 ${releaseClass}`}
      >
        {releaseLabel}
      </button>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto w-full px-4 pt-5 pb-10 space-y-6">

      {/* ─── プライバシー ─── */}
      <Section title="プライバシー">

        {/* 非表示リスト */}
        <div>
          <Row
            label="非表示リスト"
            desc={hiddenLoading ? '読み込み中...' : `${hidden.length}人を非表示中`}
          />
          {hiddenErr === 'TABLE_NOT_FOUND' ? (
            <TableNotFoundBanner onShowSql={() => setModal('sql')} />
          ) : hiddenErr ? (
            <p className="px-4 pb-3 text-xs text-red-400">エラー: {hiddenErr}</p>
          ) : !hiddenLoading && hidden.length === 0 ? (
            <p className="px-4 pb-3 text-xs text-gray-400">非表示にしているユーザーはいません</p>
          ) : (
            <div className="pb-1">
              {hidden.map((h) => (
                <UserListItem
                  key={h.id}
                  name={h.hidden_nickname}
                  userId={h.hidden_id}
                  onRelease={() => handleUnhide(h.id)}
                  releaseLabel="解除"
                  releaseClass="text-indigo-500 border-indigo-200 hover:border-indigo-400 hover:text-indigo-700"
                />
              ))}
            </div>
          )}
        </div>

        {/* ブロックリスト */}
        <div>
          <Row
            label="ブロックリスト"
            desc={blocksLoading ? '読み込み中...' : `${blocks.length}人をブロック中`}
          />
          {blocksErr === 'TABLE_NOT_FOUND' ? (
            <TableNotFoundBanner onShowSql={() => setModal('sql')} />
          ) : blocksErr ? (
            <p className="px-4 pb-3 text-xs text-red-400">エラー: {blocksErr}</p>
          ) : !blocksLoading && blocks.length === 0 ? (
            <p className="px-4 pb-3 text-xs text-gray-400">ブロックしているユーザーはいません</p>
          ) : (
            <div className="pb-1">
              {blocks.map((b) => (
                <UserListItem
                  key={b.id}
                  name={b.blocked_nickname}
                  userId={b.blocked_id}
                  onRelease={() => handleUnblock(b.id)}
                  releaseLabel="ブロック解除"
                  releaseClass="text-red-500 border-red-200 hover:border-red-400 hover:text-red-700"
                />
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ─── 通知・サウンド ─── */}
      <Section title="通知・サウンド">
        <Row
          label="通知"
          desc="DMやマッチングの通知を受け取る"
          right={<Toggle on={notifyOn} onChange={handleNotifyToggle} />}
        />
        <Row
          label="バイブレーション"
          desc="通知時にバイブレーションを使用する"
          right={<Toggle on={vibrationOn} onChange={handleVibrationToggle} />}
        />
      </Section>

      {/* ─── サポート ─── */}
      <Section title="サポート">
        <div className="px-4 py-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">お問い合わせ</p>
          <p className="text-xs text-gray-500">ご意見・バグ報告・機能ご要望などをお送りください。</p>

          {inquirySent ? (
            <div className="rounded-2xl bg-green-50 border border-green-100 px-4 py-5 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-bold text-green-700">送信しました</p>
              <p className="text-xs text-green-500 mt-0.5">お問い合わせありがとうございます</p>
              <button
                onClick={() => setInquirySent(false)}
                className="mt-3 text-xs text-green-600 underline hover:text-green-800"
              >
                続けて送信する
              </button>
            </div>
          ) : (
            <form onSubmit={handleInquiry} className="space-y-3">
              <textarea
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
                placeholder="内容を入力してください"
                rows={5}
                maxLength={1000}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none transition"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{inquiryText.length}/1000</span>
                <button
                  type="submit"
                  disabled={!inquiryText.trim() || inquirySending}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-200 text-white rounded-xl px-5 py-2 text-sm font-semibold transition"
                >
                  {inquirySending ? '送信中...' : '送信する'}
                </button>
              </div>
              {inquiryErr === 'TABLE_NOT_FOUND' ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex items-start gap-1.5">
                  <span className="shrink-0">⚠</span>
                  <span>inquiriesテーブルが未作成です。<button className="underline font-semibold" onClick={() => setModal('sql')}>SQLを確認</button></span>
                </div>
              ) : inquiryErr ? (
                <p className="text-xs text-red-500">⚠ {inquiryErr}</p>
              ) : null}
            </form>
          )}
        </div>
      </Section>

      {/* ─── アプリについて ─── */}
      <Section title="アプリについて">
        <Row label="利用規約"           right={<Chevron />} onClick={() => setModal('terms')} />
        <Row label="プライバシーポリシー" right={<Chevron />} onClick={() => setModal('privacy')} />
        <Row label="著作権情報"          right={<Chevron />} onClick={() => setModal('copyright')} />
        <Row
          label="バージョン"
          right={<span className="text-sm text-gray-400 font-mono">1.0.0</span>}
        />
      </Section>

      {/* ─── その他 ─── */}
      <Section title="その他">
        <Row
          label="キャッシュクリア"
          desc="ローカルデータをすべて削除してログアウトします"
          right={<Chevron />}
          onClick={() => setModal('clear')}
        />
        <Row
          label="退会"
          desc="アカウントとすべてのデータを削除します"
          danger
          right={<Chevron />}
          onClick={() => setModal('delete')}
        />
      </Section>

      {/* ─── モーダル ─── */}

      {modal === 'terms'     && <TextModal title="利用規約"           body={TERMS_TEXT}     onClose={() => setModal(null)} />}
      {modal === 'privacy'   && <TextModal title="プライバシーポリシー" body={PRIVACY_TEXT}    onClose={() => setModal(null)} />}
      {modal === 'copyright' && <TextModal title="著作権情報"          body={COPYRIGHT_TEXT} onClose={() => setModal(null)} />}
      {modal === 'sql'       && <SetupSQLModal onClose={() => setModal(null)} />}

      {modal === 'clear' && (
        <ConfirmModal
          icon="🗂"
          iconBg="bg-orange-100"
          title="キャッシュをクリアしますか？"
          desc="ローカルに保存されたデータがすべて削除され、ログアウトされます。サーバーのデータは削除されません。"
          confirmLabel="クリアする"
          confirmClass="bg-orange-500 hover:bg-orange-600"
          onConfirm={handleClearCache}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'delete' && (
        <DeleteAccountModal
          user={user}
          onClose={() => setModal(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}

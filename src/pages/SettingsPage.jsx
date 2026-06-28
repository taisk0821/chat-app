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

const TERMS_TEXT = `本利用規約（以下「本規約」）は、本サービスの利用に関する条件を定めるものです。ご利用前に必ずお読みください。


第1条（適用）

1. 本規約は、本サービスの利用に関する運営者と登録ユーザーとの間の権利義務関係を定めることを目的とし、登録ユーザーと運営者の間の本サービスの利用に関わる一切の関係に適用されます。
2. 運営者が本サービス上で掲載するルール・諸規定等は本規約の一部を構成するものとします。


第2条（定義）

本規約において使用する以下の用語は各々以下に定める意味を有します。
(1)「知的財産権」とは、著作権、特許権、実用新案権、商標権、意匠権その他の知的財産権を意味します。
(2)「登録ユーザー」とは、第3条に基づき本サービスの利用者としての登録がなされた個人を意味します。
(3)「投稿コンテンツ」とは、登録ユーザーが本サービスに投稿、送信、アップロードしたコンテンツを意味します。


第3条（登録）

本サービスの利用を希望する者は、本規約を遵守することに同意し、当社の定める方法で登録情報を提供することにより、登録ユーザーとしての登録が完了します。


第4条（本サービスの利用）

登録ユーザーは、利用契約の有効期間中、本規約に従って本サービスを利用することができます。


第5条（禁止行為）

1. 登録ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
   (1) 当社または他のユーザーの知的財産権、肖像権、プライバシーの権利、名誉その他の権利または利益を侵害する行為
   (2) 犯罪行為に関連する行為または公序良俗に反する行為
   (3) わいせつな記述・画像の掲載、未成年者への卑猥な表現を伴う記述
   (4) 営利目的の勧誘・営業行為・スパム行為
   (5) 他のユーザーへの誹謗中傷・ハラスメント・脅迫
   (6) 特定の個人を特定できる情報の無断公開
   (7) なりすまし行為
   (8) 出会い・性的目的での利用（本サービスは出会い系サービスではありません）
   (9) 未成年者へのわいせつなアプローチ
   (10) 違法薬物・危険物に関する情報の共有
   (11) コンピューターウィルスその他有害なプログラムの送信
   (12) 当社による本サービスの運営を妨害するおそれのある行為
   (13) 18歳未満の方の保護者の同意なき利用
   (14) その他、当社が不適切と判断する行為

2. 当社は、登録ユーザーによる情報の送信行為が前項各号のいずれかに該当すると判断した場合には、事前に通知することなく、当該情報の全部または一部を削除できるものとします。


第6条（本サービスの停止等）

1. 当社は、以下のいずれかに該当する場合には、登録ユーザーに事前に通知することなく、本サービスの全部または一部を停止または中断できます。
   (1) システムの点検または保守作業を行う場合
   (2) 通信回線等が事故により停止した場合
   (3) 火災・停電・天災地変などの不可抗力により運営ができなくなった場合
   (4) その他、当社が停止または中断を必要と判断した場合

2. 当社は、当社の都合により、本サービスの提供を終了することができます。この場合、事前に通知するものとします。


第7条（設備の負担等）

1. 本サービスの利用に必要なコンピューター・通信環境等の準備及び維持は、登録ユーザーの費用と責任において行うものとします。
2. 登録ユーザーは自己の利用環境に応じて、ウィルス感染防止・不正アクセス及び情報漏洩の防止等のセキュリティ対策を自らの費用と責任において講じるものとします。


第8条（権利帰属）

1. 当社ウェブサービス及び本サービスに関する所有権及び知的財産権は全て当社または当社にライセンスを許諾している者に帰属します。
2. 登録ユーザーが投稿その他送信を行った文章・画像その他のデータについては、当社においてサービス改善・運営のために利用することができるものとします。


第9条（登録取消等）

1. 当社は、登録ユーザーが以下のいずれかに該当する場合には、事前に通知することなく、利用を一時停止または登録を取り消すことができます。
   (1) 本規約のいずれかの条項に違反した場合
   (2) 登録情報に虚偽の事実があることが判明した場合
   (3) 24ヶ月以上本サービスの利用がない場合
   (4) その他、当社が登録の継続を適当でないと判断した場合

2. 当社は、本条に基づき当社が行った行為により登録ユーザーに生じた損害について一切の責任を負いません。


第10条（保証の否認及び免責）

1. 当社は、本サービスにつき如何なる保証も行いません。本サービスは現状有姿で提供されるものとします。
2. 本サービスに関連して登録ユーザーと他の登録ユーザーまたは第三者との間において生じた取引・連絡・紛争等については、登録ユーザーの責任において処理及び解決するものとし、当社は一切責任を負いません。
3. 当社は、本サービスの提供の中断・停止・終了・利用不能・変更、登録ユーザーのメッセージまたは情報の削除または消失、登録ユーザーの登録の取消、本サービスの利用によるデータの消失または機器の故障もしくは損傷、その他本サービスに関連して登録ユーザーが被った損害につき、賠償する責任を一切負わないものとします。
4. 当社は、本サービスに関連して登録ユーザーが被った損害について、一切賠償の責任を負いません。


第11条（ユーザーの賠償等の責任）

登録ユーザーは、本規約に違反することにより、または本サービスの利用に関連して当社に損害を与えた場合、当社に対してその損害を賠償しなければなりません。


第12条（有効期間）

利用契約は、本サービスの提供期間中、登録が完了した日から当該登録ユーザーの登録が取り消された日まで有効に存続します。


第13条（本規約等の変更）

1. 当社は、本サービスの内容を自由に変更できるものとします。
2. 当社は、本規約を変更した場合には、登録ユーザーに当該変更内容を通知するものとし、通知後に本サービスを利用した場合は、変更後の規約に同意したものとみなします。


第14条（連絡/通知）

本サービスに関する問い合わせその他登録ユーザーから当社に対する連絡または通知、及び本規約の変更に関する通知その他当社から登録ユーザーに対する連絡または通知は、当社の定める方法で行うものとします。


第15条（本規約の譲渡等）

1. 登録ユーザーは、当社の書面による事前の承諾なく、利用契約上の地位または本規約に基づく権利もしくは義務につき、第三者に対し、譲渡、移転、担保設定、その他の処分をすることはできません。
2. 当社は本サービスにかかる事業を他社に譲渡した場合には、当該事業譲渡に伴い利用契約上の地位、本規約に基づく権利及び義務並びに登録ユーザーの登録情報その他の顧客情報を当該事業譲渡の譲受人に譲渡することができるものとします。


第16条（分離可能性）

本規約のいずれかの条項またはその一部が無効または執行不能と判断された場合であっても、本規約の残りの規定及び一部が無効または執行不能と判断された規定の残りの部分は、継続して完全に効力を有するものとします。


第17条（準拠法及び管轄裁判所）

本規約の準拠法は日本法とし、本規約に起因しまたは関連する一切の紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。


第18条（協議解決）

当社及び登録ユーザーは、本規約に定めのない事項または本規約の解釈に疑義が生じた場合には、互いに信義誠実の原則に従って協議の上速やかに解決を図るものとします。


制定日：2026年6月28日`

const PRIVACY_TEXT = `本サービスの運営者（以下「当社」）は、本サービスにおける利用者情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定め、公表しております。


1. 取得する利用者情報と取得目的

▸ ユーザーID（自動生成）
  サービス本来の機能の提供・不具合調査・利用状況解析・不正利用の防止

▸ ニックネーム・性別・居住地・年齢・画像・その他入力情報
  サービス本来の機能の提供・不具合調査・利用状況解析・不正利用の防止

▸ 投稿・メッセージ内容
  サービスの提供・運営・不正利用の防止・サービス改善

▸ IPアドレス
  サービスの不正利用の防止・おおよその位置の推定

▸ クラッシュログ
  問題の診断・サービスの改善

▸ パフォーマンスデータ（起動時間等）
  ユーザー行動の評価・サービス改善・新機能のプランニング


2. 送信先

本サービスの運営者


3. 外部送信・第三者提供

利用者情報（個人情報を含む）を以下の場合を除き第三者に開示することはございません。

(1) 情報提供について本人の同意がある場合
(2) 裁判所から開示を命じる判決もしくは命令を受けた場合
(3) 警察などの公的機関から捜査権限を定める法律に基づき正式な照会を受けた場合
(4) 人の生命・身体及び財産などに対する差し迫った危険があり、緊急の必要性がある場合であって、本人の同意を得ることが困難な場合
(5) チャット機能を用いて個人情報が送信された場合


4. データの保管について

収集したデータはSupabase（米国）のサーバーに保管されます。
退会するとデータは削除されます。


5. データの安全管理

当社は、取得した利用者情報の漏洩・滅失・毀損の防止のため、適切なセキュリティ対策を実施します。ただし、インターネット上の通信は完全な安全性を保証するものではありません。


6. ユーザーの権利

登録ユーザーは以下の権利を有します。
・自己の情報の開示請求
・自己の情報の訂正・追加・削除の請求
・アカウント削除によるデータ消去


7. 未成年者の利用について

本サービスは18歳以上を対象としています。18歳未満の方が利用する場合は保護者の同意が必要です。当社は故意に18歳未満の個人情報を収集することはありません。


8. お問い合わせ窓口

本ポリシーに関するお問い合わせは、アプリ内の「お問い合わせ」よりご連絡ください。


9. プライバシーポリシーの変更手続

当社は、利用者情報の取扱いに関する運用状況を適宜見直し、継続的な改善に努めるものとし、必要に応じて本ポリシーを変更することがあります。変更した場合にはアプリ内にて通知します。


制定日：2026年6月28日`

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

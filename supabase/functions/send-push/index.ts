import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore — Deno npm: 互換で読み込む
import webpush from 'npm:web-push@3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // CORS プリフライト
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { receiver_id, sender_name, sender_id, content } = await req.json()

    if (!receiver_id || !sender_name || !sender_id || !content) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'missing_params' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const vapidEmail = Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@example.com'

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'vapid_not_configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 受信者のプッシュサブスクリプションを取得
    const { data: sub, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', receiver_id)
      .maybeSingle()

    if (subErr || !sub) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'no_subscription' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // VAPID 設定
    webpush.setVapidDetails(
      vapidEmail.startsWith('mailto:') ? vapidEmail : `mailto:${vapidEmail}`,
      vapidPublicKey,
      vapidPrivateKey,
    )

    const payload = JSON.stringify({
      title: `${sender_name} からDM`,
      body: content.length > 60 ? content.slice(0, 60) + '...' : content,
      url: `/dm/${sender_id}`,
      tag: `dm-${sender_id}`,
    })

    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
    )

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    // 410 Gone = サブスクリプション無効（ブラウザで通知をオフにした場合）
    if (err?.statusCode === 410) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'subscription_expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.error('[send-push] error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

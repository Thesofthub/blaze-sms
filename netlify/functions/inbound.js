// netlify/functions/inbound.js
// POST /webhook/inbound — receives inbound SMS from Telnyx, triggers auto-replies

import { getSupabase, telnyxRequest, json } from './_shared.js';

export async function handler(event) {
  // Always return 200 immediately — Telnyx will retry if it doesn't get one
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { event_type, payload } = body?.data || {};

    if (event_type !== 'message.received') {
      return { statusCode: 200, body: 'OK' };
    }

    const fromPhone = payload?.from?.phone_number;
    const toPhone   = payload?.to?.[0]?.phone_number;
    const text      = (payload?.text || '').trim();

    if (!fromPhone || !text) return { statusCode: 200, body: 'OK' };

    const db = getSupabase();

    // Look up contact name
    const { data: contact } = await db
      .from('contacts')
      .select('name')
      .eq('phone', fromPhone)
      .maybeSingle();

    // Save inbound message
    await db.from('messages').insert({
      telnyx_id:  payload.id,
      direction:  'inbound',
      from_phone: fromPhone,
      from_name:  contact?.name || fromPhone,
      to_phone:   toPhone,
      to_name:    'You',
      text,
      status:     'received',
      auto:       false,
    });

    // Check for matching auto-reply rule (case-insensitive exact match)
    const keyword = text.toUpperCase();
    const { data: rule } = await db
      .from('auto_replies')
      .select('*')
      .eq('trigger', keyword)
      .eq('active', true)
      .maybeSingle();

    if (rule) {
      // Send auto-reply via Telnyx
      await telnyxRequest('POST', '/messages', {
        from: toPhone,
        to:   fromPhone,
        text: rule.response,
      });

      // Save auto-reply as outbound message
      await db.from('messages').insert({
        telnyx_id:  `auto-${Date.now()}`,
        direction:  'outbound',
        from_phone: toPhone,
        from_name:  'You (auto)',
        to_phone:   fromPhone,
        to_name:    contact?.name || fromPhone,
        text:       rule.response,
        status:     'sent',
        auto:       true,
      });

      console.log(`Auto-replied to ${fromPhone} — trigger: "${rule.trigger}"`);
    }
  } catch (err) {
    console.error('Webhook error:', err);
    // Still return 200 so Telnyx doesn't keep retrying
  }

  return { statusCode: 200, body: 'OK' };
}

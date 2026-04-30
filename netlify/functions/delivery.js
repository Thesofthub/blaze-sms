// netlify/functions/delivery.js
// POST /webhook/delivery — Telnyx delivery receipt webhook
// Updates message status in Supabase when carrier confirms delivery

import { getSupabase } from './_shared.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { event_type, payload } = body?.data || {};

    if (event_type !== 'message.finalized') {
      return { statusCode: 200, body: 'OK' };
    }

    const telnyxId = payload?.id;
    const status   = payload?.to?.[0]?.status;

    if (telnyxId && status) {
      const db = getSupabase();
      await db
        .from('messages')
        .update({ status })
        .eq('telnyx_id', telnyxId);
      console.log(`Delivery update: ${telnyxId} → ${status}`);
    }
  } catch (err) {
    console.error('Delivery webhook error:', err);
  }

  return { statusCode: 200, body: 'OK' };
}

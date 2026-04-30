// netlify/functions/messages.js
// GET  /api/messages        — list messages (optional ?contact=phone)
// POST /api/messages/send   — send SMS via Telnyx

import { getSupabase, telnyxRequest, json, cors } from './_shared.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors();

  const db = getSupabase();
  const path = event.path.replace(/^\/.netlify\/functions/, '').replace('/api', '');

  // ── POST /messages/send ───────────────────────────────────────────────────
  if (event.httpMethod === 'POST' && path.includes('/send')) {
    try {
      const { to, text } = JSON.parse(event.body || '{}');
      if (!to || !text) return json(400, { error: 'to and text are required' });

      const from = process.env.TELNYX_PHONE_NUMBER;
      const data = await telnyxRequest('POST', '/messages', { from, to, text });

      // Look up contact name
      const { data: contact } = await db
        .from('contacts')
        .select('name')
        .eq('phone', to)
        .maybeSingle();

      const msg = {
        telnyx_id:  data.data.id,
        direction:  'outbound',
        from_phone: from,
        from_name:  'You',
        to_phone:   to,
        to_name:    contact?.name || to,
        text,
        status:     data.data.to?.[0]?.status || 'queued',
        auto:       false,
      };

      const { data: saved } = await db.from('messages').insert(msg).select().single();
      return json(200, { success: true, message: saved });
    } catch (err) {
      console.error('Send error:', err);
      return json(err.status || 500, { error: err.error || 'Failed to send' });
    }
  }

  // ── GET /messages ──────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const contact = event.queryStringParameters?.contact;
    let query = db.from('messages').select('*').order('created_at', { ascending: false }).limit(200);
    if (contact) {
      query = query.or(`from_phone.eq.${contact},to_phone.eq.${contact}`);
    }
    const { data, error } = await query;
    if (error) return json(500, { error: error.message });
    return json(200, { messages: data || [] });
  }

  return json(405, { error: 'Method not allowed' });
}

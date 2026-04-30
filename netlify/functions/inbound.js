import { getSupabase, telnyxRequest, json } from './_shared.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('Webhook received:', JSON.stringify(body?.data?.event_type));
    
    const { event_type, payload } = body?.data || {};

    if (event_type !== 'message.received') {
      console.log('Ignoring event type:', event_type);
      return { statusCode: 200, body: 'OK' };
    }

    const fromPhone = payload?.from?.phone_number;
    const toPhone   = payload?.to?.[0]?.phone_number;
    const text      = (payload?.text || '').trim();

    console.log(`Inbound SMS from ${fromPhone} to ${toPhone}: "${text}"`);

    if (!fromPhone || !text) {
      console.log('Missing fromPhone or text, skipping');
      return { statusCode: 200, body: 'OK' };
    }

    const db = getSupabase();

    // Test Supabase connection
    const { data: testData, error: testError } = await db
      .from('messages')
      .select('count')
      .limit(1);
    
    console.log('Supabase connection test:', testError ? 'FAILED: ' + testError.message : 'OK');

    const { data: contact } = await db
      .from('contacts')
      .select('name')
      .eq('phone', fromPhone)
      .maybeSingle();

    const insertPayload = {
      telnyx_id:  payload.id,
      direction:  'inbound',
      from_phone: fromPhone,
      from_name:  contact?.name || fromPhone,
      to_phone:   toPhone,
      to_name:    'You',
      text,
      status:     'received',
      auto:       false,
    };

    console.log('Inserting message:', JSON.stringify(insertPayload));

    const { data, error } = await db
      .from('messages')
      .insert(insertPayload)
      .select();

    if (error) {
      console.error('Insert error:', JSON.stringify(error));
    } else {
      console.log('Message saved successfully:', JSON.stringify(data));
    }

    // Check for auto-reply
    const keyword = text.toUpperCase();
    const { data: rule } = await db
      .from('auto_replies')
      .select('*')
      .eq('trigger', keyword)
      .eq('active', true)
      .maybeSingle();

    if (rule) {
      await telnyxRequest('POST', '/messages', {
        from: toPhone,
        to:   fromPhone,
        text: rule.response,
      });
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
      console.log(`Auto-replied with trigger: "${rule.trigger}"`);
    }

  } catch (err) {
    console.error('Webhook error:', JSON.stringify(err));
  }

  return { statusCode: 200, body: 'OK' };
}

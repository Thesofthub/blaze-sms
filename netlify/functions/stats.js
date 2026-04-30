// netlify/functions/stats.js
// GET /api/stats — dashboard counters

import { getSupabase, json, cors } from './_shared.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors();

  const db = getSupabase();

  const [
    { count: sent },
    { count: received },
    { count: autoSent },
    { count: contacts },
  ] = await Promise.all([
    db.from('messages').select('*', { count: 'exact', head: true }).eq('direction', 'outbound').eq('auto', false),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('direction', 'inbound'),
    db.from('messages').select('*', { count: 'exact', head: true }).eq('auto', true),
    db.from('contacts').select('*', { count: 'exact', head: true }),
  ]);

  return json(200, {
    sent:      sent      || 0,
    received:  received  || 0,
    autoSent:  autoSent  || 0,
    contacts:  contacts  || 0,
  });
}

// netlify/functions/autoreplies.js
// GET    /api/autoreplies       — list rules
// POST   /api/autoreplies       — create rule
// PUT    /api/autoreplies/:id   — update rule (toggle active, edit)
// DELETE /api/autoreplies/:id   — delete rule

import { getSupabase, json, cors } from './_shared.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors();

  const db = getSupabase();

  const pathParts = event.path.split('/');
  const id = pathParts[pathParts.length - 1];
  const hasId = id && id !== 'autoreplies';

  // ── GET ────────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const { data, error } = await db
      .from('auto_replies')
      .select('*')
      .order('created_at');
    if (error) return json(500, { error: error.message });
    return json(200, { rules: data || [] });
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    const { trigger, response } = JSON.parse(event.body || '{}');
    if (!trigger || !response) return json(400, { error: 'trigger and response required' });
    const { data, error } = await db
      .from('auto_replies')
      .insert({ trigger: trigger.toUpperCase(), response, active: true })
      .select()
      .single();
    if (error) return json(500, { error: error.message });
    return json(200, { success: true, rule: data });
  }

  // ── PUT ────────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'PUT' && hasId) {
    const body = JSON.parse(event.body || '{}');
    if (body.trigger) body.trigger = body.trigger.toUpperCase();
    const { data, error } = await db
      .from('auto_replies')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    if (error) return json(500, { error: error.message });
    return json(200, { success: true, rule: data });
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (event.httpMethod === 'DELETE' && hasId) {
    const { error } = await db.from('auto_replies').delete().eq('id', id);
    if (error) return json(500, { error: error.message });
    return json(200, { success: true });
  }

  return json(405, { error: 'Method not allowed' });
}

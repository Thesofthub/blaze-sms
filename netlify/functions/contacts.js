// netlify/functions/contacts.js
// GET    /api/contacts       — list all contacts
// POST   /api/contacts       — create contact
// PUT    /api/contacts/:id   — update contact
// DELETE /api/contacts/:id   — delete contact

import { getSupabase, json, cors } from './_shared.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return cors();

  const db = getSupabase();

  // Extract ID from path e.g. /api/contacts/123
  const pathParts = event.path.split('/');
  const id = pathParts[pathParts.length - 1];
  const hasId = id && id !== 'contacts';

  // ── GET /contacts ──────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const { data, error } = await db
      .from('contacts')
      .select('*')
      .order('name');
    if (error) return json(500, { error: error.message });
    return json(200, { contacts: data || [] });
  }

  // ── POST /contacts ─────────────────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    const { name, phone, tags } = JSON.parse(event.body || '{}');
    if (!name || !phone) return json(400, { error: 'name and phone required' });

    // Normalise phone to E.164
    const normPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;

    const { data, error } = await db
      .from('contacts')
      .insert({ name, phone: normPhone, tags: tags || [] })
      .select()
      .single();
    if (error) return json(500, { error: error.message });
    return json(200, { success: true, contact: data });
  }

  // ── PUT /contacts/:id ──────────────────────────────────────────────────────
  if (event.httpMethod === 'PUT' && hasId) {
    const body = JSON.parse(event.body || '{}');
    const { data, error } = await db
      .from('contacts')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    if (error) return json(500, { error: error.message });
    return json(200, { success: true, contact: data });
  }

  // ── DELETE /contacts/:id ───────────────────────────────────────────────────
  if (event.httpMethod === 'DELETE' && hasId) {
    const { error } = await db.from('contacts').delete().eq('id', id);
    if (error) return json(500, { error: error.message });
    return json(200, { success: true });
  }

  return json(405, { error: 'Method not allowed' });
}

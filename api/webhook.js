// ─────────────────────────────────────────────────────────────────────────────
// api/webhook.js — Recibe datos de Power Automate y los guarda en Vercel KV.
// POST /api/webhook
// Header: x-webhook-secret: <tu secreto>
// Body:   { "rows": [ {...}, {...} ] }
// Usa Upstash KV REST API (array command format)
// ─────────────────────────────────────────────────────────────────────────────

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', key, JSON.stringify(value)]),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`KV SET failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  console.log(`[webhook] KV SET result: ${JSON.stringify(json)}`);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validar secreto
  const secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    console.error('[webhook] Unauthorized – wrong or missing x-webhook-secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validar env vars del KV
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error('[webhook] KV env vars not set');
    return res.status(500).json({ error: 'KV not configured. Create a Vercel KV store in the Storage tab.' });
  }

  const { rows } = req.body || {};
  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Payload inválido. Se esperaba: { "rows": [...] }' });
  }
  if (rows.length === 0) {
    return res.status(400).json({ error: 'El array de filas está vacío.' });
  }

  const payload = {
    rows,
    updatedAt: new Date().toISOString(),
    count: rows.length,
  };

  await kvSet('gemini_data', payload);
  console.log(`[webhook] ${rows.length} filas guardadas en KV — ${payload.updatedAt}`);

  return res.status(200).json({
    ok: true,
    message: `${rows.length} usuarios guardados.`,
    updatedAt: payload.updatedAt,
  });
};

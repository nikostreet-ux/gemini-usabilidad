// ─────────────────────────────────────────────────────────────────────────────
// api/data.js — Sirve los datos al dashboard HTML.
// GET /api/data → { rows, updatedAt, count }
// Usa Upstash KV REST API (array command format)
// ─────────────────────────────────────────────────────────────────────────────

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['GET', key]),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`KV GET failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  console.log(`[data] KV raw result type: ${typeof json.result}, value preview: ${String(json.result).slice(0, 100)}`);
  const { result } = json;
  if (!result) return null;
  if (typeof result === 'object') return result;
  return JSON.parse(result);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS para que el HTML pueda leerlo desde cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(200).json({
      rows: [],
      updatedAt: null,
      count: 0,
      message: 'KV store no configurado. Ve a Vercel → Storage → Create KV y luego haz Redeploy.',
    });
  }

  try {
    const data = await kvGet('gemini_data');
    console.log(`[data] kvGet returned: ${data ? `object with ${data.rows?.length} rows` : 'null'}`);

    if (!data || !data.rows || data.rows.length === 0) {
      return res.status(200).json({
        rows: [],
        updatedAt: null,
        count: 0,
        message: 'Sin datos aún. Ejecuta el flujo de Power Automate para cargar el Excel.',
      });
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (err) {
    console.error('[data] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

import { createHash } from 'node:crypto';

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...extra }
});
const plain = property => (property?.rich_text || []).map(part => part.plain_text ?? part.text?.content ?? '').join('');

// No token, contact information, guest list, or upstream error is ever logged or returned.
export function createHandler({ env = process.env, fetcher = fetch, now = () => new Date() } = {}) {
  return async request => {
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'Please respond from your invitation page.' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json(415, { error: 'JSON required.' });
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 1024) return json(413, { error: 'Request too large.' });
      body = JSON.parse(raw);
    } catch { return json(400, { error: 'Invalid request.' }); }
    if (!body || !['view', 'acknowledge'].includes(body.action) || typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) {
      return json(400, { error: 'Please use the personal link from your text invitation.' });
    }
    if (env.INVITATIONS_ENABLED !== 'true' || !env.NOTION_API_KEY || !env.NOTION_HOUSEHOLDS_DATA_SOURCE_ID) {
      return json(503, { error: 'Responses aren’t open yet. Please try again later.' });
    }
    const hash = createHash('sha256').update(body.token).digest('hex');
    async function notion(path, payload, method = 'POST') {
      const response = await fetcher('https://api.notion.com/v1/' + path, {
        method, signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${env.NOTION_API_KEY}`, 'Notion-Version': '2025-09-03', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Notion unavailable');
      return response.json();
    }
    try {
      const result = await notion(`data_sources/${env.NOTION_HOUSEHOLDS_DATA_SOURCE_ID}/query`, {
        page_size: 2,
        filter: { and: [
          { property: 'Invitation token hash', rich_text: { equals: hash } },
          { property: 'Household status', select: { equals: 'Active' } }
        ] }
      });
      if (result.has_more || result.results?.length !== 1) return json(404, { error: 'This invitation link is no longer available. Please text Paul or Audrey.' });
      const household = result.results[0];
      const p = household.properties;
      if (household.archived || household.in_trash || p['Household status']?.select?.name !== 'Active' || p.Decision?.select?.name === 'Do not invite' || plain(p['Invitation token hash']) !== hash) {
        return json(404, { error: 'This invitation link is no longer available. Please text Paul or Audrey.' });
      }
      let acknowledged = p['Date saved']?.checkbox === true;
      if (body.action === 'acknowledge' && !acknowledged) {
        await notion(`pages/${household.id}`, { properties: {
          'Date saved': { checkbox: true }, 'Date saved on': { date: { start: now().toISOString() } }
        } }, 'PATCH');
        acknowledged = true;
      }
      return json(200, { greeting: plain(p.Greeting), personalNote: plain(p['Personal note']), acknowledged });
    } catch {
      return json(503, { error: 'We couldn’t save your response right now. Please try again, or text Paul or Audrey.' });
    }
  };
}
export default createHandler();
export const config = { path: '/api/invitation', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };

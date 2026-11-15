import { createHash, randomBytes } from 'node:crypto';
// Explicitly target one reviewed household. Writes the link to Notion, never stdout.
const [pageId, base] = process.argv.slice(2);
const expectedSource = process.env.NOTION_HOUSEHOLDS_DATA_SOURCE_ID;
if (!expectedSource) throw new Error('Set NOTION_HOUSEHOLDS_DATA_SOURCE_ID before preparing an invitation.');
if (!/^[a-f0-9-]{32,36}$/i.test(pageId || '') || !base || !process.env.NOTION_API_KEY) {
  console.error('Usage: NOTION_API_KEY=<set privately> node scripts/prepare-invitation.mjs <household-page-id> <https://site-url>');
  process.exit(1);
}
const site = new URL(base);
if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) throw new Error('Use the final HTTPS site origin.');
const richText = value => ({rich_text:[{type:'text',text:{content:value}}]});
const plain = property => (property?.rich_text || []).map(t=>t.plain_text ?? t.text?.content ?? '').join('');
async function notion(path, body) {
  const response = await fetch('https://api.notion.com/v1/' + path, {
    method:body?'PATCH':'GET', signal:AbortSignal.timeout(15000),
    headers:{Authorization:`Bearer ${process.env.NOTION_API_KEY}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if (!response.ok) throw new Error(`Notion request failed (${response.status}). No response body logged.`);
  return response.json();
}
const page = await notion('pages/' + pageId);
if (page.parent?.data_source_id?.replaceAll('-','') !== expectedSource.replaceAll('-','')) throw new Error('This page is not in the configured Households data source.');
if (page.archived || page.in_trash || page.properties['Household status']?.select?.name !== 'Active') throw new Error('Only active households can receive links.');
if (page.properties.Decision?.select?.name !== 'Include') throw new Error('Set Decision to Include after reviewing this household.');
const existing = page.properties['Invitation URL']?.url;
if (existing) {
  const url = new URL(existing);
  const token = url.searchParams.get('invite');
  if (url.origin !== site.origin || !token || createHash('sha256').update(token).digest('hex') !== plain(page.properties['Invitation token hash'])) {
    throw new Error('Existing link needs reconciliation. Review it in Notion; this helper will not overwrite or revive it.');
  }
  console.log('Existing invitation preserved in Notion. No message sent.');
} else {
  if (plain(page.properties['Invitation token hash'])) throw new Error('Existing token needs reconciliation; no changes made.');
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  site.searchParams.set('invite',token);
  await notion('pages/' + pageId, {properties:{'Invitation URL':{url:site.href},'Invitation token hash':richText(hash)}});
  console.log('Invitation URL saved on the selected Notion household. No message sent.');
}

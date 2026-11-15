import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createHandler } from '../netlify/functions/invitation.mjs';
const token = 'a'.repeat(43);
const hash = createHash('sha256').update(token).digest('hex');
const text = value => ({ rich_text: [{ plain_text: value }] });
const household = (extra = {}) => ({ id: 'household-test', properties: {
  'Invitation token hash': text(hash), 'Household status': { select: { name: 'Active' } },
  Greeting: text('Hello, Test Household'), 'Personal note': text('A reviewed note.'),
  'Date saved': { checkbox: false }, 'Phone number': { phone_number: 'PRIVATE' }, Notes: text('PRIVATE'),
  ...extra
}});
function fixture(rows = [household()], failPatch = false) {
  const calls = [];
  const env = { INVITATIONS_ENABLED: 'true', NOTION_API_KEY: 'test-secret', NOTION_HOUSEHOLDS_DATA_SOURCE_ID: 'test-source' };
  const handler = createHandler({ env, now: () => new Date('2026-11-15T18:00:00Z'), fetcher: async (url, options) => {
    calls.push({url, ...options, body: JSON.parse(options.body)});
    if (options.method === 'PATCH') {
      if (failPatch) return new Response('{}', {status:503});
      rows[0].properties['Date saved'].checkbox = true;
      return Response.json(rows[0]);
    }
    return Response.json({results: rows, has_more: false});
  }});
  return {handler,calls};
}
function request(action = 'view', overrides = {}, origin = 'https://wedding.example') {
  return new Request('https://wedding.example/api/invitation', { method:'POST', headers:{'Content-Type':'application/json', Origin:origin}, body:JSON.stringify({token,action,...overrides}) });
}
test('lookup filters active households by hashed token and returns only approved fields', async () => {
  const {handler,calls}=fixture(); const response=await handler(request());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(), {greeting:'Hello, Test Household',personalNote:'A reviewed note.',acknowledged:false});
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].body.filter.and, [
    {property:'Invitation token hash',rich_text:{equals:hash}},
    {property:'Household status',select:{equals:'Active'}}
  ]);
  assert.ok(!JSON.stringify(calls[0].body).includes(token));
});
test('acknowledgment writes only its two fields and a repeat is idempotent', async () => {
  const {handler,calls}=fixture();
  assert.equal((await (await handler(request('acknowledge'))).json()).acknowledged,true);
  assert.deepEqual(calls[1].body, {properties:{'Date saved':{checkbox:true},'Date saved on':{date:{start:'2026-11-15T18:00:00.000Z'}}}});
  assert.equal((await (await handler(request('acknowledge'))).json()).acknowledged,true);
  assert.equal(calls.filter(c=>c.method==='PATCH').length,1);
});
test('merged, excluded, revoked, duplicate and unknown invitations cannot write', async () => {
  const rows = [[], [household(),household()], [household({'Household status':{select:{name:'Merged'}}})],
    [household({Decision:{select:{name:'Do not invite'}}})], [household({'Invitation token hash':text('revoked')})]];
  for (const row of rows) {
    const {handler,calls}=fixture(row);
    assert.equal((await handler(request('acknowledge'))).status,404);
    assert.equal(calls.length,1);
  }
});
test('invalid input, cross-origin writes and GET never query Notion', async () => {
  const {handler,calls}=fixture();
  for (const req of [request('view',{token:'guess'}),request('edit'),request('view',{token:null})]) assert.equal((await handler(req)).status,400);
  assert.equal((await handler(request('acknowledge',{},'https://attacker.example'))).status,403);
  assert.equal((await handler(new Request('https://wedding.example/api/invitation'))).status,405);
  assert.equal(calls.length,0);
});
test('unconfigured preview and upstream write failures never report success', async () => {
  let called=false;
  const handler=createHandler({env:{},fetcher:()=>{called=true;}});
  assert.equal((await handler(request('acknowledge'))).status,503); assert.equal(called,false);
  const failing=fixture([household()],true);
  const response=await failing.handler(request('acknowledge'));
  assert.equal(response.status,503);assert.equal((await response.json()).acknowledged,undefined);
});

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createHandler } from '../netlify/functions/invitation.mjs';
const root = fileURLToPath(new URL('../site/', import.meta.url));
const port = Number(process.env.PORT || 8768);
let handler = createHandler();
// Explicit local-only fixture for exercising UI states, never included in the deploy.
if (process.argv.includes('--fixture')) {
  let saved = false;
  const hash = createHash('sha256').update('a'.repeat(43)).digest('hex');
  const text = value => ({rich_text:[{plain_text:value}]});
  handler = createHandler({env:{INVITATIONS_ENABLED:'true',NOTION_API_KEY:'local-test',NOTION_HOUSEHOLDS_DATA_SOURCE_ID:'fixture'},fetcher:async (_url,options)=>{
    if (options.method === 'PATCH') { saved = true; return Response.json({}); }
    const body = JSON.parse(options.body);
    const match = body.filter.and[0].rich_text.equals === hash;
    return Response.json({has_more:false,results:match?[{id:'local-fixture',properties:{
      'Household status':{select:{name:'Active'}},'Invitation token hash':text(hash),Greeting:text('Hello, preview guests.'),
      'Personal note':text('This is a local test invitation. No guest records are changed.'),'Date saved':{checkbox:saved}
    }}]:[]});
  }});
}
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'};
http.createServer(async (req,res)=>{
  try {
    const url = new URL(req.url,`http://127.0.0.1:${port}`);
    if (url.pathname === '/api/invitation') {
      const chunks=[]; let size=0;
      for await (const chunk of req) { size+=chunk.length; if(size>1024){res.writeHead(413);res.end();return;}chunks.push(chunk); }
      const response = await handler(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
    const path = resolve(root,'.'+decodeURIComponent(url.pathname === '/'?'/index.html':url.pathname));
    if(!path.startsWith(resolve(root)+sep) || !(await stat(path)).isFile()) {res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    res.end(req.method==='HEAD'?undefined:await readFile(path));
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${port}/review.html?size=mobile${process.argv.includes('--fixture')?' (isolated response fixture)':''}`));

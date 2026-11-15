import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {siteMetadata, renderMetadata, robotsText, sitemapText} from '../scripts/metadata.mjs';

const source = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');

test('production metadata and sitemap never contain invitation tokens or preview paths', () => {
  const metadata = siteMetadata({NETLIFY:'true',CONTEXT:'production',URL:'https://wedding.example/preview?invite=private-household-token#response'});
  const html = renderMetadata(source,metadata);
  assert.match(html, /name="robots" content="index, follow, max-image-preview:large"/);
  assert.match(html, /rel="canonical" href="https:\/\/wedding.example\/"/);
  assert.match(html, /property="og:image" content="https:\/\/wedding.example\/assets\/images\/save-the-date.jpg"/);
  assert.doesNotMatch(html, /private-household-token|127\.0\.0\.1|noindex|wedding\.example\/preview/);
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(schema.url,'https://wedding.example/');
  assert.equal(schema.primaryImageOfPage.width,1200);
  assert.match(robotsText(metadata), /Sitemap: https:\/\/wedding.example\/sitemap.xml/);
  assert.match(sitemapText(metadata), /<loc>https:\/\/wedding.example\/<\/loc>/);
  assert.equal((html.match(/name="robots"/g)||[]).length,1);
  assert.equal((html.match(/<title>/g)||[]).length,1);
});

test('custom production origin overrides the Netlify subdomain', () => {
  assert.deepEqual(siteMetadata({CONTEXT:'production',SITE_URL:'https://our-wedding.example/',URL:'https://site.netlify.app'}),{origin:'https://our-wedding.example',indexable:true});
});

test('deploy previews stay noindex with their own image URL even with a production override', () => {
  for (const CONTEXT of ['deploy-preview','branch-deploy','dev']) {
    const metadata=siteMetadata({CONTEXT,SITE_URL:'https://our-wedding.example',URL:'https://site.netlify.app',DEPLOY_PRIME_URL:'https://preview--site.netlify.app'});
    const html=renderMetadata(source,metadata);
    assert.match(html,/name="robots" content="noindex, nofollow"/);
    assert.match(html,/https:\/\/preview--site.netlify.app\/assets\/images\/save-the-date.jpg/);
    assert.doesNotMatch(robotsText(metadata), /Sitemap|Disallow: \/\n/);
  }
});

test('local builds stay noindex and invalid public origins fail before publishing', () => {
  assert.equal(siteMetadata({}).indexable,false);
  assert.equal(siteMetadata({SITE_URL:'http://localhost:8768'}).indexable,false);
  for (const SITE_URL of ['http://public.example','https://user:password@public.example','file:///private/path','invalid-url']) {
    assert.throws(()=>siteMetadata({SITE_URL}));
  }
  assert.throws(()=>siteMetadata({NETLIFY:'true'}),/needs SITE_URL/);
});

test('metadata insertion fails loudly when the HTML template loses its marker', () => {
  assert.throws(()=>renderMetadata('<html></html>',siteMetadata({})),/one metadata block/);
});

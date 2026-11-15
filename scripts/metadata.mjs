export const title = 'Paul & Audrey | September 25, 2027';
export const description = 'We’re getting married. Save the date for September 25, 2027, in Salt Lake City. With love, Paul and Audrey.';
const imagePath = '/assets/images/save-the-date.jpg';
const imageAlt = 'Paul and Audrey sitting in a golden meadow beside their names, September 25, 2027, and Salt Lake City.';
const escape = value => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function siteMetadata(env = process.env) {
  const preview = Boolean(env.CONTEXT && env.CONTEXT !== 'production');
  const address = preview
    ? env.DEPLOY_PRIME_URL || env.DEPLOY_URL || env.SITE_URL || env.URL
    : env.SITE_URL || env.URL;
  if (env.NETLIFY === 'true' && !address) throw new Error('A deployed build needs SITE_URL or Netlify URL.');
  const url = new URL(address || 'http://127.0.0.1:8768');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('SITE_URL must be an HTTP(S) site address without credentials.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!local && url.protocol !== 'https:') throw new Error('The public SITE_URL must use HTTPS.');
  // Always discard paths, query parameters, and fragments, including invitation tokens.
  return { origin: url.origin, indexable: Boolean(address) && !local && !preview };
}

export function metadataBlock({origin, indexable}) {
  const canonical = origin + '/';
  const image = origin + imagePath;
  const robots = indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
  const schema = {
    '@context':'https://schema.org', '@type':'WebPage', name:title, description,
    url:canonical, inLanguage:'en-US', primaryImageOfPage:{'@type':'ImageObject',url:image,width:1200,height:630}
  };
  return `<!-- metadata:start -->
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${escape(canonical)}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="Paul &amp; Audrey">
  <meta property="og:title" content="${escape(title)}">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="${escape(canonical)}">
  <meta property="og:image" content="${escape(image)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escape(imageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escape(title)}">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="${escape(image)}">
  <meta name="twitter:image:alt" content="${escape(imageAlt)}">
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>
  <!-- metadata:end -->`;
}

export function renderMetadata(html, metadata) {
  const marker = /<!-- metadata:start -->[\s\S]*?<!-- metadata:end -->/g;
  if ([...html.matchAll(marker)].length !== 1) throw new Error('Expected one metadata block in index.html.');
  return html.replace(marker, () => metadataBlock(metadata));
}

export function robotsText({origin, indexable}) {
  // Permit fetching the HTML and social artwork so crawlers can read previews and noindex.
  return 'User-agent: *\nAllow: /\nDisallow: /api/\n' + (indexable ? `\nSitemap: ${origin}/sitemap.xml\n` : '');
}

export function sitemapText({origin}) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(origin)}/</loc></url></urlset>\n`;
}

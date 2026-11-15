# Paul & Audrey

A responsive wedding save-the-date for September 25, 2027, in Salt Lake City. Built with vanilla HTML, CSS, JavaScript, self-hosted fonts, GSAP, and Lenis.

The site opens automatically with a brief photo and typography reveal. It includes a short story, scroll-linked photo transitions, a calendar download, a nine-photo gallery, and a household save-the-date acknowledgment. Reduced-motion preferences are respected.

## Local development

Requires Node.js 22 or newer. No package installation is needed for preview, tests, or the static build.

```sh
npm run preview
```

Open [the mobile review](http://127.0.0.1:8768/review.html?size=mobile) or [the page directly](http://127.0.0.1:8768/). Review controls offer 320, 390, 768, and 1440 pixel layouts, reduced motion, and opening replay.

```sh
npm test
npm run build
```

The build writes `dist/` using an explicit public-file allowlist. Review controls, test fixtures, guest data, credentials, and screenshots are excluded.

## Netlify setup

`netlify.toml` specifies:

- Build: `node scripts/build.mjs`
- Publish directory: `dist`
- Functions: `netlify/functions`

Publishing and live response activation are separate from pushing this repository.

## Search and sharing previews

The build emits the title, description, canonical URL, Open Graph and Twitter large-image tags, and WebPage JSON-LD directly into the HTML. The sharing artwork is a 1200 × 630 JPEG at `assets/images/save-the-date.jpg`; its editable layout is `site/social-card.html`, excluded from deployment. The browser icon is `site/favicon.svg`.

Production builds enable indexing and generate `robots.txt` and a one-page `sitemap.xml`. Canonical, social, and sitemap URLs always point to the root page, without household tokens or other query parameters. Household greetings and response state never enter metadata.

On Netlify, the build uses its automatic `URL` variable for the public origin. Set build-scoped `SITE_URL` to override it with a custom domain. Deploy previews and branch deploys use their own `DEPLOY_PRIME_URL` and remain `noindex`; they do not publish a sitemap. Local builds also remain `noindex` without a public origin. `dist/_headers` sets the matching robots response header, so there is no conflicting global noindex rule.

For a production build outside Netlify, export the actual public HTTPS origin:

```sh
SITE_URL=https://your-wedding-domain.example npm run build
```

After publishing, verify the public page and image are reachable without sign-in, and paste a test link into Messages to check the live preview. Localhost cannot be fetched by remote preview services. See [Apple's Messages preview guidance](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages), the [Open Graph specification](https://ogp.me/), and [Netlify's build variables](https://docs.netlify.com/build/configure-builds/environment-variables/).

## Notion acknowledgment

`/api/invitation` resolves a random invitation token to one active household. It returns only the approved greeting, personal note, and acknowledgment state. Clicking “We’ve saved the date” writes `Date saved` and `Date saved on`; it does not change formal RSVPs, guest seats, contact details, or sending status.

Configure these environment variables in Netlify with Functions access:

| Variable | Purpose |
| --- | --- |
| `NOTION_API_KEY` | Private integration credential with read/update access to Households |
| `NOTION_HOUSEHOLDS_DATA_SOURCE_ID` | Existing Households data source ID |
| `INVITATIONS_ENABLED` | Set to `true` only after configuration and a successful authorized test |

The integration expects these properties: `Household status` (select, `Active`), `Decision` (select), `Greeting` and `Personal note` (rich text), `Invitation token hash` (rich text), `Invitation URL` (URL), `Date saved` (checkbox), and `Date saved on` (date).

With the credential and data source ID exported privately in the environment, prepare one reviewed household:

```sh
node scripts/prepare-invitation.mjs <household-page-id> <https://site-origin>
```

The household must be active and its Decision must be Include. The helper preserves existing valid links and writes a new link directly to Notion when needed. It never prints invitation tokens or sends messages. Clear a household’s Invitation token hash to revoke its link.

Without an invitation, the page explains that guests need their personal text link to respond. Without runtime configuration, the server returns an unavailable response rather than reporting success.

For an isolated local response test:

```sh
node scripts/preview.mjs --fixture
```

This accepts a token of 43 lowercase `a` characters using a memory-only fixture. It makes no real Notion requests. The fixture is excluded from deployment.

## Source layout

- `site/`: browser source, optimized photographs, fonts, and vendored animation libraries.
- `netlify/functions/`: server-side invitation lookup and acknowledgment.
- `scripts/`: local preview, public build, and explicit invitation preparation.
- `tests/` and `site/tests/`: acknowledgment and calendar checks.

Private guest records, original photo archives, planning documents, and runtime credentials remain outside version control.

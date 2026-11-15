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

Publishing and live response activation are separate from pushing this repository. The preview currently includes `noindex, nofollow` headers and metadata.

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

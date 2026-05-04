# docs-site

[Astro Starlight](https://starlight.astro.build) documentation site for swsd-mcp. Deployed to Cloudflare Pages on every push to `main`.

Live at: **[swsd-mcp.pages.dev](https://swsd-mcp.pages.dev)** _(once Cloudflare Pages is connected — see setup below)_

## Local development

```bash
cd docs-site
npm install
npm run dev          # → http://localhost:4321
```

Hot-reload is enabled. Edit any `.md` / `.mdx` file under `src/content/docs/` and the browser refreshes automatically.

## Build

```bash
npm run build        # → docs-site/dist/
npm run preview      # serves the built site locally
```

Output is fully static HTML + a Pagefind search index. No server runtime.

## Cloudflare Pages setup (one-time, by maintainer)

The docs site auto-deploys via Cloudflare's GitHub integration. To wire it up the first time:

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**
2. Authorize Cloudflare to read this repository
3. Select `mikimatsub/MCP-SWSD`
4. Configure the build:

   | Setting | Value |
   |---|---|
   | **Production branch** | `main` |
   | **Framework preset** | `Astro` |
   | **Build command** | `cd docs-site && npm install && npm run build` |
   | **Build output directory** | `docs-site/dist` |
   | **Root directory** | _(leave blank)_ |
   | **Environment variable: `NODE_VERSION`** | `24` |

5. Click **Save and Deploy**

After the first successful build, every push to `main` auto-deploys, and every PR gets a preview URL automatically (commented on the PR by Cloudflare's bot).

### Optional: custom domain later

Cloudflare Pages → your project → Custom domains → Set up a custom domain. Add a `CNAME` record pointing at the `*.pages.dev` URL via your DNS provider. SSL provisions in ~1 minute.

## Project structure

```
docs-site/
├── astro.config.mjs              # Astro + Starlight config (sidebar, social, edit-link)
├── package.json                  # Sub-package; isolated from the root MCP server package
├── tsconfig.json
├── public/                       # Static assets (favicons, etc.)
└── src/
    ├── content.config.ts         # Starlight content-collection definition
    └── content/docs/             # Markdown pages → URLs
        ├── index.mdx             # Homepage (splash template)
        ├── quickstart.md
        ├── configuration.md
        ├── tools.md
        ├── deployment.md
        ├── security.md
        └── contributing.md
```

## Why a separate package?

The docs site has its own dependency tree (Astro, Starlight, sharp, ~350 packages) that isn't relevant to the runtime MCP server. Keeping it isolated:

- Lets the main `npm install` stay fast for contributors who only want to work on the server
- Prevents Astro/Starlight version pins from constraining the MCP server's TypeScript / Node version
- Keeps the published npm package (`swsd-mcp`) free of docs-only dependencies
- Lets Cloudflare's build run independently from GitHub Actions CI (saves CI minutes)

The root `eslint.config.js` ignores `docs-site/` for the same isolation reason.

## Adding a new page

1. Create `src/content/docs/your-page.md` with a `title` and `description` in frontmatter
2. Add an entry to the `sidebar` array in [`astro.config.mjs`](./astro.config.mjs)
3. `npm run dev` to preview
4. Commit; Cloudflare auto-deploys

## D2 diagrams

Not yet integrated. The plan is to use [`astro-d2`](https://github.com/astrolicious/astro-d2) once content migration starts adding architecture diagrams. Tracking in a follow-up PR.

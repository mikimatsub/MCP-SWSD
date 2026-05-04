// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  // Update if you ever switch to a custom domain (e.g., 'https://swsd-mcp.dev').
  // The `base` option below should remain '/' for any root-domain deploy
  // (Cloudflare Pages, custom domain). Only set base if you ever move to a
  // subpath deploy like GitHub Pages.
  site: 'https://swsd-mcp.pages.dev',

  integrations: [
    starlight({
      title: 'swsd-mcp',
      description:
        'MCP server for SolarWinds Service Desk (SWSD / Samanage). Lets AI assistants read and modify tickets, comments, and KB articles.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mikimatsub/MCP-SWSD' },
        { icon: 'npm', label: 'npm', href: 'https://www.npmjs.com/package/swsd-mcp' },
      ],
      sidebar: [
        { label: 'Quick start', link: '/quickstart/' },
        { label: 'Configuration', link: '/configuration/' },
        { label: 'Tools reference', link: '/tools/' },
        { label: 'Deployment', link: '/deployment/' },
        { label: 'Security', link: '/security/' },
        { label: 'Contributing', link: '/contributing/' },
      ],
      editLink: {
        baseUrl: 'https://github.com/mikimatsub/MCP-SWSD/edit/main/docs-site/',
      },
      lastUpdated: true,
    }),
  ],
});

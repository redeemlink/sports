// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// For project repo (e.g., username.github.io/my-repo), use base: '/my-repo/'
// For user site (username.github.io), no base needed
// For custom domain, set site to your domain
export default defineConfig({
  // Change to your custom domain later, e.g., 'https://mysportsnews.com'
  // base: '/your-repo-name',  // Uncomment if deploying to a project site (not user site)
  site: 'https://redeemlink.xyz',

  integrations: [sitemap()]
});
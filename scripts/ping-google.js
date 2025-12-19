import fetch from 'node-fetch';

const site = 'https://ptnews.store'; // Same as above
const sitemapUrl = `${site}/sitemap-index.xml`;

fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`)
  .then(res => console.log(`Pinged Google: ${res.status}`))
  .catch(err => console.error('Ping failed:', err));
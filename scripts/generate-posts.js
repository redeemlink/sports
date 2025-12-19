import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parser = new Parser();

const feedsTxt = fs.readFileSync(path.join(__dirname, '../feeds.txt'), 'utf-8');
const feedUrls = feedsTxt.split('\n').filter(line => line.trim() && !line.startsWith('#'));

const contentDir = path.join(__dirname, '../src/content/news');
const publicDir = path.join(__dirname, '../public/data');
fs.mkdirSync(contentDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

// Clear old generated files
if (fs.existsSync(contentDir)) {
  fs.readdirSync(contentDir).forEach(file => {
    if (file.endsWith('.md')) fs.unlinkSync(path.join(contentDir, file));
  });
}
if (fs.existsSync(path.join(publicDir, 'posts.json'))) {
  fs.unlinkSync(path.join(publicDir, 'posts.json'));
}

let allPosts = [];

for (const url of feedUrls) {
  console.log(`Fetching feed: ${url}`);
  let feed;
  try {
    // Reliable CORS proxy
    feed = await parser.parseURL(`https://corsproxy.io/?${encodeURIComponent(url)}`);
  } catch (e) {
    console.error(`Failed to fetch ${url}:`, e.message);
    continue;
  }

  for (const item of feed.items.slice(0, 100)) {
    // Generate clean slug
    const slug = (item.title || 'untitled')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 200) || Date.now().toString();

    // pubDate as string (YYYY-MM-DD)
    const pubDateStr = item.pubDate
      ? new Date(item.pubDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Extract image
    let image = '';
    if (item.enclosure?.url) {
      image = item.enclosure.url;
    } else if (item.content || item.description) {
      const desc = item.content || item.description || '';
      const match = desc.match(/src=["']([^"']+\.(jpg|jpeg|png|gif|webp))["']/i);
      if (match) image = match[1];
    }

    // Short description (strip HTML)
    const description = (item.contentSnippet || item.description || item.content || '')
      .replace(/<[^>]*>/g, '')
      .slice(0, 300)
      .trim();

    // Frontmatter (only one declaration!)
    const frontmatter = `---
title: "${(item.title || 'No title').replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
pubDate: "${pubDateStr}"
image: "${image}"
link: "${item.link || '#'}"
source: "${(item.creator || feed.title || 'Google News').replace(/"/g, '\\"')}"
---
`;

    // Write markdown file
    fs.writeFileSync(path.join(contentDir, `${slug}.md`), frontmatter);

    // Add to index
    allPosts.push({
      slug,
      title: item.title || 'No title',
      description,
      pubDate: pubDateStr,
      image,
      link: item.link || '#',
      source: item.creator || feed.title || 'Google News',
    });
  }
}

// Sort newest first and save JSON for homepage
allPosts.sort((a, b) => b.pubDate.localeCompare(a.pubDate));
fs.writeFileSync(path.join(publicDir, 'posts.json'), JSON.stringify(allPosts, null, 2));

console.log(`Successfully generated ${allPosts.length} articles!`);
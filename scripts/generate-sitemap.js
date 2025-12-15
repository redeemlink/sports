
import fs from 'fs';
import path from 'path';
import { create } from 'xmlbuilder2';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(APP_DIR, 'dist');
const URL_FILE = path.resolve(APP_DIR, 'astro_sitemap_urls.txt');
const ASTRO_CONFIG_FILE = path.resolve(APP_DIR, 'astro.config.mjs');

async function fetchExistingSitemapIndex(domain) {
    const sitemapIndexUrl = `https://${domain}/sitemap.xml`;
    try {
        const response = await fetch(sitemapIndexUrl);
        if (!response.ok) {
            console.warn(`Could not fetch existing sitemap index from ${sitemapIndexUrl}: ${response.statusText}`);
            return null;
        }
        return await response.text();
    } catch (e) {
        console.warn(`Could not fetch existing sitemap index from ${sitemapIndexUrl}: ${e.message}`);
        return null;
    }
}

function getSiteDomain() {
    try {
        const configContent = fs.readFileSync(ASTRO_CONFIG_FILE, 'utf-8');
        const match = configContent.match(/site\s*:\s*['"](.+?)['"]/);
        if (match && match[1]) {
            const url = new URL(match[1]);
            return url.hostname;
        }
    } catch (e) {
        console.error(`Could not read or parse astro.config.mjs: ${e.message}`);
    }
    return null;
}

async function generateSitemaps(urls, domain) {
    const files = {};
    const newSitemapNames = [];

    // Add sitemap.xsl to the files to be deployed
    try {
        files["sitemap.xsl"] = fs.readFileSync(path.resolve(APP_DIR, 'public', 'sitemap.xsl'), 'utf-8');
    } catch (e) {
        console.error("sitemap.xsl not found!");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const chunkSize = 45000;
    const chunks = [];
    for (let i = 0; i < urls.length; i += chunkSize) {
        chunks.push(urls.slice(i, i + chunkSize));
    }
    const numChunks = chunks.length;
    const publicationName = "Your Publication Name"; // You might want to configure this

    const pi = '<?xml-stylesheet type="text/xsl" href="sitemap.xsl"?>';

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const root = create({ version: '1.0', encoding: 'UTF-8' })
            .ele('urlset', { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' });

        for (const url of chunk) {
            const u = root.ele('url');
            u.ele('loc').txt(url);

            const newsBlock = u.ele('news:news', {
                'xmlns:news': 'http://www.google.com/schemas/sitemap-news/0.9'
            });
            const pubBlock = newsBlock.ele('news:publication');
            pubBlock.ele('news:name').txt(publicationName);
            pubBlock.ele('news:language').txt('en');
            newsBlock.ele('news:publication_date').txt(new Date().toISOString());
            newsBlock.ele('news:title').txt(url);
            u.ele('lastmod').txt(new Date().toISOString());
        }

        const xmlString = root.end({ prettyPrint: true });
        
        let sitemapFilename;
        if (numChunks > 1) {
            sitemapFilename = `sitemap-${timestamp}-${i + 1}.xml`;
        } else {
            sitemapFilename = `sitemap-${timestamp}.xml`;
        }

        files[sitemapFilename] = `<?xml version="1.0" encoding="UTF-8"?>\n${pi}\n${xmlString}`;
        newSitemapNames.push(sitemapFilename);
    }

    const existingSitemapUrls = [];
    const existingSitemapIndexXml = await fetchExistingSitemapIndex(domain);
    if (existingSitemapIndexXml) {
        try {
            const existingRoot = create(existingSitemapIndexXml);
            const existingSitemaps = existingRoot.find(
                ({ node }) => node.nodeName === 'sitemap',
                true
              );
            for (const sitemapElem of existingSitemaps) {
                const loc = sitemapElem.find(({ node }) => node.nodeName === 'loc', true);
                if (loc.length > 0) {
                    const locText = loc[0].string;
                    if (locText && !locText.endsWith('/sitemap.xml')) {
                        existingSitemapUrls.push(locText);
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to parse existing sitemap.xml: ${e.message}`);
        }
    }

    const index = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('sitemapindex', { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' });

    for (const url of existingSitemapUrls) {
        const s = index.ele('sitemap');
        s.ele('loc').txt(url);
        s.ele('lastmod').txt(new Date().toISOString());
    }

    for (const name of newSitemapNames) {
        const sitemapLoc = `https://${domain}/${name}`;
        if (!existingSitemapUrls.includes(sitemapLoc)) {
            const s = index.ele('sitemap');
            s.ele('loc').txt(sitemapLoc);
            s.ele('lastmod').txt(new Date().toISOString());
        }
    }

    const sitemapIndexXml = index.end({ prettyPrint: true });
    files["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n${pi}\n${sitemapIndexXml}`;
    files["robots.txt"] = `User-agent: *\nSitemap: https://${domain}/sitemap.xml`;

    return files;
}

async function main() {
    const domain = getSiteDomain();
    if (!domain) {
        console.error("Could not determine site domain. Aborting.");
        return;
    }

    let urls = [];
    try {
        const urlContent = fs.readFileSync(URL_FILE, 'utf-8');
        urls = urlContent.split('\n').map(line => line.trim()).filter(line => line.startsWith('http'));
    } catch (e) {
        console.error(`Could not read URL file at ${URL_FILE}: ${e.message}`);
        return;
    }

    if (urls.length === 0) {
        console.warn("No URLs found to generate sitemaps.");
        return;
    }

    console.log(`Generating sitemaps for ${urls.length} URLs...`);
    const filesToDeploy = await generateSitemaps(urls, domain);

    if (!fs.existsSync(DIST_DIR)) {
        fs.mkdirSync(DIST_DIR, { recursive: true });
    }

    for (const filename in filesToDeploy) {
        fs.writeFileSync(path.resolve(DIST_DIR, filename), filesToDeploy[filename], 'utf-8');
        console.log(`Wrote ${filename} to ${DIST_DIR}`);
    }

    console.log("Sitemap generation complete.");
}

main();

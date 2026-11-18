'use strict';

// GitHub Pages-д байршуулах статик сайтыг _site/ хавтсанд бэлдэнэ.
//   node scripts/build-site.js            → зөвхөн бэлдэх
//   node scripts/build-site.js --serve    → бэлдээд http://localhost:8080 дээр нээх

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_site');

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'site'), OUT, { recursive: true });
  fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'public', 'css', 'style.css'), path.join(OUT, 'css', 'style.css'));
  fs.copyFileSync(path.join(ROOT, 'public', 'favicon.svg'), path.join(OUT, 'favicon.svg'));
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log(`Сайт бэлэн: ${path.relative(ROOT, OUT)}/`);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

function serve(port) {
  http.createServer((req, res) => {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.join(OUT, path.normalize(urlPath));
    if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`Урьдчилан харах: http://localhost:${port}/`));
}

build();
if (process.argv.includes('--serve')) serve(parseInt(process.env.PORT, 10) || 8080);

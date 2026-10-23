#!/usr/bin/env node
/* ------------------------------------------------------------------
   Mini serveur statique pour vérifier la boutique en local.
   Usage : node serve.mjs        (port 4173, ou PORT=xxxx node serve.mjs)
   Aucune dépendance. Ne sert jamais les fichiers cachés (.env, .git…).
   ------------------------------------------------------------------ */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  // Refuse les fichiers/dossiers cachés (.env, .git) et les remontées de chemin.
  if (urlPath.split('/').some((part) => part.startsWith('.') && part !== '.nojekyll')) {
    return send(res, 404, 'Not found');
  }
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (err) return send(res, 404, 'Not found');
    if (stat.isDirectory()) {
      res.writeHead(301, { Location: urlPath + '/' });
      return res.end();
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Boutique en ligne sur http://localhost:${PORT}  (Ctrl+C pour arrêter)`);
});

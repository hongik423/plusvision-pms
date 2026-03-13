#!/usr/bin/env node
/**
 * dev 모드에서 chunks/*.js를 server/*.js로 복사
 * npm run dev와 별도 터미널에서 실행: node scripts/chunk-copier.cjs
 */
const fs = require('fs');
const path = require('path');

const serverDir = path.join(__dirname, '..', '.next', 'server');
const chunksDir = path.join(serverDir, 'chunks');
const interval = 50;

function copyChunks() {
  if (!fs.existsSync(chunksDir)) return;
  const files = fs.readdirSync(chunksDir);
  for (const name of files) {
    if (!name.endsWith('.js')) continue;
    const src = path.join(chunksDir, name);
    const dest = path.join(serverDir, name);
    try {
      if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
        fs.copyFileSync(src, dest);
        process.stdout.write('.');
      }
    } catch (_) {}
  }
}

process.stdout.write('Chunk copier running (copies chunks/*.js to server/)...\n');
setInterval(copyChunks, interval);
copyChunks();

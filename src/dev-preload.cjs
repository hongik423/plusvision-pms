/**
 * Preload: main 프로세스에서 5ms마다 chunks를 server 루트로 복사
 * node -r ./dev-preload.cjs next dev
 */
const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const serverDir = path.join(baseDir, '.next', 'server');
const chunksDir = path.join(serverDir, 'chunks');

function copyChunks() {
  try {
    if (!fs.existsSync(chunksDir)) return;
    const files = fs.readdirSync(chunksDir);
    for (const name of files) {
      if (!name.endsWith('.js')) continue;
      const src = path.join(chunksDir, name);
      const dest = path.join(serverDir, name);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    }
  } catch (_) {}
}

setInterval(copyChunks, 5);
copyChunks();

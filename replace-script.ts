import fs from 'fs';
let content = fs.readFileSync('vite.config.ts', 'utf8');
content = content.replace(/server: {[\s\S]*?},/, `server: {
      host: true,
      port: 3000,
      strictPort: true,
      hmr: {
        protocol: 'ws',
        clientPort: 443,
      },
    },`);
fs.writeFileSync('vite.config.ts', content, 'utf8');
console.log('done');

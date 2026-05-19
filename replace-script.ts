import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string, callback: (path: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

function getRelativePath(fromPath: string, toPath: string) {
    let rel = path.relative(path.dirname(fromPath), toPath);
    if (!rel.startsWith('.')) rel = './' + rel;
    // Remove .ts extension
    rel = rel.replace(/\.ts$/, '');
    // Ensure posix paths
    rel = rel.split(path.sep).join('/');
    return rel;
}

const firebaseLibPath = path.resolve('./src/lib/firebase');

walk('./src', (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  if (path.resolve(filePath) === firebaseLibPath + '.ts') return;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  const relFirebasePath = getRelativePath(path.resolve(filePath), firebaseLibPath);

  content = content.replace(/['"]firebase\/firestore['"]/g, `'${relFirebasePath}'`);
  content = content.replace(/['"]firebase\/auth['"]/g, `'${relFirebasePath}'`);
  content = content.replace(/['"]firebase\/storage['"]/g, `'${relFirebasePath}'`);
  content = content.replace(/['"]firebase\/app['"]/g, `'${relFirebasePath}'`);

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});

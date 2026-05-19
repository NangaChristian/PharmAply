const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  if (fs.existsSync(dir)) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, files);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
            files.push(filePath);
        }
    }
  }
  return files;
}

const directories = [
  'src/pages/patient',
  'src/pages/delivery',
  'src/pages/pharmacist',
];

function processFiles() {
  let filePaths = [];
  directories.forEach(dir => {
    getFiles(dir, filePaths);
  });
  
  filePaths.push('src/components/layout/BottomNav.tsx');
  filePaths.push('src/components/layout/RoleLayout.tsx');

  filePaths.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    const replaceClass = (search, replace) => {
        content = content.replace(/(className\s*=\s*(?:["'][^"']*["']|\{[^}]*\}))/g, (match) => {
            const regex = new RegExp(`\\b${search}\\b(?!.*\\b${replace}\\b)`, 'g');
            return match.replace(regex, `${replace}`); // Notice we now just output replace instead of search+replace
        });
    };

    // Make jet black!
    replaceClass('dark:bg-slate-900', 'dark:bg-black');
    replaceClass('dark:bg-slate-950', 'dark:bg-black');
    replaceClass('dark:bg-slate-800', 'dark:bg-zinc-900');
    replaceClass('dark:bg-gray-900', 'dark:bg-black');
    replaceClass('dark:bg-gray-950', 'dark:bg-black');
    replaceClass('dark:border-slate-800', 'dark:border-zinc-800');
    replaceClass('dark:border-slate-700', 'dark:border-zinc-800');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed: ${filePath}`);
  });
}

processFiles();

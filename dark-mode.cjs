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
        // Find className="...." and replace inside it.
        content = content.replace(/(className\s*=\s*(?:["'][^"']*["']|\{[^}]*\}))/g, (match) => {
            const regex = new RegExp(`\\b${search}\\b(?!.*\\b${replace}\\b)`, 'g');
            return match.replace(regex, `${search} ${replace}`);
        });
    };

    replaceClass('bg-slate-50', 'dark:bg-slate-900');
    replaceClass('bg-white', 'dark:bg-slate-950');
    replaceClass('text-gray-900', 'dark:text-white');
    replaceClass('text-slate-900', 'dark:text-white');
    replaceClass('text-slate-800', 'dark:text-slate-100');
    replaceClass('text-gray-800', 'dark:text-slate-100');
    replaceClass('text-gray-500', 'dark:text-gray-400');
    replaceClass('text-slate-500', 'dark:text-slate-400');
    replaceClass('text-gray-400', 'dark:text-gray-500');
    replaceClass('border-gray-100', 'dark:border-slate-800');
    replaceClass('border-slate-100', 'dark:border-slate-800');
    replaceClass('border-gray-200', 'dark:border-slate-700');
    replaceClass('border-slate-200', 'dark:border-slate-700');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed: ${filePath}`);
  });
}

processFiles();

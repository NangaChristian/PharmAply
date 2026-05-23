const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            content = content.replace(/text-slate-900(?!\s+dark:text-)/g, 'text-slate-900 dark:text-white');
            content = content.replace(/text-slate-800(?!\s+dark:text-)/g, 'text-slate-800 dark:text-slate-100');

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated slate: ${fullPath}`);
            }
        }
    }
}

processDir(path.join(process.cwd(), 'src'));

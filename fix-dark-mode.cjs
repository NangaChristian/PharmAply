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

            // Replace text-gray-900 without dark:text-
            content = content.replace(/text-gray-900(?!\s+dark:text-)/g, 'text-gray-900 dark:text-white');
            content = content.replace(/text-gray-800(?!\s+dark:text-)/g, 'text-gray-800 dark:text-gray-100');
            content = content.replace(/bg-white(?!\s+dark:bg-)/g, 'bg-white dark:bg-zinc-950');
            content = content.replace(/bg-gray-50(?!\s+dark:bg-)/g, 'bg-gray-50 dark:bg-zinc-900');
            content = content.replace(/bg-gray-100(?!\s+dark:bg-)/g, 'bg-gray-100 dark:bg-zinc-800');

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

processDir(path.join(process.cwd(), 'src'));

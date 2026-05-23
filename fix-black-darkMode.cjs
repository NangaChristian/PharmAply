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

            content = content.replace(/text-black(?!\s+dark:text-)/g, 'text-black dark:text-white');
            content = content.replace(/text-\[#111\](?!\s+dark:text-)/g, 'text-[#111] dark:text-gray-100');

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated black: ${fullPath}`);
            }
        }
    }
}

processDir(path.join(process.cwd(), 'src'));

/**
 * Node.js script to scan all .tsx and .ts files for potential hardcoded strings
 * Usage: node scripts/scan-hardcoded-strings.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', 'src');
const OUTPUT_REPORT = path.resolve(__dirname, '..', 'i18n-audit-report.json');

const IGNORE_PATTERNS = [
  /^https?:\/\//i,
  /^[0-9\s.,:%#+\-_/\\()]+$/,
  /^#[0-9a-fA-F]{3,8}$/,
  /^(flex|grid|hidden|block|inline|absolute|relative|fixed|sticky|w-|h-|p-|m-|text-|bg-|border-)/,
  /^(px|rem|em|vh|vw|%|ms|s|fr)$/,
  /^(GET|POST|PUT|DELETE|PATCH)$/i,
  /^(id|key|ref|className|type|name|value|src|alt|href|to)$/,
  /^[a-zA-Z0-9_\-\.]+@[a-zA-Z0-9_\-\.]+$/, // email
  /^[A-Z0-9_]{3,}$/, // CONSTANTS
  /^lucide-/
];

const results = [];

function isExcludedString(str) {
  const trimmed = str.trim();
  if (trimmed.length < 2) return true;
  if (/^[^a-zA-ZÀ-ÿ\u0600-\u06FF]+$/.test(trimmed)) return true; // only symbols
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileRelative = path.relative(path.resolve(__dirname, '..'), filePath);

  const fileFindings = [];

  // Regex 1: JSX Text outside of tags: >Text here<
  const jsxTextRegex = />\s*([A-Za-zÀ-ÿ\u0600-\u06FF][^<>{}\n]+?)\s*</g;
  let match;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (!isExcludedString(text)) {
      const lineIndex = content.substring(0, match.index).split('\n').length;
      fileFindings.push({
        type: 'JSX_TEXT',
        line: lineIndex,
        text
      });
    }
  }

  // Regex 2: Attributes like placeholder="...", title="...", alt="..."
  const attrRegex = /(placeholder|title|aria-label|label)=["']([^"']+)["']/g;
  while ((match = attrRegex.exec(content)) !== null) {
    const attr = match[1];
    const text = match[2].trim();
    if (!isExcludedString(text) && !text.startsWith('{') && !text.includes('t(')) {
      const lineIndex = content.substring(0, match.index).split('\n').length;
      fileFindings.push({
        type: `ATTRIBUTE_${attr.toUpperCase()}`,
        line: lineIndex,
        text
      });
    }
  }

  // Regex 3: toast.error("..."), toast.success("...")
  const toastRegex = /toast\.(error|success|info)\s*\(\s*["']([^"']+)["']/g;
  while ((match = toastRegex.exec(content)) !== null) {
    const text = match[2].trim();
    if (!isExcludedString(text)) {
      const lineIndex = content.substring(0, match.index).split('\n').length;
      fileFindings.push({
        type: 'TOAST_MESSAGE',
        line: lineIndex,
        text
      });
    }
  }

  if (fileFindings.length > 0) {
    results.push({
      file: fileRelative,
      totalIssues: fileFindings.length,
      findings: fileFindings
    });
  }
}

function traverseDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        traverseDir(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      if (!entry.name.endsWith('.d.ts') && !entry.name.includes('i18n') && !entry.name.includes('test')) {
        scanFile(fullPath);
      }
    }
  }
}

console.log('Scanning source directory for hardcoded strings...');
traverseDir(ROOT_DIR);

const totalStrings = results.reduce((acc, curr) => acc + curr.totalIssues, 0);

const report = {
  scanDate: new Date().toISOString(),
  scannedDirectory: 'src/',
  totalFilesWithPotentialHardcodedStrings: results.length,
  totalPotentialHardcodedStrings: totalStrings,
  files: results
};

fs.writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2), 'utf8');

console.log(`Scan completed! Found ${totalStrings} candidate strings across ${results.length} files.`);
console.log(`Detailed report generated at: ${OUTPUT_REPORT}`);

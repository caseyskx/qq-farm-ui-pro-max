#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = [
  'logs/development/Update.log',
  'CHANGELOG.md',
  'CHANGELOG.DEVELOPMENT.md',
];

let errorCount = 0;
let warnCount = 0;

function print(level, file, message) {
  const tag = level === 'error' ? 'ERROR' : 'WARN';
  console.log(`[${tag}] ${file}: ${message}`);
}

function checkNulBytes(file, content) {
  if (content.includes('\u0000')) {
    errorCount += 1;
    print('error', file, 'contains NUL bytes');
  }
}

function checkUpdateLog(file, content) {
  const lines = content.split(/\r?\n/);

  const headers = [];
  for (const line of lines) {
    if (/^\d{4}-\d{2}-\d{2}\s+/.test(line)) headers.push(line);
  }

  const headerCount = new Map();
  for (const header of headers) {
    headerCount.set(header, (headerCount.get(header) || 0) + 1);
  }
  for (const [header, count] of headerCount.entries()) {
    if (count > 1) {
      errorCount += 1;
      print('error', file, `duplicate title "${header}" (${count} times)`);
    }
  }

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (/^\s*-\S/.test(line)) {
      errorCount += 1;
      print('error', file, `malformed bullet at line ${lineNo}: "${line}"`);
    }
    if (/^##\s+\[\d{4}-\d{2}-\d{2}\]/.test(line)) {
      errorCount += 1;
      print('error', file, `markdown date title style is not allowed at line ${lineNo}`);
    }
  });

  const longBullets = lines.filter((line) => /^\s*-\s/.test(line) && line.length > 120).length;
  if (longBullets > 0) {
    warnCount += 1;
    print('warn', file, `${longBullets} bullet lines are longer than 120 chars`);
  }
}

function main() {
  for (const relPath of files) {
    const fullPath = path.join(root, relPath);
    if (!fs.existsSync(fullPath)) {
      warnCount += 1;
      print('warn', relPath, 'file not found, skipped');
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    checkNulBytes(relPath, content);
    if (relPath === 'logs/development/Update.log') {
      checkUpdateLog(relPath, content);
    }
  }

  console.log(`\nAnnouncement check finished: ${errorCount} error(s), ${warnCount} warning(s).`);
  process.exitCode = errorCount > 0 ? 1 : 0;
}

main();

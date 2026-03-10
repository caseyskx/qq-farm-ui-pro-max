#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const targetFile = 'README.md';

let errorCount = 0;
let warnCount = 0;

function print(level, message) {
  const tag = level === 'error' ? 'ERROR' : 'WARN';
  console.log(`[${tag}] ${targetFile}: ${message}`);
}

function isExternalLink(link) {
  return /^(https?:)?\/\//.test(link) || link.startsWith('mailto:');
}

function normalizeTarget(rawTarget) {
  return rawTarget.split('#')[0].split('?')[0].trim();
}

function collectMarkdownTargets(content) {
  const targets = [];
  const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const target = match[1].trim();
    if (!target || target.startsWith('#') || isExternalLink(target)) {
      continue;
    }

    targets.push({
      raw: target,
      normalized: normalizeTarget(target),
    });
  }

  return targets;
}

function main() {
  const fullPath = path.join(root, targetFile);
  if (!fs.existsSync(fullPath)) {
    print('error', 'file not found');
    process.exit(1);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('\u0000')) {
    errorCount += 1;
    print('error', 'contains NUL bytes');
  }

  const seen = new Set();
  for (const target of collectMarkdownTargets(content)) {
    if (!target.normalized || seen.has(target.normalized)) {
      continue;
    }
    seen.add(target.normalized);

    const resolved = path.resolve(root, target.normalized);
    if (!fs.existsSync(resolved)) {
      errorCount += 1;
      print('error', `missing local target "${target.normalized}"`);
      continue;
    }

    if (fs.statSync(resolved).isDirectory()) {
      warnCount += 1;
      print('warn', `target "${target.normalized}" is a directory, not a file`);
    }
  }

  console.log(`\nREADME link check finished: ${errorCount} error(s), ${warnCount} warning(s).`);
  process.exitCode = errorCount > 0 ? 1 : 0;
}

main();

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = [
  'README.md',
  'deploy/README.md',
  'deploy/README.cn.md',
  'docs/USER_MANUAL.md',
  'docs/DEPLOYMENT_SOP.md',
  'docs/DEPLOYMENT_PLAN.md',
  'docs/architecture/TECH_STACK.md',
  'docs/maintenance/SOP_DEVELOPMENT_RELEASE_DEPLOY.md',
  'docs/maintenance/DIRECTORY_README_TEMPLATE.md',
  'docs/deployment/README.md',
  'docs/deployment/archive/README.md',
  'docs/deployment/DEPLOYMENT.md',
  'docs/deployment/DOCKER-DEPLOYMENT.md',
  'docs/deployment/DOCKER-QUICK-REFERENCE.md',
  'docs/deployment/DOCKER_HUB_README.md',
  'docs/deployment/GHCR_README.md',
  'docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md',
  'docs/dev-notes/ANNOUNCEMENT_HISTORY_CONSOLIDATION_2026-03-09.md',
  'assets/screenshots/README_IMAGES.md',
  '.github/pull_request_template.md',
];

const deprecatedPatternFiles = new Set([
  'README.md',
  'deploy/README.md',
  'deploy/README.cn.md',
  'docs/USER_MANUAL.md',
  'docs/DEPLOYMENT_SOP.md',
  'docs/DEPLOYMENT_PLAN.md',
  'docs/architecture/TECH_STACK.md',
  'docs/maintenance/SOP_DEVELOPMENT_RELEASE_DEPLOY.md',
  'docs/maintenance/DIRECTORY_README_TEMPLATE.md',
  'docs/deployment/README.md',
  'docs/deployment/DEPLOYMENT.md',
  'docs/deployment/DOCKER-DEPLOYMENT.md',
  'docs/deployment/DOCKER-QUICK-REFERENCE.md',
  'docs/deployment/DOCKER_HUB_README.md',
  'docs/deployment/GHCR_README.md',
  '.github/pull_request_template.md',
]);

const deprecatedPatterns = [
  {
    level: 'error',
    pattern: /raw\.githubusercontent\.com\/smdk000\/qq-farm-ui-pro-max\/main\/scripts\/deploy-(arm|x86)\.sh/g,
    message: 'uses deprecated raw deploy wrapper path, replace with main/scripts/deploy/deploy-*.sh',
  },
  {
    level: 'error',
    pattern: /raw\.githubusercontent\.com\/smdk000\/qq-farm-bot-ui\/main\/scripts\/deploy-(arm|x86)\.sh/g,
    message: 'uses deprecated old-repo deploy wrapper path, replace with qq-farm-ui-pro-max/main/scripts/deploy/deploy-*.sh',
  },
  {
    level: 'error',
    pattern: /ghcr\.io\/smdk000\/qq-farm-bot-ui/g,
    message: 'uses deprecated GHCR image name, replace with ghcr.io/smdk000/qq-farm-ui-pro-max',
  },
  {
    level: 'error',
    pattern: /docker-compose\.prod\.yml/g,
    message: 'uses deprecated compose filename, replace with deploy/docker-compose.yml or current deploy path',
  },
  {
    level: 'warn',
    pattern: /qq-farm-bot-ui-main_副本/g,
    message: 'contains machine-specific workspace path sample, replace with /path/to/qq-farm-ui-pro-max',
  },
];

let errorCount = 0;
let warnCount = 0;

function print(level, file, message) {
  const tag = level === 'error' ? 'ERROR' : 'WARN';
  console.log(`[${tag}] ${file}: ${message}`);
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

    targets.push(normalizeTarget(target));
  }

  return targets;
}

function checkFile(relPath) {
  const fullPath = path.join(root, relPath);
  if (!fs.existsSync(fullPath)) {
    errorCount += 1;
    print('error', relPath, 'file not found');
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes('\u0000')) {
    errorCount += 1;
    print('error', relPath, 'contains NUL bytes');
  }

  if (deprecatedPatternFiles.has(relPath)) {
    for (const rule of deprecatedPatterns) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(content)) {
        continue;
      }

      if (rule.level === 'error') {
        errorCount += 1;
        print('error', relPath, rule.message);
      }
      else {
        warnCount += 1;
        print('warn', relPath, rule.message);
      }
    }
  }

  const fileDir = path.dirname(fullPath);
  const seen = new Set();
  for (const target of collectMarkdownTargets(content)) {
    if (!target || seen.has(target)) {
      continue;
    }
    seen.add(target);

    const resolved = path.resolve(fileDir, target);
    if (!fs.existsSync(resolved)) {
      errorCount += 1;
      print('error', relPath, `missing local target "${target}"`);
      continue;
    }

    if (fs.statSync(resolved).isDirectory()) {
      warnCount += 1;
      print('warn', relPath, `target "${target}" is a directory, not a file`);
    }
  }
}

function main() {
  for (const relPath of files) {
    checkFile(relPath);
  }

  console.log(`\nDoc link check finished: ${errorCount} error(s), ${warnCount} warning(s).`);
  process.exitCode = errorCount > 0 ? 1 : 0;
}

main();

#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generate changelog entries using Claude Code CLI
 * Analyzes commits since last release and updates all changelog files
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(color, msg) {
  console.log(`${color}${msg}${RESET}`);
}

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function main() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const version = packageJson.version;
  const date = new Date().toISOString().split('T')[0];

  // Get previous release tag
  let prevTag = exec('git describe --tags --abbrev=0 HEAD^ 2>/dev/null');

  let commits;
  if (!prevTag) {
    log(YELLOW, 'No previous tag found, using recent commits');
    commits = exec('git log --oneline --no-merges -20');
  } else {
    log(CYAN, `Generating changelog from ${prevTag} to v${version}`);
    commits = exec(`git log --oneline --no-merges ${prevTag}..HEAD`);
  }

  if (!commits) {
    log(YELLOW, 'No commits found since last release');
    process.exit(0);
  }

  log(CYAN, 'Commits to analyze:');
  console.log(commits);
  console.log('');

  // Create prompt for Claude
  const prompt = `Analyze these git commits and generate a concise changelog entry for version ${version}.

Commits:
${commits}

Requirements:
1. Group related changes together
2. Use past tense (Added, Fixed, Updated, etc.)
3. Be concise - max 1 line per item
4. Focus on user-facing changes
5. Skip merge commits and version bumps
6. Format as markdown bullet points (- item)

Output ONLY the bullet points, nothing else. Example format:
- Added feature X for better Y
- Fixed bug in Z component
- Updated dependencies to latest versions`;

  log(CYAN, 'Calling Claude Code CLI...');

  // Call Claude Code CLI
  let changelogItems;
  try {
    const result = spawnSync('claude', ['--print'], {
      input: prompt,
      encoding: 'utf8',
      timeout: 60000
    });
    changelogItems = result.stdout?.trim();
  } catch {
    changelogItems = '';
  }

  if (!changelogItems) {
    log(YELLOW, 'Claude CLI not available or no output. Using commit summary.');
    changelogItems = commits
      .split('\n')
      .map(line => `- ${line.replace(/^[a-f0-9]+ /, '')}`)
      .join('\n');
  }

  log(GREEN, 'Generated changelog:');
  console.log(changelogItems);
  console.log('');

  // Update CHANGELOG.md
  log(CYAN, 'Updating CHANGELOG.md...');
  const changelogPath = 'CHANGELOG.md';
  let changelog = fs.readFileSync(changelogPath, 'utf8');

  // Check if version already exists
  if (changelog.includes(`## [${version}]`)) {
    log(YELLOW, `Version ${version} already exists in CHANGELOG.md, skipping...`);
  } else {
    const changelogEntry = `## [${version}] - ${date}

${changelogItems}

`;
    // Insert after "All notable changes" line
    changelog = changelog.replace(
      /(All notable changes to Kubeli will be documented in this file\.\n\n)/,
      `$1${changelogEntry}`
    );
    fs.writeFileSync(changelogPath, changelog);
  }

  // Update changelog.mdx
  log(CYAN, 'Updating web/src/pages/changelog.mdx...');
  const mdxPath = 'web/src/pages/changelog.mdx';
  let mdx = fs.readFileSync(mdxPath, 'utf8');

  // Check if version already exists
  if (mdx.includes(`## v${version}`)) {
    log(YELLOW, `Version ${version} already exists in changelog.mdx, skipping...`);
  } else {
    const mdxEntry = `## v${version} <span class="text-sm font-normal text-neutral-400 ml-2">${date}</span>

${changelogItems}

`;
    // Insert after frontmatter (after second ---)
    const parts = mdx.split('---');
    if (parts.length >= 3) {
      mdx = `---${parts[1]}---\n\n${mdxEntry}${parts.slice(2).join('---').trimStart()}`;
      fs.writeFileSync(mdxPath, mdx);
    }
  }

  log(GREEN, 'Changelog generated successfully!');
  console.log('');

  // Output release notes for GitHub
  const releaseNotes = `## What's Changed

${changelogItems}

**Full Changelog**: https://github.com/atilladeniz/Kubeli/compare/${prevTag || 'initial'}...v${version}`;

  // Write release notes to temp file for Makefile to use
  fs.writeFileSync('.release-notes.md', releaseNotes);
  log(GREEN, 'Release notes written to .release-notes.md');
}

main().catch(console.error);

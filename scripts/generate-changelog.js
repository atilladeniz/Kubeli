#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generate changelog entries using Claude, Codex, or OpenCode CLI
 * Analyzes commits since last release and updates all changelog files
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const readline = require('readline');

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const MANUAL_PROMPT_PATH = '.changelog-ai-prompt.md';

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

function extractMarkdownBullets(output) {
  const bullets = [];

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (/^-\s+\S/.test(trimmed)) {
      bullets.push(trimmed);
    } else if (bullets.length > 0 && /^\s+\S/.test(line)) {
      bullets[bullets.length - 1] += ` ${trimmed}`;
    }
  }

  return bullets.join('\n');
}

function buildChangelogPrompt(version, commits) {
  return `# Task: Generate the Kubeli changelog for version ${version}

Create a concise changelog from the git commits below.

## Git commits

\`\`\`text
${commits}
\`\`\`

## Requirements

1. Group related changes together.
2. Use past tense (Added, Fixed, Updated, etc.).
3. Keep every item to a maximum of one line.
4. Focus on user-facing changes.
5. Skip merge commits and version bumps.
6. Format every item as a Markdown bullet beginning with \`- \`.

## Output contract

Return only the Markdown bullet points. Do not add a heading, explanation, greeting, or code fence.

Example:

- Added feature X for better Y
- Fixed bug in Z component
- Updated dependencies to their latest versions
`;
}

function readPastedResponse(input = process.stdin, output = process.stdout) {
  output.write('Paste the AI response below, then enter END on its own line:\n\n');

  return new Promise(resolve => {
    const lines = [];
    const rl = readline.createInterface({ input, terminal: false });
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve(lines.join('\n'));
    };

    rl.on('line', line => {
      if (line.trim() === 'END') {
        finish();
        rl.close();
        return;
      }
      lines.push(line);
    });
    rl.on('close', finish);
  });
}

async function requestManualChangelog(prompt, options = {}) {
  const {
    interactive = process.stdin.isTTY,
    readResponse = readPastedResponse,
    writeFile = fs.writeFileSync
  } = options;

  writeFile(MANUAL_PROMPT_PATH, prompt);
  log(YELLOW, `All AI CLIs failed. Manual prompt written to ${MANUAL_PROMPT_PATH}`);
  console.log(`\nCopy the prompt into an AI chat (show it with: cat ${MANUAL_PROMPT_PATH}).`);

  if (!interactive) return '';

  const response = await readResponse();
  const changelogItems = extractMarkdownBullets(response);
  if (!changelogItems) {
    log(YELLOW, 'The pasted response did not contain valid Markdown bullet points.');
  }
  return changelogItems;
}

function parseJsonLines(output, getText) {
  return output
    .split('\n')
    .filter(Boolean)
    .flatMap(line => {
      try {
        const text = getText(JSON.parse(line));
        return text ? [text] : [];
      } catch {
        return [];
      }
    })
    .join('\n');
}

const CHANGELOG_PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    args: [
      '--print',
      '--disable-slash-commands',
      '--tools',
      ''
    ],
    env: {
      CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1'
    },
    useStdin: true,
    parse: output => output
  },
  {
    id: 'codex',
    name: 'Codex',
    command: 'codex',
    args: ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '-'],
    useStdin: true,
    parse: output =>
      parseJsonLines(output, event =>
        event.type === 'item.completed' && event.item?.type === 'agent_message'
          ? event.item.text
          : ''
      )
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    command: 'opencode',
    args: prompt => ['run', '--pure', '--format', 'json', '--dir', os.tmpdir(), prompt],
    env: {
      OPENCODE_CONFIG_CONTENT: JSON.stringify({ permission: { '*': 'deny' } })
    },
    useStdin: false,
    parse: output =>
      parseJsonLines(output, event =>
        event.type === 'text' ? event.part?.text : ''
      )
  }
];

function failureReason(result) {
  if (result.error?.code === 'ETIMEDOUT') return 'timed out';
  if (result.error?.code === 'ENOENT') return 'CLI not installed';
  if (result.error) return result.error.message;
  if (result.status !== 0) return `exited with status ${result.status}`;
  return 'returned no valid changelog items';
}

function invokeProvider(provider, prompt, spawn = spawnSync) {
  const args = typeof provider.args === 'function' ? provider.args(prompt) : provider.args;
  const result = spawn(provider.command, args, {
    input: provider.useStdin ? prompt : undefined,
    encoding: 'utf8',
    timeout: 60000,
    env: provider.env ? { ...process.env, ...provider.env } : process.env
  });
  const parsedOutput = result.status === 0
    ? provider.parse(result.stdout?.trim() || '')
    : '';

  return {
    changelogItems: extractMarkdownBullets(parsedOutput),
    result
  };
}

function generateWithAiFallback(prompt, spawn = spawnSync) {
  for (const provider of CHANGELOG_PROVIDERS) {
    log(CYAN, `Calling ${provider.name} CLI...`);

    const { changelogItems, result } = invokeProvider(provider, prompt, spawn);

    if (changelogItems) {
      log(GREEN, `Generated changelog with ${provider.name}.`);
      return { changelogItems, provider: provider.name };
    }

    log(YELLOW, `${provider.name} unavailable (${failureReason(result)}). Trying next provider...`);
  }

  return { changelogItems: '', provider: null };
}

function dryRunProviders(providerId = '', spawn = spawnSync) {
  const normalizedId = providerId.trim().toLowerCase();
  const providers = normalizedId
    ? CHANGELOG_PROVIDERS.filter(provider => provider.id === normalizedId)
    : CHANGELOG_PROVIDERS;

  if (providers.length === 0) {
    throw new Error(
      `Unknown provider "${providerId}". Use claude, codex, or opencode.`
    );
  }

  log(CYAN, `Testing ${providers.map(provider => provider.name).join(', ')}...`);
  console.log('No release or changelog files will be changed.\n');

  const results = providers.map(provider => {
    const prompt = `Return exactly this Markdown bullet and nothing else: - ${provider.name} provider OK`;
    const invocation = invokeProvider(provider, prompt, spawn);
    const passed = Boolean(invocation.changelogItems);

    if (passed) {
      log(GREEN, `✓ ${provider.name}: ${invocation.changelogItems}`);
    } else {
      log(YELLOW, `✗ ${provider.name}: ${failureReason(invocation.result)}`);
    }

    return { id: provider.id, passed };
  });

  console.log('');
  return results;
}

function dryRunFallback(spawn = spawnSync) {
  const prompt = 'Return exactly this Markdown bullet and nothing else: - Release fallback OK';
  console.log('No release or changelog files will be changed.\n');
  const generated = generateWithAiFallback(prompt, spawn);

  if (!generated.changelogItems) {
    throw new Error('No AI provider completed the fallback dry run.');
  }

  log(GREEN, `Fallback dry run passed with ${generated.provider}.`);
  return generated;
}

async function dryRunManualFallback(options = {}) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const commits = exec('git log --oneline --no-merges -20');
  const prompt = buildChangelogPrompt(packageJson.version, commits || 'No commits available');

  console.log('No release or changelog files will be changed.\n');
  const changelogItems = await requestManualChangelog(prompt, options);
  if (!changelogItems) {
    throw new Error('Manual changelog dry run did not receive valid Markdown bullet points.');
  }

  log(GREEN, 'Manual changelog dry run passed:');
  console.log(changelogItems);
  return changelogItems;
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

  // Create one portable prompt for both local CLIs and the manual chat fallback.
  const prompt = buildChangelogPrompt(version, commits);

  let { changelogItems } = generateWithAiFallback(prompt);

  if (!changelogItems) {
    changelogItems = await requestManualChangelog(prompt);
  }

  if (!changelogItems) {
    throw new Error(
      `Changelog generation stopped. Use ${MANUAL_PROMPT_PATH} in an AI chat, then rerun make release.`
    );
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

  // Update the changelog markdown (parsed at build by web/src/pages/changelog.astro)
  log(CYAN, 'Updating web/src/data/changelog.md...');
  const mdxPath = 'web/src/data/changelog.md';
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

if (require.main === module) {
  let command;
  if (process.argv.includes('--dry-run')) {
    command = Promise.resolve().then(() => {
      const results = dryRunProviders(process.env.PROVIDER || '');
      if (results.some(result => !result.passed)) {
        throw new Error('One or more AI provider checks failed.');
      }
      log(GREEN, 'All selected AI provider checks passed.');
    });
  } else if (process.argv.includes('--fallback-dry-run')) {
    command = Promise.resolve().then(() => dryRunFallback());
  } else if (process.argv.includes('--manual-dry-run')) {
    command = dryRunManualFallback();
  } else {
    command = main();
  }

  command.catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  CHANGELOG_PROVIDERS,
  MANUAL_PROMPT_PATH,
  buildChangelogPrompt,
  dryRunFallback,
  dryRunManualFallback,
  dryRunProviders,
  extractMarkdownBullets,
  generateWithAiFallback,
  invokeProvider,
  parseJsonLines,
  readPastedResponse,
  requestManualChangelog
};

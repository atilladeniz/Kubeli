/* eslint-disable @typescript-eslint/no-require-imports */
/* global afterEach, beforeEach, describe, expect, it, jest */
const {
  MANUAL_PROMPT_PATH,
  buildChangelogPrompt,
  dryRunFallback,
  dryRunManualFallback,
  dryRunProviders,
  extractMarkdownBullets,
  generateWithAiFallback,
  readPastedResponse,
  requestManualChangelog
} = require('../generate-changelog');
const { PassThrough } = require('stream');

function result({ status = 0, stdout = '', error } = {}) {
  return { status, stdout, stderr: '', error };
}

describe('generateWithAiFallback', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('uses Codex when Claude fails, including limit-related failures', () => {
    const spawn = jest
      .fn()
      .mockReturnValueOnce(result({ status: 1, stdout: 'Usage limit reached' }))
      .mockReturnValueOnce(result({
        stdout: JSON.stringify({
          type: 'item.completed',
          item: { type: 'agent_message', text: '- Added Codex fallback' }
        })
      }));

    const generated = generateWithAiFallback('prompt', spawn);

    expect(generated).toEqual({
      changelogItems: '- Added Codex fallback',
      provider: 'Codex'
    });
    expect(spawn.mock.calls.map(call => call[0])).toEqual(['claude', 'codex']);
  });

  it('uses OpenCode when Claude and Codex fail', () => {
    const spawn = jest
      .fn()
      .mockReturnValueOnce(result({ status: 1 }))
      .mockReturnValueOnce(result({ status: 1 }))
      .mockReturnValueOnce(result({
        stdout: JSON.stringify({ type: 'text', part: { text: '- Fixed release generation' } })
      }));

    const generated = generateWithAiFallback('prompt', spawn);

    expect(generated.provider).toBe('OpenCode');
    expect(generated.changelogItems).toBe('- Fixed release generation');
    expect(spawn.mock.calls.map(call => call[0])).toEqual(['claude', 'codex', 'opencode']);
  });

  it('stops after the first valid provider response', () => {
    const spawn = jest.fn().mockReturnValue(result({ stdout: '- Added a feature' }));

    expect(generateWithAiFallback('prompt', spawn).provider).toBe('Claude Code');
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0][1]).toEqual([
      '--print',
      '--disable-slash-commands',
      '--tools',
      ''
    ]);
    expect(spawn.mock.calls[0][2].env.CLAUDE_CODE_SKIP_PROMPT_HISTORY).toBe('1');
  });

  it('denies all OpenCode tools through its inline runtime config', () => {
    const spawn = jest
      .fn()
      .mockReturnValueOnce(result({ status: 1 }))
      .mockReturnValueOnce(result({ status: 1 }))
      .mockReturnValueOnce(result({
        stdout: JSON.stringify({ type: 'text', part: { text: '- Added safe fallback' } })
      }));

    generateWithAiFallback('prompt', spawn);

    const openCodeOptions = spawn.mock.calls[2][2];
    expect(JSON.parse(openCodeOptions.env.OPENCODE_CONFIG_CONTENT)).toEqual({
      permission: { '*': 'deny' }
    });
  });

  it('rejects non-bullet output so limit messages trigger fallback', () => {
    expect(extractMarkdownBullets('Usage limit reached')).toBe('');
    expect(extractMarkdownBullets('Here you go:\n- Added a feature\nThanks')).toBe('- Added a feature');
  });

  it('joins indented continuation lines from pasted chat output', () => {
    const pasted = `  - Fixed memory leaks, race conditions, and error handling in the
    frontend
  - Virtualized resource tables, log viewers, and AI chat components to improve
    rendering efficiency`;

    expect(extractMarkdownBullets(pasted)).toBe(
      '- Fixed memory leaks, race conditions, and error handling in the frontend\n' +
      '- Virtualized resource tables, log viewers, and AI chat components to improve rendering efficiency'
    );
  });
});

describe('dryRunProviders', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('tests the real fallback chain without requiring every provider to pass', () => {
    const spawn = jest
      .fn()
      .mockReturnValueOnce(result({ status: 1 }))
      .mockReturnValueOnce(result({
        stdout: JSON.stringify({
          type: 'item.completed',
          item: { type: 'agent_message', text: '- Release fallback OK' }
        })
      }));

    expect(dryRunFallback(spawn)).toEqual({
      changelogItems: '- Release fallback OK',
      provider: 'Codex'
    });
    expect(spawn.mock.calls.map(call => call[0])).toEqual(['claude', 'codex']);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('checks all providers independently with their production parsers', () => {
    const spawn = jest.fn(command => {
      if (command === 'claude') return result({ stdout: '- Claude provider OK' });
      if (command === 'codex') {
        return result({
          stdout: JSON.stringify({
            type: 'item.completed',
            item: { type: 'agent_message', text: '- Codex provider OK' }
          })
        });
      }
      return result({
        stdout: JSON.stringify({
          type: 'text',
          part: { text: '- OpenCode provider OK' }
        })
      });
    });

    expect(dryRunProviders('', spawn)).toEqual([
      { id: 'claude', passed: true },
      { id: 'codex', passed: true },
      { id: 'opencode', passed: true }
    ]);
    expect(spawn.mock.calls.map(call => call[0])).toEqual(['claude', 'codex', 'opencode']);
  });

  it('can test one provider and rejects unknown provider names', () => {
    const spawn = jest.fn().mockReturnValue(result({
      stdout: JSON.stringify({
        type: 'item.completed',
        item: { type: 'agent_message', text: '- Codex provider OK' }
      })
    }));

    expect(dryRunProviders('codex', spawn)).toEqual([{ id: 'codex', passed: true }]);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(() => dryRunProviders('unknown', spawn)).toThrow(
      'Unknown provider "unknown". Use claude, codex, or opencode.'
    );
  });
});

describe('manual changelog fallback', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('creates an LLM-friendly Markdown prompt', () => {
    const prompt = buildChangelogPrompt('1.2.3', 'abc123 Added release fallback');

    expect(prompt).toContain('# Task: Generate the Kubeli changelog for version 1.2.3');
    expect(prompt).toContain('```text\nabc123 Added release fallback\n```');
    expect(prompt).toContain('Return only the Markdown bullet points');
    expect(prompt).toContain('Never wrap or continue a bullet on the next line');
    expect(prompt).toContain('Do not infer or invent features');
    expect(prompt).toContain('Start every bullet at column 1');
  });

  it('writes the prompt and accepts a pasted multi-line response', async () => {
    const writeFile = jest.fn();
    const readResponse = jest.fn().mockResolvedValue(
      'Here is the changelog:\n- Added manual AI fallback\n- Fixed release flow'
    );

    const changelogItems = await requestManualChangelog('prompt contents', {
      interactive: true,
      readResponse,
      writeFile
    });

    expect(writeFile).toHaveBeenCalledWith(MANUAL_PROMPT_PATH, 'prompt contents');
    expect(changelogItems).toBe('- Added manual AI fallback\n- Fixed release flow');
  });

  it('reads pasted terminal lines until the END marker', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const responsePromise = readPastedResponse(input, output);

    input.end('- Added terminal fallback\n- Fixed formatting\nEND\nignored');

    await expect(responsePromise).resolves.toBe(
      '- Added terminal fallback\n- Fixed formatting'
    );
  });

  it('writes the prompt but does not wait without an interactive terminal', async () => {
    const writeFile = jest.fn();
    const readResponse = jest.fn();

    await expect(requestManualChangelog('prompt contents', {
      interactive: false,
      readResponse,
      writeFile
    })).resolves.toBe('');
    expect(writeFile).toHaveBeenCalledWith(MANUAL_PROMPT_PATH, 'prompt contents');
    expect(readResponse).not.toHaveBeenCalled();
  });

  it('dry-runs the copy and paste flow without updating changelog files', async () => {
    const writeFile = jest.fn();
    const readResponse = jest.fn().mockResolvedValue('- Added pasted changelog entry');

    await expect(dryRunManualFallback({
      interactive: true,
      readResponse,
      writeFile
    })).resolves.toBe('- Added pasted changelog entry');
    expect(writeFile.mock.calls[0][0]).toBe(MANUAL_PROMPT_PATH);
  });
});

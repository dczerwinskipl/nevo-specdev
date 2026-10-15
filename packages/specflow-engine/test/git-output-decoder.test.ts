import { describe, expect, it } from 'vitest';

import { GitOutputDecoder } from '../src/git/output-decoder';

describe('Git subprocess UTF-8 output decoding', () => {
  it('reconstructs multibyte characters split into individual bytes on each stream', () => {
    const result = new GitOutputDecoder();
    const stdout = Buffer.from('worktree /tmp/Żółć 🍀\0HEAD abc\0', 'utf8');
    const stderr = Buffer.from('Błąd: zażółć gęślą jaźń', 'utf8');

    for (let i = 0; i < Math.max(stdout.length, stderr.length); i++) {
      if (i < stdout.length) result.write('stdout', stdout.subarray(i, i + 1));
      if (i < stderr.length) result.write('stderr', stderr.subarray(i, i + 1));
    }

    expect(result.finish()).toEqual({
      stdout: 'worktree /tmp/Żółć 🍀\0HEAD abc\0',
      stderr: 'Błąd: zażółć gęślą jaźń',
    });
  });

  it('flushes an incomplete final sequence only when the stream ends', () => {
    const result = new GitOutputDecoder();
    result.write('stdout', Buffer.from([0xc5]));
    result.write('stderr', Buffer.from('Ż', 'utf8'));
    expect(result.finish()).toEqual({ stdout: '�', stderr: 'Ż' });
  });
});

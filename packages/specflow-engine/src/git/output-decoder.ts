import { StringDecoder } from 'node:string_decoder';

/** Reconstruct Git stdout/stderr without corrupting split UTF-8 code points. */
export class GitOutputDecoder {
  private readonly stdoutDecoder = new StringDecoder('utf8');
  private readonly stderrDecoder = new StringDecoder('utf8');
  private stdout = '';
  private stderr = '';

  write(channel: 'stdout' | 'stderr', chunk: Buffer): void {
    if (channel === 'stdout') {
      this.stdout += this.stdoutDecoder.write(chunk);
    } else {
      this.stderr += this.stderrDecoder.write(chunk);
    }
  }

  /** Called after both streams close; flushes any incomplete final sequence. */
  finish(): { readonly stdout: string; readonly stderr: string } {
    return {
      stdout: this.stdout + this.stdoutDecoder.end(),
      stderr: this.stderr + this.stderrDecoder.end(),
    };
  }
}

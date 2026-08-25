export type PlaybackResult = 'completed' | 'failed' | 'cancelled';

export interface PlaybackFailure {
  source: string;
  reason: unknown;
}

export interface SpeechPlaybackOptions {
  clipTimeoutMs?: number;
  onFailure?: (failure: PlaybackFailure) => void;
}

const DEFAULT_CLIP_TIMEOUT_MS = 15_000;

export class SpeechPlayback {
  private readonly audio: HTMLAudioElement;
  private readonly clipTimeoutMs: number;
  private readonly onFailure: (failure: PlaybackFailure) => void;
  private cancelActiveClip: (() => void) | null = null;
  private currentSource: string | null = null;
  private sourceNeedsReload = false;
  private sequence = 0;

  constructor(audio: HTMLAudioElement, options: SpeechPlaybackOptions = {}) {
    this.audio = audio;
    this.audio.preload = 'auto';
    this.clipTimeoutMs = options.clipTimeoutMs ?? DEFAULT_CLIP_TIMEOUT_MS;
    this.onFailure =
      options.onFailure ??
      ((failure) => {
        console.warn('Speech clip failed; continuing without it.', failure);
      });
  }

  stop(): void {
    this.sequence += 1;

    const cancel = this.cancelActiveClip;
    this.cancelActiveClip = null;
    cancel?.();

    this.audio.pause();
    this.resetCurrentTime();
  }

  preload(source: string): void {
    this.stop();

    if (this.currentSource === source && !this.sourceNeedsReload) {
      return;
    }

    try {
      this.audio.src = source;
      this.currentSource = source;
      this.sourceNeedsReload = false;
      this.audio.load();
    } catch (reason) {
      this.sourceNeedsReload = true;
      this.reportFailure({ source, reason });
    }
  }

  play(source: string): Promise<PlaybackResult> {
    return this.playSequence([source]);
  }

  async playSequence(sources: readonly string[]): Promise<PlaybackResult> {
    this.stop();
    const sequence = this.sequence;
    let anyClipFailed = false;

    for (const source of sources) {
      const result = await this.playClip(source, sequence);

      if (result === 'cancelled' || sequence !== this.sequence) {
        return 'cancelled';
      }

      if (result === 'failed') {
        anyClipFailed = true;
      }
    }

    return anyClipFailed ? 'failed' : 'completed';
  }

  private playClip(source: string, sequence: number): Promise<PlaybackResult> {
    if (sequence !== this.sequence) {
      return Promise.resolve('cancelled');
    }

    this.audio.pause();
    this.resetCurrentTime();

    return new Promise((resolve) => {
      let settled = false;
      let sourceLoadStarted = this.currentSource === source && !this.sourceNeedsReload;
      let watchdog: ReturnType<typeof setTimeout> | null = null;

      const finish = (result: PlaybackResult, reason?: unknown): void => {
        if (settled) {
          return;
        }

        settled = true;
        if (watchdog !== null) {
          clearTimeout(watchdog);
        }
        this.audio.removeEventListener('loadstart', handleLoadStart);
        this.audio.removeEventListener('ended', handleEnded);
        this.audio.removeEventListener('error', handleError);
        this.audio.removeEventListener('abort', handleAbort);
        this.audio.removeEventListener('pause', handlePause);

        if (this.cancelActiveClip === cancel) {
          this.cancelActiveClip = null;
        }

        if (result === 'failed') {
          this.sourceNeedsReload = true;
          this.audio.pause();
          this.resetCurrentTime();
          this.reportFailure({ source, reason });
        }

        resolve(result);
      };
      const handleLoadStart = (): void => {
        sourceLoadStarted = true;
      };
      const handleEnded = (): void => {
        // A queued event from a superseded source must not finish the new clip.
        if (this.audio.ended) {
          finish('completed');
        }
      };
      const handleError = (): void => {
        // Changing src clears MediaError. Ignore an old queued error after a
        // superseding clip has already started on this persistent element.
        if (this.audio.error !== null) {
          finish('failed', this.audio.error);
        }
      };
      const handleAbort = (): void => {
        if (sourceLoadStarted) {
          finish('failed', 'media load aborted');
        }
      };
      const handlePause = (): void => {
        // A pause queued by stop() can arrive after the replacement clip has
        // begun. In that case paused is already false and the event is stale.
        if (this.audio.paused && !this.audio.ended) {
          finish('failed', 'playback interrupted');
        }
      };
      const cancel = (): void => finish('cancelled');

      this.audio.addEventListener('loadstart', handleLoadStart);
      this.audio.addEventListener('ended', handleEnded);
      this.audio.addEventListener('error', handleError);
      this.audio.addEventListener('abort', handleAbort);
      this.audio.addEventListener('pause', handlePause);
      this.cancelActiveClip = cancel;

      watchdog = setTimeout(() => {
        finish('failed', `playback did not finish within ${this.clipTimeoutMs}ms`);
      }, this.clipTimeoutMs);

      try {
        if (this.currentSource !== source || this.sourceNeedsReload) {
          sourceLoadStarted = false;
          this.audio.src = source;
          this.currentSource = source;
          this.sourceNeedsReload = false;
          this.audio.load();
        }

        const playAttempt = this.audio.play();
        if (playAttempt) {
          void playAttempt.catch((reason) => finish('failed', reason));
        }
      } catch (reason) {
        finish('failed', reason);
      }
    });
  }

  private resetCurrentTime(): void {
    try {
      this.audio.currentTime = 0;
    } catch {
      // Some WebKit media states reject seeking before metadata is available.
    }
  }

  private reportFailure(failure: PlaybackFailure): void {
    try {
      this.onFailure(failure);
    } catch (loggingError) {
      console.error('Speech failure logging also failed.', loggingError);
    }
  }
}

export function chooseNonRepeatingIndex(
  itemCount: number,
  previousIndex: number | null,
  random: () => number = Math.random
): number {
  if (!Number.isInteger(itemCount) || itemCount < 1) {
    throw new Error('At least one item is required.');
  }

  const choices = Array.from({ length: itemCount }, (_, index) => index).filter(
    (index) => itemCount === 1 || index !== previousIndex
  );
  return choices[Math.floor(random() * choices.length)];
}

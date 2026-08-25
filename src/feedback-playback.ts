import type { PlaybackResult, SpeechPlayback } from './audio-playback.ts';

export async function runCorrectAnswerFeedback(
  playback: SpeechPlayback,
  sources: readonly [identification: string, praise: string],
  isCurrent: () => boolean,
  advance: () => void
): Promise<PlaybackResult> {
  const result = await playback.playSequence(sources);

  if (result !== 'cancelled' && isCurrent()) {
    advance();
  }

  return result;
}

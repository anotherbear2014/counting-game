import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SpeechPlayback, chooseNonRepeatingIndex } from '../src/audio-playback.ts';
import { runCorrectAnswerFeedback } from '../src/feedback-playback.ts';

const numberWords = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten'
];

class FakeAudio {
  constructor() {
    this.preload = 'none';
    this.currentTime = 0;
    this.paused = true;
    this.ended = false;
    this.error = null;
    this.listeners = new Map();
    this.playBehaviors = new Map();
    this.playedSources = [];
    this.loadedSources = [];
    this.activePlayCount = 0;
    this._src = '';
  }

  get src() {
    return this._src;
  }

  set src(source) {
    this._src = source;
    this.ended = false;
    this.error = null;
  }

  setPlayBehavior(source, behavior) {
    this.playBehaviors.set(source, behavior);
  }

  load() {
    this.loadedSources.push(this.src);
    this.dispatch('loadstart');
  }

  play() {
    assert.equal(this.activePlayCount, 0, `Speech overlapped while starting ${this.src}.`);
    this.paused = false;
    this.ended = false;
    this.activePlayCount = 1;
    this.playedSources.push(this.src);

    const behavior = this.playBehaviors.get(this.src) ?? 'manual';
    if (behavior === 'reject') {
      this.paused = true;
      this.activePlayCount = 0;
      return Promise.reject(new Error(`play rejected for ${this.src}`));
    }
    if (behavior === 'throw') {
      this.paused = true;
      this.activePlayCount = 0;
      throw new Error(`play threw for ${this.src}`);
    }

    return behavior === 'pending' ? new Promise(() => {}) : Promise.resolve();
  }

  pause() {
    if (this.paused) {
      return;
    }

    this.paused = true;
    this.activePlayCount = 0;
    this.dispatch('pause');
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  finish() {
    this.ended = true;
    this.paused = true;
    this.activePlayCount = 0;
    this.dispatch('ended');
  }

  fail() {
    this.error = new Error(`media error for ${this.src}`);
    this.paused = true;
    this.activePlayCount = 0;
    this.dispatch('error');
  }

  interrupt() {
    this.pause();
  }

  dispatch(type) {
    const event = new Event(type);
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      if (typeof listener === 'function') {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    }
  }
}

function createPlayback(clipTimeoutMs = 100) {
  const audio = new FakeAudio();
  const failures = [];
  const playback = new SpeechPlayback(audio, {
    clipTimeoutMs,
    onFailure: (failure) => failures.push(failure)
  });
  return { audio, failures, playback };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

// Successful two-clip incorrect-answer sequencing.
{
  const { audio, playback } = createPlayback();
  const sequence = playback.playSequence(['thats-seven', 'try-again']);
  assert.deepEqual(audio.playedSources, ['thats-seven']);
  audio.finish();
  await flushPromises();
  assert.deepEqual(audio.playedSources, ['thats-seven', 'try-again']);
  audio.finish();
  assert.equal(await sequence, 'completed');
}

// Successful two-clip correct-answer sequencing.
{
  const { audio, playback } = createPlayback();
  const sequence = playback.playSequence(['yes-thats-ten', 'great-job']);
  assert.deepEqual(audio.playedSources, ['yes-thats-ten']);
  audio.finish();
  await flushPromises();
  assert.deepEqual(audio.playedSources, ['yes-thats-ten', 'great-job']);
  audio.finish();
  assert.equal(await sequence, 'completed');
}

// A rejected second play call resolves as failed instead of hanging.
{
  const { audio, failures, playback } = createPlayback();
  audio.setPlayBehavior('great-job', 'reject');
  const sequence = playback.playSequence(['yes-thats-four', 'great-job']);
  audio.finish();
  assert.equal(await sequence, 'failed');
  assert.equal(failures.length, 1);
  assert.deepEqual(audio.playedSources, ['yes-thats-four', 'great-job']);
}

// A media error during the second clip resolves as failed.
{
  const { audio, failures, playback } = createPlayback();
  const sequence = playback.playSequence(['yes-thats-six', 'thats-right']);
  audio.finish();
  await flushPromises();
  audio.fail();
  assert.equal(await sequence, 'failed');
  assert.equal(failures.length, 1);
}

// A first-clip failure does not prevent the second clip from being attempted.
{
  const { audio, playback } = createPlayback();
  const sequence = playback.playSequence(['thats-two', 'try-again']);
  audio.fail();
  await flushPromises();
  assert.deepEqual(audio.playedSources, ['thats-two', 'try-again']);
  audio.finish();
  assert.equal(await sequence, 'failed');
}

// Cancellation settles the old sequence and prevents its next clip.
{
  const { audio, playback } = createPlayback();
  const sequence = playback.playSequence(['thats-three', 'try-again']);
  playback.stop();
  assert.equal(await sequence, 'cancelled');
  assert.deepEqual(audio.playedSources, ['thats-three']);
  assert.equal(audio.paused, true);
}

// An interrupted clip is a failure, not an unresolved wait.
{
  const { audio, playback } = createPlayback();
  const sequence = playback.play('opening-dialogue');
  audio.interrupt();
  assert.equal(await sequence, 'failed');
}

// Even a play promise with no resolution and no media events is bounded.
{
  const { audio, failures, playback } = createPlayback(10);
  audio.setPlayBehavior('stalled-clip', 'pending');
  assert.equal(await playback.play('stalled-clip'), 'failed');
  assert.equal(failures.length, 1);
}

// Correct-answer state advances after failed Dad praise.
{
  const { audio, playback } = createPlayback();
  audio.setPlayBehavior('great-job', 'reject');
  let phase = 'reinforcement';
  let advances = 0;
  const feedback = runCorrectAnswerFeedback(
    playback,
    ['yes-thats-four', 'great-job'],
    () => phase === 'reinforcement',
    () => {
      advances += 1;
      phase = 'question';
    }
  );
  audio.finish();
  assert.equal(await feedback, 'failed');
  assert.equal(advances, 1);
  assert.equal(phase, 'question');
}

// Failed incorrect feedback leaves the question usable for new playback.
{
  const { audio, playback } = createPlayback();
  let phase = 'question';
  audio.setPlayBehavior('thats-five', 'reject');
  const failedFeedback = playback.playSequence(['thats-five', 'try-again']);
  await flushPromises();
  audio.finish();
  assert.equal(await failedFeedback, 'failed');
  assert.equal(phase, 'question');

  const nextAttempt = playback.play('thats-six');
  audio.finish();
  assert.equal(await nextAttempt, 'completed');
  assert.equal(phase, 'question');
}

// Superseding playback cannot overlap or let stale completion start an old clip.
{
  const { audio, playback } = createPlayback();
  const staleSequence = playback.playSequence(['old-identification', 'old-praise']);
  const currentSequence = playback.play('current-feedback');
  assert.equal(await staleSequence, 'cancelled');
  assert.deepEqual(audio.playedSources, ['old-identification', 'current-feedback']);

  audio.ended = false;
  audio.dispatch('ended');
  await flushPromises();
  assert.deepEqual(audio.playedSources, ['old-identification', 'current-feedback']);
  audio.finish();
  assert.equal(await currentSequence, 'completed');
  assert.equal(audio.playedSources.includes('old-praise'), false);
}

// Preloading prepares the first expected clip without creating another player.
{
  const { audio, playback } = createPlayback();
  playback.preload('yes-thats-nine');
  assert.deepEqual(audio.loadedSources, ['yes-thats-nine']);
  const sequence = playback.play('yes-thats-nine');
  assert.deepEqual(audio.loadedSources, ['yes-thats-nine']);
  audio.finish();
  assert.equal(await sequence, 'completed');
}

const randomValues = [0.02, 0.31, 0.67, 0.98];
let randomIndex = 0;
let previousIndex = null;
const selectedIndices = new Set();
for (let selection = 0; selection < 30; selection += 1) {
  const nextIndex = chooseNonRepeatingIndex(3, previousIndex, () => {
    const value = randomValues[randomIndex % randomValues.length];
    randomIndex += 1;
    return value;
  });
  assert.notEqual(nextIndex, previousIndex, 'Correct phrases must not repeat consecutively.');
  selectedIndices.add(nextIndex);
  previousIndex = nextIndex;
}
assert.deepEqual(selectedIndices, new Set([0, 1, 2]));

const audioRoot = join(process.cwd(), 'src/assets/audio');
const expectedFiles = [
  join(audioRoot, 'number-exploration/opening-dialogue.wav'),
  ...numberWords.map((word) => join(audioRoot, `number-exploration/${word}.wav`)),
  join(audioRoot, 'feedback/correct/good-work.wav'),
  join(audioRoot, 'feedback/correct/great-job.wav'),
  join(audioRoot, 'feedback/correct/thats-right.wav'),
  join(audioRoot, 'feedback/incorrect/try-again.wav'),
  ...numberWords.map((word) =>
    join(audioRoot, `feedback/incorrect/machine/thats-${word}.wav`)
  ),
  ...numberWords.map((word) =>
    join(audioRoot, `feedback/correct/machine/yes-thats-${word}.wav`)
  )
];

for (const file of expectedFiles) {
  const wave = readFileSync(file);
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF', file);
  assert.equal(wave.toString('ascii', 8, 12), 'WAVE', file);
  assert.equal(wave.readUInt16LE(22), 1, `${file} must be mono.`);
  assert.equal(wave.readUInt32LE(24), 48_000, `${file} must use 48 kHz audio.`);
  assert.equal(wave.readUInt16LE(34), 16, `${file} must use 16-bit PCM.`);
}

const mainSource = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8');
assert.doesNotMatch(mainSource, /how-many-(?:horses|rabbits|apples|carrots)/);
assert.doesNotMatch(mainSource, /setTimeout\s*\(/);
assert.match(mainSource, /'reinforcement'/);
assert.equal(
  mainSource.match(/new Audio\s*\(/g)?.length,
  1,
  'The application must create exactly one persistent audio element.'
);
assert.match(mainSource, /play\(explorationIntroUrl\)/, 'Start must play the real opening dialogue.');
for (const word of numberWords) {
  assert.match(mainSource, new RegExp(`thats-${word}\\.wav`));
  assert.match(mainSource, new RegExp(`yes-thats-${word}\\.wav`));
  assert.match(mainSource, new RegExp(`number-exploration/${word}\\.wav`));
}

console.log(
  `Persistent audio playback recovery, game-state continuation, non-repeating feedback, and ${expectedFiles.length} local WAV files passed validation.`
);

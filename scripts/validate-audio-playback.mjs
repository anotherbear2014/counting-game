import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SpeechPlayback, chooseNonRepeatingIndex } from '../src/audio-playback.ts';

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
  constructor(name, activeSounds) {
    this.name = name;
    this.activeSounds = activeSounds;
    this.currentTime = 0;
    this.paused = true;
    this.playCount = 0;
    this.pauseCount = 0;
    this.listeners = new Map();
  }

  play() {
    this.paused = false;
    this.playCount += 1;
    this.activeSounds.add(this.name);
    assert.equal(this.activeSounds.size, 1, `Speech overlapped while starting ${this.name}.`);
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.pauseCount += 1;
    this.activeSounds.delete(this.name);
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
    this.paused = true;
    this.activeSounds.delete(this.name);
    for (const listener of [...(this.listeners.get('ended') ?? [])]) {
      if (typeof listener === 'function') {
        listener(new Event('ended'));
      } else {
        listener.handleEvent(new Event('ended'));
      }
    }
  }
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

const activeSounds = new Set();
const playback = new SpeechPlayback();
const identification = new FakeAudio('thats-seven', activeSounds);
const tryAgain = new FakeAudio('try-again', activeSounds);
const incorrectSequence = playback.playSequence([identification, tryAgain]);

assert.equal(identification.playCount, 1);
assert.equal(tryAgain.playCount, 0, 'Try again must wait for the numeral identification.');
identification.finish();
await flushPromises();
assert.equal(tryAgain.playCount, 1, 'Try again should start after the identification ends.');
tryAgain.finish();
assert.equal(await incorrectSequence, true);

const firstIdentification = new FakeAudio('thats-two', activeSounds);
const canceledTryAgain = new FakeAudio('canceled-try-again', activeSounds);
const supersedingSpeech = new FakeAudio('positive-feedback', activeSounds);
const canceledSequence = playback.playSequence([firstIdentification, canceledTryAgain]);
playback.play(supersedingSpeech);
await flushPromises();
assert.equal(firstIdentification.paused, true);
assert.equal(canceledTryAgain.playCount, 0, 'A superseded sequence must not continue.');
assert.equal(supersedingSpeech.playCount, 1);
assert.equal(await canceledSequence, false);
supersedingSpeech.finish();

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
for (const word of numberWords) {
  assert.match(mainSource, new RegExp(`thats-${word}\\.wav`));
  assert.match(mainSource, new RegExp(`number-exploration/${word}\\.wav`));
}

console.log(
  `Audio playback sequencing, non-repeating feedback, and ${expectedFiles.length} local WAV files passed validation.`
);

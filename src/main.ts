import './styles.css';
import horseUrl from './assets/objects/horse.png';
import rabbitUrl from './assets/objects/rabbit.png';
import appleUrl from './assets/objects/apple.png';
import carrotUrl from './assets/objects/carrot.png';
import correctSoundUrl from './assets/audio/correct.wav';
import tryAgainSoundUrl from './assets/audio/try-again.wav';
import explorationIntroUrl from './assets/audio/number-exploration/intro.wav';
import oneUrl from './assets/audio/number-exploration/one.wav';
import twoUrl from './assets/audio/number-exploration/two.wav';
import threeUrl from './assets/audio/number-exploration/three.wav';
import fourUrl from './assets/audio/number-exploration/four.wav';
import fiveUrl from './assets/audio/number-exploration/five.wav';
import sixUrl from './assets/audio/number-exploration/six.wav';
import sevenUrl from './assets/audio/number-exploration/seven.wav';
import eightUrl from './assets/audio/number-exploration/eight.wav';
import nineUrl from './assets/audio/number-exploration/nine.wav';
import tenUrl from './assets/audio/number-exploration/ten.wav';
import { createSession, type ObjectKind, type Question } from './questions';

type GamePhase = 'start' | 'exploration' | 'question' | 'celebrating' | 'end';

function getAppRoot(): HTMLElement {
  const element = document.querySelector<HTMLElement>('#app');

  if (!element) {
    throw new Error('The application root was not found.');
  }

  return element;
}

const app = getAppRoot();

const objectImages: Record<ObjectKind, string> = {
  horse: horseUrl,
  rabbit: rabbitUrl,
  apple: appleUrl,
  carrot: carrotUrl
};

const correctSound = new Audio(correctSoundUrl);
const tryAgainSound = new Audio(tryAgainSoundUrl);
const explorationIntro = new Audio(explorationIntroUrl);
const numberSounds: Record<number, HTMLAudioElement> = {
  1: new Audio(oneUrl),
  2: new Audio(twoUrl),
  3: new Audio(threeUrl),
  4: new Audio(fourUrl),
  5: new Audio(fiveUrl),
  6: new Audio(sixUrl),
  7: new Audio(sevenUrl),
  8: new Audio(eightUrl),
  9: new Audio(nineUrl),
  10: new Audio(tenUrl)
};
correctSound.preload = 'auto';
tryAgainSound.preload = 'auto';
explorationIntro.preload = 'auto';
Object.values(numberSounds).forEach((sound) => {
  sound.preload = 'auto';
});

let questions: Question[] = [];
let questionIndex = 0;
let phase: GamePhase = 'start';
let explorationHasSelection = false;
let activeExplorationSound: HTMLAudioElement | null = null;

function playSound(sound: HTMLAudioElement): void {
  sound.pause();
  sound.currentTime = 0;
  void sound.play().catch(() => {
    // A muted device or browser policy may prevent playback; the game remains usable.
  });
}

function playExplorationSound(sound: HTMLAudioElement): void {
  if (activeExplorationSound && activeExplorationSound !== sound) {
    activeExplorationSound.pause();
    activeExplorationSound.currentTime = 0;
  }

  sound.pause();
  sound.currentTime = 0;
  activeExplorationSound = sound;
  void sound.play().catch(() => {
    if (activeExplorationSound === sound) {
      activeExplorationSound = null;
    }
  });
}

function stopExplorationSound(): void {
  if (!activeExplorationSound) {
    return;
  }

  activeExplorationSound.pause();
  activeExplorationSound.currentTime = 0;
  activeExplorationSound = null;
}

function renderStart(): void {
  phase = 'start';
  explorationHasSelection = false;
  app.innerHTML = `
    <section class="start-screen">
      <button class="start-button" type="button" data-start>Start</button>
    </section>`;
}

function renderExploration(): void {
  phase = 'exploration';
  explorationHasSelection = false;
  app.innerHTML = `
    <section class="exploration-screen" aria-label="Explore numbers">
      <div class="number-grid" aria-label="Choose a number">
        ${Array.from(
          { length: 10 },
          (_, index) => `
            <button
              class="number-button"
              type="button"
              data-explore-number="${index + 1}"
              aria-label="${index + 1}"
            >${index + 1}</button>`
        ).join('')}
      </div>
      <button
        class="start-arrow-button"
        type="button"
        data-start-counting
        aria-label="Start counting"
        hidden
      ><span aria-hidden="true">→</span></button>
    </section>`;
}

function startExploration(): void {
  if (phase !== 'start') {
    return;
  }

  renderExploration();
  playExplorationSound(explorationIntro);
}

function chooseExplorationNumber(number: number): void {
  if (phase !== 'exploration') {
    return;
  }

  const sound = numberSounds[number];
  if (!sound) {
    return;
  }

  playExplorationSound(sound);

  if (!explorationHasSelection) {
    explorationHasSelection = true;
    app.querySelector<HTMLButtonElement>('[data-start-counting]')?.removeAttribute('hidden');
  }
}

function startCounting(): void {
  if (phase !== 'exploration' || !explorationHasSelection) {
    return;
  }

  stopExplorationSound();
  questions = createSession();
  questionIndex = 0;
  phase = 'question';
  renderQuestion();
}

function renderObjects(question: Question): string {
  return question.positions
    .map(
      (position, index) => `
        <img
          class="counting-object"
          src="${objectImages[question.objectKind]}"
          alt=""
          draggable="false"
          style="--column: ${(position % 4) + 1}; --row: ${Math.floor(position / 4) + 1}; --tilt: ${
            ((position * 7 + index * 3) % 9) - 4
          }deg"
        />`
    )
    .join('');
}

function renderAnswers(question: Question, disabled: boolean): string {
  return question.choices
    .map(
      (choice) => `
        <button
          class="answer-button"
          type="button"
          data-answer="${choice}"
          ${disabled ? 'disabled' : ''}
          aria-label="${choice}"
        >${choice}</button>`
    )
    .join('');
}

function renderCelebration(): string {
  const destinations = [
    [-10, -150],
    [110, -105],
    [155, 20],
    [82, 130],
    [-72, 135],
    [-155, 30],
    [-115, -100]
  ];
  const stars = destinations
    .map(
      ([x, y], index) =>
        `<span style="--star: ${index}; --star-x: ${x}px; --star-y: ${y}px">★</span>`
    )
    .join('');
  return `<div class="celebration" aria-hidden="true">${stars}</div>`;
}

function renderQuestion(): void {
  const question = questions[questionIndex];
  const isCelebrating = phase === 'celebrating';

  app.innerHTML = `
    <section class="game-screen" aria-label="Counting question">
      <h1>How many?</h1>
      <div class="object-board" aria-hidden="true">
        ${renderObjects(question)}
      </div>
      <div class="answer-row" aria-label="Choose a number">
        ${renderAnswers(question, isCelebrating)}
      </div>
      ${isCelebrating ? renderCelebration() : ''}
    </section>`;
}

function renderEnd(): void {
  app.innerHTML = `
    <section class="end-screen">
      <h1>The End</h1>
      <button class="start-again-button" type="button" data-start-again>Start Again</button>
    </section>`;
}

function startAgain(): void {
  renderStart();
}

function chooseAnswer(answer: number): void {
  if (phase !== 'question') {
    return;
  }

  const question = questions[questionIndex];

  if (answer !== question.quantity) {
    playSound(tryAgainSound);
    return;
  }

  tryAgainSound.pause();
  playSound(correctSound);
  phase = 'celebrating';
  renderQuestion();

  window.setTimeout(() => {
    questionIndex += 1;

    if (questionIndex === questions.length) {
      phase = 'end';
      renderEnd();
      return;
    }

    phase = 'question';
    renderQuestion();
  }, 850);
}

app.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest('[data-start]')) {
    startExploration();
    return;
  }

  const explorationNumber = target.closest<HTMLButtonElement>('[data-explore-number]');
  if (explorationNumber) {
    chooseExplorationNumber(Number(explorationNumber.dataset.exploreNumber));
    return;
  }

  if (target.closest('[data-start-counting]')) {
    startCounting();
    return;
  }

  const answerButton = target.closest<HTMLButtonElement>('[data-answer]');
  if (answerButton) {
    chooseAnswer(Number(answerButton.dataset.answer));
    return;
  }

  if (target.closest('[data-start-again]')) {
    startAgain();
  }
});

renderStart();

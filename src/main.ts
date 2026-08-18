import './styles.css';
import horseUrl from './assets/objects/horse.png';
import rabbitUrl from './assets/objects/rabbit.png';
import appleUrl from './assets/objects/apple.png';
import carrotUrl from './assets/objects/carrot.png';
import correctSoundUrl from './assets/audio/correct.wav';
import tryAgainSoundUrl from './assets/audio/try-again.wav';
import { createSession, type ObjectKind, type Question } from './questions';

type GamePhase = 'question' | 'celebrating' | 'end';

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
correctSound.preload = 'auto';
tryAgainSound.preload = 'auto';

let questions = createSession();
let questionIndex = 0;
let phase: GamePhase = 'question';

function playSound(sound: HTMLAudioElement): void {
  sound.pause();
  sound.currentTime = 0;
  void sound.play().catch(() => {
    // A muted device or browser policy may prevent playback; the game remains usable.
  });
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
  questions = createSession();
  questionIndex = 0;
  phase = 'question';
  renderQuestion();
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

  const answerButton = target.closest<HTMLButtonElement>('[data-answer]');
  if (answerButton) {
    chooseAnswer(Number(answerButton.dataset.answer));
    return;
  }

  if (target.closest('[data-start-again]')) {
    startAgain();
  }
});

renderQuestion();

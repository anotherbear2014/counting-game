import './styles.css';
import { SpeechPlayback, chooseNonRepeatingIndex } from './audio-playback';
import { renderCelebration } from './celebration';
import { runCorrectAnswerFeedback } from './feedback-playback';
import horseUrl from './assets/objects/horse.png';
import rabbitUrl from './assets/objects/rabbit.png';
import appleUrl from './assets/objects/apple.png';
import carrotUrl from './assets/objects/carrot.png';
import goodWorkUrl from './assets/audio/feedback/correct/good-work.wav';
import greatJobUrl from './assets/audio/feedback/correct/great-job.wav';
import thatsRightUrl from './assets/audio/feedback/correct/thats-right.wav';
import yesThatsOneUrl from './assets/audio/feedback/correct/machine/yes-thats-one.wav';
import yesThatsTwoUrl from './assets/audio/feedback/correct/machine/yes-thats-two.wav';
import yesThatsThreeUrl from './assets/audio/feedback/correct/machine/yes-thats-three.wav';
import yesThatsFourUrl from './assets/audio/feedback/correct/machine/yes-thats-four.wav';
import yesThatsFiveUrl from './assets/audio/feedback/correct/machine/yes-thats-five.wav';
import yesThatsSixUrl from './assets/audio/feedback/correct/machine/yes-thats-six.wav';
import yesThatsSevenUrl from './assets/audio/feedback/correct/machine/yes-thats-seven.wav';
import yesThatsEightUrl from './assets/audio/feedback/correct/machine/yes-thats-eight.wav';
import yesThatsNineUrl from './assets/audio/feedback/correct/machine/yes-thats-nine.wav';
import yesThatsTenUrl from './assets/audio/feedback/correct/machine/yes-thats-ten.wav';
import tryAgainSoundUrl from './assets/audio/feedback/incorrect/try-again.wav';
import thatsOneUrl from './assets/audio/feedback/incorrect/machine/thats-one.wav';
import thatsTwoUrl from './assets/audio/feedback/incorrect/machine/thats-two.wav';
import thatsThreeUrl from './assets/audio/feedback/incorrect/machine/thats-three.wav';
import thatsFourUrl from './assets/audio/feedback/incorrect/machine/thats-four.wav';
import thatsFiveUrl from './assets/audio/feedback/incorrect/machine/thats-five.wav';
import thatsSixUrl from './assets/audio/feedback/incorrect/machine/thats-six.wav';
import thatsSevenUrl from './assets/audio/feedback/incorrect/machine/thats-seven.wav';
import thatsEightUrl from './assets/audio/feedback/incorrect/machine/thats-eight.wav';
import thatsNineUrl from './assets/audio/feedback/incorrect/machine/thats-nine.wav';
import thatsTenUrl from './assets/audio/feedback/incorrect/machine/thats-ten.wav';
import explorationIntroUrl from './assets/audio/number-exploration/opening-dialogue.wav';
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

type GamePhase = 'start' | 'exploration' | 'question' | 'reinforcement' | 'end';

type NumeralOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
};

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

const correctSounds = [goodWorkUrl, greatJobUrl, thatsRightUrl];
const correctNumberSounds: Record<number, string> = {
  1: yesThatsOneUrl,
  2: yesThatsTwoUrl,
  3: yesThatsThreeUrl,
  4: yesThatsFourUrl,
  5: yesThatsFiveUrl,
  6: yesThatsSixUrl,
  7: yesThatsSevenUrl,
  8: yesThatsEightUrl,
  9: yesThatsNineUrl,
  10: yesThatsTenUrl
};
const incorrectNumberSounds: Record<number, string> = {
  1: thatsOneUrl,
  2: thatsTwoUrl,
  3: thatsThreeUrl,
  4: thatsFourUrl,
  5: thatsFiveUrl,
  6: thatsSixUrl,
  7: thatsSevenUrl,
  8: thatsEightUrl,
  9: thatsNineUrl,
  10: thatsTenUrl
};
const numberSounds: Record<number, string> = {
  1: oneUrl,
  2: twoUrl,
  3: threeUrl,
  4: fourUrl,
  5: fiveUrl,
  6: sixUrl,
  7: sevenUrl,
  8: eightUrl,
  9: nineUrl,
  10: tenUrl
};

let questions: Question[] = [];
let questionIndex = 0;
let phase: GamePhase = 'start';
let explorationHasSelection = false;
let lastCorrectSoundIndex: number | null = null;
// This is the app's only media element. Reusing it preserves the Start-tap
// activation across every later spoken clip in iPad standalone mode.
const speechPlayback = new SpeechPlayback(new Audio());

function chooseCorrectSound(): string {
  const soundIndex = chooseNonRepeatingIndex(correctSounds.length, lastCorrectSoundIndex);
  lastCorrectSoundIndex = soundIndex;
  return correctSounds[soundIndex];
}

async function playIncorrectFeedback(answer: number): Promise<void> {
  const identification = incorrectNumberSounds[answer];
  if (!identification) {
    return;
  }

  await speechPlayback.playSequence([identification, tryAgainSoundUrl]);
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
  void speechPlayback.play(explorationIntroUrl);
}

function chooseExplorationNumber(number: number): void {
  if (phase !== 'exploration') {
    return;
  }

  const sound = numberSounds[number];
  if (!sound) {
    return;
  }

  void speechPlayback.play(sound);

  if (!explorationHasSelection) {
    explorationHasSelection = true;
    app.querySelector<HTMLButtonElement>('[data-start-counting]')?.removeAttribute('hidden');
  }
}

function startCounting(): void {
  if (phase !== 'exploration' || !explorationHasSelection) {
    return;
  }

  speechPlayback.stop();
  questions = createSession();
  questionIndex = 0;
  phase = 'question';
  renderQuestion();
}

function renderObjects(question: Question): string {
  return Array.from({ length: question.quantity }, (_, index) => index)
    .map(
      (index) => `
        <button
          class="counting-object"
          type="button"
          data-counting-object
          aria-label="Object ${index + 1} of ${question.quantity}"
          aria-pressed="false"
        >
          <img
            class="counting-object-image"
            src="${objectImages[question.objectKind]}"
            alt=""
            draggable="false"
          />
        </button>`
    )
    .join('');
}

function renderAnswers(question: Question): string {
  return question.choices
    .map(
      (choice) => `
        <button
          class="answer-button"
          type="button"
          data-answer="${choice}"
          aria-label="${choice}"
        >${choice}</button>`
    )
    .join('');
}

function renderQuestion(): void {
  const question = questions[questionIndex];

  app.innerHTML = `
    <section class="game-screen" aria-label="Counting question">
      <h1>How many?</h1>
      <div class="object-board" role="group" aria-label="Objects to count">
        ${renderObjects(question)}
      </div>
      <div class="answer-row" aria-label="Choose a number">
        ${renderAnswers(question)}
      </div>
    </section>`;
}

function getNumeralOrigin(button: HTMLButtonElement): NumeralOrigin {
  const rect = button.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    fontSize: Number.parseFloat(window.getComputedStyle(button).fontSize)
  };
}

function renderNumeralReinforcement(answer: number, origin: NumeralOrigin): void {
  app.innerHTML = `
    <section class="reinforcement-screen" aria-label="Correct answer">
      ${renderCelebration()}
      <div
        class="reinforced-numeral"
        aria-label="${answer}"
        style="
          --source-left: ${origin.left}px;
          --source-top: ${origin.top}px;
          --source-width: ${origin.width}px;
          --source-height: ${origin.height}px;
          --source-font-size: ${origin.fontSize}px;
        "
      >${answer}</div>
    </section>`;
}

function waitForNumeralTransition(): Promise<void> {
  const numeral = app.querySelector<HTMLElement>('.reinforced-numeral');
  if (!numeral) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    numeral.addEventListener('animationend', () => resolve(), { once: true });
  });
}

async function completeCorrectAnswer(answer: number): Promise<void> {
  await waitForNumeralTransition();
  if (phase !== 'reinforcement') {
    return;
  }

  const numberSound = correctNumberSounds[answer];
  if (!numberSound) {
    return;
  }

  await runCorrectAnswerFeedback(
    speechPlayback,
    [numberSound, chooseCorrectSound()],
    () => phase === 'reinforcement',
    advanceToNextQuestion
  );
}

function advanceToNextQuestion(): void {
  questionIndex += 1;
  if (questionIndex === questions.length) {
    phase = 'end';
    renderEnd();
    return;
  }

  phase = 'question';
  renderQuestion();
}

function renderEnd(): void {
  app.innerHTML = `
    <section class="end-screen">
      <h1>The End</h1>
      <button class="start-again-button" type="button" data-start-again>Start Again</button>
    </section>`;
}

function startAgain(): void {
  speechPlayback.stop();
  renderStart();
}

function chooseAnswer(answer: number, sourceButton: HTMLButtonElement): void {
  if (phase !== 'question') {
    return;
  }

  const question = questions[questionIndex];

  if (answer !== question.quantity) {
    void playIncorrectFeedback(answer);
    return;
  }

  const origin = getNumeralOrigin(sourceButton);
  phase = 'reinforcement';
  speechPlayback.stop();
  renderNumeralReinforcement(answer, origin);
  speechPlayback.preload(correctNumberSounds[answer]);
  void completeCorrectAnswer(answer);
}

function toggleCountedObject(objectButton: HTMLButtonElement): void {
  if (phase !== 'question') {
    return;
  }

  const isCounted = objectButton.getAttribute('aria-pressed') === 'true';
  objectButton.setAttribute('aria-pressed', String(!isCounted));
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

  const countingObject = target.closest<HTMLButtonElement>('[data-counting-object]');
  if (countingObject) {
    toggleCountedObject(countingObject);
    return;
  }

  const answerButton = target.closest<HTMLButtonElement>('[data-answer]');
  if (answerButton) {
    chooseAnswer(Number(answerButton.dataset.answer), answerButton);
    return;
  }

  if (target.closest('[data-start-again]')) {
    startAgain();
  }
});

renderStart();

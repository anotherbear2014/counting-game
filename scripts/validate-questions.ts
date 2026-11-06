import { createSession, OBJECT_KINDS } from '../src/questions.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const observedCorrectPositions = new Set<number>();

for (let seed = 1; seed <= 10_000; seed += 1) {
  const session = createSession(createSeededRandom(seed));
  assert(session.length === 10, `Seed ${seed}: session must contain 10 questions`);

  const sortedQuantities = session.map(({ quantity }) => quantity).sort((a, b) => a - b);
  assert(
    sortedQuantities.join(',') === '1,2,3,4,5,6,7,8,9,10',
    `Seed ${seed}: quantities must contain 1 through 10 exactly once`
  );

  session.forEach((question, index) => {
    const label = `Seed ${seed}, question ${index + 1}`;
    assert(OBJECT_KINDS.includes(question.objectKind), `${label}: invalid object kind`);
    assert(question.choices.length === 3, `${label}: must have three choices`);
    assert(new Set(question.choices).size === 3, `${label}: choices must be distinct`);
    assert(
      question.choices.every((choice) => choice >= 1 && choice <= 10),
      `${label}: choices must be between 1 and 10`
    );
    assert(question.choices.includes(question.quantity), `${label}: correct answer is missing`);
    observedCorrectPositions.add(question.choices.indexOf(question.quantity));
    assert(
      question.choices
        .filter((choice) => choice !== question.quantity)
        .every((choice) => Math.abs(choice - question.quantity) <= 2),
      `${label}: incorrect choices must be close to the correct answer`
    );
  });
}

assert(
  observedCorrectPositions.size === 3,
  'The correct answer must appear in all three button positions across generated sessions'
);

console.log('Question invariants passed for 10,000 deterministic sessions.');

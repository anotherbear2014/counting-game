import { createSession, OBJECT_KINDS } from '../src/questions.ts';

const EXPECTED_OBJECT_KINDS = [
  'horse',
  'rabbit',
  'apple',
  'frog',
  'unicorn',
  'clownfish',
  'duck',
  'turtle',
  'bumblebee',
  'ladybug'
] as const;

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

const observedPairs = new Set<string>();
const observedOrders = new Set<string>();

const observedCorrectPositions = new Set<number>();

assert(
  OBJECT_KINDS.join(',') === EXPECTED_OBJECT_KINDS.join(','),
  'The playable object pool must contain exactly the ten expected kinds in the expected order'
);
assert(!OBJECT_KINDS.some((kind: string) => kind === 'carrot'), 'Carrot must not be playable');

for (let seed = 1; seed <= 10_000; seed += 1) {
  const session = createSession(createSeededRandom(seed));
  assert(session.length === 10, `Seed ${seed}: session must contain 10 questions`);

  const sortedQuantities = session.map(({ quantity }) => quantity).sort((a, b) => a - b);
  assert(
    sortedQuantities.join(',') === '1,2,3,4,5,6,7,8,9,10',
    `Seed ${seed}: quantities must contain 1 through 10 exactly once`
  );

  observedOrders.add(session.map(q => q.objectKind).join(','));
  assert(new Set(session.map(q => q.objectKind)).size === 10, `Seed ${seed}: all ten kinds must appear`);
  assert(
    !session.some(({ objectKind }) => String(objectKind) === 'carrot'),
    `Seed ${seed}: carrot must not be generated`
  );
  session.forEach((question, index) => {
    observedPairs.add(`${question.objectKind}:${question.quantity}`);
    assert(index === 0 || question.objectKind !== session[index - 1].objectKind, 'Adjacent kinds must differ');
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

assert(observedPairs.size === 100, 'All ten kinds must occur with all ten quantities');
assert(observedOrders.size > 100, 'Object orders must vary across sessions');

console.log('Question invariants passed for 10,000 deterministic sessions.');

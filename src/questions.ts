export const OBJECT_KINDS = [
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

export type ObjectKind = (typeof OBJECT_KINDS)[number];
export type RandomSource = () => number;

export interface Question {
  quantity: number;
  objectKind: ObjectKind;
  choices: number[];
}

const QUANTITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function shuffle<T>(values: readonly T[], random: RandomSource = Math.random): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function createAnswerChoices(
  correctAnswer: number,
  random: RandomSource = Math.random
): number[] {
  const nearbyAnswers: number[] = [];

  for (let distance = 1; distance <= 9; distance += 1) {
    const atThisDistance = [correctAnswer - distance, correctAnswer + distance].filter(
      (answer) => answer >= 1 && answer <= 10
    );
    nearbyAnswers.push(...shuffle(atThisDistance, random));
  }

  return shuffle([correctAnswer, ...nearbyAnswers.slice(0, 2)], random);
}

function createObjectSequence(length: number, random: RandomSource): ObjectKind[] {
  const sequence: ObjectKind[] = [];

  while (sequence.length < length) {
    const nextGroup = shuffle(OBJECT_KINDS, random);
    const previousKind = sequence.at(-1);

    if (previousKind === nextGroup[0]) {
      [nextGroup[0], nextGroup[1]] = [nextGroup[1], nextGroup[0]];
    }

    sequence.push(...nextGroup);
  }

  return sequence.slice(0, length);
}

export function createSession(random: RandomSource = Math.random): Question[] {
  const quantities = shuffle(QUANTITIES, random);
  const objectKinds = createObjectSequence(quantities.length, random);

  return quantities.map((quantity, index) => ({
    quantity,
    objectKind: objectKinds[index],
    choices: createAnswerChoices(quantity, random)
  }));
}

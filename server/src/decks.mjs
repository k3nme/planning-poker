/**
 * Deck definitions. Kept deliberately tiny and dependency-free so the same
 * shape can be mirrored on the client (client/src/lib/decks.ts).
 *
 * `value` is the wire value. `numeric` is null for non-estimating cards
 * (unknown / break) so they can be excluded from statistics.
 */

const card = (value, numeric = Number(value), label = value) => ({ value, numeric, label });
const special = (value, label) => ({ value, numeric: null, label });

export const DECKS = {
  fibonacci: {
    id: 'fibonacci',
    name: 'Fibonacci',
    hint: 'The classic. Uncertainty grows with size.',
    cards: [
      card('0'), card('1'), card('2'), card('3'), card('5'), card('8'),
      card('13'), card('21'), card('34'), card('55'),
      special('?', '?'), special('coffee', '☕'),
    ],
  },
  modified: {
    id: 'modified',
    name: 'Modified Fibonacci',
    hint: 'Half points early, big jumps late.',
    cards: [
      card('0'), card('0.5', 0.5), card('1'), card('2'), card('3'), card('5'),
      card('8'), card('13'), card('20', 20), card('40', 40), card('100', 100),
      special('?', '?'), special('coffee', '☕'),
    ],
  },
  tshirt: {
    id: 'tshirt',
    name: 'T-shirt sizes',
    hint: 'Relative sizing without the false precision.',
    cards: [
      card('XS', 1), card('S', 2), card('M', 3), card('L', 5),
      card('XL', 8), card('XXL', 13),
      special('?', '?'), special('coffee', '☕'),
    ],
  },
  powers: {
    id: 'powers',
    name: 'Powers of two',
    hint: 'Doubling scale for infrastructure work.',
    cards: [
      card('1'), card('2'), card('4'), card('8'), card('16'), card('32'), card('64'),
      special('?', '?'), special('coffee', '☕'),
    ],
  },
  sequential: {
    id: 'sequential',
    name: 'Sequential',
    hint: 'Straight 1-10 for fine-grained work.',
    cards: [
      card('1'), card('2'), card('3'), card('4'), card('5'),
      card('6'), card('7'), card('8'), card('9'), card('10'),
      special('?', '?'), special('coffee', '☕'),
    ],
  },
};

export const DEFAULT_DECK = 'fibonacci';

export function getDeck(deckId) {
  return DECKS[deckId] ?? DECKS[DEFAULT_DECK];
}

export function isValidCard(deckId, value) {
  return getDeck(deckId).cards.some((c) => c.value === value);
}

export function numericValue(deckId, value) {
  const found = getDeck(deckId).cards.find((c) => c.value === value);
  return found ? found.numeric : null;
}

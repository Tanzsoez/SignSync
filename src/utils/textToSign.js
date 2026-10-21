import { DATASET_CATALOG, SIGN_CATALOG } from '../data/signCatalog.js';

const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

const MOTION_LETTERS = new Set(['J', 'Z', 'Ñ']);

export const normalizeSignText = (value = '') => value
  .normalize('NFKC')
  .replace(/[’‘`]/g, "'")
  .replace(/[^\p{L}\p{N}']+/gu, ' ')
  .trim()
  .toLocaleLowerCase('en');

const phraseAliases = (key, definition) => {
  const outsideParentheses = definition.display.split('(')[0].trim();
  const displayParts = outsideParentheses.split('/').map((part) => part.trim()).filter(Boolean);
  return [...new Set([
    key.replace(/_/g, ' '),
    definition.speech,
    outsideParentheses,
    ...displayParts,
  ].map(normalizeSignText).filter(Boolean))];
};

const buildPhraseIndex = (language) => {
  const dialect = language === 'FSL' ? 'FSL' : 'ASL';
  return Object.entries(SIGN_CATALOG[dialect].dynamic)
    .flatMap(([key, definition]) => phraseAliases(key, definition).map((alias) => ({
      alias,
      words: alias.split(' '),
      key,
      label: definition.display,
      type: 'phrase',
      durationMs: 2850,
    })))
    .sort((first, second) => second.words.length - first.words.length || second.alias.length - first.alias.length);
};

const getSingleSign = (query, language) => {
  const dialect = language === 'FSL' ? 'FSL' : 'ASL';
  const catalog = DATASET_CATALOG[dialect];
  const normalized = normalizeSignText(query);
  const phrases = buildPhraseIndex(dialect);
  const phrase = phrases.find((candidate) => candidate.alias === normalized);
  if (phrase) return { ...phrase };

  const letterMatch = normalized.match(/^letter ([a-zñ])$/u);
  const numberMatch = normalized.match(/^number ([0-9])$/u);
  const enyeAlias = normalized === 'enye' || normalized === 'letter enye' ? 'Ñ' : null;
  const requested = enyeAlias || letterMatch?.[1]?.toLocaleUpperCase('en') || numberMatch?.[1] || normalized.toLocaleUpperCase('en');
  if (catalog.letters.includes(requested)) {
    return {
      key: requested,
      label: requested,
      type: 'letter',
      durationMs: MOTION_LETTERS.has(requested) ? 2450 : 1050,
    };
  }
  if (catalog.numbers.includes(requested)) {
    return { key: requested, label: requested, type: 'number', durationMs: 1050 };
  }
  const numberWord = NUMBER_WORDS[normalized];
  if (numberWord && catalog.numbers.includes(numberWord)) {
    return { key: numberWord, label: numberWord, type: 'number', durationMs: 1050 };
  }
  return null;
};

const gap = (kind = 'word') => ({
  key: 'NONE',
  label: kind === 'repeat' ? 'repeat pause' : 'word pause',
  type: 'gap',
  durationMs: kind === 'repeat' ? 220 : 360,
});

const spellWord = (word, language) => {
  const dialect = language === 'FSL' ? 'FSL' : 'ASL';
  const allowed = new Set(DATASET_CATALOG[dialect].letters.concat(DATASET_CATALOG[dialect].numbers));
  const characters = [...word.toLocaleUpperCase('en')];
  if (!characters.length || characters.some((character) => !allowed.has(character))) return null;

  const result = [];
  characters.forEach((character, index) => {
    if (index > 0 && character === characters[index - 1]) result.push(gap('repeat'));
    result.push({
      key: character,
      label: character,
      type: /^[0-9]$/.test(character) ? 'number' : 'letter',
      durationMs: MOTION_LETTERS.has(character) ? 2450 : 1050,
    });
  });
  return result;
};

const appendWithBoundary = (sequence, additions) => {
  if (!additions?.length) return;
  if (sequence.length && sequence.at(-1).type !== 'gap') sequence.push(gap('word'));
  sequence.push(...additions);
};

/**
 * Converts text into a dialect-locked playback queue. Trained phrases are
 * matched longest-first; unmatched words are fingerspelled without discarding
 * word boundaries or repeated-letter pauses.
 */
export const createSignSequence = (input, language = 'ASL') => {
  const dialect = language === 'FSL' ? 'FSL' : 'ASL';
  const normalized = normalizeSignText(input);
  if (!normalized) return { sequence: [], unsupported: [], exact: false };

  const exact = getSingleSign(normalized, dialect);
  if (exact) return { sequence: [exact], unsupported: [], exact: true };

  const phraseIndex = buildPhraseIndex(dialect);
  const words = normalized.split(' ');
  const sequence = [];
  const unsupported = [];
  let wordIndex = 0;

  while (wordIndex < words.length) {
    const phrase = phraseIndex.find((candidate) => candidate.words.every(
      (word, offset) => words[wordIndex + offset] === word,
    ));
    if (phrase) {
      appendWithBoundary(sequence, [{ ...phrase }]);
      wordIndex += phrase.words.length;
      continue;
    }

    const number = NUMBER_WORDS[words[wordIndex]];
    const spelled = number
      ? spellWord(number, dialect)
      : spellWord(words[wordIndex], dialect);
    if (spelled) appendWithBoundary(sequence, spelled);
    else unsupported.push(words[wordIndex]);
    wordIndex += 1;
  }

  return { sequence, unsupported, exact: false };
};

export const findDialectSign = (query, language = 'ASL') => getSingleSign(query, language);

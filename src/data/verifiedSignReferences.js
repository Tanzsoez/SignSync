const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = '0123456789'.split('');

function makeReference(dialect, symbol, fileName = `${dialect}_${symbol}.jpg`) {
  const kind = /^\d$/.test(symbol) ? 'numbers' : 'letters';
  return {
    src: `/sign-references/${dialect.toLowerCase()}/${kind}/${fileName}`,
    alt: `${dialect} sign reference for ${symbol}`,
  };
}

export const SIGN_REFERENCES = Object.freeze({
  ...Object.fromEntries(LETTERS.map((symbol) => [`ASL_${symbol}`, makeReference('ASL', symbol)])),
  ...Object.fromEntries(NUMBERS.map((symbol) => [`ASL_${symbol}`, makeReference('ASL', symbol)])),
  ...Object.fromEntries(LETTERS.map((symbol) => [`FSL_${symbol}`, makeReference('FSL', symbol)])),
  FSL_Ñ: makeReference('FSL', 'Ñ', 'FSL_ENYE.jpg'),
  ...Object.fromEntries(NUMBERS.map((symbol) => [`FSL_${symbol}`, makeReference('FSL', symbol)])),
});

export function getSignReference(signKey) {
  return signKey ? SIGN_REFERENCES[signKey] || null : null;
}

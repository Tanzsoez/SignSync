/**
 * SignSync Unified Sign Language Catalog
 * Single Source of Truth for all dataset categories, UI translations, speech synthesis,
 * and anatomical handshape preconditions.
 * Synchronized with dataset_holistic.json (73 static + 44 dynamic classes).
 */

export const SIGN_CATALOG = {
  ASL: {
    static: {
      A: { display: 'A', speech: 'A', type: 'letter' },
      B: { display: 'B', speech: 'B', type: 'letter' },
      C: { display: 'C', speech: 'C', type: 'letter' },
      D: { display: 'D', speech: 'D', type: 'letter' },
      E: { display: 'E', speech: 'E', type: 'letter' },
      F: { display: 'F', speech: 'F', type: 'letter' },
      G: { display: 'G', speech: 'G', type: 'letter' },
      H: { display: 'H', speech: 'H', type: 'letter' },
      I: { display: 'I', speech: 'I', type: 'letter' },
      J: { display: 'J', speech: 'J', type: 'letter' },
      K: { display: 'K', speech: 'K', type: 'letter' },
      L: { display: 'L', speech: 'L', type: 'letter' },
      M: { display: 'M', speech: 'M', type: 'letter' },
      N: { display: 'N', speech: 'N', type: 'letter' },
      O: { display: 'O', speech: 'O', type: 'letter' },
      P: { display: 'P', speech: 'P', type: 'letter' },
      Q: { display: 'Q', speech: 'Q', type: 'letter' },
      R: { display: 'R', speech: 'R', type: 'letter' },
      S: { display: 'S', speech: 'S', type: 'letter' },
      T: { display: 'T', speech: 'T', type: 'letter' },
      U: { display: 'U', speech: 'U', type: 'letter' },
      V: { display: 'V', speech: 'V', type: 'letter' },
      W: { display: 'W', speech: 'W', type: 'letter' },
      X: { display: 'X', speech: 'X', type: 'letter' },
      Y: { display: 'Y', speech: 'Y', type: 'letter' },
      Z: { display: 'Z', speech: 'Z', type: 'letter' },
      '0': { display: '0', speech: '0', type: 'number' },
      '1': { display: '1', speech: '1', type: 'number' },
      '2': { display: '2', speech: '2', type: 'number' },
      '3': { display: '3', speech: '3', type: 'number' },
      '4': { display: '4', speech: '4', type: 'number' },
      '5': { display: '5', speech: '5', type: 'number' },
      '6': { display: '6', speech: '6', type: 'number' },
      '7': { display: '7', speech: '7', type: 'number' },
      '8': { display: '8', speech: '8', type: 'number' },
      '9': { display: '9', speech: '9', type: 'number' },
    },
    dynamic: {
      HELLO: { display: 'Hello', speech: 'Hello', expectedHandshape: 'openHand', requireMotion: true },
      HI: { display: 'Hi', speech: 'Hi', expectedHandshape: 'openHand', requireMotion: true },
      GOODBYE: { display: 'Goodbye', speech: 'Goodbye', expectedHandshape: 'openHand', requireMotion: true },
      THANK_YOU: { display: 'Thank You', speech: 'Thank you', expectedHandshape: 'flatHandNearFace', requireMotion: true },
      I_LOVE_YOU: { display: 'I Love You', speech: 'I love you', expectedHandshape: 'ily', requireMotion: false },
      PLEASE: { display: 'Please', speech: 'Please', expectedHandshape: 'flatHandChest', requireMotion: true },
      MORE: { display: 'More', speech: 'More', expectedHandshape: 'pinchedFingers', requireMotion: true },
      YES: { display: 'Yes', speech: 'Yes', expectedHandshape: 'fist', requireMotion: true },
      NO: { display: 'No', speech: 'No', expectedHandshape: 'indexMiddleThumb', requireMotion: true },
      EAT: { display: 'Eat / Food', speech: 'Eat', expectedHandshape: 'pinchedFingersNearMouth', requireMotion: true },
      SEE_YOU_LATER: { display: 'See You Later', speech: 'See you later', expectedHandshape: 'vShapeToL', requireMotion: true },
      GOOD: { display: 'Good', speech: 'Good', expectedHandshape: 'flatHandNearFace', requireMotion: true },
      MORNING: { display: 'Good Morning', speech: 'Good morning', expectedHandshape: 'risingArm', requireMotion: true },
      AFTERNOON: { display: 'Good Afternoon', speech: 'Good afternoon', expectedHandshape: 'decliningArm', requireMotion: true },
      NIGHT: { display: 'Good Night', speech: 'Good night', expectedHandshape: 'curvedWristDown', requireMotion: true },
      DEAF: { display: 'Deaf', speech: 'Deaf', expectedHandshape: 'indexToEarJaw', requireMotion: true },
      HARD_OF_HEARING: { display: 'Hard of Hearing', speech: 'Hard of hearing', expectedHandshape: 'hShapeBounce', requireMotion: true },
      HEARING: { display: 'Hearing', speech: 'Hearing', expectedHandshape: 'indexCircleMouth', requireMotion: true },
      PEOPLE: { display: 'People', speech: 'People', expectedHandshape: 'pShapeCircle', requireMotion: true },
      ME: { display: 'I / Me', speech: 'I', expectedHandshape: 'indexToChest', requireMotion: true },
      "WHAT'S_UP": { display: "What's Up?", speech: "What's up", expectedHandshape: 'feelHandsUp', requireMotion: true },
    },
  },
  FSL: {
    static: {
      A: { display: 'A', speech: 'A', type: 'letter' },
      B: { display: 'B', speech: 'B', type: 'letter' },
      C: { display: 'C', speech: 'C', type: 'letter' },
      D: { display: 'D', speech: 'D', type: 'letter' },
      E: { display: 'E', speech: 'E', type: 'letter' },
      F: { display: 'F', speech: 'F', type: 'letter' },
      G: { display: 'G', speech: 'G', type: 'letter' },
      H: { display: 'H', speech: 'H', type: 'letter' },
      I: { display: 'I', speech: 'I', type: 'letter' },
      J: { display: 'J', speech: 'J', type: 'letter' },
      K: { display: 'K', speech: 'K', type: 'letter' },
      L: { display: 'L', speech: 'L', type: 'letter' },
      M: { display: 'M', speech: 'M', type: 'letter' },
      N: { display: 'N', speech: 'N', type: 'letter' },
      Ñ: { display: 'Ñ (Enye)', speech: 'Enye', type: 'letter' },
      O: { display: 'O', speech: 'O', type: 'letter' },
      P: { display: 'P', speech: 'P', type: 'letter' },
      Q: { display: 'Q', speech: 'Q', type: 'letter' },
      R: { display: 'R', speech: 'R', type: 'letter' },
      S: { display: 'S', speech: 'S', type: 'letter' },
      T: { display: 'T', speech: 'T', type: 'letter' },
      U: { display: 'U', speech: 'U', type: 'letter' },
      V: { display: 'V', speech: 'V', type: 'letter' },
      W: { display: 'W', speech: 'W', type: 'letter' },
      X: { display: 'X', speech: 'X', type: 'letter' },
      Y: { display: 'Y', speech: 'Y', type: 'letter' },
      Z: { display: 'Z', speech: 'Z', type: 'letter' },
      '0': { display: '0', speech: '0', type: 'number' },
      '1': { display: '1', speech: '1', type: 'number' },
      '2': { display: '2', speech: '2', type: 'number' },
      '3': { display: '3', speech: '3', type: 'number' },
      '4': { display: '4', speech: '4', type: 'number' },
      '5': { display: '5', speech: '5', type: 'number' },
      '6': { display: '6', speech: '6', type: 'number' },
      '7': { display: '7', speech: '7', type: 'number' },
      '8': { display: '8', speech: '8', type: 'number' },
      '9': { display: '9', speech: '9', type: 'number' },
    },
    dynamic: {
      KUMUSTA_KA_NA: { display: 'Kumusta Ka Na? (How are you?)', speech: 'Kumusta ka na', expectedHandshape: 'openHand', requireMotion: true },
      SALAMAT: { display: 'Salamat (Thank You)', speech: 'Salamat', expectedHandshape: 'flatHandNearFace', requireMotion: true },
      MAHAL_KITA: { display: 'Mahal Kita (I Love You)', speech: 'Mahal kita', expectedHandshape: 'ily', requireMotion: false },
      PATAWAD: { display: 'Patawad (Sorry / Forgive me)', speech: 'Patawad', expectedHandshape: 'flatHandNearFace', requireMotion: true },
      MAGANDANG_UMAGA: { display: 'Magandang Umaga (Good Morning)', speech: 'Magandang umaga', expectedHandshape: 'risingArm', requireMotion: true },
      MAGANDANG_TANGHALI: { display: 'Magandang Tanghali (Good Noon)', speech: 'Magandang tanghali', expectedHandshape: 'decliningArm', requireMotion: true },
      MAGANDANG_HAPON: { display: 'Magandang Hapon (Good Afternoon)', speech: 'Magandang hapon', expectedHandshape: 'decliningArm', requireMotion: true },
      MAGANDANG_GABI: { display: 'Magandang Gabi (Good Evening)', speech: 'Magandang gabi', expectedHandshape: 'curvedWristDown', requireMotion: true },
      MAGANDANG_ARAW: { display: 'Magandang Araw (Good Day)', speech: 'Magandang araw', expectedHandshape: 'openHand', requireMotion: true },
      AKO: { display: 'Ako (I / Me)', speech: 'Ako', expectedHandshape: 'indexToChest', requireMotion: true },
      AKO_AY_MABUTI: { display: 'Ako ay Mabuti (I am good)', speech: 'Ako ay mabuti', expectedHandshape: 'thumbsUpOrFlat', requireMotion: true },
      AYOS_LANG: { display: 'Ayos Lang (I am okay)', speech: 'Ayos lang', expectedHandshape: 'thumbsUpOrFlat', requireMotion: true },
      ANG_PANGALAN_KO_AY: { display: 'Ang Pangalan Ko Ay... (My name is...)', speech: 'Ang pangalan ko ay', expectedHandshape: 'hShapeCross', requireMotion: true },
      ANO_ANG_PANGALAN_MO: { display: 'Ano ang Pangalan Mo? (What is your name?)', speech: 'Ano ang pangalan mo', expectedHandshape: 'hShapeCross', requireMotion: true },
      MAY_SAKIT_AKO: { display: 'May Sakit Ako (I am sick)', speech: 'May sakit ako', expectedHandshape: 'feelHandsChest', requireMotion: true },
      MGA_TAO: { display: 'Mga Tao (People)', speech: 'Mga tao', expectedHandshape: 'pShapeCircle', requireMotion: true },
      OO: { display: 'Oo (Yes)', speech: 'Oo', expectedHandshape: 'fist', requireMotion: true },
      HINDI: { display: 'Hindi (No)', speech: 'Hindi', expectedHandshape: 'indexWag', requireMotion: true },
      HELLO: { display: 'Hello', speech: 'Hello', expectedHandshape: 'openHand', requireMotion: true },
      HI: { display: 'Hi', speech: 'Hi', expectedHandshape: 'openHand', requireMotion: true },
      DEAF: { display: 'Bingi (Deaf)', speech: 'Bingi', expectedHandshape: 'indexToEarJaw', requireMotion: true },
      HARD_OF_HEARING: { display: 'Mahirap Makarinig (Hard of Hearing)', speech: 'Mahirap makarinig', expectedHandshape: 'hShapeBounce', requireMotion: true },
      HEARING: { display: 'Nakakarinig (Hearing)', speech: 'Nakakarinig', expectedHandshape: 'indexCircleMouth', requireMotion: true },
    },
  },
};

export function getCatalogDisplay(signKey, lang = 'ASL') {
  if (!signKey || signKey === 'NONE') return 'NONE';
  const cleanKey = signKey.replace(/^(ASL_|FSL_)/, '').trim();

  if (cleanKey === 'Ñ' || cleanKey === 'ñ' || cleanKey === 'Ã‘' || cleanKey === '\u00c3\u2018' || cleanKey === '\ufffd') {
    return 'Ñ (Enye)';
  }

  // Letters (A-Z) and numbers (0-9) are purely individual static characters
  if (/^[A-Za-z0-9]$/.test(cleanKey)) {
    return cleanKey.toUpperCase();
  }

  const dialect = lang.toUpperCase() === 'FSL' ? 'FSL' : 'ASL';
  const altDialect = dialect === 'FSL' ? 'ASL' : 'FSL';

  const dynSign = SIGN_CATALOG[dialect]?.dynamic[cleanKey] || SIGN_CATALOG[altDialect]?.dynamic[cleanKey];
  if (dynSign) return dynSign.display;

  const statSign = SIGN_CATALOG[dialect]?.static[cleanKey] || SIGN_CATALOG[altDialect]?.static[cleanKey];
  if (statSign) return statSign.display;

  return cleanKey.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function getCatalogSpokenText(signKey, lang = 'ASL') {
  if (!signKey || signKey === 'NONE') return '';
  const cleanKey = signKey.replace(/^(ASL_|FSL_)/, '').trim();

  if (cleanKey === 'Ñ' || cleanKey === 'ñ' || cleanKey === 'Ã‘' || cleanKey === '\u00c3\u2018' || cleanKey === '\ufffd') {
    return 'Enye';
  }

  // Individual letters and numbers
  if (/^[A-Za-z0-9]$/.test(cleanKey)) {
    return cleanKey.toUpperCase();
  }

  const dialect = lang.toUpperCase() === 'FSL' ? 'FSL' : 'ASL';
  const altDialect = dialect === 'FSL' ? 'ASL' : 'FSL';

  const dynSign = SIGN_CATALOG[dialect]?.dynamic[cleanKey] || SIGN_CATALOG[altDialect]?.dynamic[cleanKey];
  if (dynSign) return dynSign.speech;

  const statSign = SIGN_CATALOG[dialect]?.static[cleanKey] || SIGN_CATALOG[altDialect]?.static[cleanKey];
  if (statSign) return statSign.speech;

  if (cleanKey.includes('(')) {
    return cleanKey.split('(')[0].replace(/[?]/g, '').trim();
  }
  if (cleanKey.includes('/')) {
    return cleanKey.split('/')[0].trim();
  }

  return cleanKey.replace(/_/g, ' ');
}

export const DATASET_CATALOG = {
  ASL: {
    letters: Object.keys(SIGN_CATALOG.ASL.static).filter((k) => SIGN_CATALOG.ASL.static[k].type === 'letter'),
    numbers: Object.keys(SIGN_CATALOG.ASL.static).filter((k) => SIGN_CATALOG.ASL.static[k].type === 'number'),
    phrases: Object.entries(SIGN_CATALOG.ASL.dynamic).map(([key, val]) => ({ key, label: val.display })),
  },
  FSL: {
    letters: Object.keys(SIGN_CATALOG.FSL.static).filter((k) => SIGN_CATALOG.FSL.static[k].type === 'letter'),
    numbers: Object.keys(SIGN_CATALOG.FSL.static).filter((k) => SIGN_CATALOG.FSL.static[k].type === 'number'),
    phrases: Object.entries(SIGN_CATALOG.FSL.dynamic).map(([key, val]) => ({ key, label: val.display })),
  },
};

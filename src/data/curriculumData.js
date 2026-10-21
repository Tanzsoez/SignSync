// Comprehensive Curriculum Dataset for ASL & FSL Letters and Numbers (72 Signs Total)
// Strictly focused on Letters (A-Z) and Numbers (0-9) for both American Sign Language & Filipino Sign Language

export const ASL_LETTERS = [
  { symbol: 'A', handShape: 'fist_thumb_side', desc: 'Closed fist with thumb resting upright along the index finger.', hint: 'Keep fist compact and thumb alongside the side of your hand.' },
  { symbol: 'B', handShape: 'open_thumb_in', desc: 'Four fingers extended upright together, thumb folded flat across palm.', hint: 'Press all four fingers firmly together and fold thumb across palm.' },
  { symbol: 'C', handShape: 'c_curve', desc: 'Fingers and thumb curved to form an open "C" shape facing sideways.', hint: 'Arch your fingers and thumb in an open curved cup.' },
  { symbol: 'D', handShape: 'point_o_base', desc: 'Index finger extended straight up, thumb touching middle, ring, and pinky tips.', hint: 'Only index points straight up; touch other three fingers to thumb.' },
  { symbol: 'E', handShape: 'claw_fist', desc: 'All four fingertips curled tightly inward, resting on top of folded thumb.', hint: 'Curl fingertips down until they rest directly on thumb.' },
  { symbol: 'F', handShape: 'ok_circle', desc: 'Index finger touches thumb forming a circle; other three fingers straight up spread.', hint: 'Make an "OK" circle with thumb and index, extend other 3 fingers.' },
  { symbol: 'G', handShape: 'pinch_horizontal', desc: 'Index finger and thumb pointing parallel horizontally sideways, other fingers curled.', hint: 'Point index and thumb horizontally like pinching.' },
  { symbol: 'H', handShape: 'two_horizontal', desc: 'Index and middle fingers extended together horizontally forward/sideways.', hint: 'Keep index and middle fingers side-by-side pointing sideways.' },
  { symbol: 'I', handShape: 'pinky_up', desc: 'Pinky finger extended straight up, other fingers folded into a fist with thumb over them.', hint: 'Only pinky stays straight up; curl all other fingers in.' },
  { symbol: 'J', handShape: 'pinky_j', desc: 'Pinky finger extended up while tracing a downward "J" swoop in the air.', hint: 'Start with pinky up and curve your wrist downward in a J.' },
  { symbol: 'K', handShape: 'k_victory', desc: 'Index upright, middle finger angled slightly forward, thumb resting at middle knuckle.', hint: 'Place thumb between index and middle fingers pointing up.' },
  { symbol: 'L', handShape: 'l_shape', desc: 'Index finger pointing straight up and thumb extended sideways forming an "L".', hint: 'Make a crisp right-angle "L" with thumb and index finger.' },
  { symbol: 'M', handShape: 'three_over', desc: 'Thumb tucked under first three fingers (index, middle, ring), pinky curled.', hint: 'Tuck thumb beneath index, middle, and ring fingers.' },
  { symbol: 'N', handShape: 'two_over', desc: 'Thumb tucked under first two fingers (index and middle), ring and pinky curled.', hint: 'Tuck thumb beneath index and middle fingers only.' },
  { symbol: 'O', handShape: 'o_circle', desc: 'All four fingertips curved to touch thumb tip, forming a circular "O".', hint: 'Bring all fingertips together with thumb to make an enclosed ring.' },
  { symbol: 'P', handShape: 'p_downward', desc: 'Like "K" pointing downwards: index down, middle angled forward, thumb in between.', hint: 'Tilt your hand downward while holding the K finger posture.' },
  { symbol: 'Q', handShape: 'q_downward', desc: 'Like "G" pointing downwards: index and thumb pointing straight down.', hint: 'Tilt index finger and thumb pointing straight toward the ground.' },
  { symbol: 'R', handShape: 'crossed_fingers', desc: 'Middle finger crossed over index finger, both pointing straight up.', hint: 'Cross your middle finger tightly over your index finger.' },
  { symbol: 'S', handShape: 'fist_thumb_front', desc: 'Tight fist with thumb folded horizontally across front of curled fingers.', hint: 'Wrap thumb across the front of your curled fingers.' },
  { symbol: 'T', handShape: 'thumb_under_index', desc: 'Thumb tucked between index and middle finger, index hooked over thumb.', hint: 'Tuck thumb between index and middle; curl other fingers.' },
  { symbol: 'U', handShape: 'two_together', desc: 'Index and middle fingers extended straight up pressed tightly together.', hint: 'Hold index and middle fingers straight up with no gap between them.' },
  { symbol: 'V', handShape: 'v_peace', desc: 'Index and middle fingers extended straight up spread apart in a "V" peace sign.', hint: 'Spread index and middle fingers apart in a clear peace sign.' },
  { symbol: 'W', handShape: 'three_spread', desc: 'Index, middle, and ring fingers extended upright spread apart in a "W".', hint: 'Extend three fingers upright and spread them into a W.' },
  { symbol: 'X', handShape: 'index_hook', desc: 'Index finger bent into a hook shape, all other fingers closed into a fist.', hint: 'Bend only the index finger like a pirate hook.' },
  { symbol: 'Y', handShape: 'shaka', desc: 'Thumb and pinky extended outward, middle three fingers folded into palm.', hint: 'Extend thumb and pinky wide in a classic shaka sign.' },
  { symbol: 'Z', handShape: 'z_trace', desc: 'Index finger extended tracing the letter "Z" pattern in the air.', hint: 'Point index finger and trace a sharp Z in the air.' }
];

export const ASL_NUMBERS = [
  { symbol: '0', handShape: 'o_circle', desc: 'Fingertips touching thumb to form an oval "0" shape.', hint: 'Form a round zero ring with all fingers touching thumb.' },
  { symbol: '1', handShape: 'index_up', desc: 'Index finger pointing straight up, other fingers curled with thumb across.', hint: 'Point only index finger straight up with palm facing forward.' },
  { symbol: '2', handShape: 'v_peace', desc: 'Index and middle fingers extended upright spread apart in a "V".', hint: 'Extend two fingers upright spread apart.' },
  { symbol: '3', handShape: 'three_asl_num', desc: 'Thumb, index, and middle fingers extended upright. Ring and pinky curled.', hint: 'Extend thumb, index, and middle fingers outward.' },
  { symbol: '4', handShape: 'four_up', desc: 'Four fingers extended upright spread apart, thumb folded across palm.', hint: 'Hold four fingers straight up and fold thumb inside palm.' },
  { symbol: '5', handShape: 'five_spread', desc: 'Open hand with all five fingers spread wide apart.', hint: 'Open all five fingers wide facing the camera.' },
  { symbol: '6', handShape: 'pinky_touch', desc: 'Pinky finger tip touches thumb tip, other three fingers extended straight up.', hint: 'Touch pinky to thumb, hold remaining three fingers upright.' },
  { symbol: '7', handShape: 'ring_touch', desc: 'Ring finger tip touches thumb tip, other three fingers extended straight up.', hint: 'Touch ring finger to thumb, keep other three fingers upright.' },
  { symbol: '8', handShape: 'middle_touch', desc: 'Middle finger tip touches thumb tip, other three fingers extended straight up.', hint: 'Touch middle finger to thumb, keep other three fingers upright.' },
  { symbol: '9', handShape: 'ok_circle', desc: 'Index finger tip touches thumb tip, other three fingers extended straight up.', hint: 'Touch index finger to thumb, keep other three fingers upright.' }
];

export const FSL_LETTERS = [
  ...ASL_LETTERS.map((item) => ({
    ...item,
    desc: `FSL Letter ${item.symbol}: ${item.desc.replace('ASL', 'FSL')}`,
    hint: `FSL ${item.symbol}: ${item.hint}`
  })),
  {
    symbol: 'Ñ',
    handShape: 'two_over',
    desc: 'FSL Letter Ñ: Form letter "N" (thumb under index and middle) and make a slight horizontal wave gesture.',
    hint: 'FSL Ñ: Form the N hand shape and wave slightly sideways.'
  }
];

export const FSL_NUMBERS = ASL_NUMBERS.map((item) => ({
  ...item,
  desc: `FSL Number ${item.symbol}: ${item.desc.replace('ASL', 'FSL')}`,
  hint: `FSL ${item.symbol}: ${item.hint}`
}));

// Master Array of All Curriculum Signs (36 ASL + 37 FSL = 73 Total)
export const ALL_CURRICULUM_SIGNS = [
  ...ASL_LETTERS.map((l) => ({
    id: `asl_${l.symbol.toLowerCase()}`,
    signKey: `ASL_${l.symbol}`,
    dialect: 'ASL',
    type: 'Letter',
    symbol: l.symbol,
    title: `ASL Letter ${l.symbol}`,
    description: l.desc,
    hint: l.hint,
    handShape: l.handShape
  })),
  ...ASL_NUMBERS.map((n) => ({
    id: `asl_${n.symbol}`,
    signKey: `ASL_${n.symbol}`,
    dialect: 'ASL',
    type: 'Number',
    symbol: n.symbol,
    title: `ASL Number ${n.symbol}`,
    description: n.desc,
    hint: n.hint,
    handShape: n.handShape
  })),
  ...FSL_LETTERS.map((l) => ({
    id: `fsl_${l.symbol.toLowerCase()}`,
    signKey: `FSL_${l.symbol}`,
    dialect: 'FSL',
    type: 'Letter',
    symbol: l.symbol,
    title: `FSL Letter ${l.symbol}`,
    description: l.desc,
    hint: l.hint,
    handShape: l.handShape
  })),
  ...FSL_NUMBERS.map((n) => ({
    id: `fsl_${n.symbol}`,
    signKey: `FSL_${n.symbol}`,
    dialect: 'FSL',
    type: 'Number',
    symbol: n.symbol,
    title: `FSL Number ${n.symbol}`,
    description: n.desc,
    hint: n.hint,
    handShape: n.handShape
  }))
];

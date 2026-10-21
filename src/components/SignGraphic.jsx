import React from 'react';

/**
 * Realistic Anatomical Vector Hand Graphic Component for Sign Language Curriculum
 * Renders lifelike hands with organic human skin gradients, articulated phalanges,
 * realistic knuckle contours, keratin fingernails, and accurate poses for all 36 canonical symbols (A-Z, Ñ, 0-9).
 */
export default function SignGraphic({ symbol = '', dialect = 'ASL', handShape = '', size = 180, isMastered = false, showPromptBadge = true }) {
  const isASL = dialect === 'ASL';
  const accentColor = isASL ? '#38bdf8' : '#34d399';  // Bright cyan (ASL) / Mint emerald (FSL)
  const glowColor = isMastered
    ? 'rgba(16, 185, 129, 0.2)'
    : isASL
      ? 'rgba(56, 189, 248, 0.14)'
      : 'rgba(52, 211, 153, 0.14)';

  // Clean symbol string (e.g. 'A', '1', 'Ñ')
  const sym = (symbol || '').trim().toUpperCase();

  // Unique identifier for gradient definitions per sign instance
  const uid = `${dialect}-${sym || handShape || 'default'}-${size}`;

  // -------------------------------------------------------------
  // REUSABLE ANATOMICAL SUB-ELEMENTS
  // -------------------------------------------------------------

  // Forearm and Wrist Base (curves into bottom edge)
  const renderWristAndForearm = () => (
    <g>
      {/* Forearm skin mass */}
      <path
        d="M 78 185 C 78 160, 81 146, 84 138 L 116 138 C 119 146, 122 160, 122 185 Z"
        fill={`url(#skinWrist-${uid})`}
      />
      {/* Wrist flexion creases */}
      <path
        d="M 85 160 C 94 163, 106 163, 115 160"
        stroke="#7e3b1c"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.45"
        fill="none"
      />
      <path
        d="M 87 167 C 95 170, 105 170, 113 167"
        stroke="#7e3b1c"
        strokeWidth="1.0"
        strokeLinecap="round"
        opacity="0.35"
        fill="none"
      />
    </g>
  );

  // Palmar Mass (fleshy thenar & hypothenar pads)
  const renderPalmarBody = (hasOpenPalm = true) => (
    <g>
      {/* Palm Contour */}
      <path
        d="M 72 140 C 66 128, 68 108, 77 96 C 84 90, 116 88, 123 96 C 131 108, 132 126, 124 140 C 118 144, 78 144, 72 140 Z"
        fill={`url(#skinBase-${uid})`}
      />
      {hasOpenPalm && (
        <>
          {/* Thenar pad (thumb ball cushion) */}
          <path
            d="M 74 138 C 70 125, 74 112, 85 110 C 92 118, 92 134, 84 139 Z"
            fill={`url(#thenarPad-${uid})`}
            opacity="0.9"
          />
          {/* Hypothenar pad (pinky side) */}
          <path
            d="M 122 136 C 126 126, 124 114, 114 112 C 108 120, 110 134, 116 138 Z"
            fill={`url(#thenarPad-${uid})`}
            opacity="0.7"
          />
          {/* Palmar flexion crease (life line) */}
          <path
            d="M 78 116 C 88 118, 96 126, 98 138"
            stroke="#7e3b1c"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.5"
            fill="none"
          />
          {/* Heart/head line crease */}
          <path
            d="M 77 106 C 90 105, 108 112, 120 110"
            stroke="#7e3b1c"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.45"
            fill="none"
          />
        </>
      )}
    </g>
  );

  // Dorsal (back of hand) Mass with metacarpal knuckle highlights
  const renderDorsalBody = () => (
    <g>
      <path
        d="M 72 140 C 66 128, 68 108, 77 96 C 84 90, 116 88, 123 96 C 131 108, 132 126, 124 140 Z"
        fill={`url(#skinBase-${uid})`}
      />
      {/* Metacarpal tendon lines */}
      <path d="M 83 98 L 86 136" stroke="#fce2d0" strokeWidth="1.1" opacity="0.35" strokeLinecap="round" />
      <path d="M 94 94 L 95 136" stroke="#fce2d0" strokeWidth="1.1" opacity="0.35" strokeLinecap="round" />
      <path d="M 106 96 L 105 136" stroke="#fce2d0" strokeWidth="1.1" opacity="0.35" strokeLinecap="round" />
      <path d="M 117 102 L 114 136" stroke="#fce2d0" strokeWidth="1.0" opacity="0.35" strokeLinecap="round" />
      {/* Knuckle arches */}
      <circle cx="83" cy="98" r="4.5" fill="#fcdbc6" opacity="0.6" />
      <circle cx="94" cy="94" r="5" fill="#fcdbc6" opacity="0.65" />
      <circle cx="106" cy="96" r="4.8" fill="#fcdbc6" opacity="0.6" />
      <circle cx="117" cy="102" r="4.2" fill="#fcdbc6" opacity="0.55" />
    </g>
  );

  // Extended finger with a softly tapered silhouette, joint volume, and a
  // translucent nail bed. This avoids the rigid tube/rectangle look while
  // preserving each sign's existing geometry.
  const renderExtendedFinger = ({ x, y, width = 11, height = 66, tilt = 0, showNail = true, palmar = false }) => {
    const rx = width / 2;
    const inset = width * 0.13;
    return (
      <g transform={`rotate(${tilt}, ${x + rx}, ${y + height})`}>
        {/* Natural tapered finger contour */}
        <path
          d={`M ${x + rx} ${y}
            C ${x + width * 0.18} ${y + 2}, ${x + width * 0.06} ${y + height * 0.16}, ${x + inset} ${y + height * 0.35}
            C ${x + width * 0.08} ${y + height * 0.58}, ${x + width * 0.12} ${y + height * 0.82}, ${x + width * 0.2} ${y + height}
            L ${x + width * 0.8} ${y + height}
            C ${x + width * 0.88} ${y + height * 0.82}, ${x + width * 0.92} ${y + height * 0.58}, ${x + width - inset} ${y + height * 0.35}
            C ${x + width * 0.94} ${y + height * 0.16}, ${x + width * 0.82} ${y + 2}, ${x + rx} ${y} Z`}
          fill={`url(#fingerGrad-${uid})`}
          stroke="#a96d58"
          strokeWidth="0.45"
        />
        {/* PIP joint crease */}
        <path
          d={`M ${x + 2} ${y + height * 0.42} Q ${x + rx} ${y + height * 0.42 + (palmar ? 1.5 : -1.5)} ${x + width - 2} ${y + height * 0.42}`}
          stroke="#8b5946"
          strokeWidth="0.75"
          strokeLinecap="round"
          opacity="0.6"
          fill="none"
        />
        {/* DIP joint crease */}
        <path
          d={`M ${x + 2.5} ${y + height * 0.22} Q ${x + rx} ${y + height * 0.22 + (palmar ? 1.2 : -1.2)} ${x + width - 2.5} ${y + height * 0.22}`}
          stroke="#8b5946"
          strokeWidth="0.65"
          strokeLinecap="round"
          opacity="0.55"
          fill="none"
        />
        {/* Dorsal Fingernail */}
        {showNail && !palmar && (
          <g>
            <path
              d={`M ${x + rx} ${y + 3}
                C ${x + 2.4} ${y + 4}, ${x + 2.1} ${y + width * 0.8}, ${x + rx} ${y + width * 0.96}
                C ${x + width - 2.1} ${y + width * 0.8}, ${x + width - 2.4} ${y + 4}, ${x + rx} ${y + 3} Z`}
              fill={`url(#nailGrad-${uid})`}
              stroke="#c38a78"
              strokeWidth="0.4"
            />
            {/* Glossy specular highlight */}
            <path
              d={`M ${x + 3.2} ${y + 5} Q ${x + rx} ${y + 4.2} ${x + width - 3.2} ${y + 5}`}
              stroke="#ffffff"
              strokeWidth="0.8"
              opacity="0.75"
              strokeLinecap="round"
            />
          </g>
        )}
        {/* Palmar fingertip pad highlight */}
        {palmar && (
          <ellipse
            cx={x + rx}
            cy={y + rx + 1}
            rx={rx - 2}
            ry={rx - 1}
            fill="#fae0cf"
            opacity="0.55"
          />
        )}
      </g>
    );
  };

  const renderSideFinger = ({ x, y, length = 56, width = 11, showNail = true }) => {
    const half = width / 2;
    return (
      <g>
        <path
          d={`M ${x} ${y + half}
            C ${x + 2} ${y + width * 0.17}, ${x + length * 0.18} ${y + width * 0.08}, ${x + length * 0.34} ${y + width * 0.13}
            C ${x + length * 0.57} ${y + width * 0.06}, ${x + length * 0.82} ${y + width * 0.12}, ${x + length} ${y + half}
            C ${x + length * 0.82} ${y + width * 0.88}, ${x + length * 0.57} ${y + width * 0.94}, ${x + length * 0.34} ${y + width * 0.87}
            C ${x + length * 0.18} ${y + width * 0.92}, ${x + 2} ${y + width * 0.83}, ${x} ${y + half} Z`}
          fill={`url(#fingerGrad-${uid})`}
          stroke="#a96d58"
          strokeWidth="0.45"
        />
        <path d={`M ${x + length * 0.42} ${y + 2} Q ${x + length * 0.44} ${y + half} ${x + length * 0.42} ${y + width - 2}`} stroke="#8b5946" strokeWidth="0.65" opacity="0.52" fill="none" />
        {showNail && <ellipse cx={x + length - width * 0.45} cy={y + half} rx={width * 0.34} ry={width * 0.26} fill={`url(#nailGrad-${uid})`} opacity="0.9" />}
      </g>
    );
  };

  // Curled knuckle segment with an asymmetric, fleshy silhouette rather than
  // a perfect circle/rounded rectangle.
  const renderCurledKnuckle = (cx, cy, r = 7) => (
    <g>
      <path
        d={`M ${cx - r * 0.92} ${cy + r * 0.72}
          C ${cx - r * 1.15} ${cy - r * 0.15}, ${cx - r * 0.76} ${cy - r * 1.35}, ${cx} ${cy - r * 1.5}
          C ${cx + r * 0.82} ${cy - r * 1.34}, ${cx + r * 1.12} ${cy - r * 0.26}, ${cx + r * 0.92} ${cy + r * 0.76}
          C ${cx + r * 0.65} ${cy + r * 1.2}, ${cx - r * 0.62} ${cy + r * 1.2}, ${cx - r * 0.92} ${cy + r * 0.72} Z`}
        fill={`url(#fingerGrad-${uid})`}
        stroke="#a96d58"
        strokeWidth="0.45"
      />
      {/* Skin fold crease */}
      <path
        d={`M ${cx - r + 1.5} ${cy} C ${cx} ${cy - 2}, ${cx + r - 1.5} ${cy - 2}, ${cx + r - 1.5} ${cy}`}
        stroke="#875441"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.65"
        fill="none"
      />
      {/* Highlight on knuckle apex */}
      <ellipse cx={cx - r * 0.08} cy={cy - r * 0.78} rx={r * 0.62} ry={r * 0.3} fill="#f7d8c8" opacity="0.42" />
    </g>
  );

  // -------------------------------------------------------------
  // POSTURE DRAWING SELECTOR FOR ALL 36 CANONICAL SIGNS
  // -------------------------------------------------------------
  const renderHandSignPose = () => {
    switch (sym) {
      // ==============================================================
      // 1. ALPHABET A TO Z + Ñ
      // ==============================================================
      case 'A':
        // Closed fist, thumb straight up resting flat alongside index finger
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {/* 4 curled knuckles */}
            {renderCurledKnuckle(82, 102, 6.5)}
            {renderCurledKnuckle(94, 98, 7)}
            {renderCurledKnuckle(106, 101, 6.8)}
            {renderCurledKnuckle(118, 107, 6)}
            {/* Upright Thumb along index side */}
            <g>
              <rect x="66" y="80" width="13" height="48" rx="6.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
              {/* Thumb nail */}
              <rect x="68" y="83" width="9" height="9" rx="4" fill={`url(#nailGrad-${uid})`} stroke="#c78672" strokeWidth="0.6" />
              <path d="M 69 85 Q 72.5 84 76 85" stroke="#ffffff" strokeWidth="0.8" opacity="0.7" strokeLinecap="round" />
              {/* Joint crease */}
              <path d="M 68 104 Q 72.5 106 77 104" stroke="#743315" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" fill="none" />
            </g>
          </g>
        );

      case 'B':
        // 4 fingers upright touching together, thumb folded flat across palm
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {/* 4 extended fingers side-by-side */}
            {renderExtendedFinger({ x: 77, y: 35, width: 10, height: 65, tilt: -1, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 88, y: 28, width: 10, height: 72, tilt: 0, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 99, y: 32, width: 10, height: 68, tilt: 0.5, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 110, y: 44, width: 9.5, height: 56, tilt: 1.5, showNail: false, palmar: true })}
            {/* Thumb folded across palm */}
            <path
              d="M 68 136 C 75 125, 96 120, 114 125 C 114 133, 94 138, 70 142 Z"
              fill={`url(#fingerGrad-${uid})`}
              stroke="#964e2c"
              strokeWidth="0.9"
            />
            <ellipse cx="106" cy="126" rx="4.5" ry="3.5" fill="#fce4d4" opacity="0.6" />
          </g>
        );

      case 'C':
        // Curved C-shape profile: fingers and thumb arching towards each other
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {/* Curved hand body */}
            <path
              d="M 81 145 C 70 134, 66 112, 70 91 C 74 68, 90 52, 110 50 C 124 49, 136 54, 138 62 C 139 68, 132 73, 121 75 C 105 78, 96 87, 96 102 C 96 117, 106 124, 123 124 C 132 124, 137 128, 136 135 C 133 145, 119 149, 104 148 Z"
              fill={`url(#skinBase-${uid})`}
              stroke="#a96d58"
              strokeWidth="0.55"
            />
            {/* Arched fingers at top */}
            <path
              d="M 98 52 C 112 48, 132 50, 135 62"
              stroke="#743315"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.65"
              fill="none"
            />
            {/* Upper fingertips cluster */}
            <ellipse cx="132" cy="62" rx="6" ry="5.2" fill={`url(#fingerGrad-${uid})`} stroke="#a96d58" strokeWidth="0.45" />
            <ellipse cx="132" cy="61" rx="3.2" ry="2.1" fill="#f7d8c8" opacity="0.45" />
            {/* Lower thumb tip */}
            <ellipse cx="128" cy="128" rx="6.7" ry="5.5" fill={`url(#fingerGrad-${uid})`} stroke="#a96d58" strokeWidth="0.45" />
            <ellipse cx="127" cy="127" rx="3.8" ry="2.4" fill="#f7d8c8" opacity="0.45" />
          </g>
        );

      case 'D':
        // Index straight up, thumb touching middle, ring, pinky tips forming circle
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(false)}
            {/* Index upright */}
            {renderExtendedFinger({ x: 88, y: 26, width: 11, height: 74, tilt: 0, showNail: false, palmar: true })}
            {/* Curled 3 fingers meeting thumb */}
            {renderCurledKnuckle(106, 108, 7.5)}
            {renderCurledKnuckle(114, 116, 7)}
            {renderCurledKnuckle(121, 125, 6.5)}
            {/* Thumb touching them */}
            <path
              d="M 72 136 C 80 125, 94 116, 102 114"
              stroke={`url(#fingerGrad-${uid})`}
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Loop opening */}
            <ellipse cx="94" cy="122" rx="6.5" ry="5.5" fill="rgba(15, 23, 42, 0.7)" />
          </g>
        );

      case 'E':
        // 4 fingertips tightly curled down resting on top of folded thumb
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {/* Knuckles at top */}
            <circle cx="82" cy="85" r="6" fill="#fcdbc6" opacity="0.7" />
            <circle cx="94" cy="81" r="6.5" fill="#fcdbc6" opacity="0.75" />
            <circle cx="106" cy="83" r="6.2" fill="#fcdbc6" opacity="0.7" />
            <circle cx="118" cy="88" r="5.5" fill="#fcdbc6" opacity="0.65" />
            {/* Curled fingertips pressed downward */}
            {renderCurledKnuckle(81, 102, 6)}
            {renderCurledKnuckle(93, 99, 6.4)}
            {renderCurledKnuckle(105, 101, 6.2)}
            {renderCurledKnuckle(117, 106, 5.8)}
            {/* Nails on bent fingers */}
            <rect x="78" y="106" width="6" height="6" rx="2.5" fill={`url(#nailGrad-${uid})`} />
            <rect x="90" y="104" width="6" height="6" rx="2.5" fill={`url(#nailGrad-${uid})`} />
            <rect x="102" y="105" width="6" height="6" rx="2.5" fill={`url(#nailGrad-${uid})`} />
            <rect x="114" y="108" width="5.5" height="5.5" rx="2.5" fill={`url(#nailGrad-${uid})`} />
            {/* Folded thumb beneath them */}
            <path d="M 70 128 C 80 122, 105 120, 118 125" stroke="#7e3b1c" strokeWidth="7" strokeLinecap="round" />
            <path d="M 70 128 C 80 122, 105 120, 118 125" stroke={`url(#fingerGrad-${uid})`} strokeWidth="5.5" strokeLinecap="round" />
          </g>
        );

      case 'F':
      case '9':
        // Index & thumb form circle (OK sign), other 3 fingers straight upright spread
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {/* 3 upright spread fingers: Middle, Ring, Pinky */}
            {renderExtendedFinger({ x: 92, y: 28, width: 10, height: 72, tilt: -3, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 104, y: 32, width: 10, height: 68, tilt: 2, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 116, y: 44, width: 9, height: 56, tilt: 7, showNail: false, palmar: true })}
            {/* Index & Thumb meeting in circle */}
            <circle cx="77" cy="104" r="14" fill="none" stroke={`url(#fingerGrad-${uid})`} strokeWidth="8" />
            <circle cx="77" cy="104" r="14" fill="none" stroke="#964e2c" strokeWidth="1" />
            <circle cx="77" cy="104" r="6" fill="rgba(15, 23, 42, 0.7)" />
          </g>
        );

      case 'G':
        // Index pointing horizontally forward, thumb parallel alongside it
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {/* Palm rotated */}
            <path d="M 75 145 C 70 125, 75 105, 85 95 L 115 110 C 120 125, 122 145, 120 145 Z" fill={`url(#skinBase-${uid})`} />
            {/* Curled middle, ring, pinky */}
            {renderCurledKnuckle(95, 120, 7)}
            {renderCurledKnuckle(106, 125, 6.6)}
            {renderCurledKnuckle(116, 132, 6)}
            {/* Horizontal Index finger */}
            {renderSideFinger({ x: 85, y: 86, length: 56, width: 12 })}
            {/* Parallel Thumb */}
            {renderSideFinger({ x: 80, y: 102, length: 46, width: 11 })}
          </g>
        );

      case 'H':
        // Index & Middle pointing horizontally together
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            <path d="M 75 145 C 70 125, 75 105, 85 95 L 115 110 C 120 125, 122 145, 120 145 Z" fill={`url(#skinBase-${uid})`} />
            {/* Curled ring and pinky */}
            {renderCurledKnuckle(104, 126, 6.6)}
            {renderCurledKnuckle(114, 133, 6)}
            {/* Index horizontal */}
            {renderSideFinger({ x: 86, y: 84, length: 56, width: 11 })}
            {/* Middle horizontal */}
            {renderSideFinger({ x: 86, y: 98, length: 58, width: 11 })}
            {/* Thumb folded over ring */}
            <path d="M 75 120 C 82 115, 96 114, 102 118" stroke={`url(#fingerGrad-${uid})`} strokeWidth="9" strokeLinecap="round" />
          </g>
        );

      case 'I':
        // Pinky straight up, other fingers in tight fist
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {/* Curled knuckles of index, middle, ring */}
            {renderCurledKnuckle(82, 102, 6.5)}
            {renderCurledKnuckle(94, 98, 7)}
            {renderCurledKnuckle(106, 101, 6.8)}
            {/* Upright Pinky */}
            {renderExtendedFinger({ x: 114, y: 38, width: 9.5, height: 68, tilt: 2, showNail: true, palmar: false })}
            {/* Thumb folded across knuckles */}
            <path d="M 72 128 C 80 118, 98 114, 108 118" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
            <ellipse cx="106" cy="118" rx="4.5" ry="3.5" fill="#fce2d2" opacity="0.65" />
          </g>
        );

      case 'J':
        // Pinky upright with dynamic J-tracing swoop arrow
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {renderCurledKnuckle(82, 102, 6.5)}
            {renderCurledKnuckle(94, 98, 7)}
            {renderCurledKnuckle(106, 101, 6.8)}
            {renderExtendedFinger({ x: 114, y: 38, width: 9.5, height: 68, tilt: 2, showNail: true, palmar: false })}
            <path d="M 72 128 C 80 118, 98 114, 108 118" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
            {/* Glowing J Motion Path & Arrow */}
            <path
              d="M 120 40 C 145 60, 148 110, 130 135 C 120 148, 100 152, 88 144"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="4 3"
              fill="none"
            />
            {/* Arrowhead */}
            <polygon points="86,140 82,148 92,148" fill="#f59e0b" />
          </g>
        );

      case 'K':
        // Index upright, middle tilted forward 45 deg, thumb upright between them
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {/* Curled ring and pinky */}
            {renderCurledKnuckle(106, 108, 6.8)}
            {renderCurledKnuckle(118, 114, 6)}
            {/* Index straight up */}
            {renderExtendedFinger({ x: 80, y: 28, width: 10.5, height: 72, tilt: -1, showNail: true, palmar: false })}
            {/* Middle finger tilted forward/upward */}
            {renderExtendedFinger({ x: 98, y: 40, width: 10.5, height: 64, tilt: 22, showNail: true, palmar: false })}
            {/* Thumb upright resting between them */}
            <rect x="88" y="72" width="11" height="38" rx="5.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <rect x="90" y="75" width="7" height="7" rx="3" fill={`url(#nailGrad-${uid})`} />
          </g>
        );

      case 'L':
        // Right-angle L: index straight up, thumb horizontal 90 deg
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {/* Curled middle, ring, pinky */}
            <circle cx="102" cy="112" r="7.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <circle cx="112" cy="118" r="7" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <circle cx="120" cy="126" r="6.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            {/* Upright Index */}
            {renderExtendedFinger({ x: 86, y: 26, width: 11, height: 74, tilt: 0, showNail: false, palmar: true })}
            {/* Horizontal Thumb */}
            <rect x="42" y="118" width="48" height="12" rx="6" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
            <ellipse cx="48" cy="124" rx="4.5" ry="3.5" fill="#fce4d4" opacity="0.6" />
          </g>
        );

      case 'M':
        // 3 fingers folded over thumb, thumb tip peeking out between ring and pinky
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {/* Curled 3 fingers (index, middle, ring) */}
            {renderCurledKnuckle(82, 98, 6.8)}
            {renderCurledKnuckle(94, 95, 7.2)}
            {renderCurledKnuckle(106, 97, 7)}
            {/* Curled pinky */}
            {renderCurledKnuckle(118, 108, 6)}
            {/* Thumb tip protruding under ring finger */}
            <ellipse cx="112" cy="114" rx="5" ry="4" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <ellipse cx="112" cy="113" rx="3.2" ry="2.2" fill="#fce4d4" opacity="0.7" />
          </g>
        );

      case 'N':
        // 2 fingers folded over thumb, thumb tip peeking out between middle and ring
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {renderCurledKnuckle(82, 98, 6.8)}
            {renderCurledKnuckle(94, 95, 7.2)}
            {renderCurledKnuckle(106, 104, 6.8)}
            {renderCurledKnuckle(118, 110, 6)}
            {/* Thumb tip protruding under middle finger */}
            <ellipse cx="100" cy="112" rx="5.2" ry="4.2" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <ellipse cx="100" cy="111" rx="3.4" ry="2.3" fill="#fce4d4" opacity="0.7" />
          </g>
        );

      case 'Ñ':
        // FSL Ñ: N handshape with glowing tilde wave above
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {renderCurledKnuckle(82, 104, 6.8)}
            {renderCurledKnuckle(94, 101, 7.2)}
            {renderCurledKnuckle(106, 110, 6.8)}
            {renderCurledKnuckle(118, 116, 6)}
            <ellipse cx="100" cy="118" rx="5.2" ry="4.2" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            {/* Glowing FSL Tilde Wave (~) */}
            <path
              d="M 68 55 C 78 45, 92 65, 106 55 C 120 45, 134 65, 144 55"
              stroke="#10b981"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              filter="drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))"
            />
          </g>
        );

      case 'O':
      case '0':
        // Circular O formed by all fingertips meeting thumb tip
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            <path
              d="M 82 145 C 70 125, 70 82, 85 62 C 102 48, 128 50, 132 64 C 132 78, 122 88, 114 92 C 102 96, 92 108, 92 122 C 94 135, 105 140, 128 132 C 132 140, 124 148, 108 148 Z"
              fill={`url(#skinBase-${uid})`}
              stroke="#964e2c"
              strokeWidth="1"
            />
            {/* Enclosed oval ring meeting thumb */}
            <circle cx="106" cy="98" r="14" fill="rgba(15, 23, 42, 0.85)" stroke="#964e2c" strokeWidth="1" />
            <circle cx="122" cy="88" r="6" fill={`url(#fingerGrad-${uid})`} />
            <circle cx="120" cy="108" r="6.5" fill={`url(#fingerGrad-${uid})`} />
          </g>
        );

      case 'P':
        // K pointing downward
        return (
          <g filter={`url(#handShadow-${uid})`} transform="rotate(95, 100, 100)">
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {renderCurledKnuckle(106, 108, 6.8)}
            {renderCurledKnuckle(118, 114, 6)}
            {renderExtendedFinger({ x: 80, y: 28, width: 10.5, height: 72, tilt: -1, showNail: true, palmar: false })}
            {renderExtendedFinger({ x: 98, y: 40, width: 10.5, height: 64, tilt: 22, showNail: true, palmar: false })}
            <rect x="88" y="72" width="11" height="38" rx="5.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
          </g>
        );

      case 'Q':
        // G pointing downward
        return (
          <g filter={`url(#handShadow-${uid})`} transform="rotate(85, 100, 100)">
            {renderWristAndForearm()}
            <path d="M 75 145 C 70 125, 75 105, 85 95 L 115 110 C 120 125, 122 145, 120 145 Z" fill={`url(#skinBase-${uid})`} />
            <circle cx="95" cy="120" r="7.5" fill={`url(#fingerGrad-${uid})`} />
            <circle cx="106" cy="125" r="7" fill={`url(#fingerGrad-${uid})`} />
            <circle cx="116" cy="132" r="6.5" fill={`url(#fingerGrad-${uid})`} />
            <rect x="85" y="86" width="56" height="12" rx="6" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
            <rect x="80" y="102" width="46" height="11" rx="5.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
          </g>
        );

      case 'R':
        // Middle finger crossed over index finger upright
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {renderCurledKnuckle(106, 102, 6.8)}
            {renderCurledKnuckle(118, 108, 6)}
            {/* Index upright */}
            {renderExtendedFinger({ x: 86, y: 28, width: 10.5, height: 72, tilt: 3, showNail: true, palmar: false })}
            {/* Middle finger crossed over front */}
            {renderExtendedFinger({ x: 89, y: 26, width: 10.5, height: 74, tilt: -8, showNail: true, palmar: false })}
            {/* Thumb folded across knuckles */}
            <path d="M 72 128 C 80 118, 98 114, 108 118" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
          </g>
        );

      case 'S':
        // Tight fist with thumb wrapped horizontally across front of fingers
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {renderCurledKnuckle(82, 98, 6.5)}
            {renderCurledKnuckle(94, 94, 7)}
            {renderCurledKnuckle(106, 96, 6.8)}
            {renderCurledKnuckle(118, 102, 6)}
            {/* Thumb wrapped across front horizontally */}
            <path
              d="M 68 120 C 78 112, 105 110, 118 114"
              stroke={`url(#fingerGrad-${uid})`}
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path
              d="M 68 120 C 78 112, 105 110, 118 114"
              stroke="#964e2c"
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
            />
            {/* Thumb nail */}
            <ellipse cx="114" cy="114" rx="4.5" ry="3.8" fill={`url(#nailGrad-${uid})`} />
          </g>
        );

      case 'T':
        // Thumb tucked between index and middle (index hooked over thumb)
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {/* Thumb peeking out between index and middle */}
            <ellipse cx="90" cy="102" rx="5.5" ry="4.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <ellipse cx="90" cy="101" rx="3.5" ry="2.5" fill="#fce2d2" opacity="0.75" />
            {/* Index folded over thumb */}
            {renderCurledKnuckle(84, 96, 7)}
            {renderCurledKnuckle(96, 95, 7)}
            {renderCurledKnuckle(107, 98, 6.8)}
            {renderCurledKnuckle(118, 105, 6)}
          </g>
        );

      case 'U':
        // Index and middle fingers extended straight up pressed tightly together
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {renderCurledKnuckle(106, 112, 6.8)}
            {renderCurledKnuckle(118, 118, 6)}
            {/* Index & Middle touching side by side */}
            {renderExtendedFinger({ x: 84, y: 28, width: 10.5, height: 72, tilt: 0, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 95, y: 26, width: 10.5, height: 74, tilt: 0, showNail: false, palmar: true })}
            {/* Thumb folded over curled fingers */}
            <path d="M 74 130 C 82 120, 98 116, 108 120" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
          </g>
        );

      case 'V':
      case '2':
        // V peace sign: Index and Middle upright spread apart
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            <circle cx="106" cy="112" r="7.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <circle cx="118" cy="118" r="7" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            {/* Index leaning left */}
            {renderExtendedFinger({ x: 78, y: 30, width: 10.5, height: 72, tilt: -12, showNail: false, palmar: true })}
            {/* Middle leaning right */}
            {renderExtendedFinger({ x: 102, y: 28, width: 10.5, height: 74, tilt: 12, showNail: false, palmar: true })}
            {/* Thumb folded over ring */}
            <path d="M 74 130 C 82 120, 98 116, 108 120" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
          </g>
        );

      case 'W':
        // Index, middle, and ring extended upright spread apart in W
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            <circle cx="118" cy="118" r="7" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            {renderExtendedFinger({ x: 76, y: 32, width: 10, height: 70, tilt: -14, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 90, y: 26, width: 10, height: 74, tilt: 0, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 104, y: 30, width: 10, height: 70, tilt: 14, showNail: false, palmar: true })}
            {/* Thumb over pinky */}
            <path d="M 74 134 C 85 125, 105 122, 116 126" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
          </g>
        );

      case 'X':
        // Index finger bent into hook, other fingers curled
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {renderCurledKnuckle(94, 98, 7)}
            {renderCurledKnuckle(106, 101, 6.8)}
            {renderCurledKnuckle(118, 107, 6)}
            {/* Hooked index finger */}
            <path
              d="M 80 102 L 80 54 C 80 44, 96 44, 98 56 L 98 70"
              stroke={`url(#fingerGrad-${uid})`}
              strokeWidth="11"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 80 102 L 80 54 C 80 44, 96 44, 98 56 L 98 70"
              stroke="#964e2c"
              strokeWidth="0.9"
              strokeLinecap="round"
              fill="none"
            />
            {/* Hook tip nail */}
            <ellipse cx="98" cy="70" rx="4" ry="4" fill={`url(#nailGrad-${uid})`} />
            <path d="M 72 128 C 80 118, 98 114, 108 118" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
          </g>
        );

      case 'Y':
        // Shaka: Thumb and Pinky extended wide, middle 3 curled
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {/* Curled middle 3 */}
            {renderCurledKnuckle(88, 106, 6.5)}
            {renderCurledKnuckle(100, 104, 6.8)}
            {renderCurledKnuckle(111, 106, 6.5)}
            {/* Thumb extended wide left */}
            <g transform="rotate(-40, 75, 125)">
              <rect x="42" y="112" width="46" height="12" rx="6" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
              <rect x="44" y="114" width="7" height="8" rx="3" fill={`url(#nailGrad-${uid})`} />
            </g>
            {/* Pinky extended wide right */}
            <g transform="rotate(38, 120, 115)">
              <rect x="116" y="52" width="9.5" height="64" rx="4.7" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
              <rect x="118" y="55" width="6" height="7" rx="2.5" fill={`url(#nailGrad-${uid})`} />
            </g>
          </g>
        );

      case 'Z':
        // Index extended tracing Z in air with glowing trajectory
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(false)}
            {renderCurledKnuckle(94, 105, 7)}
            {renderCurledKnuckle(106, 108, 6.8)}
            {renderCurledKnuckle(118, 114, 6)}
            {/* Upright index pointing */}
            {renderExtendedFinger({ x: 82, y: 32, width: 10.5, height: 72, tilt: 6, showNail: false, palmar: true })}
            <path d="M 72 130 C 80 120, 96 116, 106 120" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
            {/* Glowing Z Trace Stroke */}
            <path
              d="M 68 35 L 125 35 L 75 75 L 135 75"
              stroke="#f59e0b"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray="5 3"
              filter="drop-shadow(0 0 6px rgba(245, 158, 11, 0.75))"
            />
          </g>
        );

      // ==============================================================
      // 2. DIGITS 1 TO 8 (0 and 9 handled above)
      // ==============================================================
      case '1':
        // Index straight up
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            <circle cx="95" cy="108" r="7.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <circle cx="106" cy="112" r="7.2" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <circle cx="117" cy="118" r="6.8" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            {renderExtendedFinger({ x: 82, y: 26, width: 11, height: 74, tilt: 0, showNail: false, palmar: true })}
            <path d="M 72 130 C 82 120, 98 116, 108 120" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
          </g>
        );

      case '3':
        // ASL/FSL 3: Thumb, Index, Middle extended; ring & pinky curled
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            <circle cx="108" cy="114" r="7.2" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <circle cx="118" cy="120" r="6.8" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            {/* Extended Index */}
            {renderExtendedFinger({ x: 80, y: 30, width: 10.5, height: 72, tilt: -6, showNail: false, palmar: true })}
            {/* Extended Middle */}
            {renderExtendedFinger({ x: 96, y: 28, width: 10.5, height: 74, tilt: 6, showNail: false, palmar: true })}
            {/* Extended Thumb */}
            <g transform="rotate(-35, 75, 125)">
              <rect x="42" y="112" width="46" height="12" rx="6" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
              <ellipse cx="48" cy="118" rx="4" ry="3.5" fill="#fce4d4" opacity="0.6" />
            </g>
          </g>
        );

      case '4':
        // 4 fingers upright, thumb folded in palm
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {renderExtendedFinger({ x: 74, y: 34, width: 9.8, height: 68, tilt: -8, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 86, y: 28, width: 10, height: 72, tilt: -2, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 98, y: 30, width: 10, height: 70, tilt: 3, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 110, y: 40, width: 9.5, height: 60, tilt: 9, showNail: false, palmar: true })}
            {/* Thumb folded across palm */}
            <path d="M 68 136 C 75 125, 96 120, 112 125 C 112 133, 94 138, 70 142 Z" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
          </g>
        );

      case '5':
        // 5 spread fingers open hand
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {/* Thumb spread out */}
            <g transform="rotate(-45, 75, 125)">
              <rect x="40" y="112" width="46" height="12" rx="6" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.9" />
              <ellipse cx="46" cy="118" rx="4" ry="3.5" fill="#fce4d4" opacity="0.6" />
            </g>
            {/* 4 spread fingers */}
            {renderExtendedFinger({ x: 74, y: 34, width: 9.8, height: 68, tilt: -12, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 88, y: 26, width: 10, height: 74, tilt: -4, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 102, y: 28, width: 10, height: 72, tilt: 5, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 116, y: 38, width: 9.5, height: 62, tilt: 15, showNail: false, palmar: true })}
          </g>
        );

      case '6':
        // Thumb touches pinky tip; index, middle, ring straight up
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {renderExtendedFinger({ x: 78, y: 30, width: 10, height: 70, tilt: -6, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 90, y: 26, width: 10, height: 74, tilt: 0, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 102, y: 30, width: 10, height: 70, tilt: 6, showNail: false, palmar: true })}
            {/* Pinky and thumb touching */}
            <circle cx="114" cy="116" r="7" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <path d="M 72 136 C 85 125, 100 118, 114 116" stroke={`url(#fingerGrad-${uid})`} strokeWidth="9" strokeLinecap="round" />
          </g>
        );

      case '7':
        // Thumb touches ring tip; index, middle, pinky straight up
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {renderExtendedFinger({ x: 78, y: 30, width: 10, height: 70, tilt: -6, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 90, y: 26, width: 10, height: 74, tilt: 0, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 114, y: 42, width: 9, height: 58, tilt: 10, showNail: false, palmar: true })}
            {/* Ring and thumb touching */}
            <circle cx="102" cy="114" r="7.2" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <path d="M 72 136 C 85 125, 95 116, 102 114" stroke={`url(#fingerGrad-${uid})`} strokeWidth="9" strokeLinecap="round" />
          </g>
        );

      case '8':
        // Thumb touches middle tip; index, ring, pinky straight up
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderPalmarBody(true)}
            {renderExtendedFinger({ x: 78, y: 30, width: 10, height: 70, tilt: -8, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 102, y: 32, width: 10, height: 68, tilt: 4, showNail: false, palmar: true })}
            {renderExtendedFinger({ x: 114, y: 42, width: 9, height: 58, tilt: 12, showNail: false, palmar: true })}
            {/* Middle and thumb touching */}
            <circle cx="90" cy="112" r="7.5" fill={`url(#fingerGrad-${uid})`} stroke="#964e2c" strokeWidth="0.8" />
            <path d="M 72 136 C 80 125, 86 116, 90 112" stroke={`url(#fingerGrad-${uid})`} strokeWidth="9" strokeLinecap="round" />
          </g>
        );

      default:
        // Universal fallback: natural fist with thumb
        return (
          <g filter={`url(#handShadow-${uid})`}>
            {renderWristAndForearm()}
            {renderDorsalBody()}
            {renderCurledKnuckle(82, 102, 6.5)}
            {renderCurledKnuckle(94, 98, 7)}
            {renderCurledKnuckle(106, 101, 6.8)}
            {renderCurledKnuckle(118, 107, 6)}
            <path d="M 72 128 C 80 118, 98 114, 108 118" stroke={`url(#fingerGrad-${uid})`} strokeWidth="10" strokeLinecap="round" />
          </g>
        );
    }
  };

  return (
    <div
      className="sign-graphic-stage"
      style={{
        position: 'relative',
        width: '100%',
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sign-stage-bg)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: `1px solid ${isMastered ? '#10b981' : 'var(--sign-stage-line)'}`,
        boxShadow: isMastered
          ? '0 0 20px rgba(16, 185, 129, 0.2)'
          : 'inset 0 -18px 28px rgba(15, 118, 110, 0.08), 0 8px 18px rgba(15, 23, 42, 0.08)',
      }}
    >
      {/* Background Decorative Tech Rings & Ambient Light */}
      <svg
        viewBox="0 0 200 200"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          filter: 'saturate(0.92) contrast(1.03)',
        }}
      >
        <defs>
          {/* Base Anatomical Skin Gradient */}
          <linearGradient id={`skinBase-${uid}`} x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#f2cfba" />
            <stop offset="45%" stopColor="#d8a28a" />
            <stop offset="100%" stopColor="#bb7f68" />
          </linearGradient>

          {/* Wrist Skin Transition */}
          <linearGradient id={`skinWrist-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#bd846d" />
            <stop offset="40%" stopColor="#efd2c0" />
            <stop offset="100%" stopColor="#ae755f" />
          </linearGradient>

          {/* 3D Cylindrical Finger Lighting */}
          <linearGradient id={`fingerGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#be8068" />
            <stop offset="28%" stopColor="#f3d3c0" />
            <stop offset="70%" stopColor="#d6a08a" />
            <stop offset="100%" stopColor="#b47761" />
          </linearGradient>

          {/* Fingernail Plate Reflection */}
          <linearGradient id={`nailGrad-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f5e2da" stopOpacity="0.9" />
            <stop offset="65%" stopColor="#e3c2b4" stopOpacity="0.76" />
            <stop offset="100%" stopColor="#ce9a88" stopOpacity="0.65" />
          </linearGradient>

          {/* Thenar Palm Pad Cushion */}
          <radialGradient id={`thenarPad-${uid}`} cx="40%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#f0d4c4" />
            <stop offset="60%" stopColor="#d6a18b" />
            <stop offset="100%" stopColor="#b77e68" />
          </radialGradient>

          {/* Realistic Anatomical Drop Shadow */}
          <filter id={`handShadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="rgba(72, 52, 42, 0.22)" />
          </filter>

          {/* Dialect Ambient Ring Glow */}
          <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.32" />
            <stop offset="75%" stopColor={accentColor} stopOpacity="0.05" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Quiet studio depth: no tech rings or neon glow competing with the posture. */}
        <ellipse cx="100" cy="170" rx="38" ry="7" fill="rgba(71, 96, 89, 0.11)" />

        {/* Realistic Anatomical Hand Sign Rendering */}
        {renderHandSignPose()}
      </svg>

      {/* The card heading carries the symbol; the stage is dedicated to the hand. */}
      <div
        style={{
          position: 'absolute',
          top: '0.65rem',
          right: '0.65rem',
          minWidth: '38px',
          height: '38px',
          padding: '0 0.5rem',
          borderRadius: '10px',
          background: isMastered ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.8)',
          border: `1.5px solid ${isMastered ? '#10b981' : accentColor}`,
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
          fontWeight: 900,
          color: isMastered ? '#34d399' : '#ffffff',
          boxShadow: `0 4px 12px ${isMastered ? 'rgba(16, 185, 129, 0.4)' : glowColor}`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 2,
        }}
      >
        {symbol}
      </div>

      {/* Interactive Camera Prompt Badge (Grid Cards only) */}
      {showPromptBadge && (
        <div
          style={{
            position: 'absolute',
            bottom: '0.38rem',
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(13, 148, 136, 0.16)',
            padding: '0.15rem 0.5rem',
            borderRadius: '999px',
            fontSize: '0.62rem',
            color: '#47746b',
            fontWeight: 650,
            display: 'none',
            alignItems: 'center',
            gap: '0.35rem',
            zIndex: 2,
          }}
        >
          <span>📷 Tap to Copy</span>
        </div>
      )}
    </div>
  );
}

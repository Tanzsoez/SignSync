import React from 'react';

/**
 * Custom 'I Love You' (🤟) Sign Language Hand Icon
 * Designed on a 24x24 grid matching standard Lucide icon aesthetics.
 * Features extended thumb, upright index, curled middle & ring, and upright pinky.
 */
export default function IlyHandIcon({
  size = 20,
  className = '',
  strokeWidth = 2,
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Left wrist base -> thumb splay -> index finger upright */}
      <path d="M7 21.5v-3.5c0-.8-.4-1.5-1-1.9L3.4 14a1.8 1.8 0 0 1-.2-2.5 1.8 1.8 0 0 1 2.5-.2l1.8 1.4V5a1.8 1.8 0 0 1 3.5 0v6" />
      {/* Curled middle finger knuckle */}
      <path d="M11 11c0-1.1.8-1.9 1.8-1.9s1.7.8 1.7 1.9v3" />
      {/* Curled ring finger knuckle */}
      <path d="M14.5 11c0-1.1.8-1.9 1.8-1.9s1.7.8 1.7 1.9v2.5" />
      {/* Upright pinky finger -> outer palm -> right wrist base */}
      <path d="M18 13.5V6a1.7 1.7 0 0 1 3.4 0v9.5c0 3.3-2.7 6-6 6h-.9" />
    </svg>
  );
}

export { IlyHandIcon };

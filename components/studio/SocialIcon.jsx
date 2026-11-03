'use client';
// app: a social platform's logo. Website and unknown platforms draw a globe.
import { css } from '@/lib/studio/css';
import { socialOf } from '@/lib/studio/socials';

export default function SocialIcon({ id, size = 16, mono }) {
  const so = socialOf(id);
  const color = !mono && so && so.color ? so.color : 'currentColor';
  if (!so || !so.path) {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={css('flex: none')}>
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"></path>
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={color} style={css('flex: none')}>
      <path d={so.path}></path>
    </svg>
  );
}

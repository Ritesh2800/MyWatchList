import React, { useState } from 'react';
import { getTmdbImageUrl } from '../services/tmdbApi';

interface MediaArtProps {
  title: string;
  path: string | null | undefined;
  size?: 'w500' | 'w1280' | 'w185';
  accentGradient?: [string, string];
  className?: string;
  variant?: 'poster' | 'backdrop';
}

const DEFAULT_GRADIENTS: [string, string][] = [
  ['#d4884a', '#572d16'],
  ['#4f79d4', '#162552'],
  ['#aeb88f', '#3d4c37'],
  ['#cf728b', '#4d2236'],
  ['#7bb3b0', '#234a50'],
  ['#9e83d4', '#392869'],
];

function fallbackGradient(title: string, provided?: [string, string]): [string, string] {
  if (provided) return provided;
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return DEFAULT_GRADIENTS[Math.abs(hash) % DEFAULT_GRADIENTS.length];
}

export const MediaArt: React.FC<MediaArtProps> = ({
  title,
  path,
  size = 'w500',
  accentGradient,
  className = '',
  variant = 'poster',
}) => {
  const [failed, setFailed] = useState(false);
  const url = !failed ? getTmdbImageUrl(path, size) : null;
  const [fromColor, toColor] = fallbackGradient(title, accentGradient);

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        background:
          variant === 'backdrop'
            ? `linear-gradient(135deg, ${fromColor} 0%, ${toColor} 100%)`
            : `linear-gradient(160deg, ${fromColor} 0%, ${toColor} 100%)`,
      }}
    >
      {/* Subtle atmospheric sheen */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background:
            'radial-gradient(circle at 25% 20%, rgba(255,255,255,0.42) 0%, transparent 58%)',
        }}
      />
      {url && (
        <img
          src={url}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="relative h-full w-full object-cover transition-opacity duration-200"
        />
      )}
    </div>
  );
};

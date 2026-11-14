import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTmdbImageProxyUrl } from '../services/tmdbApi';
import {
  deriveFallbackPalette,
  extractPaletteFromPixels,
  type PosterPalette,
} from '../utils/posterPalette';

interface PosterAmbientBackdropProps {
  title: string;
  posterPath: string | null | undefined;
  backdropPath?: string | null | undefined;
  accentGradient?: [string, string];
}

export const PosterAmbientBackdrop: React.FC<PosterAmbientBackdropProps> = ({
  title,
  posterPath,
  backdropPath,
  accentGradient,
}) => {
  const imageUrl = getTmdbImageProxyUrl(posterPath || backdropPath, 'w185');
  const fallback = useMemo(
    () => deriveFallbackPalette(title, accentGradient),
    [title, accentGradient]
  );

  const [extractedPalette, setExtractedPalette] = useState<PosterPalette | null>(null);
  const [paletteSource, setPaletteSource] = useState<'image' | 'fallback'>('fallback');
  const [posterLayerLoaded, setPosterLayerLoaded] = useState(false);

  useEffect(() => {
    setExtractedPalette(null);
    setPaletteSource('fallback');
    setPosterLayerLoaded(false);

    if (!imageUrl || typeof window === 'undefined') return;

    let cancelled = false;
    const img = new Image();

    img.onload = () => {
      if (cancelled) return;
      try {
        const w = 24;
        const h = 36;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const palette = extractPaletteFromPixels(data);
        if (palette && !cancelled) {
          setExtractedPalette(palette);
          setPaletteSource('image');
        }
      } catch {
        // Fallback gradient palette already active
      }
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const activePalette = extractedPalette || fallback;
  const portalTarget =
    typeof document !== 'undefined' ? document.getElementById('page-ambient-slot') : null;

  const content = (
    <div
      aria-hidden="true"
      data-testid="details-ambient-blur"
      data-palette-source={paletteSource}
      data-primary-color={activePalette.primary}
      data-secondary-color={activePalette.secondary}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      style={{
        maskImage:
          'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.88) 58%, rgba(0,0,0,0.32) 86%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage:
          'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,0.88) 58%, rgba(0,0,0,0.32) 86%, rgba(0,0,0,0) 100%)',
      }}
    >
      {/* Blurred poster layer directly echoes exact spatial poster hues */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          onLoad={() => setPosterLayerLoaded(true)}
          onError={() => setPosterLayerLoaded(false)}
          className={`animate-ambient-a absolute -top-[6%] -left-[6%] h-[74vh] w-[112%] max-w-none object-cover blur-[48px] saturate-[1.5] transition-opacity duration-700 ${
            posterLayerLoaded ? 'opacity-[0.34] dark:opacity-[0.48]' : 'opacity-0'
          }`}
        />
      )}

      {/* Animated color-matched ambient light orbs (smooth multi-stop gradients for zero GPU blur overhead) */}
      <div
        className="animate-ambient-a absolute -top-[14%] -left-[8%] h-[62vw] max-h-[680px] min-h-[360px] w-[62vw] max-w-[680px] min-w-[360px] rounded-full opacity-[0.42] transition-[background] duration-700 dark:opacity-[0.60]"
        style={{
          background: `radial-gradient(circle at center, ${activePalette.primary}cc 0%, ${activePalette.primary}66 32%, ${activePalette.primary}1a 56%, transparent 74%)`,
        }}
      />
      <div
        className="animate-ambient-b absolute -top-[8%] -right-[8%] h-[58vw] max-h-[640px] min-h-[340px] w-[58vw] max-w-[640px] min-w-[340px] rounded-full opacity-[0.38] transition-[background] duration-700 dark:opacity-[0.54]"
        style={{
          background: `radial-gradient(circle at center, ${activePalette.secondary}cc 0%, ${activePalette.secondary}60 32%, ${activePalette.secondary}18 56%, transparent 74%)`,
        }}
      />
      <div
        className="animate-ambient-c absolute top-[18%] left-[18%] h-[52vw] max-h-[580px] min-h-[300px] w-[52vw] max-w-[580px] min-w-[300px] rounded-full opacity-[0.28] transition-[background] duration-700 dark:opacity-[0.42]"
        style={{
          background: `radial-gradient(circle at center, ${activePalette.highlight}b8 0%, ${activePalette.highlight}4d 34%, ${activePalette.highlight}14 58%, transparent 75%)`,
        }}
      />
    </div>
  );

  return portalTarget ? createPortal(content, portalTarget) : content;
};

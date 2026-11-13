import type { WatchProvider } from '../types/reelist';

export function normalizeProviderKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Generates a direct web search / landing URL for Indian & global streaming platforms
 * whenever an exact JustWatch deep-link URL is not available (e.g. offline catalog or unlinked title).
 */
export function buildProviderFallbackUrl(
  providerName: string,
  title: string,
  providerId?: number
): string {
  const key = normalizeProviderKey(providerName);
  const q = encodeURIComponent(title.trim());

  if (
    providerId === 122 ||
    providerId === 2336 ||
    key.includes('hotstar') ||
    key.includes('jiohotstar')
  ) {
    return `https://www.hotstar.com/in/explore?search_query=${q}`;
  }
  if (providerId === 2409 || providerId === 614 || key.includes('vimovies')) {
    return `https://moviesandtv.myvi.in/search?q=${q}`;
  }
  if (providerId === 8 || providerId === 1796 || key.includes('netflix')) {
    return `https://www.netflix.com/search?q=${q}`;
  }
  if (
    providerId === 119 ||
    providerId === 9 ||
    providerId === 10 ||
    providerId === 2100 ||
    key.includes('primevideo') ||
    key.includes('amazon')
  ) {
    return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`;
  }
  if (providerId === 350 || providerId === 2 || key.includes('appletv')) {
    return `https://tv.apple.com/search?term=${q}`;
  }
  if (providerId === 237 || key.includes('sonyliv')) {
    return `https://www.sonyliv.com/search?q=${q}`;
  }
  if (providerId === 232 || key.includes('zee5')) {
    return `https://www.zee5.com/search?q=${q}`;
  }
  if (providerId === 220 || key.includes('jiocinema')) {
    return `https://www.jiocinema.com/search/${q}`;
  }
  if (providerId === 515 || key.includes('mxplayer')) {
    return `https://www.mxplayer.in/search?q=${q}`;
  }
  if (providerId === 3 || key.includes('googleplay')) {
    return `https://play.google.com/store/search?q=${q}&c=movies`;
  }
  if (providerId === 192 || key.includes('youtube')) {
    return `https://www.youtube.com/results?search_query=${q}`;
  }
  if (providerId === 283 || key.includes('crunchyroll')) {
    return `https://www.crunchyroll.com/search?q=${q}`;
  }
  if (providerId === 561 || key.includes('lionsgate')) {
    return `https://lionsgateplay.com/search?q=${q}`;
  }
  if (providerId === 11 || key.includes('mubi')) {
    return `https://mubi.com/en/in/search?query=${q}`;
  }
  if (key.includes('aha')) {
    return `https://www.aha.video/search?q=${q}`;
  }
  if (key.includes('hoichoi')) {
    return `https://www.hoichoi.tv/search?q=${q}`;
  }
  if (key.includes('sunnxt')) {
    return `https://www.sunnxt.com/search?q=${q}`;
  }

  const combined = encodeURIComponent(`${title.trim()} ${providerName.trim()} watch online`);
  return `https://www.google.com/search?q=${combined}`;
}

export function resolveProviderUrl(
  provider: Pick<WatchProvider, 'providerId' | 'providerName' | 'url'>,
  title: string
): string {
  if (provider.url && /^https?:\/\//i.test(provider.url)) {
    return provider.url;
  }
  return buildProviderFallbackUrl(provider.providerName, title, provider.providerId);
}

/**
 * Always picks the first displayed streaming option (e.g., Netflix first over Prime Video
 * when multiple options exist, matching the Where to watch list order).
 */
export function getFirstStreamingProvider(providers: WatchProvider[]): WatchProvider | null {
  if (!providers || providers.length === 0) return null;
  return providers[0];
}

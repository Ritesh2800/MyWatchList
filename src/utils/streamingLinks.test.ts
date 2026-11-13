import assert from 'node:assert/strict';
import test from 'node:test';
import type { WatchProvider } from '../types/reelist';
import {
  buildProviderFallbackUrl,
  getFirstStreamingProvider,
  resolveProviderUrl,
} from './streamingLinks.ts';

test('resolveProviderUrl prefers exact deep-link url when present', () => {
  const provider: WatchProvider = {
    providerId: 2336,
    providerName: 'JioHotstar',
    logoPath: null,
    type: 'flatrate',
    url: 'https://www.hotstar.com/in/1260063525',
  };
  assert.equal(resolveProviderUrl(provider, 'Loki'), 'https://www.hotstar.com/in/1260063525');
});

test('buildProviderFallbackUrl generates direct OTT URLs for Indian & global providers', () => {
  assert.equal(
    buildProviderFallbackUrl('JioHotstar', 'Loki', 2336),
    'https://www.hotstar.com/in/explore?search_query=Loki'
  );
  assert.equal(
    buildProviderFallbackUrl('VI movies and tv', 'Loki', 2409),
    'https://moviesandtv.myvi.in/search?q=Loki'
  );
  assert.equal(
    buildProviderFallbackUrl('Netflix', 'The Mentalist', 8),
    'https://www.netflix.com/search?q=The%20Mentalist'
  );
  assert.equal(
    buildProviderFallbackUrl('Amazon Prime Video', 'The Mentalist', 119),
    'https://www.primevideo.com/search/ref=atv_nb_sr?phrase=The%20Mentalist'
  );
});

test('getFirstStreamingProvider always returns the first provider in list', () => {
  const providers: WatchProvider[] = [
    {
      providerId: 8,
      providerName: 'Netflix',
      logoPath: null,
      type: 'flatrate',
      url: 'https://www.netflix.com/title/70155590',
    },
    {
      providerId: 119,
      providerName: 'Amazon Prime Video',
      logoPath: null,
      type: 'flatrate',
      url: 'https://app.primevideo.com/detail?gti=123',
    },
  ];
  assert.equal(getFirstStreamingProvider(providers)?.providerName, 'Netflix');
  assert.equal(getFirstStreamingProvider([]), null);
});

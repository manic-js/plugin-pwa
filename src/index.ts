import { createPlugin } from "manicjs/config";

export interface PwaIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: "any" | "maskable" | "monochrome" | "any maskable";
}

export interface PwaScreenshot {
  src: string;
  sizes?: string;
  type?: string;
  formFactor?: "narrow" | "wide";
  label?: string;
}

export interface PwaShortcut {
  name: string;
  shortName?: string;
  description?: string;
  url: string;
  icons?: PwaIcon[];
}

export interface PwaAppleConfig {
  /** @default true */
  capable?: boolean;
  /** @default "default" */
  statusBarStyle?: "default" | "black" | "black-translucent";
  title?: string;
  touchIcon?: string;
}

export interface PwaRuntimeCache {
  pathPrefix: string;
  /** @default "cache-first" */
  strategy?: "cache-first" | "network-first" | "stale-while-revalidate";
  cacheName?: string;
  maxAgeSeconds?: number;
}

export interface PwaUpdateConfig {
  /** Reload open pages when a new service worker takes control. @default true */
  refreshOnUpdate?: boolean;
  /** Call registration.update() after registration. @default true */
  checkOnLoad?: boolean;
  /** Activate the new worker as soon as it installs. @default true */
  skipWaiting?: boolean;
  /** Claim open clients during activation. @default true */
  clientsClaim?: boolean;
}

export interface PwaConfig {
  /** Full application name shown during install. */
  name: string;
  /** Short application name for compact launcher surfaces. */
  shortName?: string;
  description?: string;
  /** @default "/" */
  startUrl?: string;
  /** @default "/" */
  scope?: string;
  /** @default "standalone" */
  display?: "fullscreen" | "standalone" | "minimal-ui" | "browser";
  /** @default "#ffffff" */
  backgroundColor?: string;
  /** @default "#000000" */
  themeColor?: string;
  /** @default "any" */
  orientation?:
    | "any"
    | "natural"
    | "landscape"
    | "landscape-primary"
    | "landscape-secondary"
    | "portrait"
    | "portrait-primary"
    | "portrait-secondary";
  lang?: string;
  categories?: string[];
  icons?: PwaIcon[];
  screenshots?: PwaScreenshot[];
  shortcuts?: PwaShortcut[];
  /** Extra raw manifest fields for platform-specific extensions. */
  manifest?: Record<string, unknown>;
  /** @default "/manifest.json" */
  manifestPath?: string;
  /** @default "/sw.js" */
  serviceWorkerPath?: string;
  /**
   * Custom service worker source. When set, Manic still emits the manifest and
   * registration script but skips the generated offline/cache worker.
   */
  serviceWorker?: string;
  /** @default "/" */
  serviceWorkerScope?: string;
  /** @default "manic-pwa-v1" */
  cacheName?: string;
  /** @default true */
  offline?: boolean;
  /** @default "/index.html" */
  navigationFallback?: string;
  offlineFallback?: string;
  /** Default runtime cache age. Omit for no age limit. */
  cacheMaxAgeSeconds?: number;
  /**
   * App shell URLs to cache during service worker install.
   * The manifest URL is included automatically.
   * @default ["/", "/index.html"]
   */
  precache?: string[];
  /**
   * Same-origin path prefixes cached with a cache-first strategy.
   * @default ["/assets/", "/chunks/", "/_bun/"]
   */
  cacheablePathPrefixes?: string[];
  /** Fine-grained runtime cache routes and strategies. */
  runtimeCaches?: PwaRuntimeCache[];
  /**
   * Inject the browser-side service worker registrar.
   * @default true
   */
  register?: boolean;
  /**
   * Register on localhost. Defaults to false to avoid sticky dev caches.
   * @default false
   */
  registerOnLocalhost?: boolean;
  update?: PwaUpdateConfig;
  /** iOS install metadata. Enabled by default. */
  apple?: PwaAppleConfig | false;
}

interface WebAppManifest {
  name: string;
  short_name?: string;
  description?: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  orientation: string;
  lang?: string;
  categories?: string[];
  icons?: PwaIcon[];
  screenshots?: Array<Omit<PwaScreenshot, "formFactor"> & { form_factor?: "narrow" | "wide" }>;
  shortcuts?: Array<Omit<PwaShortcut, "shortName"> & { short_name?: string }>;
}

function normalizePublicPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildManifest(config: PwaConfig): WebAppManifest & Record<string, unknown> {
  const manifest: WebAppManifest & Record<string, unknown> = {
    name: config.name,
    start_url: config.startUrl ?? "/",
    scope: config.scope ?? "/",
    display: config.display ?? "standalone",
    background_color: config.backgroundColor ?? "#ffffff",
    theme_color: config.themeColor ?? "#000000",
    orientation: config.orientation ?? "any",
    ...config.manifest,
  };

  if (config.shortName) manifest.short_name = config.shortName;
  if (config.description) manifest.description = config.description;
  if (config.lang) manifest.lang = config.lang;
  if (config.categories?.length) manifest.categories = config.categories;
  if (config.icons?.length) manifest.icons = config.icons;
  if (config.screenshots?.length) {
    manifest.screenshots = config.screenshots.map((screenshot) => {
      const { formFactor, ...rest } = screenshot;
      return formFactor ? { ...rest, form_factor: formFactor } : rest;
    });
  }
  if (config.shortcuts?.length) {
    manifest.shortcuts = config.shortcuts.map((shortcut) => {
      const { shortName, ...rest } = shortcut;
      return shortName ? { ...rest, short_name: shortName } : rest;
    });
  }

  return manifest;
}

function buildServiceWorker(config: PwaConfig, manifestPath: string): string {
  if (config.serviceWorker) return config.serviceWorker;

  const cacheName = config.cacheName ?? "manic-pwa-v1";
  const iconUrls = config.icons?.map((icon) => icon.src) ?? [];
  const offline = config.offline ?? true;
  const update = config.update ?? {};
  const precache = uniqueStrings([
    "/",
    "/index.html",
    manifestPath,
    ...(config.precache ?? []),
    ...iconUrls,
  ]).map((path) => normalizePublicPath(path));
  const cacheablePathPrefixes = config.cacheablePathPrefixes ?? ["/assets/", "/chunks/", "/_bun/"];
  const runtimeCaches =
    config.runtimeCaches ??
    cacheablePathPrefixes.map((pathPrefix) => ({
      pathPrefix,
      strategy: "cache-first" as const,
    }));
  const defaultMaxAge = config.cacheMaxAgeSeconds ?? null;
  const navigationFallback = normalizePublicPath(config.navigationFallback ?? "/index.html");
  const offlineFallback = config.offlineFallback
    ? normalizePublicPath(config.offlineFallback)
    : null;

  return `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(precache, null, 2)};
const RUNTIME_CACHES = ${JSON.stringify(runtimeCaches, null, 2)};
const DEFAULT_MAX_AGE_SECONDS = ${JSON.stringify(defaultMaxAge)};
const NAVIGATION_FALLBACK = ${JSON.stringify(navigationFallback)};
const OFFLINE_FALLBACK = ${JSON.stringify(offlineFallback)};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function cacheNameFor(route) {
  return route.cacheName || CACHE_NAME;
}

function maxAgeFor(route) {
  return route.maxAgeSeconds === undefined
    ? DEFAULT_MAX_AGE_SECONDS
    : route.maxAgeSeconds;
}

function isFresh(response, maxAgeSeconds) {
  if (!response || maxAgeSeconds === null || maxAgeSeconds === undefined) {
    return Boolean(response);
  }

  var cachedAt = Number(response.headers.get('x-manic-cache-time') || 0);
  return cachedAt > 0 && nowSeconds() - cachedAt <= maxAgeSeconds;
}

function withCacheTime(response) {
  var headers = new Headers(response.headers);
  headers.set('x-manic-cache-time', String(nowSeconds()));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

function putInCache(cacheName, request, response) {
  if (!response || response.status !== 200) return Promise.resolve(response);
  return caches.open(cacheName).then(function (cache) {
    return cache.put(request, withCacheTime(response.clone())).then(function () {
      return response;
    });
  });
}

function matchingRuntimeRoute(pathname) {
  return RUNTIME_CACHES.find(function (route) {
    return pathname.startsWith(route.pathPrefix);
  });
}

function cacheFirst(event, route) {
  var maxAgeSeconds = maxAgeFor(route);
  return caches.match(event.request).then(function (cached) {
    if (isFresh(cached, route.maxAgeSeconds ?? maxAgeSeconds)) return cached;
    return fetch(event.request).then(function (response) {
      return putInCache(cacheNameFor(route), event.request, response);
    });
  });
}

function networkFirst(event, route) {
  var maxAgeSeconds = maxAgeFor(route);
  return fetch(event.request)
    .then(function (response) {
      return putInCache(cacheNameFor(route), event.request, response);
    })
    .catch(function () {
      return caches.match(event.request).then(function (cached) {
        return isFresh(cached, route.maxAgeSeconds ?? maxAgeSeconds)
          ? cached
          : undefined;
      });
    });
}

function staleWhileRevalidate(event, route) {
  var cacheName = cacheNameFor(route);
  var fresh = fetch(event.request).then(function (response) {
    return putInCache(cacheName, event.request, response);
  });

  return caches.match(event.request).then(function (cached) {
    return cached || fresh;
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return Promise.allSettled(
          PRECACHE_URLS.map(function (url) {
            return cache.add(url).catch(function (error) {
              console.warn('[Manic PWA] Failed to precache', url, error);
            });
          })
        );
      })
      .then(function () {
        ${(update.skipWaiting ?? true) ? "return self.skipWaiting();" : "return undefined;"}
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.allSettled(
          keys.map(function (key) {
            return key === CACHE_NAME ? undefined : caches.delete(key);
          })
        );
      })
      .then(function () {
        ${(update.clientsClaim ?? true) ? "return self.clients.claim();" : "return undefined;"}
      })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  if (${JSON.stringify(offline)} && event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          return putInCache(CACHE_NAME, '/', response);
        })
        .catch(function () {
          return caches
            .match(event.request)
            .then(function (cached) {
              if (cached) return cached;
              return caches.match('/').then(function (root) {
                if (root) return root;
                return caches.match(NAVIGATION_FALLBACK).then(function (fallback) {
                  if (fallback) return fallback;
                  return OFFLINE_FALLBACK
                    ? caches.match(OFFLINE_FALLBACK)
                    : undefined;
                });
              });
            });
        })
    );
    return;
  }

  var route = matchingRuntimeRoute(url.pathname);
  if (!route && url.pathname.includes('main-')) {
    route = { pathPrefix: url.pathname, strategy: 'cache-first' };
  }
  if (!route) return;

  switch (route.strategy || 'cache-first') {
    case 'network-first':
      event.respondWith(networkFirst(event, route));
      return;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(event, route));
      return;
    default:
      event.respondWith(cacheFirst(event, route));
      return;
  }
});
`;
}

function buildRegisterScript(
  serviceWorkerPath: string,
  serviceWorkerScope: string,
  registerOnLocalhost: boolean,
  update: PwaUpdateConfig = {},
): string {
  const refreshOnUpdate = update.refreshOnUpdate ?? true;
  const checkOnLoad = update.checkOnLoad ?? true;

  return `<script>
(function () {
  if (!('serviceWorker' in navigator)) return;

${
  refreshOnUpdate
    ? `  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
`
    : ""
}
  window.addEventListener('load', function () {
    var host = window.location.hostname;
    var isLocalhost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host.startsWith('192.168.');

    if (isLocalhost && !${JSON.stringify(registerOnLocalhost)}) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (registration) {
          if (registration.active && registration.active.scriptURL.endsWith(${JSON.stringify(serviceWorkerPath)})) {
            registration.unregister();
          }
        });
      });
      return;
    }

    navigator.serviceWorker
      .register(${JSON.stringify(serviceWorkerPath)}, { scope: ${JSON.stringify(serviceWorkerScope)} })
      .then(function (registration) {
        ${checkOnLoad ? "registration.update();" : ""}
      })
      .catch(function (error) {
        console.error('[Manic PWA] Service Worker registration failed', error);
      });
  });
})();
</script>`;
}

function buildHtml(config: PwaConfig, manifestPath: string): string {
  const themeColor = config.themeColor ?? "#000000";
  const tags = [
    `<link rel="manifest" href="${escapeHtml(manifestPath)}">`,
    `<meta name="theme-color" content="${escapeHtml(themeColor)}">`,
  ];
  const apple = config.apple ?? {};

  if (apple) {
    if (apple.capable ?? true) {
      tags.push('<meta name="apple-mobile-web-app-capable" content="yes">');
    }
    tags.push(
      `<meta name="apple-mobile-web-app-status-bar-style" content="${escapeHtml(
        apple.statusBarStyle ?? "default",
      )}">`,
    );
    if (apple.title ?? config.shortName ?? config.name) {
      tags.push(
        `<meta name="apple-mobile-web-app-title" content="${escapeHtml(
          apple.title ?? config.shortName ?? config.name,
        )}">`,
      );
    }
    if (apple.touchIcon) {
      tags.push(`<link rel="apple-touch-icon" href="${escapeHtml(apple.touchIcon)}">`);
    }
  }

  if (config.register ?? true) {
    tags.push(
      buildRegisterScript(
        normalizePublicPath(config.serviceWorkerPath ?? "/sw.js"),
        config.serviceWorkerScope ?? "/",
        config.registerOnLocalhost ?? false,
        config.update,
      ),
    );
  }

  return tags.join("\n");
}

/**
 * Creates a PWA plugin for app manifests, install metadata, and offline caching.
 *
 * Generates:
 * - web app manifest
 * - root service worker
 * - manifest/theme/apple install tags
 * - browser-side service worker registration script
 *
 * @param config - PWA configuration
 * @returns ManicPlugin for PWA support
 * @see https://www.manicjs.tech/docs/framework/plugins/pwa#options
 *
 * @example
 * import { pwa } from '@manicjs/pwa';
 *
 * pwa({
 *   name: 'My App',
 *   shortName: 'App',
 *   themeColor: '#0a0a0a',
 *   icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
 * })
 */
export function pwa(config: Partial<PwaConfig> = {}) {
  const manifestPath = normalizePublicPath(config.manifestPath ?? "/manifest.json");
  const serviceWorkerPath = normalizePublicPath(config.serviceWorkerPath ?? "/sw.js");

  const getResolvedConfig = async (ctx: any) => {
    const seoPlugin = ctx?.config?.plugins?.find(
      (p: any) => p.name === "seo" || p.name === "@manicjs/seo",
    );
    const seoConfig = (seoPlugin as any)?.config || {};

    const name = config.name || seoConfig.title || ctx?.config?.app?.name || "Manic App";
    const shortName = config.shortName || name;
    const description = config.description || seoConfig.description;

    let icons = config.icons;
    if (!icons || icons.length === 0) {
      let faviconHref = "";
      try {
        const indexPath = `${ctx.cwd}/app/index.html`;
        if (await Bun.file(indexPath).exists()) {
          const htmlContent = await Bun.file(indexPath).text();
          const match = htmlContent.match(/<link[^>]*rel="[^"]*icon[^"]*"[^>]*href="([^"]+)"/iu);
          if (match) {
            faviconHref = match[1];
          }
        }
      } catch {
        // Ignore
      }

      if (!faviconHref) {
        faviconHref = "/favicon.ico";
      }

      let iconType = "image/x-icon";
      if (faviconHref.endsWith(".png")) iconType = "image/png";
      else if (faviconHref.endsWith(".svg")) iconType = "image/svg+xml";

      icons = [
        {
          src: faviconHref,
          sizes: "any",
          type: iconType,
        },
      ];
    }

    return {
      ...config,
      name,
      shortName,
      description,
      icons,
    } as PwaConfig;
  };

  return createPlugin({
    name: "@manicjs/pwa",
    staticFiles: [
      {
        path: manifestPath,
        content: async (ctx) => {
          const resolved = await getResolvedConfig(ctx);
          return JSON.stringify(buildManifest(resolved), null, 2);
        },
        contentType: "application/manifest+json; charset=utf-8",
      },
      {
        path: serviceWorkerPath,
        content: async (ctx) => {
          const resolved = await getResolvedConfig(ctx);
          return buildServiceWorker(resolved, manifestPath);
        },
        contentType: "application/javascript; charset=utf-8",
      },
    ],
    async configureServer(ctx) {
      const resolved = await getResolvedConfig(ctx);
      ctx.addLinkHeader?.(`<${manifestPath}>; rel="manifest"; type="application/manifest+json"`);
      const devResolved = { ...resolved, register: false };
      const html = buildHtml({ ...devResolved, serviceWorkerPath }, manifestPath);
      ctx.injectHtml(html);
    },
    async build(ctx) {
      const resolved = await getResolvedConfig(ctx);
      const html = buildHtml({ ...resolved, serviceWorkerPath }, manifestPath);
      ctx.injectHtml(html);
    },
  });
}

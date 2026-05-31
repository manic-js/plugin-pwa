<img src="https://github.com/rahuletto/manic/blob/main/demo/assets/wordmark.svg?raw=1" alt="Manic" width="300" />

[![npm version](https://img.shields.io/npm/v/%40manicjs%2Fpwa?logo=npm)](https://www.npmjs.com/package/@manicjs/pwa)
[![Bun](https://img.shields.io/badge/runtime-Bun-black?logo=bun)](https://bun.sh)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue)](https://opensource.org/licenses/GPL-3.0)

Official Manic plugin for Progressive Web App manifests, install metadata,
and service worker caching.

---

Manic is a high-performance React framework built exclusively for Bun.

It ships with a custom build pipeline, first-class plugin architecture, and
production-ready DX for local development, deployment, and AI-native workflows.

## Why Manic

- Bun-first runtime and tooling
- Fast transforms and minification powered by OXC
- File-based routing with production-ready deployment adapters
- Plugin system built for framework and AI-native workflows

## Documentation

- Website: [manicjs.tech](https://www.manicjs.tech/)
- Docs: [manicjs.tech/docs](https://www.manicjs.tech/docs)
- Package docs: [https://www.manicjs.tech/docs/framework/plugins/pwa](https://www.manicjs.tech/docs/framework/plugins/pwa)

## Install

```bash
bun add @manicjs/pwa
```

## Usage

```ts
import { defineConfig } from "manicjs/config";
import { pwa } from "@manicjs/pwa";

export default defineConfig({
  plugins: [
    pwa({
      name: "My Manic App",
      shortName: "Manic App",
      description: "An installable Manic application.",
      themeColor: "#0a0a0a",
      backgroundColor: "#0a0a0a",
      icons: [
        {
          src: "/assets/pwa/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/assets/pwa/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    }),
  ],
});
```

## Options

The plugin generates `/manifest.json`, `/sw.js`, PWA meta tags, and a
browser-side service worker registration script.

Common options:

- `name`: full install name for the app.
- `shortName`: compact install name.
- `description`: manifest description.
- `themeColor` and `backgroundColor`: install UI and splash colors.
- `icons`: manifest icons. Include `192x192` and `512x512` PNGs for broad
  install support.
- `screenshots`: optional install screenshots for richer app store surfaces.
- `shortcuts`: launcher shortcuts.
- `precache`: additional same-origin app shell URLs to cache on install.
- `offline`: enable navigation fallback support. Defaults to `true`.
- `navigationFallback`: HTML fallback for offline navigation. Defaults to
  `/index.html`.
- `offlineFallback`: optional custom offline page.
- `cacheMaxAgeSeconds`: default runtime cache age.
- `cacheablePathPrefixes`: static asset prefixes cached after first request.
- `runtimeCaches`: per-prefix strategies with `cache-first`, `network-first`,
  or `stale-while-revalidate`.
- `manifestPath`: custom manifest URL. Defaults to `/manifest.json`.
- `serviceWorkerPath`: custom service worker URL. Defaults to `/sw.js`.
- `serviceWorker`: custom service worker source for advanced PWA features such
  as push, background sync, app-specific offline logic, or custom cache routing.
- `serviceWorkerScope`: custom registration scope. Defaults to `/`.
- `update`: controls `skipWaiting`, `clientsClaim`, refresh-on-update, and
  update checks on load.
- `registerOnLocalhost`: opt in to service worker registration on localhost.
  Defaults to `false` to avoid stale development caches.

## License

GPL-3.0

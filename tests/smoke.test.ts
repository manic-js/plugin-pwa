import { describe, expect, it } from "bun:test";
import { pwa } from "../src/index";

describe("@manicjs/pwa", () => {
  it("creates a plugin descriptor", () => {
    const plugin = pwa({
      name: "Example App",
      shortName: "Example",
      description: "An installable Manic app.",
      themeColor: "#101010",
      backgroundColor: "#ffffff",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    });

    expect(plugin.name).toBe("@manicjs/pwa");
  });

  it("serves manifest JSON from config in dev", async () => {
    const plugin = pwa({
      name: "Example App",
      shortName: "Example",
      description: "An installable Manic app.",
      themeColor: "#101010",
      backgroundColor: "#ffffff",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    });
    const routes = new Map<string, () => Response | Promise<Response>>();
    const ctx = {
      addRoute(path: string, handler: () => Response | Promise<Response>) {
        routes.set(path, handler);
      },
      addLinkHeader() {},
      injectHtml() {},
    };

    await plugin.configureServer?.(ctx as never);

    const manifestResponse = await routes.get("/manifest.json")?.();
    const workerResponse = await routes.get("/sw.js")?.();
    const manifest = JSON.parse(await manifestResponse!.text());

    expect(manifest.name).toBe("Example App");
    expect(manifest.short_name).toBe("Example");
    expect(manifest.theme_color).toBe("#101010");
    expect(manifest.background_color).toBe("#ffffff");
    expect(manifest.icons).toHaveLength(1);
    expect(workerResponse?.headers.get("content-type")).toBe(
      "application/javascript; charset=utf-8",
    );
  });

  it("injects manifest metadata and the service worker registrar", async () => {
    const plugin = pwa({
      name: "Example App",
      shortName: "Example",
      themeColor: "#101010",
    });
    const injected: string[] = [];
    const ctx = {
      addRoute() {},
      addLinkHeader() {},
      emitClientFile() {},
      injectHtml(html: string) {
        injected.push(html);
      },
    };

    await plugin.configureServer?.(ctx as never);
    await plugin.build?.(ctx as never);

    expect(injected.join("\n")).toContain('<link rel="manifest" href="/manifest.json">');
    expect(injected.join("\n")).toContain('<meta name="theme-color" content="#101010">');
    expect(injected.join("\n")).toContain('.register("/sw.js", { scope: "/" })');
  });

  it("generates cache expiry and runtime strategy settings", async () => {
    const plugin = pwa({
      name: "Example App",
      shortName: "Example",
      cacheMaxAgeSeconds: 60,
      runtimeCaches: [
        {
          pathPrefix: "/api/",
          strategy: "network-first",
          cacheName: "api-cache",
          maxAgeSeconds: 30,
        },
      ],
    });
    const routes = new Map<string, () => Response | Promise<Response>>();
    const ctx = {
      addRoute(path: string, handler: () => Response | Promise<Response>) {
        routes.set(path, handler);
      },
      addLinkHeader() {},
      injectHtml() {},
    };

    await plugin.configureServer?.(ctx as never);

    const workerResponse = await routes.get("/sw.js")?.();
    const worker = await workerResponse!.text();

    expect(worker).toContain("const DEFAULT_MAX_AGE_SECONDS = 60;");
    expect(worker).toContain('"strategy": "network-first"');
    expect(worker).toContain('"cacheName": "api-cache"');
    expect(worker).toContain("isFresh(cached, route.maxAgeSeconds");
  });

  it("can disable automatic refresh when a new service worker takes over", async () => {
    const plugin = pwa({
      name: "Example App",
      shortName: "Example",
      update: {
        refreshOnUpdate: false,
        checkOnLoad: false,
      },
    });
    const injected: string[] = [];
    const ctx = {
      addRoute() {},
      addLinkHeader() {},
      emitClientFile() {},
      injectHtml(html: string) {
        injected.push(html);
      },
    };

    await plugin.configureServer?.(ctx as never);

    const html = injected.join("\n");
    expect(html).not.toContain("controllerchange");
    expect(html).not.toContain("registration.update();");
  });

  it("can emit a custom service worker and registration scope", async () => {
    const plugin = pwa({
      name: "Example App",
      shortName: "Example",
      serviceWorker: "self.addEventListener('push', function () {});",
      serviceWorkerScope: "/app/",
    });
    const routes = new Map<string, () => Response | Promise<Response>>();
    const injected: string[] = [];
    const ctx = {
      addRoute(path: string, handler: () => Response | Promise<Response>) {
        routes.set(path, handler);
      },
      addLinkHeader() {},
      emitClientFile() {},
      injectHtml(html: string) {
        injected.push(html);
      },
    };

    await plugin.configureServer?.(ctx as never);

    const workerResponse = await routes.get("/sw.js")?.();

    expect(await workerResponse!.text()).toBe("self.addEventListener('push', function () {});");
    expect(injected.join("\n")).toContain('.register("/sw.js", { scope: "/app/" })');
  });

  it("grabs fallbacks from config and SEO plugin if not explicitly provided", async () => {
    const seoPluginMock = {
      name: "seo",
      config: {
        title: "SEO Title",
        description: "SEO Description",
      },
    };
    const plugin = pwa();
    const routes = new Map<string, () => Response | Promise<Response>>();
    const ctx = {
      config: {
        app: { name: "App Name" },
        plugins: [seoPluginMock],
      },
      addRoute(path: string, handler: () => Response | Promise<Response>) {
        routes.set(path, handler);
      },
      addLinkHeader() {},
      injectHtml() {},
    };

    await plugin.configureServer?.(ctx as never);

    const manifestResponse = await routes.get("/manifest.json")?.();
    const manifest = JSON.parse(await manifestResponse!.text());

    expect(manifest.name).toBe("SEO Title");
    expect(manifest.description).toBe("SEO Description");
    expect(manifest.icons).toHaveLength(1);
    expect(manifest.icons[0].src).toBe("/favicon.ico");
  });
});

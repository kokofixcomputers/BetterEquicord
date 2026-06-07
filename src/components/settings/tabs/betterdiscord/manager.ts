/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { React } from "@webpack/common";

// Import the core BD compatibility functionality
import { BROWSERFS_BUILD_HASH } from "../../../../bdcompat/constants";
import { cleanupGlobal, createGlobalBdApi, getGlobalApi } from "../../../../bdcompat/fakeBdApi";
import { addContextMenu, addDiscordModules, FakeEventEmitter, fetchWithCorsProxyFallback, Patcher } from "../../../../bdcompat/fakeStuff";
import { addCustomPlugin, convertPlugin, removeAllCustomPlugins } from "../../../../bdcompat/pluginConstructor";
import { ReactUtils_filler } from "../../../../bdcompat/stuffFromBD";
import { aquireNative, compat_logger, FSUtils, getDeferred, patchMkdirSync, patchReadFileSync, reloadCompatLayer, ZIPUtils } from "../../../../bdcompat/utils";
import { DOMHolder } from "../../../../bdcompat/fakeBdApi"; // adjust path as needed


// Global declarations
declare global {
    interface Window {
        BrowserFS: any;
        BdCompatLayer: any;
        GeneratedPlugins: any[];
        BdApi: any;
        require: any;
        global: any;
        zip: any;
        Buffer: any;
    }
}

let ReImplementationObject: any;

export class BetterDiscordManager {
    private isInitialized = false;
    private originalBuffer: any = {};
    private globalWasNotExisting = false;
    private globalDefineWasNotExisting = false;

    async initialize() {
        if (this.isInitialized) return;

        const settings = Settings.bdCompat || {};
        const proxyUrl = settings.corsProxyUrl ?? "https://cors-get-proxy.sirjosh.workers.dev/?url=";

        const reimplementationsReady = getDeferred<void>();
        const reallyUsePoorlyMadeRealFs = IS_WEB ? false : (settings.usePoorlyMadeRealFs ?? false);

        // Create the compat layer and global objects FIRST
        ReImplementationObject = this.createReImplementationObject(proxyUrl, settings);
        const windowBdCompatLayer = this.createCompatLayer(proxyUrl);
        window.BdCompatLayer = windowBdCompatLayer;
        window.GeneratedPlugins = [];

        if (!reallyUsePoorlyMadeRealFs) {
            await this.setupBrowserFS(proxyUrl, settings, reimplementationsReady, windowBdCompatLayer);
        } else {
            await this.setupNativeFS(reimplementationsReady, settings, windowBdCompatLayer);
        }

        await this.setupGlobalAPIs(proxyUrl, reimplementationsReady, settings, windowBdCompatLayer);

        // Load plugins asynchronously in background after initialization
        this.loadExistingPluginsAsync(windowBdCompatLayer);

        this.isInitialized = true;
    }

    private async setupBrowserFS(proxyUrl: string, settings: any, reimplementationsReady: any, windowBdCompatLayer: any) {
        const response = await fetch(
            proxyUrl + `https://github.com/LosersUnited/BrowserFS-builds/raw/${BROWSERFS_BUILD_HASH}/dist/browserfs.min.js`
        );
        const browserFSCode = await response.text() + "\n//# sourceURL=betterDiscord://internal/BrowserFs.js";

        eval.call(window, browserFSCode.replaceAll(".localStorage", ".Vencord.Util.localStorage"));

        const temp: any = {};
        const browserFSSetting = this.getBrowserFSSetting(settings);

        window.BrowserFS.install(temp);

        return new Promise<void>((resolve) => {
            window.BrowserFS.configure(browserFSSetting, () => {
                ReImplementationObject.fs = patchReadFileSync(patchMkdirSync(temp.require("fs")));
                ReImplementationObject.path = temp.require("path");
                if (!settings.safeMode) {
                    windowBdCompatLayer.fsReadyPromise.resolve();
                }
                resolve();
            });
        });
    }

    private getBrowserFSSetting(settings: any) {
        if (settings.useRealFsInstead) {
            return {
                fs: "AsyncMirror",
                options: {
                    sync: { fs: "InMemory" },
                    async: { fs: "RealFS", options: { apiUrl: "http://localhost:2137/api" } },
                },
            };
        } else if (settings.useIndexedDBInstead) {
            return {
                fs: "AsyncMirror",
                options: {
                    sync: { fs: "InMemory" },
                    async: { fs: "IndexedDB", options: { storeName: "VirtualFS" } },
                },
            };
        } else {
            return { fs: "LocalStorage" };
        }
    }

    private async setupNativeFS(reimplementationsReady: any, settings: any, windowBdCompatLayer: any) {
        const native = aquireNative();
        reimplementationsReady.promise.then(async () => {
            const req = (await native.unsafe_req()) as globalThis.NodeRequire;
            ReImplementationObject.fs = await req("fs");
            ReImplementationObject.path = await req("path");
            ReImplementationObject.process.env._home_secret = (await native.getUserHome())!;
            if (!settings.safeMode) {
                windowBdCompatLayer.fsReadyPromise.resolve();
            }
        });
    }

    private async setupGlobalAPIs(proxyUrl: string, reimplementationsReady: any, settings: any, windowBdCompatLayer: any) {
        reimplementationsReady.resolve();

        const BdApiReImplementation = createGlobalBdApi();
        window.BdApi = BdApiReImplementation;
        window.require = (name: keyof typeof ReImplementationObject) => ReImplementationObject[name];

        this.setupGlobalEnvironment();
        await this.setupDiscordIntegration(proxyUrl, windowBdCompatLayer);
        this.addStyles();
    }



    private createCompatLayer(proxyUrl: string) {
        return {
            FSUtils,
            ZIPUtils,
            reloadCompatLayer,
            fsReadyPromise: getDeferred(),
            mainObserver: {},
            mainRouterListener: () =>
                window.GeneratedPlugins.forEach(plugin =>
                    getGlobalApi().Plugins.isEnabled(plugin.name) &&
                    typeof plugin.instance.onSwitch === "function" &&
                    plugin.instance.onSwitch()
                ),
            get Router() {
                return getGlobalApi().Webpack.getModule(x => x.listeners && x.flushRoute) as null | { listeners: Set<Function>; };
            },
            fakeClipboard: undefined,
            wrapPluginCode: (code: string, filename = "RuntimeGenerated.plugin.js") => convertPlugin(code, filename, false),
            queuedPlugins: [],
        };
    }

    private createReImplementationObject(proxyUrl: string, settings: any) {
        const obj = {
            fs: {},
            path: {},
            https: {
                get_(url: string, options: any, cb: (em: typeof FakeEventEmitter.prototype) => void) {
                    const ev = new obj.events.EventEmitter();
                    const ev2 = new obj.events.EventEmitter();
                    const fetchResponse = fetchWithCorsProxyFallback(url, { ...options, method: "get" }, proxyUrl);

                    fetchResponse.then(async x => {
                        ev2.emit("response", ev);
                        if (x.body) {
                            const reader = x.body.getReader();
                            let result = await reader.read();
                            while (!result.done) {
                                ev.emit("data", result.value);
                                result = await reader.read();
                            }
                        }
                        ev.emit("end", Object.assign({}, x, {
                            statusCode: x.status,
                            headers: Object.fromEntries(x.headers.entries()),
                        }));
                    });

                    cb(ev);
                    fetchResponse.catch(reason => {
                        if (ev2.callbacks && ev2.callbacks["error"]) {
                            ev2.emit("error", reason);
                        }
                    });
                    return ev2;
                },
                get get() {
                    return settings.enableExperimentalRequestPolyfills ? this.get_ : undefined;
                }
            },
            events: { EventEmitter: FakeEventEmitter },
            electron: {},
            process: {
                env: {
                    _home_secret: "",
                    get HOME() {
                        if (settings.usePoorlyMadeRealFs) {
                            return this._home_secret;
                        }
                        const target = "/home/fake";
                        FSUtils.mkdirSyncRecursive(target);
                        return target;
                    }
                },
            },
        };
        return obj;
    }

    private setupGlobalEnvironment() {
        this.originalBuffer = window.Buffer;
        window.Buffer = getGlobalApi().Webpack.getModule(x => x.INSPECT_MAX_BYTES)?.Buffer;

        // Create bd-styles container if it doesn't exist
        if (!document.querySelector("bd-styles")) {
            const bdStyles = document.createElement("bd-styles");
            document.head.appendChild(bdStyles);
        }

        // Create bd-scripts container if it doesn't exist
        if (!document.querySelector("bd-scripts")) {
            const bdScripts = document.createElement("bd-scripts");
            document.head.appendChild(bdScripts);
        }

        if (typeof window.global === "undefined") {
            this.globalWasNotExisting = true;
            this.globalDefineWasNotExisting = true;
        } else if (typeof window.global.define === "undefined") {
            this.globalDefineWasNotExisting = true;
        }

        window.global = window.global || globalThis;
        window.global.define = window.global.define || function () { };
    }


    private async setupDiscordIntegration(proxyUrl: string, windowBdCompatLayer: any) {
        ReactUtils_filler.setup({ React });

        const DiscordModulesOutput = await addDiscordModules(proxyUrl);
        const DiscordModules = DiscordModulesOutput.output;

        Patcher.setup(DiscordModules);

        const ContextMenuOutput = await addContextMenu(DiscordModules, proxyUrl);
        const ContextMenu = ContextMenuOutput.output;

        getGlobalApi().ContextMenu = ContextMenu;

        const observer = new MutationObserver(mutations =>
            mutations.forEach(m =>
                window.GeneratedPlugins.forEach(p =>
                    getGlobalApi().Plugins.isEnabled(p.name) && p.instance.observer?.(m)
                )
            )
        );

        observer.observe(document, { childList: true, subtree: true });
        windowBdCompatLayer.mainObserver = observer;
        windowBdCompatLayer.Router?.listeners.add(windowBdCompatLayer.mainRouterListener);
    }

    private addStyles() {
        getGlobalApi().DOM.addStyle("bd-compat-layer-stuff", ".bd-compat-setting .vc-plugins-setting-title { display: none; }");
    }

    async importPlugin() {
        await FSUtils.importFile("//BD/plugins", true, false, ".js");
    }

    async importBulkPlugins() {
        await FSUtils.importFile("//BD/plugins", true, true, ".js");
    }

    async reloadPlugins() {
        await reloadCompatLayer();
    }

    async exportFilesystem() {
        ZIPUtils.downloadZip();
    }

    async importFilesystem() {
        ZIPUtils.importZip();
    }

    getFilesystemSize(): string {
        try {
            return ((FSUtils.getDirectorySize("/") / 1024) / 1024).toFixed(2);
        } catch (error) {
            compat_logger.error("Filesystem size calculation error:", error);
            return "ERROR";
        }
    }

    private async loadExistingPlugins() {
        try {
            const localFs = window.require("fs");
            const pluginFolder = getGlobalApi().Plugins.folder;

            if (!localFs.existsSync(pluginFolder)) {
                FSUtils.mkdirSyncRecursive(pluginFolder);
                return;
            }

            const pluginFiles = localFs.readdirSync(pluginFolder)
                .filter((x: string) => x.endsWith(".plugin.js"))
                .sort();

            for (const filename of pluginFiles) {
                try {
                    const pluginJS = localFs.readFileSync(`${pluginFolder}/${filename}`, "utf8");
                    const plugin = await convertPlugin(pluginJS, filename, true, pluginFolder);
                    addCustomPlugin(plugin);
                } catch (error) {
                    compat_logger.error(`Failed to load plugin ${filename}:`, error);
                }
            }
        } catch (error) {
            compat_logger.error("Failed to load existing plugins:", error);
        }
    }

    private loadExistingPluginsAsync(windowBdCompatLayer: any) {
        // Don't await - run in background
        windowBdCompatLayer.fsReadyPromise.promise.then(async () => {
            try {
                const localFs = window.require("fs");
                const pluginFolder = getGlobalApi().Plugins.folder;

                if (!localFs.existsSync(pluginFolder)) {
                    FSUtils.mkdirSyncRecursive(pluginFolder);
                    return;
                }

                const pluginFiles = localFs.readdirSync(pluginFolder)
                    .filter((x: string) => x.endsWith(".plugin.js"))
                    .sort();

                compat_logger.log(`Starting to load ${pluginFiles.length} BD plugins concurrently (max 3 at once)...`);

                // Load plugins in batches of 3
                const loadPlugin = async (filename: string) => {
                    try {
                        const pluginJS = localFs.readFileSync(`${pluginFolder}/${filename}`, "utf8");
                        const plugin = await convertPlugin(pluginJS, filename, true, pluginFolder);
                        addCustomPlugin(plugin);
                        compat_logger.log(`Loaded BD plugin: ${filename}`);
                    } catch (error) {
                        compat_logger.error(`Failed to load plugin ${filename}:`, error);
                    }
                };

                // Process plugins in chunks of 3
                for (let i = 0; i < pluginFiles.length; i += 3) {
                    const batch = pluginFiles.slice(i, i + 3);

                    // Load up to 3 plugins concurrently
                    await Promise.all(batch.map(filename => loadPlugin(filename)));

                    // Small delay between batches to prevent overwhelming
                    if (i + 3 < pluginFiles.length) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }

                compat_logger.log(`Finished loading ${pluginFiles.length} BD plugins`);
            } catch (error) {
                compat_logger.error("Failed to load existing plugins:", error);
            }
        }).catch(error => {
            compat_logger.error("Plugin loading failed:", error);
        });
    }

    async cleanup() {
        if (!this.isInitialized) return;

        window.BdCompatLayer?.mainObserver?.disconnect();
        window.BdCompatLayer?.Router?.listeners.delete(window.BdCompatLayer.mainRouterListener);
        getGlobalApi()?.Patcher?.unpatchAll("ContextMenuPatcher");
        await removeAllCustomPlugins();
        getGlobalApi()?.DOM?.removeStyle("bd-compat-layer-stuff");

        if (this.globalDefineWasNotExisting) {
            delete window.global?.define;
        }

        if (this.globalWasNotExisting) {
            delete (window as any).global;
        }

        delete window.BdCompatLayer;
        cleanupGlobal();
        delete window.BdApi;

        if (window.zip) {
            delete window.zip;
        }

        delete window.BrowserFS;
        window.Buffer = this.originalBuffer as BufferConstructor;

        this.isInitialized = false;
    }
}
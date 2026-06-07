/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import localDiscordModules from "./local/discordmodules.js";
import { addLogger, compat_logger, evalInScope, findFirstLineWithoutX } from "./utils";

export const TARGET_HASH = "df5c2887eb5eddb8d9f3e470b51cdfa5cec814db";

export const FakeEventEmitter = class {
    callbacks: any;
    constructor() {
        this.callbacks = {};
    }

    on(event, cb) {
        if (!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(cb);
    }

    off(event, cb) {
        const cbs = this.callbacks[event];
        if (cbs) {
            this.callbacks[event] = cbs.filter(callback => callback !== cb);
        }
    }

    emit(event, data) {
        const cbs = this.callbacks[event];
        if (cbs) {
            cbs.forEach(cb => cb(data));
        }
    }
};

export const addDiscordModules = async () => {
    const proxyUrl = "https://cors-get-proxy.sirjosh.workers.dev/?url=";
    const request = await fetch(`${proxyUrl}https://github.com/BetterDiscord/BetterDiscord/raw/${TARGET_HASH}/renderer/src/modules/discordmodules.js`);
    const ModuleDataText = (await request.text()).replaceAll("\r", "");

    const context = {
        get WebpackModules() {
            return window.BdApi.Webpack;
        },
        get Utilities() {
            return {
                memoizeObject: (obj) => {
                    // Simply return the object as-is, or create a proxy that lazily evaluates
                    const result = {};
                    for (const key in obj) {
                        Object.defineProperty(result, key, {
                            get: () => {
                                const val = obj[key];
                                return typeof val === 'function' ? val() : val;
                            },
                            enumerable: true
                        });
                    }
                    return result;
                }
            };
        }
    };

    const ev =
        "(" +
        (ModuleDataText.split("const DiscordModules = Utilities.memoizeObject(")[1]).split(/;\s*export default DiscordModules;/)[0];

    return { output: evalInScope(ev + "\n//# sourceURL=" + "betterDiscord://internal/DiscordModules.js", context), sourceBlobUrl: undefined };
};

export const addContextMenu = async (DiscordModules, proxyUrl) => {
    compat_logger.log("Loading BetterDiscord ContextMenu implementation");

    try {
        const proxyUrl = "https://cors-get-proxy.sirjosh.workers.dev/?url=";
        const request = await fetch(`${proxyUrl}https://github.com/BetterDiscord/BetterDiscord/raw/${TARGET_HASH}/renderer/src/modules/api/contextmenu.js`);
        const ModuleDataText = (await request.text()).replaceAll("\r", "");

        const context = {
            get WebpackModules() {
                return window.BdApi.Webpack;
            },
            get Filters() {
                return window.BdApi.Webpack.Filters;
            },
            DiscordModules,
            get Patcher() {
                return window.BdApi.Patcher;
            }
        };



        const linesToRemove = findFirstLineWithoutX(ModuleDataText, "import");
        let ModuleDataArr = ModuleDataText.split("\n");
        ModuleDataArr.splice(0, linesToRemove);
        ModuleDataArr.pop();
        ModuleDataArr.pop();

        const ModuleDataAssembly =
            "(()=>{" +
            addLogger.toString() +
            ";const Logger = " + addLogger.name + "();const {React} = DiscordModules;" +
            ModuleDataArr.join("\n") +
            "\nreturn ContextMenu;})();";

        const evaluatedContextMenu = evalInScope(ModuleDataAssembly + "\n//# sourceURL=" + "betterDiscord://internal/ContextMenu.js", context);
        return { output: new evaluatedContextMenu(), sourceBlobUrl: undefined };
    } catch (error) {
        compat_logger.error("Failed to load BetterDiscord ContextMenu, using fallback", error);
        // Fallback to simple implementation
        return {
            output: {
                patch(navId, callback) {
                    this._patches = this._patches || {};
                    this._patches[navId] = this._patches[navId] || [];
                    this._patches[navId].push(callback);
                    return () => {
                        const patches = this._patches[navId];
                        if (patches) {
                            const index = patches.indexOf(callback);
                            if (index > -1) patches.splice(index, 1);
                        }
                    };
                },
                unpatch(navId, callback) {
                    if (this._patches && this._patches[navId]) {
                        const patches = this._patches[navId];
                        const index = patches.indexOf(callback);
                        if (index > -1) patches.splice(index, 1);
                    }
                },
                buildItem(props = {}) { return props; },
                buildMenuChildren(setup = []) { return setup.filter(Boolean); },
                buildMenu(setup = []) { return () => setup; },
                open(event, menuComponent, config = {}) {
                    console.log("ContextMenu.open fallback called");
                },
                close() { }
            },
            sourceBlobUrl: undefined
        };
    }
};

export async function fetchWithCorsProxyFallback(url: string, options: any = {}, corsProxy: string) {
    const reqId = (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    try {
        compat_logger.debug(`[${reqId}] Requesting ${url}...`, options);
        const result = await fetch(url, options);
        compat_logger.debug(`[${reqId}] Success.`);
        return result;
    } catch (error) {
        if (options.method === undefined || options.method === "get") {
            compat_logger.debug(`[${reqId}] Failed, trying with proxy.`);
            try {
                const result = await fetch(`${corsProxy}${url}`, options);
                compat_logger.debug(`[${reqId}] (Proxy) Success.`);
                return result;
            } catch (error) {
                compat_logger.debug(`[${reqId}] (Proxy) Failed completely.`);
                throw error;
            }
        }
        compat_logger.debug(`[${reqId}] Failed completely.`);
        throw error;
    }
}

export { Patcher } from "./stuffFromBD";

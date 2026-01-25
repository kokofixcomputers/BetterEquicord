/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import { BetterDiscordManager } from "../../components/settings/tabs/betterdiscord/manager";

let manager: BetterDiscordManager | null = null;

export default definePlugin({
    name: "BetterDiscordCompat",
    description: "Automatically initializes BetterDiscord compatibility layer",
    authors: [Devs.kokofixcomputers],
    required: true,
    enabledByDefault: true,

    get manager() {
        return manager;
    },

    async start() {
        if (!manager) {
            manager = new BetterDiscordManager();
            await manager.initialize();
        }
    },

    async stop() {
        if (manager) {
            await manager.cleanup();
            manager = null;
        }
    }
});
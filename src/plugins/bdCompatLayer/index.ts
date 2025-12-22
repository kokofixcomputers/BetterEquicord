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

// This plugin has been integrated directly into BetterEquicord settings.
// The functionality is now available in Settings > BetterDiscord

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "BD Compatibility Layer",
    description: "This plugin has been integrated into BetterEquicord settings. Please use Settings > BetterDiscord instead.",
    authors: [
        Devs.Davvy,
        Devs.WhoIsThis,
        Devs.kokofixcomputers,
    ],
    enabledByDefault: false,
    start() {
        setTimeout(() => {
            if (typeof Vencord !== "undefined" && Vencord.Notifications) {
                Vencord.Notifications.showNotification({
                    title: "BD Compatibility Layer",
                    body: "This plugin has been integrated into BetterEquicord. Please disable this plugin and use Settings > BetterDiscord instead.",
                    permanent: true,
                });
            }
        }, 2000);
    },
    stop() {},
});

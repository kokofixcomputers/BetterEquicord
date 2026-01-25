/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { Alert } from "@components/Alert";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { FolderIcon, PlusIcon, RestartIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings";
import { QuickAction, QuickActionCard } from "@components/settings/QuickAction";
import { Margins } from "@utils/margins";
import { Card, Forms, React } from "@webpack/common";

import { BetterDiscordManager } from "./manager";
import FileSystemViewer from "./FileSystemViewer";

// Get the shared manager instance from the core plugin
function getManager(): BetterDiscordManager | null {
    return (Vencord.Plugins.plugins.BetterDiscordCompat as any)?.manager || null;
}

function BetterDiscordSettings() {
    const settings = useSettings();
    const [manager] = React.useState(() => getManager());
    const [isInitialized, setIsInitialized] = React.useState(!!manager);

    React.useEffect(() => {
        if (manager && !isInitialized) {
            setIsInitialized(true);
        }
    }, [manager, isInitialized]);

    if (!isInitialized || !manager) {
        return (
            <SettingsTab>
                <Heading>BetterDiscord Compatibility</Heading>
                <Paragraph>BetterDiscord compatibility layer is not initialized. Please restart Discord.</Paragraph>
            </SettingsTab>
        );
    }

    return (
        <SettingsTab>
            <Alert.Info className={Margins.bottom20} style={{ width: "100%" }}>
                BetterDiscord plugin support is experimental. Not all plugins will work correctly.
            </Alert.Info>

            <Heading>BetterDiscord Plugin Manager</Heading>
            <Paragraph className={Margins.bottom16}>
                Manage BetterDiscord plugins and configure compatibility settings.
            </Paragraph>

            <QuickActionCard>
                <QuickAction
                    text="Import BD Plugin"
                    action={() => manager.importPlugin()}
                    Icon={PlusIcon}
                />
                <QuickAction
                    text="Import Bulk Plugins"
                    action={() => manager.importBulkPlugins()}
                    Icon={FolderIcon}
                />
                <QuickAction
                    text="Reload BD Plugins"
                    action={() => manager.reloadPlugins()}
                    Icon={RestartIcon}
                />
                <QuickAction
                    text="Export Filesystem as ZIP"
                    action={() => manager.exportFilesystem()}
                    Icon={FolderIcon}
                />
                <QuickAction
                    text="Import Filesystem From ZIP"
                    action={() => manager.importFilesystem()}
                    Icon={FolderIcon}
                />
            </QuickActionCard>

            <Card className="vc-settings-quick-actions-card">
                <Forms.FormText>
                    Filesystem Size: {manager.getFilesystemSize()} MB
                </Forms.FormText>
            </Card>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Compatibility Settings</Heading>
            <Paragraph className={Margins.bottom16}>
                Configure how BetterDiscord plugins interact with BetterEquicord.
            </Paragraph>

            <FormSwitch
                value={settings.bdCompat?.enableExperimentalRequestPolyfills ?? false}
                onChange={v => {
                    settings.bdCompat = { ...settings.bdCompat, enableExperimentalRequestPolyfills: v };
                }}
                title="Enable Experimental Request Polyfills"
                description="Enables request polyfills that first try to request using normal fetch, then using a cors proxy when the normal one fails"
                hideBorder
            />

            <FormSwitch
                value={settings.bdCompat?.useIndexedDBInstead ?? false}
                onChange={v => {
                    settings.bdCompat = { ...settings.bdCompat, useIndexedDBInstead: v };
                }}
                title="Use IndexedDB Storage"
                description="Uses IndexedDB instead of localStorage. May cause memory usage issues but prevents exceeding localStorage quota."
                hideBorder
            />

            <FormSwitch
                value={settings.bdCompat?.useRealFsInstead ?? false}
                onChange={v => {
                    settings.bdCompat = { ...settings.bdCompat, useRealFsInstead: v };
                }}
                title="Use Real Filesystem"
                description="Uses true filesystem instead of localStorage. May cause memory usage issues but prevents exceeding localStorage quota."
                hideBorder
            />

            {!IS_WEB && (
                <FormSwitch
                    value={settings.bdCompat?.usePoorlyMadeRealFs ?? false}
                    onChange={v => {
                        settings.bdCompat = { ...settings.bdCompat, usePoorlyMadeRealFs: v };
                    }}
                    title="Use Native Filesystem (Experimental)"
                    description="Uses your native filesystem to manage plugins. Not recommended as there is no security for this option. Use at your own risk."
                    hideBorder
                />
            )}

            <FormSwitch
                value={settings.bdCompat?.safeMode ?? false}
                onChange={v => {
                    settings.bdCompat = { ...settings.bdCompat, safeMode: v };
                }}
                title="Safe Mode"
                description="Loads only filesystem without executing plugins"
                hideBorder
            />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>File System Manager</Heading>
            <Paragraph className={Margins.bottom16}>
                Browse and manage BetterDiscord plugin files and directories.
            </Paragraph>

            <FileSystemViewer />
        </SettingsTab>
    );
}

export default wrapTab(BetterDiscordSettings, "BetterDiscord");
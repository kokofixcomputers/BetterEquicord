/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { Alert } from "@components/Alert";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { PlusIcon, RestartIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings";
import { QuickAction, QuickActionCard } from "@components/settings/QuickAction";
import { Margins } from "@utils/margins";
import { Card, Forms, React, TextInput } from "@webpack/common";

interface InjectedPlugin {
    name: string;
    url: string;
    enabled: boolean;
    loaded: boolean;
    scriptId?: string;
}

function PluginInjectorSettings() {
    const settings = useSettings();
    const [plugins, setPlugins] = React.useState<InjectedPlugin[]>(settings.injectedPlugins || []);
    const [newPluginUrl, setNewPluginUrl] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        settings.injectedPlugins = plugins;
    }, [plugins]);

    const addPlugin = async () => {
        if (!newPluginUrl.trim()) return;

        setLoading(true);
        try {
            const response = await fetch(newPluginUrl);
            const code = await response.text();

            const nameMatch = code.match(/name:\s*["']([^"']+)["']/i) ||
                code.match(/@name\s+["']([^"']+)["']/i);
            const name = nameMatch ? nameMatch[1] : `Plugin_${Date.now()}`;

            const newPlugin: InjectedPlugin = {
                name,
                url: newPluginUrl,
                enabled: false,
                loaded: false
            };

            setPlugins(prev => [...prev, newPlugin]);
            setNewPluginUrl("");
        } catch (error) {
            console.error("Failed to add plugin:", error);
        }
        setLoading(false);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            const code = e.target?.result as string;
            const nameMatch = code.match(/name:\s*["']([^"']+)["']/i) ||
                code.match(/@name\s+["']([^"']+)["']/i);
            const name = nameMatch ? nameMatch[1] : file.name.replace('.js', '');

            const newPlugin: InjectedPlugin = {
                name,
                url: `file://${file.name}`,
                enabled: false,
                loaded: false,
                code // Store code for local files
            };

            setPlugins(prev => [...prev, newPlugin]);
            setLoading(false);
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const removePlugin = (index: number) => {
        const plugin = plugins[index];
        const confirmed = confirm(`Are you sure you want to delete "${plugin.name}"?`);
        if (!confirmed) return;

        if (plugin.loaded) {
            unloadPlugin(plugin);
        }
        setPlugins(prev => prev.filter((_, i) => i !== index));
    };

    const togglePlugin = async (index: number) => {
        const plugin = plugins[index];
        if (plugin.enabled) {
            unloadPlugin(plugin);
        } else {
            await loadPlugin(plugin);
        }

        setPlugins(prev => prev.map((p, i) =>
            i === index ? { ...p, enabled: !p.enabled } : p
        ));
    };

    const loadPlugin = async (plugin: InjectedPlugin) => {
        try {
            let code;
            if ('code' in plugin) {
                code = plugin.code as string;
            } else {
                const response = await fetch(plugin.url);
                code = await response.text();
            }

            // Clean code for Vencord plugin execution
            const cleanedCode = code
                // Remove import statements (Vencord provides all APIs globally)
                .replace(/import\s+.*?from\s+["'][^"']+["'][;]?\s*/g, '')
                // Handle definePlugin pattern
                .replace(/definePlugin\s*\(\s*\{([^}]+)\}\s*\)\s*=>?\s*\{([^}]+)\}/gs, (match, config, body) => {
                    return `const plugin = {name: "${plugin.name}", ${config}, ${body}}; Vencord.Plugins.plugins["${plugin.name}"] = plugin;`;
                })
                // Handle export default
                .replace(/export\s+default\s+definePlugin\s*\(\s*\{([^}]+)\}\s*\)\s*=>?\s*\{([^}]+)\}/gs, (match, config, body) => {
                    return `const plugin = {name: "${plugin.name}", ${config}, ${body}}; Vencord.Plugins.plugins["${plugin.name}"] = plugin;`;
                })
                // Simple export default fallback
                .replace(/export\s+default\s*(\{[^}]+?\})/gs, (match, obj) => {
                    return `const plugin = {name: "${plugin.name}", ${obj}}; Vencord.Plugins.plugins["${plugin.name}"] = plugin;`;
                })
                // Remove TypeScript types
                .replace(/:\s*[^,=;{}]+?(?=[,=;{}])/g, '')
                .replace(/<\s*[^>]+>\s*/g, '')
                .replace(/\b(as|interface|type)\b[^;{]+[;{]/g, '')
                // Remove optional chaining markers
                .replace(/\?\./g, '.');

            const script = document.createElement("script");
            script.textContent = `(function() {
                try {
                    ${cleanedCode}
                    // Auto-start if enabled
                    const plugin = Vencord.Plugins.plugins["${plugin.name}"];
                    if (plugin && plugin.start && typeof plugin.start === 'function') {
                        plugin.start();
                    }
                } catch (e) {
                    console.error('Vencord plugin execution error (${plugin.name}):', e);
                }
            })();`;

            script.id = `vencord-injected-${plugin.name}`;
            script.dataset.pluginName = plugin.name;
            document.head.appendChild(script);
            plugin.scriptId = script.id;
            plugin.loaded = true;

        } catch (error) {
            console.error(`Failed to load Vencord plugin ${plugin.name}:`, error);
        }
    };

    const unloadPlugin = (plugin: InjectedPlugin) => {
        // Remove script
        const script = document.getElementById(`vencord-injected-${plugin.name}`);
        if (script) {
            script.remove();
        }

        // Stop plugin properly through Vencord
        if (Vencord?.Plugins?.plugins?.[plugin.name]) {
            const vencordPlugin = Vencord.Plugins.plugins[plugin.name];
            if (vencordPlugin.stop && typeof vencordPlugin.stop === 'function') {
                try {
                    vencordPlugin.stop();
                } catch (e) {
                    console.error(`Error stopping plugin ${plugin.name}:`, e);
                }
            }
            delete Vencord.Plugins.plugins[plugin.name];
        }

        // Clean up settings
        if (Vencord?.Settings?.plugins?.[plugin.name]) {
            Vencord.Settings.plugins[plugin.name].enabled = false;
        }

        plugin.loaded = false;
        plugin.scriptId = undefined;
    };

    const reloadAllPlugins = async () => {
        setLoading(true);
        for (const plugin of plugins) {
            if (plugin.enabled) {
                unloadPlugin(plugin);
                await loadPlugin(plugin);
            }
        }
        setLoading(false);
    };

    return (
        <SettingsTab>
            <Alert.Info className={Margins.bottom20}>
                Inject Vencord plugins dynamically without recompiling. Use at your own risk.
            </Alert.Info>

            <Heading>Plugin Injector</Heading>
            <Paragraph className={Margins.bottom16}>
                Add and manage custom Vencord plugins from URLs or local files.
            </Paragraph>

            <QuickActionCard>
                <QuickAction
                    text="Reload All Plugins"
                    action={reloadAllPlugins}
                    Icon={RestartIcon}
                />
            </QuickActionCard>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Add New Plugin</Heading>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <TextInput
                    placeholder="Plugin URL (e.g., https://example.com/plugin.js)"
                    value={newPluginUrl}
                    onChange={setNewPluginUrl}
                    style={{ flex: 1 }}
                />
                <Button onClick={addPlugin} disabled={loading || !newPluginUrl.trim()}>
                    Add URL
                </Button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <input
                    type="file"
                    accept=".js"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                    id="plugin-file-input"
                />
                <Button
                    onClick={() => document.getElementById("plugin-file-input")?.click()}
                    disabled={loading}
                >
                    Upload File
                </Button>
                <Forms.FormText style={{ fontSize: "12px", opacity: 0.7 }}>
                    Supports Vencord plugins with definePlugin()
                </Forms.FormText>
            </div>

            <Heading className={Margins.top20}>Injected Plugins</Heading>
            {plugins.length === 0 ? (
                <Paragraph>No plugins injected yet.</Paragraph>
            ) : (
                plugins.map((plugin, index) => (
                    <Card key={index} style={{ padding: "16px", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ flex: 1 }}>
                                <Forms.FormTitle>{plugin.name}</Forms.FormTitle>
                                <Forms.FormText style={{ fontSize: "12px", opacity: 0.7 }}>
                                    {plugin.url}
                                    {plugin.loaded && ' • Loaded'}
                                </Forms.FormText>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <FormSwitch
                                    value={plugin.enabled}
                                    onChange={() => togglePlugin(index)}
                                    hideBorder
                                />
                                <Button
                                    variant="dangerPrimary"
                                    size="small"
                                    onClick={() => removePlugin(index)}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))
            )}
        </SettingsTab>
    );
}

export default wrapTab(PluginInjectorSettings, "Plugin Injector");

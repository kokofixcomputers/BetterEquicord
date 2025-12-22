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
import { PlusIcon, RestartIcon, TrashIcon } from "@components/Icons";
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
            
            const nameMatch = code.match(/name:\s*["']([^"']+)["']/);
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
            const nameMatch = code.match(/name:\s*["']([^"']+)["']/);
            const name = nameMatch ? nameMatch[1] : file.name.replace('.js', '');
            
            const newPlugin: InjectedPlugin = {
                name,
                url: `file://${file.name}`,
                enabled: false,
                loaded: false
            };
            
            // Store the code directly in the plugin object
            (newPlugin as any).code = code;
            
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
            if (plugin.url.startsWith('file://')) {
                // Handle local files - code is stored directly
                code = (plugin as any).code;
            } else {
                // Handle URL-based plugins
                const response = await fetch(plugin.url);
                code = await response.text();
            }
            
            // Check if this is an Equicord plugin (has definePlugin)
            const isEquicordPlugin = code.includes('definePlugin') || code.includes('export default');
            
            let transformedCode;
            if (isEquicordPlugin) {
                // For Equicord plugins, handle TypeScript syntax more carefully
                transformedCode = code
                    .replace(/import\s+.*?from\s+["']([^"']+)["'];?/g, '') // Remove imports
                    .replace(/export\s+default\s+/, 'const plugin = ') // Convert export to variable
                    .replace(/:\s*[\w<>\[\]|&{},.\s]+(?=[,)=;{}])/g, '') // Remove type annotations
                    .replace(/\s+as\s+\w+/g, '') // Remove 'as' type assertions
                    .replace(/<[\w<>\[\]|&{},.\s]+>/g, '') // Remove generic types
                    .replace(/\?:/g, ':') // Remove optional property markers
                    .replace(/interface\s+\w+\s*{[^}]*}/g, '') // Remove interface declarations
                    .replace(/type\s+\w+\s*=[^;]+;/g, ''); // Remove type aliases
                
                // Add plugin registration
                transformedCode += `
                if (typeof plugin === 'object' && plugin.name) {
                    if (typeof Vencord !== 'undefined' && Vencord.Plugins) {
                        // Register as Equicord plugin
                        Vencord.Plugins.plugins[plugin.name] = plugin;
                        if (plugin.start && typeof plugin.start === 'function') {
                            plugin.start();
                        }
                    }
                }`;
            } else {
                // For BetterDiscord plugins, use the old transformation
                transformedCode = code
                    .replace(/import\s+.*?from\s+["']([^"']+)["'];?/g, '')
                    .replace(/export\s+default\s+/g, 'window.BdPluginExport = ')
                    .replace(/export\s+/g, 'window.BdPluginExports = window.BdPluginExports || {}; window.BdPluginExports.')
                    .replace(/\s+as\s+\w+/g, '') // Remove TypeScript 'as' type assertions
                    .replace(/:\s*\w+\[\]/g, '') // Remove array type annotations
                    .replace(/:\s*[\w<>\[\]|&{},.\s]+(?=[,)=;{}])/g, '') // Remove type annotations more carefully
                    .replace(/<[\w<>\[\]|&{},.\s]+>/g, ''); // Remove generic type parameters
            }
            
            const script = document.createElement("script");
            script.textContent = `(function() { 
                try {
                    ${transformedCode}
                } catch (e) {
                    console.error('Plugin execution error:', e);
                }
            })();`;
            script.id = `injected-plugin-${plugin.name}`;
            document.head.appendChild(script);
            
            plugin.loaded = true;
        } catch (error) {
            console.error(`Failed to load plugin ${plugin.name}:`, error);
        }
    };

    const unloadPlugin = (plugin: InjectedPlugin) => {
        const script = document.getElementById(`injected-plugin-${plugin.name}`);
        if (script) script.remove();
        
        // If it's an Equicord plugin, also stop it properly
        if (typeof Vencord !== 'undefined' && Vencord.Plugins) {
            const equicordPlugin = Vencord.Plugins.plugins[plugin.name];
            if (equicordPlugin && equicordPlugin.stop && typeof equicordPlugin.stop === 'function') {
                try {
                    equicordPlugin.stop();
                } catch (e) {
                    console.error(`Error stopping plugin ${plugin.name}:`, e);
                }
            }
            delete Vencord.Plugins.plugins[plugin.name];
        }
        
        plugin.loaded = false;
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
                Inject Equicord plugins dynamically without recompiling. Use at your own risk.
            </Alert.Info>

            <Heading>Plugin Injector</Heading>
            <Paragraph className={Margins.bottom16}>
                Add and manage custom Equicord plugins from URLs.
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
                    Or upload a local .js plugin file
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
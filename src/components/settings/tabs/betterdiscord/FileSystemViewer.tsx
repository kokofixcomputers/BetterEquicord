/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React } from "@webpack/common";
import { Forms } from "@webpack/common";

import { getGlobalApi } from "../../../../bdcompat/fakeBdApi";
import { addCustomPlugin, convertPlugin } from "../../../../bdcompat/pluginConstructor";
import TreeView, { findInTree, TreeNode } from "../../../../bdcompat/treeView";
import { compat_logger, FSUtils, readdirPromise } from "../../../../bdcompat/utils";

export default function FileSystemViewer() {
    const baseNode = {
        id: "fs-/",
        label: "/",
        children: [],
        expanded: false,
        fetchChildren: function () { return fetchDirContentForId(this.id); },
    } as TreeNode;

    const ref = React.useRef(baseNode.id);

    const handleNodeSelect = (node: TreeNode) => {
        ref.current = node.id;
    };

    const contextMenuHandler = (event: MouseEvent) => {
        const contextMenuBuild = () => {
            return getGlobalApi().ContextMenu.buildMenu([
                { label: ref.current, disabled: true },
                findInTree(baseNode, x => x.expandable === true && x.id === ref.current)?.expandable && {
                    label: "Import a file here",
                    action: async () => {
                        await FSUtils.importFile(ref.current.split("fs-")[1], true);
                        findInTree(baseNode, x => x.id === ref.current)?.fetchChildren();
                    },
                },
                findInTree(baseNode, x => x.expandable === true && x.id === ref.current)?.expandable && {
                    label: "Remove directory and all subdirectories",
                    color: "danger",
                    action: () => {
                        getGlobalApi().UI.showConfirmationModal(
                            "Confirm your action",
                            `Are you sure you want to delete ${findInTree(baseNode, x => x.expandable === true && x.id === ref.current)?.label} and all of it's children? This cannot be undone.`,
                            {
                                confirmText: "Yes",
                                cancelText: "No",
                                onConfirm: () => {
                                    FSUtils.removeDirectoryRecursive(ref.current.split("fs-")[1]);
                                },
                                onCancel: () => undefined
                            }
                        );
                    },
                },
                (!findInTree(baseNode, x => x.expandable === true && x.id === ref.current)?.expandable) && {
                    label: "Export file",
                    action: async () => {
                        await FSUtils.exportFile(ref.current.split("fs-")[1]);
                    },
                },
                (!findInTree(baseNode, x => x.expandable === true && x.id === ref.current)?.expandable) && {
                    label: "Delete file",
                    color: "danger",
                    action: () => {
                        window.require("fs").unlinkSync(ref.current.split("fs-")[1]);
                    },
                },
                (!findInTree(baseNode, x => x.expandable === true && x.id === ref.current)?.expandable) && ref.current.endsWith(".plugin.js") && {
                    type: "group",
                    items: [
                        {
                            type: "submenu",
                            label: "Plugin actions",
                            items: [
                                {
                                    label: "Reload plugin",
                                    action: () => {
                                        const selected = ref.current.split("fs-")[1];
                                        const parsed = window.require("path").parse(selected);
                                        parsed.dir = parsed.dir.startsWith("//") ? parsed.dir.slice(1) : parsed.dir;
                                        const foundOrNot = getGlobalApi().Plugins.getAll().find(x => x.sourcePath == parsed.dir && x.filename == parsed.base);
                                        
                                        if (foundOrNot) {
                                            (async () => {
                                                Vencord.Settings.plugins[foundOrNot.name].enabled = false;
                                                if (foundOrNot.started === true) {
                                                    Vencord.Plugins.stopPlugin(foundOrNot);
                                                }
                                                delete Vencord.Plugins.plugins[foundOrNot.name];
                                                (window.GeneratedPlugins as any[]).splice((window.GeneratedPlugins as any[]).indexOf(foundOrNot), 1);

                                                await new Promise(resolve => setTimeout(resolve, 500));

                                                const pluginJS = window.require("fs").readFileSync(selected, "utf8");
                                                const converted = await convertPlugin(pluginJS, parsed.base, true, parsed.dir);
                                                addCustomPlugin(converted);
                                            })();
                                        }
                                    },
                                }
                            ],
                        }
                    ]
                }
            ].filter(Boolean));
        };
        getGlobalApi().ContextMenu.open(event, contextMenuBuild(), {});
    };

    return (
        <div>
            <TreeView 
                onContextMenu={contextMenuHandler} 
                selectedNode={ref.current} 
                selectNode={handleNodeSelect} 
                data={[baseNode]}
            />
        </div>
    );
}

async function fetchDirContentForId(id: string) {
    const fs = window.require("fs");
    const dirContents = await readdirPromise(id.split("fs-")[1]) as string[];
    return dirContents.map(x => {
        return {
            id: "fs-" + id.split("fs-")[1] + "/" + x,
            label: x,
            children: [],
            fetchChildren: function () { return fetchDirContentForId(this.id); },
            expanded: false,
            expandable: !fs.statSync(id.split("fs-")[1] + "/" + x).isFile(),
        } as TreeNode;
    });
}
// src/userplugins/QuestHelper/index.ts

import definePlugin from "@utils/types";
import { Devs } from "@utils/constants";

export default definePlugin({
    name: "QuestHelper",
    description: "Quest Helper overlay using Discord's internal quest APIs.",
    authors: [Devs.kokofixcomputers],

    start() {
        // ========== STYLE ==========
        const style = document.createElement("style");
        style.textContent = `
#quest-helper-overlay {
  position: fixed;
  z-index: 999999;
  top: 20px;
  right: 20px;
  width: 280px;
  background: #202225;
  color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  font-family: system-ui, sans-serif;
  font-size: 13px;
  padding: 10px;
}
#quest-helper-overlay h3 {
  margin: 0 0 6px;
  font-size: 14px;
}
#quest-helper-overlay select,
#quest-helper-overlay button {
  width: 100%;
  margin-top: 6px;
  padding: 4px 6px;
  border-radius: 4px;
  border: none;
  font-size: 13px;
}
#quest-helper-overlay select {
  background: #2f3136;
  color: #fff;
}
#quest-helper-overlay button {
  background: #5865f2;
  color: #fff;
  cursor: pointer;
}
#quest-helper-overlay #qh-refresh {
  background: #3ba55d;
}
#quest-helper-overlay button:disabled {
  opacity: 0.6;
  cursor: default;
}
#quest-helper-overlay small {
  display: block;
  margin-top: 6px;
  opacity: 0.8;
}

/* Hide / show toggle button (top-right of screen) */
#quest-helper-toggle {
  position: fixed;
  z-index: 999999;
  top: 20px;
  right: 20px;
  width: 26px;
  height: 26px;
  border-radius: 13px;
  border: none;
  background: #5865f2;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
`;
        document.head.appendChild(style);

        // Toggle button
        const toggleBtn = document.createElement("button");
        toggleBtn.id = "quest-helper-toggle";
        toggleBtn.textContent = "Q";
        document.body.appendChild(toggleBtn);

        // @ts-ignore
        delete (window as any).$;

        // @ts-ignore
        const wpRequire = (window as any).webpackChunkdiscord_app.push([
            [Symbol()],
            {},
            (r: any) => r
        ]);
        // @ts-ignore
        (window as any).webpackChunkdiscord_app.pop();

        const modules = Object.values(wpRequire.c) as any[];

        const ApplicationStreamingStore = modules.find(
            x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata
        )?.exports?.Z;
        const RunningGameStore = modules.find(
            x => x?.exports?.ZP?.getRunningGames
        )?.exports?.ZP;
        const QuestsStore = modules.find(
            x => x?.exports?.Z?.__proto__?.getQuest
        )?.exports?.Z;
        const ChannelStore = modules.find(
            x => x?.exports?.Z?.__proto__?.getAllThreadsForParent
        )?.exports?.Z;
        const GuildChannelStore = modules.find(
            x => x?.exports?.ZP?.getSFWDefaultChannel
        )?.exports?.ZP;
        const FluxDispatcher = modules.find(
            x => x?.exports?.Z?.__proto__?.flushWaitQueue
        )?.exports?.Z;
        const api = modules.find(
            x => x?.exports?.tn?.get
        )?.exports?.tn;

        const isApp = typeof (window as any).DiscordNative !== "undefined";

        function sleep(ms: number) {
            return new Promise(r => setTimeout(r, ms));
        }
        function formatTime(seconds: number) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return mins > 0 ? `${mins} min ${secs} sec` : `${secs} sec`;
        }

        async function safeEnroll(questId: string, questName: string, statusEl: HTMLElement) {
            console.log(`📝 Enrolling in quest: ${questName}...`);
            statusEl.textContent = `Status: enrolling in "${questName}"...`;
            try {
                await api.post({
                    url: `/quests/${questId}/enroll`,
                    body: { location: 1 }
                });
                console.log("✅ Successfully enrolled in quest!");
                statusEl.textContent = `Status: enrolled, running...`;
                return { success: true };
            } catch (e: any) {
                if (e.status === 429) {
                    const retryAfter =
                        e.body?.retry_after ||
                        e.headers?.["retry-after"] ||
                        300;
                    console.log("Rate limited, wait suggested:", retryAfter);
                    statusEl.textContent = `Status: rate limited, wait ${formatTime(
                        Math.ceil(retryAfter)
                    )}`;
                    return { success: false, rateLimited: true, retryAfter };
                } else {
                    console.error("Enroll error:", e);
                    statusEl.textContent =
                        "Status: enroll error (see console)";
                    return { success: false };
                }
            }
        }

        const getTaskType = (q: any) => {
            const taskConfig =
                q.config?.taskConfig ?? q.config?.taskConfigV2;
            const tasks = taskConfig?.tasks
                ? Object.keys(taskConfig.tasks)
                : [];
            if (
                tasks.includes("WATCH_VIDEO") ||
                tasks.includes("WATCH_VIDEO_ON_MOBILE")
            )
                return "video";
            if (tasks.includes("PLAY_ON_DESKTOP")) return "play";
            if (tasks.includes("STREAM_ON_DESKTOP")) return "stream";
            if (tasks.includes("PLAY_ACTIVITY")) return "activity";
            return "unknown";
        };

        const guiInitQuests = (sel: HTMLSelectElement, runBtn: HTMLButtonElement, statusEl: HTMLElement) => {
            const availableQuests = [...QuestsStore.quests.values()].filter(
                (x: any) => {
                    const notExpired =
                        new Date(x.config.expiresAt).getTime() > Date.now();
                    const notCompleted = !x.userStatus?.completedAt;
                    return notExpired && notCompleted;
                }
            );

            sel.innerHTML = "";
            if (availableQuests.length === 0) {
                const opt = document.createElement("option");
                opt.textContent = "No available quests";
                opt.value = "";
                sel.appendChild(opt);
                runBtn.disabled = true;
                statusEl.textContent = "Status: no quests found";
                (sel as any)._availableQuests = [];
                return;
            }

            availableQuests.forEach((q: any, i: number) => {
                const opt = document.createElement("option");
                const taskConfig =
                    q.config?.taskConfig ?? q.config?.taskConfigV2;
                const taskName = Object.keys(taskConfig?.tasks || {})[0];
                const taskType = getTaskType(q);
                opt.value = q.id;
                opt.textContent = `${i + 1}. ${q.config.messages.questName
                    } (${taskName}) [${taskType}]`;
                sel.appendChild(opt);
            });

            runBtn.disabled = false;
            statusEl.textContent =
                "Status: select a quest and click Run";
            (sel as any)._availableQuests = availableQuests;
        };

        async function handleVideoQuest(
            quest: any,
            secondsNeeded: number,
            secondsDone: number,
            statusEl: HTMLElement
        ) {
            const maxFuture = 10;
            const speed = 7;
            const interval = 1;
            const enrolledAt = new Date(
                quest.userStatus.enrolledAt
            ).getTime();

            let completed = false;
            let currentTimestamp = secondsDone;
            let errorCount = 0;
            const maxErrors = 5;

            console.log("🎬 Starting video watching simulation...");

            while (
                currentTimestamp < secondsNeeded &&
                errorCount < maxErrors
            ) {
                const maxAllowed =
                    Math.floor(
                        (Date.now() - enrolledAt) / 1000
                    ) + maxFuture;
                const diff = maxAllowed - currentTimestamp;

                if (diff >= speed) {
                    const timestamp =
                        currentTimestamp + speed + Math.random();
                    try {
                        const res = await api.post({
                            url: `/quests/${quest.id}/video-progress`,
                            body: {
                                timestamp: Math.min(
                                    secondsNeeded,
                                    timestamp
                                )
                            }
                        });
                        completed = res.body.completed_at != null;
                        currentTimestamp = Math.min(
                            secondsNeeded,
                            timestamp
                        );
                        errorCount = 0;
                        const percent = Math.floor(
                            (currentTimestamp / secondsNeeded) * 100
                        );
                        if (percent % 10 === 0) {
                            console.log(
                                `📊 Progress: ${percent}% (${Math.floor(
                                    currentTimestamp
                                )}/${secondsNeeded} sec)`
                            );
                            statusEl.textContent = `Status: video quest ${percent}%`;
                        }
                    } catch (e: any) {
                        errorCount++;
                        if (e.status === 429) {
                            const retryAfter =
                                e.body?.retry_after || 60;
                            console.log(
                                `Rate limit, wait ${retryAfter}s`
                            );
                            statusEl.textContent = `Status: rate limited (${errorCount}/${maxErrors})`;
                            await sleep(retryAfter * 1000);
                        } else {
                            console.error(
                                "video-progress error:",
                                e
                            );
                            await sleep(5000);
                        }
                    }
                }

                if (currentTimestamp >= secondsNeeded) break;
                await sleep(interval * 1000);
            }

            if (!completed && errorCount < maxErrors) {
                try {
                    await api.post({
                        url: `/quests/${quest.id}/video-progress`,
                        body: { timestamp: secondsNeeded }
                    });
                } catch (e) {
                    console.error(
                        "Final video-progress error:",
                        e
                    );
                }
            }

            if (errorCount >= maxErrors) {
                console.log("Too many errors; stopped.");
                statusEl.textContent =
                    "Status: stopped (too many errors)";
            } else {
                console.log(
                    "✅ Video quest completed! Reward in 5–15 minutes."
                );
                statusEl.textContent =
                    "Status: video quest completed (wait for reward)";
            }
        }

        async function handlePlayQuest(
            quest: any,
            applicationId: string,
            applicationName: string,
            pid: number,
            secondsNeeded: number,
            secondsDone: number,
            statusEl: HTMLElement
        ) {
            try {
                const res = await api.get({
                    url: `/applications/public?application_ids=${applicationId}`
                });
                const appData = res.body[0];

                if (!appData?.executables) {
                    console.log(
                        "❌ Failed to get application data."
                    );
                    statusEl.textContent =
                        "Status: app data not found";
                    return;
                }

                const exeData = appData.executables.find(
                    (x: any) => x.os === "win32"
                );
                if (!exeData) {
                    console.log(
                        "❌ Windows executable not found for this application."
                    );
                    statusEl.textContent =
                        "Status: no Windows executable";
                    return;
                }

                const exeName = exeData.name.replace(">", "");

                const fakeGame = {
                    cmdLine: `C:\\Program Files\\${appData.name}\\${exeName}`,
                    exeName,
                    exePath: `c:/program files/${appData.name.toLowerCase()}/${exeName}`,
                    hidden: false,
                    isLauncher: false,
                    id: applicationId,
                    name: appData.name,
                    pid,
                    pidPath: [pid],
                    processName: appData.name,
                    start: Date.now()
                };

                const realGames = RunningGameStore.getRunningGames();
                const fakeGames = [fakeGame];
                const realGetRunningGames =
                    RunningGameStore.getRunningGames;
                const realGetGameForPID =
                    RunningGameStore.getGameForPID;

                RunningGameStore.getRunningGames = () => fakeGames;
                RunningGameStore.getGameForPID = (p: number) =>
                    fakeGames.find((x: any) => x.pid === p);
                FluxDispatcher.dispatch({
                    type: "RUNNING_GAMES_CHANGE",
                    removed: realGames,
                    added: [fakeGame],
                    games: fakeGames
                });

                console.log(
                    `🎮 Simulating gameplay: ${applicationName}`
                );
                console.log(
                    `⏱️ Remaining wait time: ~${Math.ceil(
                        (secondsNeeded - secondsDone) / 60
                    )} min`
                );
                statusEl.textContent =
                    "Status: simulating PLAY_ON_DESKTOP quest";

                const fn = (data: any) => {
                    const progress =
                        quest.config.configVersion === 1
                            ? data.userStatus.streamProgressSeconds
                            : Math.floor(
                                data.userStatus.progress
                                    .PLAY_ON_DESKTOP.value
                            );

                    console.log(
                        `📊 Progress: ${progress}/${secondsNeeded} sec (${Math.floor(
                            (progress / secondsNeeded) * 100
                        )}%)`
                    );
                    statusEl.textContent = `Status: play quest ${Math.floor(
                        (progress / secondsNeeded) * 100
                    )}%`;

                    if (progress >= secondsNeeded) {
                        console.log(
                            "✅ Quest completed! Reward in 5–15 minutes."
                        );
                        statusEl.textContent =
                            "Status: PLAY_ON_DESKTOP quest completed";

                        RunningGameStore.getRunningGames =
                            realGetRunningGames;
                        RunningGameStore.getGameForPID =
                            realGetGameForPID;
                        FluxDispatcher.dispatch({
                            type: "RUNNING_GAMES_CHANGE",
                            removed: [fakeGame],
                            added: [],
                            games: []
                        });
                        FluxDispatcher.unsubscribe(
                            "QUESTS_SEND_HEARTBEAT_SUCCESS",
                            fn
                        );
                    }
                };

                FluxDispatcher.subscribe(
                    "QUESTS_SEND_HEARTBEAT_SUCCESS",
                    fn
                );
            } catch (e) {
                console.error(
                    "❌ Error loading application data:",
                    e
                );
                statusEl.textContent =
                    "Status: error loading app data (see console)";
            }
        }

        async function handleStreamQuest(
            quest: any,
            applicationId: string,
            applicationName: string,
            pid: number,
            secondsNeeded: number,
            secondsDone: number,
            statusEl: HTMLElement
        ) {
            console.log(
                "STREAM_ON_DESKTOP handler not implemented in this port."
            );
            statusEl.textContent =
                "Status: STREAM_ON_DESKTOP not implemented";
        }

        async function handleActivityQuest(
            quest: any,
            questName: string,
            secondsNeeded: number,
            statusEl: HTMLElement
        ) {
            console.log(
                "PLAY_ACTIVITY handler not implemented in this port."
            );
            statusEl.textContent =
                "Status: PLAY_ACTIVITY not implemented";
        }

        async function mainForQuest(quest: any, statusEl: HTMLElement, sel: HTMLSelectElement, runBtn: HTMLButtonElement) {
            const pid = Math.floor(Math.random() * 30000) + 1000;
            const applicationId = quest.config.application.id;
            const applicationName = quest.config.application.name;
            const questName = quest.config.messages.questName;
            const taskConfig =
                quest.config.taskConfig ?? quest.config.taskConfigV2;
            const taskName = [
                "WATCH_VIDEO",
                "PLAY_ON_DESKTOP",
                "STREAM_ON_DESKTOP",
                "PLAY_ACTIVITY",
                "WATCH_VIDEO_ON_MOBILE"
            ].find((x: string) => taskConfig.tasks[x] != null)!;
            const secondsNeeded = taskConfig.tasks[taskName].target;
            const secondsDone =
                quest.userStatus?.progress?.[taskName]?.value ?? 0;

            console.log("Quest:", questName, "| Task:", taskName);
            console.log(`Progress: ${secondsDone}/${secondsNeeded}`);
            statusEl.textContent = `Status: running "${questName}" (${taskName})`;

            if (
                taskName === "WATCH_VIDEO" ||
                taskName === "WATCH_VIDEO_ON_MOBILE"
            ) {
                await handleVideoQuest(quest, secondsNeeded, secondsDone, statusEl);
            } else if (taskName === "PLAY_ON_DESKTOP") {
                if (!isApp) {
                    console.log(
                        "PLAY_ON_DESKTOP requires desktop app."
                    );
                    statusEl.textContent =
                        "Status: PLAY_ON_DESKTOP requires desktop app";
                    return;
                }
                await handlePlayQuest(
                    quest,
                    applicationId,
                    applicationName,
                    pid,
                    secondsNeeded,
                    secondsDone,
                    statusEl
                );
            } else if (taskName === "STREAM_ON_DESKTOP") {
                if (!isApp) {
                    console.log(
                        "STREAM_ON_DESKTOP requires desktop app."
                    );
                    statusEl.textContent =
                        "Status: STREAM_ON_DESKTOP requires desktop app";
                    return;
                }
                await handleStreamQuest(
                    quest,
                    applicationId,
                    applicationName,
                    pid,
                    secondsNeeded,
                    secondsDone,
                    statusEl
                );
            } else if (taskName === "PLAY_ACTIVITY") {
                await handleActivityQuest(
                    quest,
                    questName,
                    secondsNeeded,
                    statusEl
                );
            }

            statusEl.textContent = `Status: finished logic for "${questName}" (check console / rewards)`;
        }

        // ========== OVERLAY CREATION (so we can recreate / hide) ==========

        const createOverlay = () => {
            if (document.querySelector("#quest-helper-overlay")) return;

            const overlay = document.createElement("div");
            overlay.id = "quest-helper-overlay";
            overlay.innerHTML = `
  <h3>Quest Helper</h3>
  <label>
    Quest:
    <select id="qh-select"></select>
  </label>
  <button id="qh-run">Enroll + Run</button>
  <button id="qh-refresh">Refresh Quests</button>
  <button id="qh-close" style="margin-top:4px;background:#b33;">Hide</button>
  <small id="qh-status">Status: idle</small>
`;
            document.body.appendChild(overlay);

            const sel = overlay.querySelector("#qh-select") as HTMLSelectElement;
            const runBtn = overlay.querySelector("#qh-run") as HTMLButtonElement;
            const refreshBtn = overlay.querySelector("#qh-refresh") as HTMLButtonElement;
            const closeBtn = overlay.querySelector("#qh-close") as HTMLButtonElement;
            const statusEl = overlay.querySelector("#qh-status") as HTMLElement;

            guiInitQuests(sel, runBtn, statusEl);

            runBtn.addEventListener("click", async () => {
                const list = (sel as any)._availableQuests || [];
                const id = sel.value;
                if (!id) return;

                const quest = list.find((q: any) => q.id === id);
                if (!quest) {
                    statusEl.textContent =
                        "Status: quest not found in list";
                    return;
                }

                runBtn.disabled = true;
                try {
                    if (!quest.userStatus?.enrolledAt) {
                        const r = await safeEnroll(
                            quest.id,
                            quest.config.messages.questName,
                            statusEl
                        );
                        if (!r.success) {
                            runBtn.disabled = false;
                            return;
                        }
                        await sleep(3000);
                        const updated = [...QuestsStore.quests.values()].find(
                            (x: any) => x.id === quest.id
                        );
                        if (updated) {
                            await mainForQuest(updated, statusEl, sel, runBtn);
                        } else {
                            await mainForQuest(quest, statusEl, sel, runBtn);
                        }
                    } else {
                        await mainForQuest(quest, statusEl, sel, runBtn);
                    }
                } catch (e) {
                    console.error(e);
                    statusEl.textContent =
                        "Status: error (see console)";
                } finally {
                    runBtn.disabled = false;
                }
            });

            refreshBtn.addEventListener("click", async () => {
                statusEl.textContent = "Status: refreshing quests...";
                guiInitQuests(sel, runBtn, statusEl);
            });

            // just hide, do NOT remove
            closeBtn.addEventListener("click", () => {
                (overlay as HTMLDivElement).style.display = "none";
            });
        };

        // create overlay at start
        createOverlay();

        // toggle button logic
        toggleBtn.addEventListener("click", () => {
            let overlay = document.querySelector(
                "#quest-helper-overlay"
            ) as HTMLDivElement | null;

            if (!overlay) {
                createOverlay();
                return;
            }

            const hidden = overlay.style.display === "none";
            overlay.style.display = hidden ? "" : "none";
        });
    },

    stop() {
        const overlay = document.querySelector(
            "#quest-helper-overlay"
        );
        const toggle = document.querySelector(
            "#quest-helper-toggle"
        );
        if (overlay) overlay.remove();
        if (toggle) toggle.remove();
        const style = Array.from(
            document.querySelectorAll("style")
        ).find(s =>
            s.textContent?.includes("#quest-helper-overlay")
        );
        if (style) style.remove();
    }
});

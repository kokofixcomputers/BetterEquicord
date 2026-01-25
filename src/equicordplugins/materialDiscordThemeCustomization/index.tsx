// src/equicordplugins/materialDiscordThemeCustomization/index.tsx
import definePlugin from "@utils/types";

const DEFAULT_CSS = `
    :root {
        /* Main Christmas red accent */
        --accent-hue: 3 !important;         /* slightly warm red */
        --accent-saturation: 70% !important; /* vivid but not eye‑searing */
        --accent-lightness: 60% !important;  /* brighter than classic deep red */

        --accent-text-color: #ffffff !important;

        --button-height: 40px !important;
        --button-radius: 20px !important;
        --button-padding: 0 16px !important;

        --message-radius: 18px !important;
        --message-padding-top: 8px !important;
        --message-padding-side: 12px !important;

        --card-radius-small: 8px !important;
        --card-radius-big: 18px !important;

        --popout-radius-small: 8px !important;
        --popout-radius-big: 18px !important;
    }

    .theme-dark {
        --saturation-modifier: 0.3 !important;
        --lightness-modifier: 0.225 !important;
        --text-lightness-modifier: 1.0 !important;
    }

    .theme-dark.theme-darker {
        --text-lightness-modifier: 1.75 !important;
        --ui-darkness-modifier: 0.55 !important;
    }

    .theme-dark.theme-midnight {
        --text-lightness-modifier: 9.8 !important;
        --ui-darkness-modifier: 0.10 !important;
    }

    .theme-light {
        --saturation-modifier: 0.75 !important;
        --lightness-modifier: 2.125 !important;
    }
`;

export default definePlugin({
    name: "MaterialDiscordCustomization",
    description: "Material Discord theme with beautiful red accent dont use this idk how to port things",
    authors: [{ name: "CapnKitten", id: 405126960902176768n }],

    start() {
        const style = document.createElement("style");
        style.id = "mdc-theme-css";
        style.textContent = DEFAULT_CSS;
        document.head.appendChild(style);
        console.log("[Material Discord] Beautiful red theme loaded!");
    },

    stop() {
        document.getElementById("mdc-theme-css")?.remove();
    }
});

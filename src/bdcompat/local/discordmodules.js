/**
 * A large list of known and useful webpack modules internal to Discord.
 *
 * @module DiscordModules
 * @version 0.0.3
 */

const DiscordModules = {
    get React() { return window.BdApi?.Webpack?.getByProps("createElement", "cloneElement"); },
    get ReactDOM() { return window.BdApi?.Webpack?.getByProps("render", "findDOMNode"); },
    get ChannelActions() { return window.BdApi?.Webpack?.getByProps("selectChannel"); },
    get LocaleStore() { return window.BdApi?.Webpack?.getByProps("locale", "initialize"); },
    get UserStore() { return window.BdApi?.Webpack?.getByProps("getCurrentUser", "getUser"); },
    get InviteActions() { return window.BdApi?.Webpack?.getByProps("createInvite"); },
    get SimpleMarkdown() { return window.BdApi?.Webpack?.getByProps("parseBlock", "parseInline", "defaultOutput"); },
    get Strings() { return window.BdApi?.Webpack?.getByProps("Messages")?.Messages; },
    get Dispatcher() { return window.BdApi?.Webpack?.getByProps("dispatch", "subscribe", "register"); },
    get Tooltip() {
        const fallback = props => props.children?.({}) ?? null;
        return window.BdApi?.Webpack?.getModule?.(m => m.prototype?.renderTooltip, { searchExports: true }) ?? fallback;
    },
    get promptToUpload() { return window.BdApi?.Webpack?.getModule?.(m => m.toString?.().includes("getUploadCount"), { searchExports: true }); },
    get RemoteModule() { return window.BdApi?.Webpack?.getByProps("setBadge"); },
    get UserAgent() { return window.BdApi?.Webpack?.getByProps("os", "layout"); },
    get MessageUtils() { return window.BdApi?.Webpack?.getByProps("sendMessage"); },
};

export default DiscordModules;
# [<img src="./browser/icon.png" width="40" align="left" alt="Equicord">](https://github.com/Equicord/Equicord) BetterEquicord

[![Equibop](https://img.shields.io/badge/Equibop-grey?style=flat)](https://github.com/Equicord/Equibop)
[![Tests](https://github.com/Equicord/Equicord/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Equicord/Equicord/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/1173279886065029291.svg?color=768AD4&label=Discord&logo=discord&logoColor=white)](https://equicord.org/discord)

BetterEquicord is a fork of [Equicord](https://github.com/Equicord/Equicord), adding experimental support for BetterDiscord plugins. However, this feature is currently very experimental and not all plugins will work.

The code for supporting BetterDiscord plugins is originally from [https://github.com/Davilarek/Vencord](https://github.com/Davilarek/Vencord) for Vencord, then ported to Equicord by kokofixcomputers.

This project also aims to improve Equicord.

### Included Plugins

Included plugins from the original Equicord project can be found [here](https://equicord.org/plugins).

## Installing / Uninstalling

Currently, pre-built builds are not available. Follow the below instructions in `Installing Equicord Devbuild` to build.

## Installing Equicord Devbuild

### Dependencies

[Git](https://git-scm.com/download) and [Node.JS LTS](https://nodejs.dev/en/) are required.

Install `pnpm`:

> :exclamation: This next command may need to be run as admin/root depending on your system, and you may need to close and reopen your terminal for pnpm to be in your PATH.

```shell
npm i -g pnpm
```

> :exclamation: **IMPORTANT** Make sure you aren't using an admin/root terminal from here onwards. It **will** mess up your Discord/BetterEquicord instance and you **will** most likely have to reinstall.

Clone BetterEquicord:

```shell
git clone https://github.com/kokofixcomputers/BetterEquicord
cd BetterEquicord
```

Install dependencies:

```shell
pnpm install --frozen-lockfile
```

Build BetterEquicord:

```shell
pnpm build
```

Inject BetterEquicord into your desktop client:

```shell
pnpm inject
```

Build BetterEquicord for web:

```shell
pnpm buildWeb
```

After building BetterEquicord's web extension, locate the appropriate ZIP file in the `dist` directory and follow your browser’s guide for installing custom extensions, if supported.

Note: Firefox extension zip requires Firefox for developers

## Credits

Thank you to [Vendicated](https://github.com/Vendicated) for creating [Vencord](https://github.com/Vendicated/Vencord) & [Suncord](https://github.com/verticalsync/Suncord) by [verticalsync](https://github.com/verticalsync) for helping when needed.

## Disclaimer

Discord is trademark of Discord Inc., and solely mentioned for the sake of descriptivity.
Mentioning it does not imply any affiliation with or endorsement by Discord Inc.
Vencord is not connected to BetterEquicord and as such, all donation links go to Vendicated's donation link.
BetterEquicord is not connected to BetterDiscord nor Equicord. DO NOT ask for support in their servers.

<details>
<summary>Using BetterEquicord/Equicord/**ANY MODIFICATION OF DISCORD** violates Discord's terms of service</summary>

Client modifications are against Discord’s Terms of Service.

However, Discord is pretty indifferent about them and there are no known cases of users getting banned for using client mods! So you should generally be fine if you don’t use plugins that implement abusive behaviour. But no worries, all inbuilt plugins are safe to use!

Regardless, if your account is essential to you and getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to Equicord), just to be safe.

Additionally, make sure not to post screenshots with BetterEquicord in a server where you might get banned for it.

</details>

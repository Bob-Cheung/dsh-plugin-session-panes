**Session panes** lets you keep several sessions visible at the same time in the right sidebar — click a session row's button, or drag the row onto the right side of the window, and that session opens as its own pane while the main column keeps whatever you were doing.

- Repo: https://github.com/Bob-Cheung/dsh-plugin-session-panes
- License: MIT
- Tested with DeepSeek Harness `0.1.5-rc.1` (desktop profile, Web UI)

## Why I built it

Switching back and forth between sessions is the part of my workflow that felt the most expensive: I want the main session in front of me while a second agent keeps working, or I want to watch two runs produce streaming output side by side.

The right sidebar already had the right shape for this, so the plugin just gives it a session-backed tab type and a way to put a session there.

## What you get

- **Two ways to open a pane** — hover a session row and click the button, or press and drag the button onto the highlighted right-hand drop zone (the right 45% of the viewport).
- **Real chat panes, not previews** — each pane mounts the shared Conversation slot, so you can type, stop/continue, and watch streaming output.
- **Native drag still works** — the plugin only intercepts presses that start on its own button, and only drags from the left column toward the right; reordering sessions is unaffected.
- **Drag feedback** — a floating title follows the pointer and the drop zone highlights with a label.
- **zh / en** — UI strings and plugin metadata are localized in Simplified Chinese and English.
- **No build step, no dependencies** — plain ESM and `React.createElement`, installed straight from the checkout.

## Install

```bash
git clone https://github.com/Bob-Cheung/dsh-plugin-session-panes.git
```

Then, in any Harness session, ask the agent:

```text
Install D:\tools\dsh-plugin-session-panes as a plugin
```

or call the plugin manager directly (`target` is the directory containing `package.json`):

```text
plugin_manager(action: "install_bundle", target: "D:\\tools\\dsh-plugin-session-panes")
```

Refresh the page once if the UI does not pick it up immediately. Updates are `git pull` plus a Harness restart, because a directory install is a link to the checkout rather than a copy. Uninstall with:

```text
plugin_manager(action: "remove_bundle", target: "@bob-cheung/dsh-session-panes")
```

## How it works

| Piece | What it does |
| --- | --- |
| `sessionchat` resource protocol | Addresses a session as `dsh-resource://sessionchat/session/<id>?title=…` and `retain()`s it for the tab's lifetime |
| `sidebarRightTabs` tab type | `priority: 'extension'`, title taken from the address |
| `sidebar.right.pane.tab` slot | Mounts `SessionProvider` around the shared Conversation slot (`view: 'chat'`) |
| `sidebar.workspaces.session.row.action` slot | The hover button, click-to-open and pointer-drag |
| `shell.overlay` slot | Floating drag preview and the highlighted drop zone |

The Host half is deliberately empty (`export function apply() {}`); everything lives in the browser half.

## Compatibility and limitations

- Needs the Web UI with `sidebarRight` plus the slots above; it is a no-op wherever those are not present.
- Has no user-facing config; the drop ratio (`0.55`) and the 6 px drag threshold are constants in `client.js`.
- If you move the checkout or switch install sources, restart Harness — the Host keeps the previously resolved absolute path until then. That one bit me while testing.

Feedback, bug reports and PRs are welcome — especially if you are on a Harness version where the sidebar slots differ.

---

**中文简介**：Session panes 是一个 DeepSeek Harness Web UI 插件，可以把多个会话并排放在右侧边栏同时查看。悬停左侧会话行点按钮，或把该行拖到窗口右侧，会话就会在右侧打开为独立窗格；主栏当前会话不受影响。窗格是真正的聊天面板，可以继续输入、查看流式输出。支持中英文与明暗主题，无依赖、无构建步骤，MIT 许可。安装方式：`git clone` 仓库后，让 Harness 把该目录安装为插件即可。

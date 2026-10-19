# 多会话分屏 · Session panes

在 DeepSeek Harness Web UI 的右侧边栏中**并排打开多个会话**：点击会话行上的按钮，或者把会话拖到窗口右侧区域，该会话就会作为一个独立窗格出现在右侧，主栏当前会话不受影响。

> 一个插件同时提供 Host 半与 Client 半；Host 不注册任何行为，界面逻辑全部在浏览器端。

## 功能特性

- **两种打开方式**：会话行悬停按钮一点即开；也可以按住按钮拖到窗口右侧（右侧 45% 为投放区）后松手。
- **原生拖拽兼容**：会话行本身用于排序的原生拖拽仍然可用，插件只拦截"开始于自身按钮"的按压，且只处理从左栏发往右侧的拖拽，右侧窗格内的拖拽不受影响。
- **多窗格并存**：每个会话对应一个独立的右侧标签页（`preferNewPane`），可以同时查看多个会话的实时输出。
- **拖拽反馈**：拖动时显示跟随指针的标题浮层，右侧投放区高亮并提示"拖到此处"。
- **中文 / English 双语**：界面与插件元数据均提供简体中文与英文文案，跟随 Harness 语言设置。
- **明暗主题自适应**：样式全部使用 `--dsw-alias-*` 主题变量，不写死颜色。
- **无构建步骤**：纯 ESM + 运行时 `React.createElement`，安装即生效。

## 安装

### 装到自己的 Harness

**从 npm（发布后可用）**：

```
plugin_manager(action: "install_bundle", target: "@bob-cheung/dsh-session-panes@1.0.0")
```

**从本地目录**（当前可用）：`target` 指向本目录（含 `package.json` 的绝对路径）：

```
plugin_manager(action: "install_bundle", target: "<此目录的绝对路径>")
```

也可以直接对 DSH 的 agent 说「请把 `<此目录的绝对路径>` 安装为插件」。

安装后会由 `cordis.patch.yml` 插入 `session-panes` 行，Client 半随页面加载立即注入。重启 Harness 后依然生效。

### 分享给别人

本仓库可以直接对外分发，接收方按 [仓库根目录 README](../README.md) 操作：

1. `git clone https://github.com/Bob-Cheung/deepseek-harness-plugin.git`
2. 在 DSH 会话里说「请把 `<克隆路径>/session-panes` 安装为插件」
3. 刷新页面（或重启 Harness）

注意：本地目录安装是**链接** checkout，不是拷贝，所以对方 `git pull` 后需要重启 Harness 才会加载新代码；卸载用 `plugin_manager(action: "remove_bundle", target: "@bob-cheung/dsh-session-panes")`。

包名 `@bob-cheung/dsh-session-panes` 已按 npm 发布要求准备好（MIT、`publishConfig.access: public`、`private` 已移除），但尚未 `npm publish`；发布步骤见根目录 README 的「发布到 npm」一节。发布后即可用上面的 npm 一行安装。

## 使用

1. 在左侧会话列表中找到目标会话。
2. 悬停该行，点击右侧出现的「在右侧打开」按钮；或者按住该按钮拖到窗口右侧高亮区域后松手。
3. 会话会以新标签的形式出现在右侧边栏，可继续输入、查看流式输出。
4. 关闭标签页即释放该窗格（插件会释放对会话的 retain）。

> 若右侧边栏尚未挂载，插件会先在主栏打开该会话以激活侧栏，随后自动在右侧打开对应窗格。

## 工作原理

| 组成 | 说明 |
| --- | --- |
| 资源协议 | 注册 `sessionchat` 协议，地址形如 `dsh-resource://sessionchat/session/<sessionId>?title=<标题>`，打开时 `ctx.sessions.retain()` 持有会话，标签页关闭即 `release()`。 |
| 侧栏标签类型 | 通过 `sidebarRightTabs.register()` 注册 `sessionchat` 类型，`priority: 'extension'`，标题优先取地址中的 `title`。 |
| 标签页内容 | 在 `sidebar.right.pane.tab` 插槽中注册 `SessionChatTab`，用 `SessionProvider` 包裹共享的 Conversation 插槽，复用主界面聊天视图（`view: 'chat'`）。 |
| 行操作按钮 | 在 `sidebar.workspaces.session.row.action` 插槽注册 `SessionRowAction`，负责点击打开与指针拖拽。 |
| 拖拽浮层 | 在 `shell.overlay` 注册 `DropOverlay`，绘制固定定位的投放区与跟随指针的幽灵标签。 |
| 样式 | 运行时注入 `<style data-plugin="@bob-cheung/dsh-session-panes">`，卸载时移除。 |

依赖的客户端服务（`inject`）：`sessions`、`uiWorkspace`、`slots`、`locale`、`sidebarRight`；插槽注入后额外使用 `resources`、`sidebarRightTabs`。

## 目录结构

```
session-panes/
├── package.json        # 包清单：exports 与 dsh.bundle / dsh.client 声明
├── cordis.patch.yml    # Loader patch：插入 session-panes 行
├── index.js            # Host 半：空实现
├── client.js           # Client 半：协议、标签页、行按钮、拖拽浮层、样式
├── icon.svg            # 插件图标
├── README.md           # 本文件
└── locale/
    ├── zh.json         # 插件标题与描述（中文）
    └── en.json         # 插件标题与描述（英文）
```

## 配置项

插件没有用户可配置项，安装后即按上述默认行为工作。投放区比例由 `client.js` 中的 `DROP_RATIO = 0.55` 决定（视口右侧 45%），拖拽判定阈值 6px。

## 兼容性

- 需要 Harness Web UI 提供右侧边栏（`sidebarRight`）与 `sidebar.right.pane.tab`、`sidebar.workspaces.session.row.action`、`shell.overlay` 插槽。
- 仅作用于 Web 客户端；Host 侧无行为，不影响终端或 API 调用。
- 已在 DeepSeek Harness `0.1.5-rc.1`（desktop profile）上验证安装与使用。
- 会话 ID 按 `session-<uuid>` 形式识别；若会话行未暴露 `data-session-id` 等属性，会退化到从拖拽数据中解析 UUID。

## License

[MIT](https://github.com/Bob-Cheung/deepseek-harness-plugin/blob/main/LICENSE) © 2026 Bob Cheung

## English

Open multiple sessions side by side in the right sidebar of the DeepSeek Harness Web UI. Hover a session row and click **Open in the right sidebar**, or drag the row's button onto the right 45% of the viewport, and the session opens as its own pane while the main column keeps its current session.

- Registers a `sessionchat` resource protocol (`dsh-resource://sessionchat/session/<sessionId>`) that retains the session for the tab's lifetime.
- Registers a `sidebarRightTabs` tab type and mounts the shared chat Conversation slot inside it.
- Works with the native row drag used for reordering; only presses starting on the plugin's own button, and drags from the left column, are intercepted.
- Localized in Simplified Chinese and English; styles come from `--dsw-alias-*` theme tokens.
- Install with `plugin_manager(action: "install_bundle", target: "<absolute path to this directory>")`. No build step.

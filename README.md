# 多会话分屏 · DSH session panes

一个 DeepSeek Harness Web UI 插件：**在右侧边栏并排打开多个会话**。点击会话行上的按钮，或把会话拖到窗口右侧，该会话就会作为独立窗格出现在右侧，主栏当前会话不受影响。

- 仓库：<https://github.com/Bob-Cheung/deepseek-harness-plugin-session-panes>
- npm 包名：`@bob-cheung/dsh-session-panes`（尚未发布）
- 许可证：MIT

> 本仓库根目录就是插件包本身（`package.json` 在根上），不是 monorepo，也没有子包。安装时 `target` 直接指向仓库根目录。

## 功能特性

- **两种打开方式**：会话行悬停按钮一点即开；也可以按住按钮拖到窗口右侧（右侧 45% 为投放区）后松手。
- **原生拖拽兼容**：会话行本身用于排序的原生拖拽仍然可用，插件只拦截"开始于自身按钮"的按压，且只处理从左栏发往右侧的拖拽，右侧窗格内的拖拽不受影响。
- **多窗格并存**：每个会话对应一个独立的右侧标签页（`preferNewPane`），可以同时查看多个会话的实时输出。
- **拖拽反馈**：拖动时显示跟随指针的标题浮层，右侧投放区高亮并提示"拖到此处"。
- **中文 / English 双语**：界面与插件元数据均提供简体中文与英文文案，跟随 Harness 语言设置。
- **明暗主题自适应**：样式全部使用 `--dsw-alias-*` 主题变量，不写死颜色。
- **无构建步骤**：纯 ESM + 运行时 `React.createElement`，安装即生效；没有依赖、没有安装脚本。

## 环境要求

- 已安装 DeepSeek Harness，并使用 **Web UI**（桌面端或 `dsh web` 均可）。
- Harness 版本需提供右侧边栏相关服务与插槽（见「兼容性」）。已在 `0.1.5-rc.1` 上验证。
- 安装插件不需要 Node.js、pnpm 或任何构建工具，这些由 Harness 自身完成。

## 安装

### 方式 A：从本仓库克隆后安装（当前可用）

```bash
git clone https://github.com/Bob-Cheung/deepseek-harness-plugin-session-panes.git
```

假设克隆到 `D:\tools\deepseek-harness-plugin-session-panes`，然后在 DSH 任意会话里说：

```text
请把 D:\tools\deepseek-harness-plugin-session-panes 安装为插件
```

等价的插件管理器调用（`target` 是含 `package.json` 的绝对路径，即仓库根）：

```text
plugin_manager(action: "install_bundle", target: "D:\\tools\\deepseek-harness-plugin-session-panes")
```

首次安装可能弹出权限确认，允许即可。安装返回 `application: applied` 后，如果界面没有立刻变化，刷新一次页面。

### 方式 B：下载 ZIP（没有 Git 时）

在仓库页 **Code → Download ZIP**，解压后把解压目录的路径交给上一步；注意 ZIP 解压后通常多一层同名目录，`target` 要指向真正含 `package.json` 的那一层。

### 方式 C：从 npm 安装（发布后可用）

```text
plugin_manager(action: "install_bundle", target: "@bob-cheung/dsh-session-panes@1.0.0")
```

当前尚未 `npm publish`，这条命令暂时装不到；发布步骤见「发布到 npm」。

安装成功后，在「插件管理 / Plugins」里能看到 **Session panes / 多会话分屏**，带图标与中英文描述。

## 使用

1. 在左侧会话列表中找到目标会话。
2. 悬停该行，点击右侧出现的「在右侧打开」按钮；或者按住该按钮拖到窗口右侧高亮区域后松手。
3. 会话会以新标签的形式出现在右侧边栏，可继续输入、查看流式输出。
4. 关闭标签页即释放该窗格（插件会释放对会话的 retain）。

> 若右侧边栏尚未挂载，插件会先在主栏打开该会话以激活侧栏，随后自动在右侧打开对应窗格。

## 更新

- **本地目录安装**：安装是**链接**到 checkout，不是拷贝，所以只需：

  ```bash
  git pull
  ```

  然后**重启 Harness**（替换已安装的 JavaScript 模块需要重启才能加载新版本，只刷新页面不一定够）。
- **npm 安装**：把 `target` 里的版本号改掉重新安装，然后重启 Harness。

## 卸载

```text
plugin_manager(action: "remove_bundle", target: "@bob-cheung/dsh-session-panes")
```

卸载后刷新页面。

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

Host 半（`index.js`）只导出一个空的 `apply()`，不注册任何行为。

## 目录结构

```text
deepseek-harness-plugin-session-panes/
├── package.json        # 包清单：exports、files 与 dsh.bundle / dsh.client 声明
├── cordis.patch.yml    # Loader patch：插入 session-panes 行
├── index.js            # Host 半：空实现
├── client.js           # Client 半：协议、标签页、行按钮、拖拽浮层、样式
├── icon.svg            # 插件图标
├── LICENSE             # MIT
├── README.md           # 本文件
├── .gitignore
└── locale/
    ├── zh.json         # 插件标题与描述（中文）
    └── en.json         # 插件标题与描述（英文）
```

## 配置与可调参数

插件没有面向用户的配置项，安装后即按默认行为工作。需要微调时改 `client.js` 顶部的常量：

| 常量 | 默认值 | 作用 |
| --- | --- | --- |
| `DROP_RATIO` | `0.55` | 投放区从视口宽度的 55% 处开始，即右侧 45% |
| 拖拽阈值 | `6`（px） | 指针移动超过该距离才判定为拖拽，避免误触 |
| `KIND` / `RESOURCE_PROTOCOL` | `sessionchat` | 资源协议与标签类型标识，改动需同步 `cordis.patch.yml` 之外的所有引用 |

## 兼容性

- 需要 Harness Web UI 提供右侧边栏（`sidebarRight`）与 `sidebar.right.pane.tab`、`sidebar.workspaces.session.row.action`、`shell.overlay` 插槽。
- 仅作用于 Web 客户端；Host 侧无行为，不影响终端或 API 调用。
- 已在 DeepSeek Harness `0.1.5-rc.1`（desktop profile）上验证安装与使用。
- 会话 ID 按 `session-<uuid>` 形式识别；若会话行未暴露 `data-session-id` 等属性，会退化到从拖拽数据中解析 UUID。

## 开发与校验

- 无构建：纯 ESM，改完文件重装或重启 Harness 即可看到效果。
- 语法检查：

  ```bash
  node --check client.js
  node --check index.js
  ```

- 清单校验：`package.json`、`locale/*.json` 是 JSON，`cordis.patch.yml` 是 YAML；改完立即检查。
- 打包内容核对：

  ```bash
  npm pack --dry-run
  ```

  应当包含 `package.json`、`index.js`、`client.js`、`cordis.patch.yml`、`icon.svg`、`locale/*.json`，以及 npm 自动带入的 `README.md`、`LICENSE`。

## 发布到 npm

包名 `@bob-cheung/dsh-session-panes` 在 npm 上未被占用；发布需要拥有 `bob-cheung` 这个用户名或组织：

```bash
npm login          # 首次，浏览器授权
npm publish        # publishConfig.access=public，无需再加 --access
```

发布后：

```bash
npm view @bob-cheung/dsh-session-panes version
```

常见失败码：`E403` scope 无权限（改包名，需同步 `package.json`、`cordis.patch.yml`、`client.js` 三处）；`E402` 需付费组织；`E409` 版本已存在（先改 `version`）；`EOTP` 需要一次性验证码。

## 常见问题

**会话行没有出现「在右侧打开」按钮？**
确认插件已安装且已启用（`application: applied`），然后刷新页面；仍不行则重启 Harness。若近期切换过安装来源（例如从本地目录换成 npm 包），Host 可能仍持有旧的绝对路径，必须重启。

**拖到右侧没有反应？**
投放区只在视口右侧 45% 内生效，且需要从会话行按钮上开始拖拽；松手位置要落在高亮区域内。

**右侧打开了空白窗格？**
说明该会话的资源创建失败，通常伴随控制台错误；关闭标签页后重试，并确认 Harness 版本提供 `sidebarRight` 服务。

## License

[MIT](LICENSE) © 2026 Bob Cheung

## English

`@bob-cheung/dsh-session-panes` — open multiple sessions side by side in the DeepSeek Harness Web UI right sidebar. Hover a session row and click **Open in the right sidebar**, or drag the row's button onto the right 45% of the viewport; the session opens as its own pane while the main column keeps its current session.

- This repository root **is** the plugin package (no monorepo, no subpackages); install `target` points at the clone root.
- Registers a `sessionchat` resource protocol (`dsh-resource://sessionchat/session/<sessionId>`) that retains the session for the tab's lifetime, a `sidebarRightTabs` tab type, and the shared chat Conversation slot.
- Local installs are links: `git pull` and restart Harness to update.
- Localized in Simplified Chinese and English; styles use `--dsw-alias-*` theme tokens; no dependencies and no build step.

Install from a checkout:

```text
plugin_manager(action: "install_bundle", target: "<absolute path to this repository>")
```

Install from npm (once published):

```text
plugin_manager(action: "install_bundle", target: "@bob-cheung/dsh-session-panes@1.0.0")
```

Uninstall with `plugin_manager(action: "remove_bundle", target: "@bob-cheung/dsh-session-panes")`. Licensed MIT.

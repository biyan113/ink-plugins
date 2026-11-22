# 插件 API 与规范

适用于 **M0（预览）**。入门见 [README.md](README.md)，类型声明见 [ink.d.ts](ink.d.ts)。

本文分两部分：Ink 提供什么（[manifest](#manifestjson)、[生命周期](#生命周期)、[API](#api)、[权限](#权限)、[限制](#限制)），以及插件要遵守什么（[规范](#规范)）。标「计划」的是还没有实现的，写出来是为了让接口方向提前定下来。

## manifest.json

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 只用小写字母、数字和 `-`，以字母开头，例如 `wechat-export`。必须和文件夹名一致，发布后不能改 |
| `name` | 是 | 显示名。命令在命令面板里显示为「`name`：命令名」 |
| `version` | 是 | 语义化版本 `主.次.修订`。每次发布都要加一 |
| `minInkVersion` | 建议 | 需要的最低 Ink 版本。M0 还不检查，M1 起低于它的 Ink 不加载这个插件 |
| `author` | 建议 | 作者或组织 |
| `description` | 建议 | 一两句话说明插件做什么 |
| `permissions` | 否 | 要用的权限，见[权限](#权限)。不写就是什么权限都没有 |

不认识的字段会被忽略。

## 生命周期

1. Ink 启动时，按插件文件夹里 `community.json` 的顺序，加载启用了的插件。
2. 执行 `main.js`。它的默认导出必须是一个继承 `ink.Plugin` 的类。
3. Ink 创建这个类的实例，调用 `onload()`。命令只能在 `onload` 里添加。`onload` 可以是 `async`，但所有工作（包括等待的 Promise）也要在 2 秒内完成。
4. 用户运行命令时，调用这条命令的回调。

`onload` 里没有文档，这时调用编辑器方法会报错。`onunload` M0 还不会被调用（计划在支持停用、热重载时调用）。

加载失败的插件不会运行。失败原因写到标准错误输出（从终端启动 Ink 时能看到）；`ink plugin run` 也会把原因打印出来。

## API

全局对象是 `ink`，插件不需要 import 它。

### ink.Plugin

| 方法 | 说明 |
|---|---|
| `addCommand(command)` | 添加一条命令，返回传入的对象。只能在 `onload` 里调用，`id` 在本插件内不能重复 |
| `loadData(): Promise<any>` | 读插件文件夹里的 `data.json`，没有时得到 `null` |
| `saveData(data): Promise<void>` | 把 `data` 写成 JSON，存到 `data.json` |
| `onload()` / `onunload()` | 由子类覆盖，见[生命周期](#生命周期) |

`addCommand` 的参数：

| 字段 | 说明 |
|---|---|
| `id` | 命令 id，本插件内唯一，用在 `ink plugin run` 里 |
| `name` | 显示名，写成动宾短语，例如「复制为公众号文章」，不用再写插件名 |
| `hotkey` | 可选。`⌥⌘D` 这样的符号写法，或者 `alt-cmd-d` 这样的写法。如果已经被内置命令或用户占用，就不生效 |
| `editorCallback(editor, view)` | 需要当前文档的命令用这个 |
| `callback()` | 不需要文档的命令用这个。两个回调必须有一个 |

回调可以返回 Promise。回调抛出错误时，错误信息显示在状态栏，并计入连续失败次数。

### Editor

`editorCallback` 的第一个参数，代表当前文档。位置用 `{ line, ch }` 表示：

- 行号从 0 开始，按 `\n` 分行。文档以换行结尾时，末尾还有一个空行（和 CodeMirror 一样）。
- `ch` 按 UTF-16 码元计数，和 JavaScript 字符串的下标一致。例如 `😀` 占 2。
- 超出范围的位置会被收回范围内：行号超过最后一行就是文末，`ch` 超过行尾就是行尾。

| 方法 | 说明 |
|---|---|
| `getValue(): string` | 全文（Markdown 源码） |
| `getSelection(): string` | 选中的文字，没有选中时是 `""` |
| `somethingSelected(): boolean` | 有没有选中文字 |
| `getCursor(which?)` | `"head"`（默认，光标所在端）、`"anchor"`、`"from"`（靠前的一端）、`"to"`（靠后的一端） |
| `lineCount(): number` | 行数 |
| `getLine(n): string` | 第 `n` 行，不带换行符 |
| `replaceSelection(text)` | 用 `text` 替换选中的文字；没有选中时在光标处插入。光标移到插入的文字之后 |
| `replaceRange(text, from, to?)` | 把 `from` 到 `to` 换成 `text`；省略 `to` 时在 `from` 插入。选区跟着文字移动 |
| `setSelection(anchor, head?)` | 设置选区；省略 `head` 时是一个光标 |
| `setCursor(pos)` | 把光标放到 `pos` |

一次回调里的修改按顺序生效：后面的调用看到的是前面改过的文字。回调结束后，所有修改作为**一步撤销**写回文档。

### view

`editorCallback` 的第二个参数，也可以通过 `ink.workspace.activeView` 拿到。

| 属性 | 说明 |
|---|---|
| `view.editor` | 同上面的 Editor |
| `view.file` | `{ basename }`，文件名去掉扩展名；新建、还没保存的文档是 `null` |

### ink.Notice

```js
new ink.Notice("已复制");
```

在 Ink 状态栏左边显示一行提示。同一次命令里显示多次，只留最后一条。

### ink.markdown.toHtml(markdown): string

用 Ink「导出 HTML」的同一套规则，把 Markdown 转成 HTML 正文（不含 `<html>`、`<head>`）：

- 文件开头的 front matter 不输出；
- `==高亮==` 输出为 `<mark>`；
- 公式输出为 MathML（`<span class="katex"><math>…</math></span>`），块级公式外面套 `<div style="text-align:center">`；
- Mermaid 代码块输出为内联 SVG；
- 任务列表输出为 `<input type="checkbox" disabled>`，脚注输出为 `<sup class="footnote-reference">` 和 `<div class="footnote-definition">`；
- 标题带 `id`，`[TOC]` 换成目录。

### ink.saveAs(name, ext, content)

让用户选位置，保存一个文件。`name` 是建议的文件名（不含扩展名），`ext` 是扩展名（不含点），`content` 是文本，按 UTF-8 写入。不需要任何权限，因为位置由用户自己选。

保存面板在命令结束后才弹出。用 `ink plugin run` 运行时，内容写到 stdout 或 `-o` 指定的文件。

### ink.clipboard.writeHtml(html, text?)

把 `html` 以 HTML 格式放进系统剪贴板，`text` 是纯文本备份（粘贴到只收纯文本的地方时用它）。需要 `clipboard` 权限。

目前只有 macOS 支持；其它平台上会在状态栏提示改用导出。

## 权限

在 `manifest.json` 里声明：

```json
"permissions": { "clipboard": true }
```

| 权限 | 状态 | 开了以后能做什么 |
|---|---|---|
| 当前文档 | 默认就有 | 读全文和选区，写回修改 |
| 保存面板 | 默认就有 | `ink.saveAs` |
| `clipboard: true` | 可用 | `ink.clipboard.writeHtml` |
| `network: ["域名", …]` | 计划 | `ink.request()`，只能访问列出的域名 |
| `files: "read"` / `"write"` | 计划 | 读（写）当前打开的文件夹里的文件 |
| `shell: true` | 计划 | 在登录 shell 里运行命令，安装时单独警告 |

计划中的权限现在声明了也没有效果。只声明真正用到的权限：以后 Ink 会在启用插件时把权限列给用户看。

## 限制

| 项 | 上限 | 超过时 |
|---|---|---|
| 一次调用（含 `onload`）的时间 | 2 秒 | 停止这次调用，提示「运行超过 2 秒」 |
| 每个插件的内存 | 64 MB | 停止这次调用，提示「内存超过 64 MB」 |
| 连续失败 | 3 次 | 插件被停用，直到 Ink 重启 |
| 计时器、网络、文件系统 | 没有 | `setTimeout`、`fetch` 等都不存在；只等待它们的 Promise 永远不会完成，会报错 |

一个参照：公众号导出插件处理 100 万字的文档，连同启动 `ink` 命令一共约 1 秒。

## 规范

插件要遵守下面这些。M3 开放插件市场后，上架审核按这一节来。

**身份**

- `id` 一旦发布就不改。改名只改 `name`。
- 每次发布都改 `version`，规则按语义化版本：改了行为、去掉功能，主版本加一。
- 文件夹里放一份 `README.md`（做什么、命令和快捷键、需要的权限及原因）和一份 `LICENSE`。

**代码**

- `main.js` 必须是可读的源码，或打包后的源码（允许压缩，但要同时附上 source map 或源码仓库地址）。不接受混淆。
- 不在运行时生成或执行代码（`eval`、`new Function`），不把用户的文档内容发到任何地方（M0 也没有网络能力）。
- 一次命令要在 2 秒内做完。处理长文档时先在 100 万字的文档上试一次。

**界面**

- 命令名写成动宾短语（「导出为……」「插入……」），不加插件名，不加表情。
- 少设快捷键。确实需要时用 `⌃⌥⌘` 加字母这类不常用的组合，并在 README 里写明。
- 提示要说清发生了什么、用户下一步做什么，例如「有本地图片，公众号读不到：先运行『上传文档中的本地图片』」。

**数据**

- 插件自己的数据只写 `data.json`。不把密钥、令牌写进 `main.js`。
- 不改用户没让改的文字。只读的命令（导出、复制）不要调用编辑器的写方法。

## 发布

现在还没有插件市场。发布方式：把插件文件夹打成 zip，或放在一个公开的 Git 仓库里，让用户复制到插件文件夹再运行 `ink plugin enable <id>`。

插件市场计划在 M3 推出：一份公开的清单列出每个插件的 id、仓库、版本和 sha256，Ink 里可以浏览、安装、更新，安装时核对 sha256，权限变多时再问一次用户。

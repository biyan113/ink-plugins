# 给 Ink 写插件

> 这里是 Ink 插件开发的文档、类型声明和示例插件，网页版在 https://ink.bytenote.net/plugins/。
> 本仓库由 Ink 主仓库生成，请不要直接改这里的文件；有问题或建议请提 issue。


Ink 的插件是一个文件夹，里面有 `manifest.json` 和 `main.js`。插件用 JavaScript 写，在 Ink 内嵌的 QuickJS 里运行，能往命令面板加命令、读写当前文档、导出文件、写剪贴板。

> 插件 API 目前是 **M0（预览）**：能用，但在 1.0 之前还会改。改动会写在本文末尾的「变更」里。
>
> 插件功能从 0.1.18 之后的下一个 Ink 版本开始提供，0.1.18 及更早的版本没有。

| 文档 | 内容 |
|---|---|
| 本文 | 十分钟写出第一个插件：文件结构、安装、调试 |
| [API.md](API.md) | 全部 API、manifest 字段、权限、限制，以及插件要遵守的规范 |
| [ink.d.ts](ink.d.ts) | 类型声明，放进项目里，编辑器就有补全和检查 |
| [examples/hello](examples/hello) | 最小的示例插件，可以复制来改 |
| [examples/wechat-export](examples/wechat-export) | 完整的插件：公众号导出 |

## 第一个插件

新建一个文件夹，名字就是插件的 id，比如 `hello`：

```
hello/
  manifest.json
  main.js
```

`manifest.json`：

```json
{
  "id": "hello",
  "name": "你好",
  "version": "0.1.0",
  "minInkVersion": "0.1.18",
  "author": "你的名字",
  "description": "在光标处插入今天的日期"
}
```

`main.js`：一个 ES 模块，默认导出一个继承 `ink.Plugin` 的类。

```js
export default class Hello extends ink.Plugin {
  onload() {
    this.addCommand({
      id: "insert-date",
      name: "插入今天的日期",
      hotkey: "⌃⌥⌘D",
      editorCallback: (editor) => {
        editor.replaceSelection(new Date().toISOString().slice(0, 10));
      },
    });
  }
}
```

这样就写完了。命令会以「你好：插入今天的日期」出现在命令面板（`⇧⌘P`）里，也可以按 `⌃⌥⌘D`。

## 安装和启用

插件放在 Ink 的插件文件夹里。macOS 上是：

```
~/Library/Application Support/Ink/notes/Ink/plugins/
```

```sh
cp -R hello "$HOME/Library/Application Support/Ink/notes/Ink/plugins/"
ink plugin enable hello
```

然后重新打开 Ink。只有启用了的插件才会加载，启用列表在插件文件夹的 `community.json` 里。`ink plugin list` 能看到装了哪些、启用了哪些。

`ink` 命令行就是 Ink 本身，建一个叫 `ink` 的链接就能用（名字必须是小写 `ink`）：

```sh
ln -s /Applications/Ink.app/Contents/MacOS/Ink /usr/local/bin/ink
```

## 不开窗口调试

`ink plugin run` 直接对一个文件运行插件的一条命令，不用装、不用启用，也不用重启 Ink：

```sh
ink plugin run ./hello insert-date 笔记.md
```

- 插件改了文字：输出改后的全文。
- 插件要存文件或写剪贴板：把内容输出到 stdout，或用 `-o 文件` 写进文件。
- `new ink.Notice(...)` 的提示、插件的报错，写到 stderr。
- 命令名写错了，会列出这个插件有哪些命令。

写插件时可以这样循环：改 `main.js`，跑一次 `ink plugin run`，看输出。

## 要知道的几件事

- **没有 DOM，也没有 Node。** 不能 `require`，也不能 `import` 别的文件。需要第三方库时，用 esbuild 之类的工具打包成单个 `main.js`。
- **插件看到的是快照。** 命令开始时，Ink 把当前文档交给插件；插件的修改在命令结束后一次写回，算一步撤销。如果运行期间用户又改了文档，插件的修改整批放弃，并在状态栏提示。
- **有时间和内存上限。** 一次调用最多 2 秒，每个插件最多 64 MB 内存。超了就停止这次调用；连续出错 3 次，插件被停用，直到 Ink 重启。
- **默认什么权限都没有。** 能读写当前文档，能弹保存面板让用户存文件。写剪贴板等权限要在 manifest 里声明，见 [API.md](API.md#权限)。
- **快捷键抢不走。** 插件声明的快捷键如果已经被内置命令或用户占了，这个快捷键就不生效，命令仍然能从命令面板运行。

## 变更

| 版本 | 变化 |
|---|---|
| M0（0.1.18 之后的下一版） | 第一版：`addCommand`、编辑器读写、`Notice`、`loadData` / `saveData`、`ink.markdown.toHtml`、`ink.saveAs`、`ink.clipboard.writeHtml` |

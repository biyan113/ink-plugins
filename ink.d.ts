// Ink 插件 API 的类型声明（M0）。放进插件项目，在 jsconfig.json / tsconfig.json
// 里引用，或在 main.js 顶部写 /// <reference path="./ink.d.ts" />。
// 说明见 API.md。

declare namespace ink {
  /** 文档里的位置。行号从 0 开始；ch 按 UTF-16 码元计数。 */
  interface EditorPosition {
    line: number;
    ch: number;
  }

  /** 当前文档。一次回调里的修改在回调结束后作为一步撤销写回。 */
  interface Editor {
    /** 全文（Markdown 源码）。 */
    getValue(): string;
    /** 选中的文字；没有选中时是 ""。 */
    getSelection(): string;
    somethingSelected(): boolean;
    /** 默认 "head"：光标所在端。"from" / "to" 是靠前 / 靠后的一端。 */
    getCursor(which?: "head" | "anchor" | "from" | "to"): EditorPosition;
    lineCount(): number;
    /** 第 n 行，不带换行符；超出范围是 ""。 */
    getLine(n: number): string;
    /** 替换选中的文字（没有选中时在光标处插入），光标移到新文字之后。 */
    replaceSelection(text: string): void;
    /** 把 from 到 to 换成 text；省略 to 时在 from 插入。 */
    replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void;
    setSelection(anchor: EditorPosition, head?: EditorPosition): void;
    setCursor(pos: EditorPosition): void;
  }

  interface View {
    readonly editor: Editor;
    /** 新建、还没保存的文档是 null。 */
    readonly file: { readonly basename: string } | null;
  }

  interface Command {
    /** 本插件内唯一。 */
    id: string;
    /** 动宾短语，不加插件名。 */
    name: string;
    /** "⌥⌘D" 或 "alt-cmd-d"。被内置命令或用户占用时不生效。 */
    hotkey?: string;
    /** 需要当前文档时用这个。 */
    editorCallback?: (editor: Editor, view: View) => unknown | Promise<unknown>;
    /** 不需要文档时用这个。两个回调必须有一个。 */
    callback?: () => unknown | Promise<unknown>;
  }

  /** 插件的默认导出要继承这个类。 */
  abstract class Plugin {
    /** 加载时调用一次。命令只能在这里添加。 */
    onload(): void | Promise<void>;
    /** M0 还不会调用。 */
    onunload(): void;
    addCommand<C extends Command>(command: C): C;
    /** 读插件文件夹里的 data.json；没有时是 null。 */
    loadData(): Promise<any>;
    /** 写成 JSON，存到 data.json。 */
    saveData(data: unknown): Promise<void>;
  }

  /** 在状态栏显示一行提示；同一次命令里只留最后一条。 */
  class Notice {
    constructor(message: string);
  }

  const markdown: {
    /** 和「导出 HTML」同一套规则，得到 HTML 正文。 */
    toHtml(markdown: string): string;
  };

  const workspace: {
    readonly activeView: View;
  };

  /** 命令结束后弹出保存面板，用户选位置；content 按 UTF-8 写入。 */
  function saveAs(name: string, ext: string, content: string): void;

  const clipboard: {
    /** 以 HTML 格式写剪贴板，text 是纯文本备份。要 "clipboard": true 权限；目前只有 macOS。 */
    writeHtml(html: string, text?: string): void;
  };
}

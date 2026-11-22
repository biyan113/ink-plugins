// 最小的示例插件，复制这个文件夹改起来就行。说明见 https://ink.bytenote.net/plugins/
/// <reference path="../../ink.d.ts" />

export default class Hello extends ink.Plugin {
  async onload() {
    // 插件自己的设置，存在插件文件夹的 data.json 里。
    this.settings = Object.assign({ format: "iso" }, await this.loadData());

    this.addCommand({
      id: "insert-date",
      name: "插入今天的日期",
      hotkey: "⌃⌥⌘D",
      editorCallback: (editor) => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const text = this.settings.format === "cn" ? `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        editor.replaceSelection(text);
      },
    });

    this.addCommand({
      id: "book-title",
      name: "给选中的文字加书名号",
      editorCallback: (editor) => {
        if (!editor.somethingSelected()) {
          new ink.Notice("先选中书名");
          return;
        }
        editor.replaceSelection(`《${editor.getSelection()}》`);
      },
    });
  }
}

// 公众号导出：Ink 把 Markdown 转成 HTML（ink.markdown.toHtml，和「导出 HTML」同一套），
// 这里逐个标签补上内联样式，再做公众号编辑器需要的几处改写。只在本机处理，不调用微信接口。
//
// 主题色可以在插件文件夹的 data.json 里改：{ "color": "#0F4C81" }

const DEFAULTS = { color: "#0F4C81" };

// 写进 style="…" 里，字体名只能用单引号。
const FONT = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
const MONO = "Menlo, Monaco, Consolas, 'Courier New', monospace";

// 每种标签的样式；`in` 里的是它在某个父标签里时多加的。
function styles(c) {
  return {
    h1: "margin: 1.2em 0 1em; font-size: 22px; font-weight: bold; line-height: 1.4; text-align: center; color: #222;",
    h2: `display: table; margin: 2em 0 1em; padding: 0 0.2em 0.25em; font-size: 19px; font-weight: bold; line-height: 1.4; color: #222; border-bottom: 2px solid ${c};`,
    h3: `margin: 1.6em 0 0.8em; padding-left: 8px; font-size: 17px; font-weight: bold; line-height: 1.4; color: #222; border-left: 3px solid ${c};`,
    h4: `margin: 1.4em 0 0.6em; font-size: 16px; font-weight: bold; color: ${c};`,
    h5: "margin: 1.2em 0 0.6em; font-size: 16px; font-weight: bold; color: #555;",
    h6: "margin: 1.2em 0 0.6em; font-size: 15px; font-weight: bold; color: #777;",
    p: "margin: 1em 0; line-height: 1.75; letter-spacing: 0.05em;",
    blockquote: `margin: 1.2em 0; padding: 0.6em 1em; color: #666; background: #f7f7f7; border-left: 3px solid ${c}; border-radius: 4px;`,
    ul: "margin: 1em 0; padding-left: 1.4em; list-style-type: disc;",
    ol: "margin: 1em 0; padding-left: 1.4em; list-style-type: decimal;",
    li: "margin: 0.3em 0; line-height: 1.75;",
    code: `margin: 0 2px; padding: 2px 4px; font-size: 90%; font-family: ${MONO}; color: ${c}; background: rgba(27, 31, 35, 0.05); border-radius: 3px;`,
    pre: "margin: 1.2em 0; padding: 1em; font-size: 13px; line-height: 1.6; color: #333; background: #f6f8fa; border-radius: 6px; overflow-x: auto; white-space: nowrap;",
    a: `color: ${c}; text-decoration: none; border-bottom: 1px solid ${c};`,
    strong: `font-weight: bold; color: ${c};`,
    em: "font-style: italic;",
    del: "color: #999;",
    mark: "padding: 0 2px; background: #fff3a3; color: inherit;",
    hr: "margin: 2em 0; border: 0; border-top: 1px solid #e5e5e5;",
    img: "display: block; max-width: 100%; height: auto; margin: 1em auto; border-radius: 4px;",
    table: "width: 100%; margin: 1em 0; border-collapse: collapse; font-size: 14px;",
    th: "padding: 6px 10px; border: 1px solid #dfdfdf; background: #f6f6f6; font-weight: bold;",
    td: "padding: 6px 10px; border: 1px solid #dfdfdf;",
    sup: `font-size: 12px; color: ${c};`,
    note: {
      box: "display: flex; gap: 6px; margin: 0.4em 0; font-size: 13px; line-height: 1.6; color: #888;",
      label: `flex: none; font-size: 13px; color: ${c};`,
      p: "margin: 0;",
    },
    in: {
      "pre code": `display: block; margin: 0; padding: 0; font-size: 13px; font-family: ${MONO}; color: #333; background: none; white-space: nowrap;`,
      "blockquote p": "margin: 0.4em 0;",
      "li p": "margin: 0;",
    },
  };
}

const VOID = new Set(["img", "br", "hr", "input", "meta", "link", "col", "source", "wbr", "area"]);
const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|[^<]+|</g;
const ATTR = /([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function attrs(s) {
  const out = [];
  for (const m of s.matchAll(ATTR)) out.push([m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? ""]);
  return out;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const wechatLink = (href) => /^https?:\/\/mp\.weixin\.qq\.com\//i.test(href);

// 代码里的空格和换行在公众号里会被压掉，换成 &nbsp; 和 <br>。
const codeText = (t) => t.replace(/\t/g, "    ").replace(/ /g, "&nbsp;").replace(/\r?\n/g, "<br/>");

/** HTML → 公众号正文。返回 { html, text, issues }。 */
function typeset(html, color) {
  const S = styles(color);
  const stack = []; // 打开的标签
  const classes = new Map(); // 栈里每一层原来的 class
  const links = []; // 外链，放到文末
  const issues = new Map();
  const issue = (k, msg) => issues.set(k, { msg, n: (issues.get(k)?.n ?? 0) + 1 });
  let out = "";
  let skipA = 0; // 外链 <a> 换成了文字，跳过它的 </a>
  let foreign = 0; // 在 <svg> / <math> 里：原样保留
  let pendingLink = null;

  for (const m of html.matchAll(TOKEN)) {
    const [whole, close, rawName, rawAttrs = "", selfClose] = m;
    if (!rawName) {
      if (whole.startsWith("<!--")) continue; // 分栏注释等
      const inCode = stack.includes("pre");
      out += foreign ? whole : inCode ? codeText(whole) : whole;
      continue;
    }
    const name = rawName.toLowerCase();
    if (foreign) {
      out += whole;
      if (name === "svg" || name === "math") foreign += close ? -1 : selfClose ? 0 : 1;
      continue;
    }
    if (close) {
      const i = stack.lastIndexOf(name);
      if (i >= 0) stack.length = i;
      if (name === "a" && skipA) {
        skipA--;
        if (pendingLink) {
          out += `<sup style="${S.sup}">[${pendingLink}]</sup>`;
          pendingLink = null;
        }
        continue;
      }
      out += `</${name === "div" ? "section" : name}>${name === "table" ? "</section>" : ""}`;
      continue;
    }
    if (name === "svg" || name === "math") {
      issue(name, name === "svg" ? "图表是 SVG，粘贴后请在公众号编辑器里确认效果，不行就截图换成图片" : "公式在公众号里可能显示不出来，建议截图换成图片");
      if (!selfClose) foreign = 1;
      // 图表按正文宽度缩放（它带 viewBox）
      out += name === "svg" ? whole.replace(/^<svg/i, '<svg style="display: block; max-width: 100%; height: auto; margin: 1em auto;"') : whole;
      continue;
    }
    const a = attrs(rawAttrs);
    const get = (k) => a.find(([n]) => n === k)?.[1];
    // 任务列表的勾选框：公众号会删掉 <input>
    if (name === "input") {
      if (get("type") === "checkbox") out += get("checked") !== undefined ? "☑ " : "☐ ";
      continue;
    }
    if (name === "a") {
      const href = get("href") ?? "";
      if (href.startsWith("#")) {
        // 脚注引用：链接在公众号里点不了，只留编号
        skipA++;
        continue;
      }
      if (!wechatLink(href)) {
        // 公众号正文不能放外链：文字留下，网址编号放到文末
        links.push(href);
        pendingLink = links.length;
        skipA++;
        continue;
      }
    }
    if (name === "img") {
      const src = get("src") ?? "";
      if (!/^https?:\/\//i.test(src)) issue("img-local", "有本地图片，公众号读不到：先运行「上传文档中的本地图片」，或在公众号编辑器里重新插入");
    }
    const ctx = stack[stack.length - 1];
    let style = S[name] ?? "";
    for (const [sel, extra] of Object.entries(S.in)) {
      const [parent, child] = sel.split(" ");
      if (child === name && stack.includes(parent)) style = extra;
    }
    if (name === "p" && ctx === "li") style = S.in["li p"];
    // 脚注：文末一行一条，字小一些
    const cls = get("class") ?? "";
    if (cls.includes("footnote-definition-label")) style = S.note.label;
    else if (cls.includes("footnote-definition")) style = S.note.box;
    if (name === "p" && ctx === "div" && stack.length && /footnote/.test(classes.get(stack.length - 1) ?? "")) style = S.note.p;
    // 保留原有的 style（表格对齐、公式居中），追加在后面
    const own = get("style");
    if (own) style = `${style} ${own}`;
    const keep = a.filter(([n]) => !["class", "id", "style", "data-src"].includes(n) && !n.startsWith("on") && !n.startsWith("data-"));
    const tag = name === "div" ? "section" : name;
    const rest = keep.map(([n, v]) => ` ${n}="${esc(decode(v))}"`).join("");
    // 宽表格可以横向滑动
    if (name === "table") out += `<section style="overflow-x: auto;">`;
    out += `<${tag}${style ? ` style="${style.trim()}"` : ""}${rest}${VOID.has(name) ? "/" : ""}>`;
    if (!VOID.has(name) && !selfClose) {
      stack.push(name);
      classes.set(stack.length - 1, cls);
    }
  }
  if (links.length) {
    out += `<h4 style="${S.h4}">引用链接</h4><section style="font-size: 13px; line-height: 1.6; color: #888; word-break: break-all;">`;
    links.forEach((href, i) => (out += `<p style="margin: 0.3em 0;">[${i + 1}] ${esc(decode(href))}</p>`));
    out += "</section>";
  }
  out = out.replace(/(?:<br\/>)+(<\/code>)/g, "$1"); // 代码块最后的换行
  const root = `font-size: 16px; color: #3f3f3f; line-height: 1.75; letter-spacing: 0.05em; text-align: left; word-wrap: break-word; font-family: ${FONT};`;
  const body = `<section style="${root}">${out}</section>`;
  return { html: body, text: plain(out), issues: [...issues.values()] };
}

/** 纯文本备份：块之间换行，代码保留行。 */
function plain(html) {
  return decode(
    html
      .replace(/<svg[\s\S]*?<\/svg>/gi, "[图表]")
      .replace(/<math[\s\S]*?<\/math>/gi, "[公式]")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h[1-6]|li|pre|tr|blockquote|section)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function title(md, file) {
  const h1 = md.match(/^#\s+(.+?)\s*#*\s*$/m);
  return h1 ? h1[1] : file?.basename ?? "公众号文章";
}

function summary(issues) {
  if (!issues.length) return "";
  return `。${issues.length} 处要注意：` + issues.map((i) => (i.n > 1 ? `${i.msg}（${i.n} 处）` : i.msg)).join("；");
}

function preview(name, out) {
  const note = out.issues.length ? out.issues.map((i) => `<li>${esc(i.msg)}</li>`).join("") : "<li>样式已全部内联，可以直接粘贴。</li>";
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} · 公众号预览</title>
<style>
body{margin:0;background:#eef0f2;font-family:system-ui,sans-serif;color:#202124}
header{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 20px;background:#fff;border-bottom:1px solid #ddd}
header span{font-size:13px;line-height:1.6}
button{padding:9px 16px;border:0;border-radius:7px;background:#07c160;color:#fff;font-size:14px;cursor:pointer}
main{max-width:677px;margin:24px auto;padding:0 12px}
ul{margin:0 0 12px;padding-left:1.2em;font-size:13px;color:#555}
#article{padding:20px;background:#fff}
</style></head>
<body><header><span>公众号预览 · 由 Ink 导出<br>点右边的按钮复制正文，再粘贴到公众号编辑器</span><button id="copy" type="button">复制正文</button></header>
<main><ul id="status">${note}</ul><article id="article">${out.html}</article></main>
<script>
document.getElementById("copy").addEventListener("click", async () => {
  const body = document.getElementById("article"), status = document.getElementById("status");
  let ok = false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([body.innerHTML], { type: "text/html" }), "text/plain": new Blob([body.innerText], { type: "text/plain" }) })]);
    ok = true;
  } catch (_) {
    const r = document.createRange(), s = getSelection();
    r.selectNodeContents(body); s.removeAllRanges(); s.addRange(r);
    ok = document.execCommand("copy"); s.removeAllRanges();
  }
  status.innerHTML = ok ? "<li>已复制，去公众号编辑器粘贴吧。</li>" : "<li>没能自动复制：请选中下面的正文，手动复制。</li>";
});
</script></body></html>`;
}

export default class WechatExport extends ink.Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addCommand({
      id: "copy",
      name: "复制为公众号文章",
      hotkey: "⌥⇧⌘C",
      editorCallback: (ed) => {
        const out = typeset(ink.markdown.toHtml(ed.getValue()), this.settings.color);
        ink.clipboard.writeHtml(out.html, out.text);
        new ink.Notice(`已复制为公众号文章，到公众号编辑器里粘贴即可${summary(out.issues)}`);
      },
    });
    this.addCommand({
      id: "export",
      name: "导出公众号预览网页…",
      editorCallback: (ed, view) => {
        const md = ed.getValue();
        const out = typeset(ink.markdown.toHtml(md), this.settings.color);
        const name = title(md, view.file);
        ink.saveAs(name, "html", preview(name, out));
        if (out.issues.length) new ink.Notice(`预览网页里列出了要注意的地方${summary(out.issues)}`);
      },
    });
  }
}

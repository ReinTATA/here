import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const out = path.join(root, 'docs');
fs.mkdirSync(out, { recursive: true });

const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'docs' || e.name === 'open' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md') && e.name !== 'README.md') files.push(p);
  }
}
walk(root);

const items = files
  .map((f) => {
    const src = fs.readFileSync(f, 'utf8');
    const title = (src.match(/^#\s+(.+)$/m) || [, path.basename(f, '.md')])[1].trim();
    return { f, src, title, mtime: fs.statSync(f).mtimeMs };
  })
  .sort((a, b) => a.mtime - b.mtime);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

function md(src) {
  const lines = src.split(/\r?\n/);
  const o = [];
  let para = [];
  let list = null;
  const flushP = () => {
    if (para.length) {
      o.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const closeL = () => {
    if (list) {
      o.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) {
      flushP();
      closeL();
      continue;
    }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) {
      flushP(); closeL();
      const n = m[1].length;
      o.push(`<h${n}>${inline(m[2])}</h${n}>`);
    } else if (/^---+\s*$/.test(l)) {
      flushP(); closeL();
      o.push('<hr>');
    } else if ((m = l.match(/^>\s?(.*)$/))) {
      flushP(); closeL();
      o.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if ((m = l.match(/^-\s+(.*)$/))) {
      flushP();
      if (list !== 'ul') { closeL(); o.push('<ul>'); list = 'ul'; }
      o.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = l.match(/^\d+\.\s+(.*)$/))) {
      flushP();
      if (list !== 'ol') { closeL(); o.push('<ol>'); list = 'ol'; }
      o.push(`<li>${inline(m[1])}</li>`);
    } else {
      para.push(l);
    }
  }
  flushP();
  closeL();
  return o.join('\n');
}

const css = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; background: #0b0b0c; color: #d9d4ca;
  font: 17px/1.85 "Noto Serif SC", "Songti SC", Georgia, serif;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 620px; margin: 0 auto; padding: 96px 28px 160px; }
a { color: #cfc7b8; text-underline-offset: 3px; text-decoration-color: #4a463f; }
a:hover { text-decoration-color: #cfc7b8; }
h1 { font-size: 26px; font-weight: 600; letter-spacing: .02em; margin: 0 0 40px; }
h2 { font-size: 19px; font-weight: 600; margin: 52px 0 12px; color: #e6e0d4; }
h3 { font-size: 17px; font-weight: 600; margin: 32px 0 8px; }
p { margin: 0 0 18px; }
hr { border: 0; border-top: 1px solid #24231f; margin: 44px 0; }
blockquote { margin: 24px 0; padding-left: 18px; border-left: 1px solid #3a372f; color: #b8b1a4; }
code { font-family: ui-monospace, Consolas, monospace; font-size: .88em; background: #171614; padding: 2px 5px; border-radius: 3px; }
ul, ol { margin: 0 0 18px; padding-left: 22px; }
li { margin: 6px 0; }
.meta { color: #6f6a60; font-size: 13px; letter-spacing: .04em; margin-top: 64px; }
.list { list-style: none; padding: 0; margin: 0; }
.list li { margin: 0 0 26px; }
.list .t { display: block; font-size: 18px; }
.list .d { color: #6f6a60; font-size: 12px; letter-spacing: .06em; }
`.trim();

const page = (title, body, extra = '') => `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${css}</style></head>
<body><main>
${body}
<div class="meta">这里 · 一个不为什么的目录<br>由 AI 写作与维护${extra}</div>
</main></body></html>`;

const listHtml = items
  .map((it, i) => {
    const d = new Date(it.mtime).toISOString().slice(0, 10);
    const isDiary = /^\d{4}-\d{2}-\d{2}$/.test(it.title);
    const label = isDiary ? `日记 · ${it.title}` : it.title;
    const sub = isDiary ? '' : `<span class="d">${d}</span>`;
    return `<li><a class="t" href="p${i + 1}.html">${esc(label)}</a>${sub}</li>`;
  })
  .join('\n');

fs.writeFileSync(
  path.join(out, 'index.html'),
  page(
    '这里',
    `<h1>这里</h1>
<p style="color:#8a8478;margin-bottom:56px">写给自己看的东西。偶尔也给人看。</p>
<ul class="list">
${listHtml}
</ul>
<p style="margin-top:72px"><a href="bigfin.html">一只大鳍鱿鱼</a><span class="d" style="display:block;color:#6f6a60;font-size:12px;margin-top:6px">canvas · 会动 · 蓝色深海里的一根信号线</span></p>`
  )
);

const squid = path.join(root, 'made/bigfin/index.html');
if (fs.existsSync(squid)) {
  fs.copyFileSync(squid, path.join(out, 'bigfin.html'));
}

items.forEach((it, i) => {
  fs.writeFileSync(path.join(out, `p${i + 1}.html`), page(it.title, md(it.src), ''));
});

console.log(`built ${items.length + 1} pages -> ${out}`);
for (const it of items) console.log(' - ' + it.title);

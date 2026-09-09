# -*- coding: utf-8 -*-
"""
「Myみっちー」機能を index.html / style.css / app.js に追加する。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_mymitchie.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_mymitchie.py apply     -> ルートに直接出力（本番へ昇格）

検証に1つでも失敗した場合は、ファイルを一切書き込まずに異常終了する。
"""
import os
import sys
import shutil

MODE = sys.argv[1] if len(sys.argv) > 1 else ""
if MODE not in ("preview", "apply"):
    print("::error::実行モードは preview か apply のどちらかを指定してください。")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["index.html", "style.css", "app.js"]
ROOT_ASSETS = [
    "manifest.json", "images.js",
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]

HTML_ANCHOR = '  <div id="historyArea"></div>'
JS_ANCHOR = "  window.scrollTo(0, 0);\n\n})();"

for f in FILES:
    if not os.path.exists(f):
        print(f"::error::{f} が見つかりません。")
        sys.exit(1)

for fname in ("mymitchie_html.txt", "mymitchie_css.txt", "mymitchie_js.txt"):
    if not os.path.exists(os.path.join(HERE, fname)):
        print(f"::error::scripts/{fname} が見つかりません。")
        sys.exit(1)

mm_html = open(os.path.join(HERE, "mymitchie_html.txt"), encoding="utf-8").read().rstrip("\n")
mm_css = open(os.path.join(HERE, "mymitchie_css.txt"), encoding="utf-8").read()
mm_js = open(os.path.join(HERE, "mymitchie_js.txt"), encoding="utf-8").read()

html = open("index.html", encoding="utf-8").read()
css = open("style.css", encoding="utf-8").read()
js = open("app.js", encoding="utf-8").read()

# --- 二重適用ガード ---
if "mmToggleBtn" in html:
    print("::error::index.html に既にMyみっちーが追加されています（二重適用防止のため中止）。")
    sys.exit(1)
if "mm-toggle" in css:
    print("::error::style.css に既にMyみっちーのCSSが追加されています（中止）。")
    sys.exit(1)
if "MM_KEY" in js:
    print("::error::app.js に既にMyみっちーのJSが追加されています（中止）。")
    sys.exit(1)

# --- アンカー確認 ---
if HTML_ANCHOR not in html:
    print("::error::index.html 内に差し込み位置(historyArea)が見つかりません。")
    sys.exit(1)
if JS_ANCHOR not in js:
    print("::error::app.js 内に差し込み位置(末尾のIIFE)が見つかりません。")
    sys.exit(1)

# --- 差し込み ---
new_html = html.replace(HTML_ANCHOR, mm_html + "\n" + HTML_ANCHOR, 1)
new_css = css + mm_css
new_js = js.replace(JS_ANCHOR, "  window.scrollTo(0, 0);\n" + mm_js + "\n})();", 1)

# --- 検証 ---
checks = [
    ("HTMLにmmToggleBtnが入っている", "id=\"mmToggleBtn\"" in new_html),
    ("HTMLのdiv開閉バランスが取れている", new_html.count("<div") == new_html.count("</div>")),
    ("CSSにmm-toggleが入っている", ".mm-toggle{" in new_css),
    ("JSにMM_KEYが入っている", "MM_KEY" in new_js),
    ("JSの中括弧の数が一致している", new_js.count("{") == new_js.count("}")),
    ("JSのIIFE終端が想定どおり2箇所になっている", new_js.count("})();") == 2),
]
ok = True
for name, res in checks:
    print(("  OK   " if res else "  NG   ") + name)
    if not res:
        ok = False
if not ok:
    print("::error::検証に失敗したため、ファイルは一切書き込みませんでした。")
    sys.exit(1)

# --- 書き込み ---
if MODE == "preview":
    outdir = "preview"
    if os.path.isdir(outdir):
        shutil.rmtree(outdir)
    os.makedirs(outdir)
    for name in ROOT_ASSETS:
        if os.path.exists(name):
            shutil.copy(name, os.path.join(outdir, name))
        else:
            print(f"::warning::{name} が見つからずpreviewにコピーしませんでした。")
else:
    outdir = "."

for name, text in (("index.html", new_html), ("style.css", new_css), ("app.js", new_js)):
    with open(os.path.join(outdir, name), "w", encoding="utf-8") as f:
        f.write(text)
    print("書き込み: " + os.path.join(outdir, name))

print("")
print("完了（モード: " + MODE + "）")
if MODE == "preview":
    print("確認先: https://ray-ray870.github.io/mitchie-fiscal/preview/")

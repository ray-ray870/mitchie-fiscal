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
METER0_OLD = (
    "\"<h2 class='sr-only'>\u5065\u5eb7\u5ea6\u30b9\u30b3\u30a2</h2>\" + noteHtml(d, h, d.p === nm) + \"<div class='meter' id='m0' role='button' tabindex='0' style='border:3px solid \"+pr.c+\";background:\"+pr.c+\"10;'><div class='mt'><span>\u7dcf\u5408\u8ca1\u653f\u5065\u5168\u5ea6\u30b9\u30b3\u30a2\uff08\u53c2\u8003\u5024\uff09</span></div>\" +\n"
    "        \"<div class='mb'><div id='hbar' class='mf' style='width:0%;background:\"+pr.c+\";'></div></div>\" +\n"
    "        \"<div class='mv'><span style='color:\"+pr.c+\";font-weight:700;'>\"+h+\" / 100</span><span class='mt-tap'>\u30bf\u30c3\u30d7\u3067\u30b9\u30b3\u30a2\u306e\u4f3c\u305f\u81ea\u6cbb\u4f53\u3068\u8a73\u7d30\u3092\u898b\u308b\u25b6</span></div>\" +\n"
    "      \"</div>\" +\n"
)
METER0_NEW = (
    "\"<h2 class='sr-only'>\u5065\u5eb7\u5ea6\u30b9\u30b3\u30a2</h2>\" + noteHtml(d, h, d.p === nm) + \"<div class='meter' id='m0' role='button' tabindex='0' style='border:3px solid \"+pr.c+\";background:\"+pr.c+\"10;'><div class='mt'><span>\u8ca1\u653f\u5065\u5168\u5ea6\u30b9\u30b3\u30a2</span><span style='color:\"+pr.c+\";font-weight:700;'>\"+h+\"\u70b9</span></div>\" +\n"
    "        mmScoreBoxRanks(nm, d) +\n"
    "        \"<div class='mt-tap' style='text-align:center;margin-top:6px;'>\u30bf\u30c3\u30d7\u3067<span style='color:\"+pr.c+\";font-weight:700;'>\"+nm+\"</span>\u3068\u4f3c\u305f\u81ea\u6cbb\u4f53\u3068\u8a73\u7d30\u3092\u898b\u308b\u25b6</div>\" +\n"
    "      \"</div>\" +\n"
)
HBAR_OLD = "document.getElementById(\"hbar\").style.width = h+\"%\";\n      "
HBAR_NEW = ""
CORNER_HTML_OLD = "\"<div class='compare-corner-wrap' id='compareBtnWrap'></div>\" +"
CORNER_HTML_NEW = "\"<div class='corner-row'><div class='compare-corner-wrap' id='compareBtnWrap'></div><div id='mmCompareBtnWrap'></div></div>\" +"
RENDERBTN_OLD = "renderCompareButton(nm);\n    updateCompareBar();"
RENDERBTN_NEW = "renderCompareButton(nm);\n    mmRenderCompareBtn(nm);\n    updateCompareBar();"
COMPAREMAX_OLD = "var COMPARE_MAX = 5;"
COMPAREMAX_NEW = "var COMPARE_MAX = 6;"
CORNERWRAP_CSS_OLD = ".compare-corner-wrap{position:absolute;top:14px;right:14px;display:flex;flex-direction:column;align-items:flex-end;gap:3px;z-index:2;}"
CORNERWRAP_CSS_NEW = ".compare-corner-wrap{display:flex;flex-direction:column;align-items:flex-end;gap:3px;}"
CNAME_OLD = "\"<div class='cname'>\"+nm+\"</div>\" +"
CNAME_NEW = "\"<div class='cname'>\"+(mmIsMine(nm)?\"\\ud83d\\udc27 \":\"\")+nm+\"</div>\" +"

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
if "mmScoreBoxRanks" in js:
    print("::error::app.js に既にスコア枠の順位表示が追加されています（中止）。")
    sys.exit(1)

# --- アンカー確認 ---
if HTML_ANCHOR not in html:
    print("::error::index.html 内に差し込み位置(historyArea)が見つかりません。")
    sys.exit(1)
if JS_ANCHOR not in js:
    print("::error::app.js 内に差し込み位置(末尾のIIFE)が見つかりません。")
    sys.exit(1)
if METER0_OLD not in js:
    print("::error::app.js 内にスコア枠(m0)の差し込み位置が見つかりません。")
    sys.exit(1)
if js.count(METER0_OLD) != 1:
    print("::error::スコア枠(m0)の差し込み位置が複数見つかりました（想定外のため中止）。")
    sys.exit(1)
if HBAR_OLD not in js:
    print("::error::app.js 内にhbarアニメーション行が見つかりません。")
    sys.exit(1)
if CORNER_HTML_OLD not in js:
    print("::error::app.js 内に比較ボタン枠の差し込み位置が見つかりません。")
    sys.exit(1)
if RENDERBTN_OLD not in js:
    print("::error::app.js 内にrenderCompareButton呼び出し位置が見つかりません。")
    sys.exit(1)
if COMPAREMAX_OLD not in js:
    print("::error::app.js 内にCOMPARE_MAXが見つかりません。")
    sys.exit(1)
if CORNERWRAP_CSS_OLD not in css:
    print("::error::style.css 内にcompare-corner-wrapが見つかりません。")
    sys.exit(1)
if CNAME_OLD not in js:
    print("::error::app.js 内にcname表示位置が見つかりません。")
    sys.exit(1)

# --- 差し込み ---
new_html = html.replace(HTML_ANCHOR, mm_html + "\n" + HTML_ANCHOR, 1)
new_css = css.replace(CORNERWRAP_CSS_OLD, CORNERWRAP_CSS_NEW, 1) + mm_css
js2 = js.replace(METER0_OLD, METER0_NEW, 1)
js2 = js2.replace(HBAR_OLD, HBAR_NEW, 1)
js2 = js2.replace(CORNER_HTML_OLD, CORNER_HTML_NEW, 1)
js2 = js2.replace(RENDERBTN_OLD, RENDERBTN_NEW, 1)
js2 = js2.replace(COMPAREMAX_OLD, COMPAREMAX_NEW, 1)
js2 = js2.replace(CNAME_OLD, CNAME_NEW, 1)
new_js = js2.replace(JS_ANCHOR, "  window.scrollTo(0, 0);\n" + mm_js + "\n})();", 1)

# --- 検証 ---
checks = [
    ("HTMLにmmToggleBtnが入っている", "id=\"mmToggleBtn\"" in new_html),
    ("HTMLのdiv開閉バランスが取れている", new_html.count("<div") == new_html.count("</div>")),
    ("CSSにmm-toggleが入っている", ".mm-toggle{" in new_css),
    ("JSにMM_KEYが入っている", "MM_KEY" in new_js),
    ("JSにmmScoreBoxRanksが入っている", "mmScoreBoxRanks" in new_js),
    ("JSからhbar行が削除されている", "getElementById(\"hbar\")" not in new_js),
    ("JSにmmRenderCompareBtnが入っている", "mmRenderCompareBtn" in new_js),
    ("JSでCOMPARE_MAXが6になっている", "var COMPARE_MAX = 6;" in new_js),
    ("JSにmmIsMineが入っている", "mmIsMine" in new_js),
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

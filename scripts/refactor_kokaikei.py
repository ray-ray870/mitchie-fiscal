# -*- coding: utf-8 -*-
"""
公会計タブ（財政／公会計の切り替え、9指標BOX）を index.html を触らずに
app.js / style.css へ直接注入する。Myみっちー機能とは完全に独立している。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_kokaikei.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_kokaikei.py apply     -> ルートに直接出力（本番へ昇格）

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
FILES = ["app.js", "style.css"]
ROOT_ASSETS = [
    "index.html", "manifest.json", "images.js", "kokaikei.json",
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]

TAB_START_OLD = "\"<div class='card'>\" +\n"
TAB_START_NEW = (
    "\"<div class='card'>\" +\n"
    "      \"<div class='fk-tabs'><button id='finTabBtn' class='fk-tab' role='button' tabindex='0'>\u8ca1\u653f</button>"
    "<button id='kkTabBtn' class='fk-tab' role='button' tabindex='0'>\u516c\u4f1a\u8a08</button></div>\" +\n"
    "      \"<div id='finContent'>\" +\n"
)

TAB_END_OLD = (
    "\"<div class='src'>\U0001f4cb \u7dcf\u52d9\u7701\u300c\u5730\u65b9\u8ca1\u653f\u72b6\u6cc1\u8abf\u67fb\u95a2\u4fc2\u8cc7\u6599\u300d\u4ee4\u548c6\u5e74\u5ea6 | "
    "<a href='https://www.soumu.go.jp/iken/jokyo_chousa_shiryo.html' target='_blank'>\u7dcf\u52d9\u7701\u516c\u5f0f</a></div>\" +\n"
    "      \"</div>\";\n"
)
TAB_END_NEW = (
    "\"<div class='src'>\U0001f4cb \u7dcf\u52d9\u7701\u300c\u5730\u65b9\u8ca1\u653f\u72b6\u6cc1\u8abf\u67fb\u95a2\u4fc2\u8cc7\u6599\u300d\u4ee4\u548c6\u5e74\u5ea6 | "
    "<a href='https://www.soumu.go.jp/iken/jokyo_chousa_shiryo.html' target='_blank'>\u7dcf\u52d9\u7701\u516c\u5f0f</a></div>\" +\n"
    "      \"</div>\" +\n"
    "      \"<div class='hidden' id='kkContent'></div>\" +\n"
    "      \"</div>\";\n"
)

TABINIT_OLD = "el.classList.remove(\"hidden\");\n    renderCompareButton(nm);"
TABINIT_NEW = "el.classList.remove(\"hidden\");\n    fkInitTabs(nm, d);\n    renderCompareButton(nm);"

for f in FILES:
    if not os.path.exists(f):
        print(f"::error::{f} が見つかりません。")
        sys.exit(1)

for fname in ("kokaikei_css.txt", "kokaikei_js.txt"):
    if not os.path.exists(os.path.join(HERE, fname)):
        print(f"::error::scripts/{fname} が見つかりません。")
        sys.exit(1)

if not os.path.exists(os.path.join(os.path.dirname(HERE), "kokaikei.json")):
    print("::error::kokaikei.json がリポジトリのルートに見つかりません。先にアップロードしてください。")
    sys.exit(1)

kk_css = open(os.path.join(HERE, "kokaikei_css.txt"), encoding="utf-8").read()
kk_js = open(os.path.join(HERE, "kokaikei_js.txt"), encoding="utf-8").read()

js = open("app.js", encoding="utf-8").read()
css = open("style.css", encoding="utf-8").read()

# --- 二重適用ガード ---
if "kkTabBtn" in js:
    print("::error::app.js に既に公会計タブが追加されています（二重適用防止のため中止）。")
    sys.exit(1)
if ".fk-tabs" in css:
    print("::error::style.css に既に公会計タブのCSSが追加されています（中止）。")
    sys.exit(1)

# --- アンカー確認 ---
if js.count(TAB_START_OLD) != 1:
    print("::error::app.js 内にタブの差し込み開始位置が一意に見つかりません。")
    sys.exit(1)
if TAB_END_OLD not in js:
    print("::error::app.js 内にタブの差し込み終了位置が見つかりません。")
    sys.exit(1)
if TABINIT_OLD not in js:
    print("::error::app.js 内にfkInitTabsの差し込み位置が見つかりません。")
    sys.exit(1)

# --- 差し込み ---
new_js = js.replace(TAB_START_OLD, TAB_START_NEW, 1)
new_js = new_js.replace(TAB_END_OLD, TAB_END_NEW, 1)
new_js = new_js.replace(TABINIT_OLD, TABINIT_NEW, 1)
new_js = new_js.rstrip() + "\n\n" + kk_js.strip() + "\n"
new_css = css + kk_css

# --- 検証 ---
checks = [
    ("app.jsにkkTabBtnが入っている", "id='kkTabBtn'" in new_js),
    ("app.jsにfkInitTabsの呼び出しが入っている", "fkInitTabs(nm, d);" in new_js),
    ("app.jsにfkInitTabsの定義が入っている", "function fkInitTabs" in new_js),
    ("app.jsにkkRenderが入っている", "function kkRender" in new_js),
    ("app.jsの中括弧の数が一致している", new_js.count("{") == new_js.count("}")),
    ("CSSに.fk-tabsが入っている", ".fk-tabs{" in new_css),
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

for name, text in (("app.js", new_js), ("style.css", new_css)):
    with open(os.path.join(outdir, name), "w", encoding="utf-8") as f:
        f.write(text)
    print("書き込み: " + os.path.join(outdir, name))

print("")
print("完了（モード: " + MODE + "）")
if MODE == "preview":
    print("確認先: https://ray-ray870.github.io/mitchie-fiscal/preview/")

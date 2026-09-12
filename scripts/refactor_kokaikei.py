# -*- coding: utf-8 -*-
"""
公会計タブ（財政／公会計の切り替え、9指標BOX）を app.js / style.css / index.html へ
直接注入する。Myみっちー機能とは完全に独立している。

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
FILES = ["app.js", "style.css", "index.html"]
ROOT_ASSETS = [
    "manifest.json", "images.js", "kokaikei.json",
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]

HTML_OLD = (
    "    <div id=\"shTitle\" class=\"sh-t\"></div>\n"
    "    <div id=\"shDesc\" class=\"sh-d\"></div>\n"
    "    <div class=\"sp-w\">\n"
    "      <svg id=\"spSvg\" viewBox=\"0 0 300 75\" preserveAspectRatio=\"none\" style=\"width:100%;height:75px;overflow:visible;\"></svg>\n"
    "      <div id=\"spLabels\" class=\"sp-l\"></div>\n"
    "    </div>\n"
)
HTML_NEW = (
    "    <div id=\"shTitle\" class=\"sh-t\"></div>\n"
    "    <div id=\"shTop\" class=\"sh-top\"></div>\n"
    "    <div class=\"sp-w\">\n"
    "      <svg id=\"spSvg\" viewBox=\"0 0 300 75\" preserveAspectRatio=\"none\" style=\"width:100%;height:75px;overflow:visible;\"></svg>\n"
    "      <div id=\"spLabels\" class=\"sp-l\"></div>\n"
    "    </div>\n"
    "    <div id=\"shDesc\" class=\"sh-d\"></div>\n"
)

TAB_START_OLD = "el.innerHTML =\n      \"<div class='card'>\" +\n"
TAB_START_NEW = (
    "el.innerHTML =\n"
    "      \"<div class='fk-tabs'><button id='finTabBtn' class='fk-tab' role='button' tabindex='0'>\u8ca1\u653f</button>"
    "<button id='kkTabBtn' class='fk-tab' role='button' tabindex='0'>\u516c\u4f1a\u8a08</button></div>\" +\n"
    "      \"<div class='card' id='finContent' style='border-left:5px solid #6dcfad;'>\" +\n"
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
    "      \"<div class='card hidden' id='kkContent' style='border-left:5px solid #f0c46a;'></div>\";\n"
)

POPSTATE_OLD = (
    "    if (st && st.mitchieView === \"detail\") {\n"
    "      // \u8a73\u7d30\u30e2\u30fc\u30c0\u30eb\u306e\u72b6\u614b\u306b\u623b\u3063\u305f\u5834\u5408\u306f\u3001\u540c\u3058\u8a73\u7d30\u30d1\u30cd\u30eb\u3092\u518d\u5ea6\u958b\u304f\n"
    "      if (st.key) { openD(st.key, true); }\n"
    "      return;\n"
    "    }\n"
)

PRELOAD_OLD = (
    "  Promise.all(dataFiles.map(function(f){ return fetch(f).then(function(r){ return r.json(); }); }))\n"
    "    .then(function(results){\n"
    "      DB = {};\n"
    "      results.forEach(function(data){ Object.assign(DB, data); });"
)
PRELOAD_NEW = (
    "  Promise.all(dataFiles.map(function(f){ return fetch(f).then(function(r){ return r.json(); }); })"
    ".concat([fetch(\"kokaikei.json\").then(function(r){ return r.json(); }).catch(function(){ return {}; })]))\n"
    "    .then(function(results){\n"
    "      KK = results.pop();\n"
    "      DB = {};\n"
    "      results.forEach(function(data){ Object.assign(DB, data); });"
)
POPSTATE_NEW = (
    "    if (st && st.mitchieView === \"detail\") {\n"
    "      // \u8a73\u7d30\u30e2\u30fc\u30c0\u30eb\u306e\u72b6\u614b\u306b\u623b\u3063\u305f\u5834\u5408\u306f\u3001\u540c\u3058\u8a73\u7d30\u30d1\u30cd\u30eb\u3092\u518d\u5ea6\u958b\u304f\n"
    "      if (st.kk) { kkOpenDetail(st.key, true); }\n"
    "      else if (st.key) { openD(st.key, true); }\n"
    "      return;\n"
    "    }\n"
)

TABINIT_OLD = "el.classList.remove(\"hidden\");\n    renderCompareButton(nm);"
TABINIT_NEW = "el.classList.remove(\"hidden\");\n    fkInitTabs(nm, d);\n    renderCompareButton(nm);"

IIFE_END_OLD = "  window.scrollTo(0, 0);\n\n})();"

FISCALSTATUS_OLD = (
    "    if (key === \"fiscalStatus\") {\n"
    "      document.getElementById(\"shTitle\").textContent = m.icon+\" \"+m.label;\n"
    "      document.getElementById(\"shDesc\").innerHTML = m.htmlDesc || chipifyHeaders(m.desc).replace(/\\n/g,\"<br>\");"
)
FISCALSTATUS_NEW = (
    "    if (key === \"fiscalStatus\") {\n"
    "      document.getElementById(\"shTitle\").textContent = m.icon+\" \"+m.label;\n"
    "      document.getElementById(\"shTop\").innerHTML = \"\";\n"
    "      document.getElementById(\"shDesc\").innerHTML = m.htmlDesc || chipifyHeaders(m.desc).replace(/\\n/g,\"<br>\");"
)

DESC_DECL_OLD = 'var descHtml = rankHtml + chipifyHeaders(descSrc).replace(/\\n/g,"<br>");'
DESC_DECL_NEW = 'var topSummaryHtml = "";\n    var descHtml = chipifyHeaders(descSrc).replace(/\\n/g,"<br>");'

DESC_FINAL_OLD = 'document.getElementById("shDesc").innerHTML = descHtml;'
DESC_FINAL_NEW = 'document.getElementById("shTop").innerHTML = rankHtml + topSummaryHtml; document.getElementById("shDesc").innerHTML = ((rankHtml || topSummaryHtml) ? "<div style=\'border-top:1px dashed #d8d5e8;margin:22px 0;\'></div>" : "") + descHtml;'

for fname in ("topsummary_all_old.txt", "topsummary_all_new.txt"):
    if not os.path.exists(os.path.join(HERE, fname)):
        print(f"::error::scripts/{fname} が見つかりません。")
        sys.exit(1)


def parse_blocks(text):
    """###BLOCK:名前### 区切りのファイルを {名前: 中身} の辞書にする。"""
    parts = text.split("###BLOCK:")
    out = {}
    for p in parts[1:]:
        name, _, body = p.partition("###\n")
        out[name] = body.rstrip("\n")
    return out


_all_old = parse_blocks(open(os.path.join(HERE, "topsummary_all_old.txt"), encoding="utf-8").read())
_all_new = parse_blocks(open(os.path.join(HERE, "topsummary_all_new.txt"), encoding="utf-8").read())

_block_names = [
    "reserve", "future", "growth", "health2", "debt",
    "fiscalPower", "flex", "education", "childInvest", "budget",
]
for _n in _block_names:
    if _n not in _all_old or _n not in _all_new:
        print(f"::error::topsummary_all_old.txt / topsummary_all_new.txt に {_n} ブロックが見つかりません。")
        sys.exit(1)

RESERVE_OLD, RESERVE_NEW = _all_old["reserve"], _all_new["reserve"]
FUTURE_OLD, FUTURE_NEW = _all_old["future"], _all_new["future"]
GROWTH_OLD, GROWTH_NEW = _all_old["growth"], _all_new["growth"]
HEALTH2_OLD, HEALTH2_NEW = _all_old["health2"], _all_new["health2"]
DEBT_OLD, DEBT_NEW = _all_old["debt"], _all_new["debt"]
FISCALPOWER_OLD, FISCALPOWER_NEW = _all_old["fiscalPower"], _all_new["fiscalPower"]
FLEX_OLD, FLEX_NEW = _all_old["flex"], _all_new["flex"]
EDUCATION_OLD, EDUCATION_NEW = _all_old["education"], _all_new["education"]
CHILDINVEST_OLD, CHILDINVEST_NEW = _all_old["childInvest"], _all_new["childInvest"]
BUDGET_OLD, BUDGET_NEW = _all_old["budget"], _all_new["budget"]

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
html = open("index.html", encoding="utf-8").read()
css = open("style.css", encoding="utf-8").read()

# --- 二重適用ガード ---
if "kkTabBtn" in js:
    print("::error::app.js に既に公会計タブが追加されています（二重適用防止のため中止）。")
    sys.exit(1)
if ".fk-tabs" in css:
    print("::error::style.css に既に公会計タブのCSSが追加されています（中止）。")
    sys.exit(1)
if "shTop" in html:
    print("::error::index.html に既にshTopが追加されています（二重適用防止のため中止）。")
    sys.exit(1)
if html.count(HTML_OLD) != 1:
    print("::error::index.html 内にモーダルの差し込み位置が一意に見つかりません。")
    sys.exit(1)
if js.count(FISCALSTATUS_OLD) != 1:
    print("::error::app.js 内にfiscalStatusの差し込み位置が一意に見つかりません。")
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
if POPSTATE_OLD not in js:
    print("::error::app.js 内にpopstateのdetail分岐が見つかりません。")
    sys.exit(1)
if js.count(IIFE_END_OLD) != 1:
    print("::error::app.js 内にIIFEの終端位置が一意に見つかりません。")
    sys.exit(1)
if PRELOAD_OLD not in js:
    print("::error::app.js 内にデータ読み込み処理（Promise.all）が見つかりません。")
    sys.exit(1)
if "var KK = null;" not in kk_js:
    print("::error::kokaikei_js.txt 内に var KK = null; の定義が見つかりません。")
    sys.exit(1)
if js.count(RESERVE_OLD) != 1:
    print("::error::app.js 内に財政調整基金の詳細ブロックが一意に見つかりません。")
    sys.exit(1)
if js.count(FUTURE_OLD) != 1:
    print("::error::app.js 内に将来負担比率の詳細ブロックが一意に見つかりません。")
    sys.exit(1)
for _name, _old in (
    ("人口増減率", GROWTH_OLD), ("総合スコア", HEALTH2_OLD), ("実質公債費比率", DEBT_OLD),
    ("財政力指数", FISCALPOWER_OLD), ("経常収支比率", FLEX_OLD), ("教育費", EDUCATION_OLD),
    ("子ども投資額", CHILDINVEST_OLD), ("歳出歳入", BUDGET_OLD),
):
    if js.count(_old) != 1:
        print(f"::error::app.js 内に{_name}の詳細ブロックが一意に見つかりません。")
        sys.exit(1)
if js.count(DESC_DECL_OLD) != 1:
    print("::error::app.js 内にdescHtml宣言位置が一意に見つかりません。")
    sys.exit(1)
if js.count(DESC_FINAL_OLD) != 1:
    print("::error::app.js 内にshDesc最終出力位置が一意に見つかりません。")
    sys.exit(1)

# --- 差し込み ---
new_js = js.replace(TAB_START_OLD, TAB_START_NEW, 1)
new_js = new_js.replace(TAB_END_OLD, TAB_END_NEW, 1)
new_js = new_js.replace(TABINIT_OLD, TABINIT_NEW, 1)
new_js = new_js.replace(POPSTATE_OLD, POPSTATE_NEW, 1)
new_js = new_js.replace(PRELOAD_OLD, PRELOAD_NEW, 1)
new_js = new_js.replace(RESERVE_OLD, RESERVE_NEW, 1)
new_js = new_js.replace(FUTURE_OLD, FUTURE_NEW, 1)
new_js = new_js.replace(GROWTH_OLD, GROWTH_NEW, 1)
new_js = new_js.replace(HEALTH2_OLD, HEALTH2_NEW, 1)
new_js = new_js.replace(DEBT_OLD, DEBT_NEW, 1)
new_js = new_js.replace(FISCALPOWER_OLD, FISCALPOWER_NEW, 1)
new_js = new_js.replace(FLEX_OLD, FLEX_NEW, 1)
new_js = new_js.replace(EDUCATION_OLD, EDUCATION_NEW, 1)
new_js = new_js.replace(CHILDINVEST_OLD, CHILDINVEST_NEW, 1)
new_js = new_js.replace(BUDGET_OLD, BUDGET_NEW, 1)
new_js = new_js.replace(DESC_DECL_OLD, DESC_DECL_NEW, 1)
new_js = new_js.replace(DESC_FINAL_OLD, DESC_FINAL_NEW, 1)
new_js = new_js.replace(FISCALSTATUS_OLD, FISCALSTATUS_NEW, 1)
new_js = new_js.replace(IIFE_END_OLD, "  window.scrollTo(0, 0);\n\n" + kk_js.strip() + "\n\n})();", 1)
new_css = css + kk_css
new_html = html.replace(HTML_OLD, HTML_NEW, 1)

# --- 検証 ---
checks = [
    ("app.jsにkkTabBtnが入っている", "id='kkTabBtn'" in new_js),
    ("app.jsにfkInitTabsの呼び出しが入っている", "fkInitTabs(nm, d);" in new_js),
    ("app.jsにfkInitTabsの定義が入っている", "function fkInitTabs" in new_js),
    ("app.jsにkkRenderが入っている", "function kkRender" in new_js),
    ("app.jsのpopstateにkk分岐が入っている", "if (st.kk) { kkOpenDetail" in new_js),
    ("app.jsの中括弧の数が一致している", new_js.count("{") == new_js.count("}")),
    ("app.jsにtopSummaryHtmlが入っている", "topSummaryHtml" in new_js),
    ("app.jsの財政調整基金に公会計連携が入っている", "貯金（財政調整基金）のほかに" in new_js),
    ("app.jsの将来負担比率に公会計連携が入っている", "公会計でみた将来世代負担比率も" in new_js),
    ("CSSに.fk-tabsが入っている", ".fk-tabs{" in new_css),
    ("index.htmlにshTopが入っている", "id=\"shTop\"" in new_html),
    ("index.htmlのdiv開閉バランスが取れている", new_html.count("<div") == new_html.count("</div>")),
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

for name, text in (("app.js", new_js), ("style.css", new_css), ("index.html", new_html)):
    with open(os.path.join(outdir, name), "w", encoding="utf-8") as f:
        f.write(text)
    print("書き込み: " + os.path.join(outdir, name))

print("")
print("完了（モード: " + MODE + "）")
if MODE == "preview":
    print("確認先: https://ray-ray870.github.io/mitchie-fiscal/preview/")

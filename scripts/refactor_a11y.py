# -*- coding: utf-8 -*-
"""
アクセシビリティ（読み上げソフト対応）を改善する。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_a11y.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_a11y.py apply     -> ルートに直接出力（本番へ昇格）

前提: 先に refactor_split.py を apply 済みであること
      （index.html / style.css / app.js の3ファイル構成）

方針: 見た目は一切変えない。機械が読んだときの伝わり方だけを直す。
"""

import os
import re
import sys
import shutil

FILES = ["index.html", "style.css", "app.js"]

ROOT_ASSETS = [
    "manifest.json", "mitchie_doctor.png", "images.js",
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]

# 画面には出ないが読み上げソフトには読まれる見出し用のCSS
SR_ONLY_CSS = """
/* 読み上げソフト専用（画面には表示されない） */
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
/* キーボード操作時のフォーカス表示 */
[role="button"]:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #6a3de8;outline-offset:2px;}
"""

# キーボードのEnter/スペースでも押せるようにする
KEYBOARD_JS = """

/* --- アクセシビリティ: role="button" をキーボードでも押せるようにする --- */
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
  var el = e.target;
  if (!el || !el.getAttribute || el.getAttribute("role") !== "button") return;
  e.preventDefault();
  el.click();
});
"""


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def sub_once(text, pattern, repl, label, expected):
    """期待した件数だけ置換する。件数が違えば即座に異常終了。"""
    new, n = re.subn(pattern, repl, text)
    if n != expected:
        fail("%s: %d 件のはずが %d 件でした" % (label, expected, n))
    print("  置換 %-28s %d 件" % (label, n))
    return new


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    if mode not in ("preview", "apply"):
        fail("モードは preview か apply を指定してください")

    for f in FILES:
        if not os.path.exists(f):
            fail(f + " が見つかりません。先にファイル分割（refactor_split.py）を実行してください")

    html = open("index.html", encoding="utf-8").read()
    css = open("style.css", encoding="utf-8").read()
    js = open("app.js", encoding="utf-8").read()

    if ".sr-only" in css:
        fail("すでに適用済みのようです（style.css に .sr-only があります）")

    print("■ app.js を修正")

    # --- A. 押せる場所を「ボタン」として認識させる ---
    js = sub_once(js, r"(<div class='stat' id='s\d+')", r"\1 role='button' tabindex='0'",
                  "指標パネル s0-s7", 8)
    js = sub_once(js, r"(<div class='meter' id='m\d+')", r"\1 role='button' tabindex='0'",
                  "メーター m0/m1", 2)
    js = sub_once(js, r"(<div class='\" \+ btnClass \+ \"' id='compareBtn')",
                  r"\1 role='button' tabindex='0'", "比較ボタン", 1)

    # --- B. みっちーの画像に体調を含む説明を付ける ---
    js = sub_once(js, r"alt='みっちー'>", "alt='\" + pr.l + \"'>",
                  "診断結果のみっちー", 1)
    js = sub_once(js,
                  r"(<img src='data:image/png;base64,\"\+IMGS\[pr\.img\]\+\"')( style='width:190px)",
                  r"\1 alt='\"+pr.l+\"'\2", "共有画像のみっちー", 1)
    js = sub_once(js,
                  r"(<img src='data:image/png;base64,\"\+IMGS\[key\]\+\"')",
                  r"\1 alt='\"+HEALTH_LABELS[key][0]+\"'", "比較表のみっちー", 1)

    # --- C. 画面に出ない見出しを入れて、読み上げソフトで飛べるようにする ---
    js = sub_once(js, r"<div class='hero'>",
                  "<h2 class='sr-only'>診断結果</h2><div class='hero'>", "見出し（診断結果）", 1)
    js = sub_once(js, r"<div class='meter' id='m0'",
                  "<h2 class='sr-only'>健康度スコア</h2><div class='meter' id='m0'",
                  "見出し（スコア）", 1)
    js = sub_once(js, r"<div class='grid'>",
                  "<h2 class='sr-only'>財政指標の一覧</h2><div class='grid'>",
                  "見出し（指標一覧）", 1)

    js = js + KEYBOARD_JS

    print("■ index.html を修正")
    html = sub_once(html, r'<div id="suggestBox" class="suggest hidden">',
                    '<div id="suggestBox" class="suggest hidden" role="listbox" '
                    'aria-label="検索候補" aria-live="polite">',
                    "検索候補の読み上げ", 1)
    html = sub_once(html, r'<img id="loadImg" alt="loading">',
                    '<img id="loadImg" alt="読み込み中">', "読み込み画像の説明", 1)

    print("■ style.css を修正")
    css = css + SR_ONLY_CSS
    print("  追加 .sr-only とフォーカス表示")

    # --- 検証 ---
    print("■ 検証")
    checks = [
        ("role=button が11個ある", js.count("role='button'") == 11),
        ("tabindex が11個ある", js.count("tabindex='0'") == 11),
        ("見出しが3つある", js.count("class='sr-only'") == 3),
        ("キーボード対応が入っている", "keydown" in js),
        ("sr-only の CSS がある", ".sr-only{" in css),
        ("診断ロジックが壊れていない", "html2canvas(" in js),
        ("データ読み込みが残っている", ".json" in js),
        ("HTMLにapp.jsの読み込みがある", "app.js?v=" in html),
        ("HTMLにstyle.cssの読み込みがある", "style.css?v=" in html),
        ("GA4タグが残っている", "G-5BGX6KQZFL" in html),
    ]
    ok = True
    for name, res in checks:
        print(("  OK   " if res else "  NG   ") + name)
        if not res:
            ok = False
    if not ok:
        fail("検証に失敗したため、ファイルは一切書き込みませんでした")

    # --- 出力 ---
    if mode == "preview":
        outdir = "preview"
        if os.path.isdir(outdir):
            shutil.rmtree(outdir)
        os.makedirs(outdir)
        for name in ROOT_ASSETS:
            html = html.replace('"' + name + '"', '"../' + name + '"')
            js = js.replace('"' + name + '"', '"../' + name + '"')
    else:
        outdir = "."

    for name, text in (("index.html", html), ("style.css", css), ("app.js", js)):
        with open(os.path.join(outdir, name), "w", encoding="utf-8") as f:
            f.write(text)
        print("書き込み: %s" % os.path.join(outdir, name))

    print("")
    print("完了（モード: %s）" % mode)
    if mode == "preview":
        print("確認先: https://ray-ray870.github.io/mitchie-fiscal/preview/")


if __name__ == "__main__":
    main()

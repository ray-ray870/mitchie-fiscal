# -*- coding: utf-8 -*-
"""
タイトル「みっちー財政カルテ」をタップすると、最初の画面に戻れるようにする。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_hometitle.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_hometitle.py apply     -> ルートに直接出力（本番へ昇格）

仕様:
  ・自治体を開いている状態でタップ → ホーム（みっちーの吹き出しがある画面）に戻る。
    履歴に追加するので、端末の戻るボタンでその自治体に帰れる。
  ・すでにホーム画面のときにタップ → 何も起きない（履歴も増えない）。
  ・開いている詳細パネルや比較モーダルも一緒に閉じる。

  タイトルには role="button" と tabindex="0" を付けるため、
  読み上げソフトでも「ボタン」と認識され、キーボードでも押せる
  （既存の keydown ハンドラが Enter / スペースを拾う）。
"""

import os
import sys
import shutil

FILES = ["index.html", "style.css", "app.js"]

ROOT_ASSETS = [
    "manifest.json", "mitchie_doctor.png", "images.js",
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]

OLD_H1 = "<h1>みっちー財政カルテ</h1>"
NEW_H1 = ('<h1 id="homeTitle" role="button" tabindex="0" '
          'aria-label="みっちー財政カルテ　最初の画面に戻る">みっちー財政カルテ</h1>')

CSS_ADD = """
/* タイトルをタップするとホームに戻れる。
   押したことが分かるよう、グラデーションを濃くして少し縮める。
   h1 は背景グラデーションを文字に切り抜いて色を出しているので、
   色を変えるには background そのものを差し替える必要がある。 */
#homeTitle{cursor:pointer;transition:transform 0.12s ease,filter 0.12s ease;}
#homeTitle:active{
  background:linear-gradient(135deg,#4a1fc0 0%,#8a30b8 50%,#c03080 100%);
  -webkit-background-clip:text;background-clip:text;
  transform:scale(0.96);
  filter:drop-shadow(0 1px 3px rgba(140,60,200,0.35));
}
#homeTitle:focus-visible{outline:3px solid #6a3de8;outline-offset:4px;border-radius:6px;}
"""

# ホームに戻す処理。popstate のホーム処理と同じ動きにする。
GO_HOME_FN = '''  /* --- タイトルからホームに戻る ---
     自治体を開いているときだけ動く。履歴に積むので、
     端末の戻るボタンで元の自治体に帰れる。 */
  function goHome() {
    var re = document.getElementById("resEl");
    if (!re || re.classList.contains("hidden")) return;  // すでにホームなら何もしない

    var ov = document.getElementById("ovEl");
    if (ov && !ov.classList.contains("hidden")) ov.classList.add("hidden");
    var cOv = document.getElementById("compareOv");
    if (cOv && !cOv.classList.contains("hidden")) cOv.classList.add("hidden");
    document.body.style.overflow = "";

    history.pushState({mitchieView: "home"}, "", "#home");

    re.classList.add("hidden");
    var ma = document.getElementById("mitchieArea");
    if (ma) ma.classList.remove("hidden");
    var ci = document.getElementById("cityInput");
    if (ci) ci.value = "";
    hideSuggestions();
    window.scrollTo(0, 0);
  }

'''

# 呼び出しの登録（既存の chip 登録の直前に差し込む）
ANCHOR = ('  document.querySelectorAll(".chip").forEach(function(el){ '
          'el.addEventListener("click", function(){ '
          'document.getElementById("cityInput").value=this.getAttribute("data-city"); '
          'hideSuggestions(); diagnose(); }); });')

BIND = ('  var homeTitleEl = document.getElementById("homeTitle");\n'
        '  if (homeTitleEl) homeTitleEl.addEventListener("click", goHome);\n')


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def rep(text, old, new, label, expected=1):
    n = text.count(old)
    if n != expected:
        fail("%s: %d 件のはずが %d 件でした" % (label, expected, n))
    print("  置換 %-28s %d 件" % (label, n))
    return text.replace(old, new)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    if mode not in ("preview", "apply"):
        fail("モードは preview か apply を指定してください")

    for f in FILES:
        if not os.path.exists(f):
            fail(f + " が見つかりません")

    html = open("index.html", encoding="utf-8").read()
    css = open("style.css", encoding="utf-8").read()
    js = open("app.js", encoding="utf-8").read()

    if "function goHome(" in js:
        fail("すでに適用済みのようです（goHome が存在します）")

    print("■ タイトルを押せるようにする")
    html = rep(html, OLD_H1, NEW_H1, "h1 タグ")

    print("■ 押したときの見た目")
    css = css + CSS_ADD
    print("  #homeTitle のスタイルを追加")

    print("■ ホームに戻す処理を追加")
    anchor_fn = "  function diagnose("
    if js.count(anchor_fn) != 1:
        fail("挿入位置を特定できませんでした")
    js = js.replace(anchor_fn, GO_HOME_FN + anchor_fn, 1)
    print("  goHome を追加")

    print("■ タイトルに処理を結びつける")
    js = rep(js, ANCHOR, BIND + ANCHOR, "クリックの登録")

    print("■ 検証")
    checks = [
        ("h1 に id が付いた", 'id="homeTitle"' in html),
        ("role=button が付いた", 'role="button"' in html
         and html.count('id="homeTitle"') == 1),
        ("CSS が追加された", "#homeTitle{cursor:pointer" in css),
        ("押したときの色変化がある", "#homeTitle:active{" in css),
        ("goHome が定義されている", "function goHome(" in js),
        ("クリックが登録されている", 'homeTitleEl.addEventListener("click", goHome)' in js),
        ("ホームなら何もしない条件がある",
         'if (!re || re.classList.contains("hidden")) return;' in js),
        ("履歴に積んでいる", 'history.pushState({mitchieView: "home"}' in js),
        ("既存の popstate が残っている", 'window.addEventListener("popstate"' in js),
        ("既存の chip 登録が残っている", 'querySelectorAll(".chip")' in js),
        ("診断ロジックが壊れていない", "html2canvas(" in js),
        ("div バランス", html.count("<div") == html.count("</div>")),
    ]
    ok = True
    for name, res in checks:
        print(("  OK   " if res else "  NG   ") + name)
        if not res:
            ok = False
    if not ok:
        fail("検証に失敗したため、ファイルは一切書き込みませんでした")

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

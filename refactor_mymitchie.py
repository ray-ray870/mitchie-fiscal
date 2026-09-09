# -*- coding: utf-8 -*-
"""
「Myみっちー」機能を追加する。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_mymitchie.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_mymitchie.py apply     -> ルートに直接出力（本番へ昇格）

仕様:
  ・検索バーの下に「🐧 Myみっちー」ボタンを置く。毎回閉じた状態で始まる。
  ・開くと、登録した自治体の点数と順位を表示する。
      市区町村を登録した場合 … 全国順位・県内順位・その県じたいの順位（帯つき）
      都道府県を登録した場合 … 全国順位のみ
  ・未登録なら案内と「Myみっちーを登録する」ボタンを出す。
  ・登録ボタンを押すと検索バーに誘導。枠が紫に光り、プレースホルダーが
    「登録したい自治体名を入力」に変わる。1文字入力すると光は止まる。
  ・候補を選ぶと登録完了。診断画面には移らず、Myみっちーが更新される。
  ・保存は localStorage（端末内のみ。サーバーには送らない）。
  ・「アニメーションを減らす」設定の端末では光らせず、枠の色だけ変える。

順位について:
  市区町村と都道府県は計算式が違うため、混ぜずに別々に順位を出す。
  帯は右へ行くほど上位（1位が右端）。
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

# --- HTML：検索バーの直後に差し込む ---
ANCHOR_HTML = '  <div id="historyArea"></div>'

NEW_HTML = '''  <div class="mm-wrap">
    <button class="mm-toggle" id="myMitchieBtn" aria-expanded="false" aria-controls="myMitchieBox">
      <img class="mm-icon" id="mmIcon" alt="" src="">
      <span>My&#12415;&#12387;&#12385;&#12540;</span><span id="mmArrow">&#9660;</span>
    </button>
    <div class="mm-box hidden" id="myMitchieBox">
      <div id="myMitchieBody"></div>
    </div>
  </div>
''' + ANCHOR_HTML

# --- CSS ---
CSS_ADD = """
/* ===== Myみっちー ===== */
.mm-wrap{margin:0 0 10px;text-align:center;}
.mm-toggle{display:inline-flex;align-items:center;justify-content:center;gap:7px;
  background:linear-gradient(135deg,#8b7ae8,#a08be8);color:#fff;border:none;
  border-radius:10px;padding:11px 22px;font-size:15px;
  font-family:inherit;cursor:pointer;transition:filter 0.15s ease;}
.mm-toggle:hover{filter:brightness(1.06);}
.mm-toggle:active{transform:scale(0.99);}
.mm-icon{width:22px;height:22px;object-fit:contain;vertical-align:middle;}
.mm-box{position:relative;text-align:left;background:rgba(255,255,255,0.75);border:1.5px solid rgba(160,139,232,0.22);
  border-radius:12px;padding:14px;margin-top:7px;}
.mm-close{position:absolute;top:9px;right:9px;width:30px;height:30px;
  border:none;border-radius:8px;background:rgba(160,139,232,0.12);color:#6b5b95;
  font-size:16px;font-family:inherit;cursor:pointer;line-height:1;}
.mm-close:hover{background:rgba(160,139,232,0.22);}
.mm-head{padding-right:38px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:9px;}
.mm-name{font-size:18px;font-weight:700;color:#4a3f75;}
.mm-name-s{font-size:16px;}
.mm-score{font-size:24px;font-weight:700;}
.mm-score-s{font-size:20px;}
.mm-badge{font-size:12px;padding:3px 10px;border-radius:11px;font-weight:700;}
.mm-lab{font-size:13px;color:#6b5b95;margin:0 0 4px;}
.mm-lab strong{font-size:16px;color:#4a3f75;}
.mm-bar{position:relative;height:32px;display:flex;align-items:center;margin-bottom:2px;}
.mm-bar-track{width:100%;height:9px;border-radius:5px;
  background:linear-gradient(to right,#f0a890,#f0c46a,#7bb8e8,#6dcfad);}
.mm-bar-pin{position:absolute;width:30px;height:30px;margin-left:-15px;
  object-fit:contain;pointer-events:none;}
.mm-bar-pin-fb{width:3px;height:18px;background:#4a3f75;border-radius:2px;margin-left:-1.5px;}
.mm-bar-lab{display:flex;justify-content:space-between;font-size:11px;color:#a090c8;
  margin-bottom:11px;}
.mm-sep{border-top:1px dashed rgba(160,139,232,0.32);margin:13px 0;}
.mm-actions{display:flex;gap:8px;margin-top:12px;}
.mm-go{flex:1;background:linear-gradient(135deg,#8b7ae8,#a08be8);color:#fff;border:none;
  border-radius:10px;padding:11px;font-size:15px;font-family:inherit;cursor:pointer;}
.mm-edit{background:rgba(255,255,255,0.8);border:1.5px solid rgba(160,139,232,0.32);
  border-radius:10px;padding:0 15px;font-size:17px;color:#6b5b95;cursor:pointer;}
.mm-empty{margin-top:26px;text-align:center;background:rgba(160,139,232,0.09);border-radius:10px;padding:15px;}
.mm-empty p{font-size:14px;color:#6b5b95;margin:0;line-height:1.7;}
.mm-reg-btn{margin-top:11px;background:linear-gradient(135deg,#8b7ae8,#a08be8);color:#fff;
  border:none;border-radius:10px;padding:11px 22px;font-size:15px;font-family:inherit;cursor:pointer;}
.mm-hint{font-size:12px;color:#a090c8;margin-top:9px;}

/* 登録モード中の検索バー。入力が始まるまで光り続ける */
@keyframes mmGlow{0%,100%{box-shadow:0 0 0 0 rgba(139,122,232,0);}
  50%{box-shadow:0 0 0 5px rgba(139,122,232,0.3);}}
.inp.registering{border-color:#8b7ae8;animation:mmGlow 1.3s ease-in-out infinite;}
.inp.registering.typing{animation:none;}
@media (prefers-reduced-motion: reduce){
  .inp.registering{animation:none;}
}
"""


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def rep(text, old, new, label, expected=1):
    n = text.count(old)
    if n != expected:
        fail("%s: %d 件のはずが %d 件でした" % (label, expected, n))
    print("  置換 %-30s %d 件" % (label, n))
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

    if "myMitchieBtn" in html:
        fail("すでに適用済みのようです")
    if "function goHome(" not in js:
        fail("先に refactor_hometitle.py を適用してください")

    here = os.path.dirname(os.path.abspath(__file__))
    block_path = os.path.join(here, "mymitchie_block.txt")
    if not os.path.exists(block_path):
        fail("mymitchie_block.txt が見つかりません（scripts/ に置いてください）")
    block = open(block_path, encoding="utf-8").read()

    print("■ 検索バーの下にボタンを置く")
    html = rep(html, ANCHOR_HTML, NEW_HTML, "Myみっちーのボタン")

    print("■ 見た目を追加")
    css = css + CSS_ADD
    print("  Myみっちーのスタイルを追加")

    print("■ 処理を追加")
    anchor_fn = "  /* --- タイトルからホームに戻る ---"
    if js.count(anchor_fn) != 1:
        fail("挿入位置を特定できませんでした")
    js = js.replace(anchor_fn, block + anchor_fn, 1)
    print("  Myみっちーの処理を追加")

    print("■ 候補を選んだときの分岐")
    old_pick = ('    document.getElementById("cityInput").value = item.getAttribute("data-city");\n'
                '    hideSuggestions();\n'
                '    diagnose();')
    new_pick = ('    var picked = item.getAttribute("data-city");\n'
                '    document.getElementById("cityInput").value = picked;\n'
                '    hideSuggestions();\n'
                '    if (registerMode) {\n'
                '      setMyCity(picked);\n'
                '      endRegister();\n'
                '      document.getElementById("cityInput").value = "";\n'
                '      var mb = document.getElementById("myMitchieBox");\n'
                '      if (mb && mb.classList.contains("hidden")) { toggleMyMitchie(); }\n'
                '      else { renderMyMitchie(); }\n'
                '      var mw = document.querySelector(".mm-wrap");\n'
                '      if (mw) mw.scrollIntoView({block: "center"});\n'
                '      return;\n'
                '    }\n'
                '    diagnose();')
    js = rep(js, old_pick, new_pick, "候補を選んだとき")

    print("■ 入力で光を止める")
    old_input = ('  document.getElementById("cityInput").addEventListener("input", '
                 'function(){ updateSuggestions(this.value); });')
    new_input = ('  document.getElementById("cityInput").addEventListener("input", function(){\n'
                 '    if (registerMode && this.value) this.classList.add("typing");\n'
                 '    updateSuggestions(this.value);\n'
                 '  });')
    js = rep(js, old_input, new_input, "入力時の処理")

    print("■ ボタンに処理を結びつける")
    old_bind = '  var homeTitleEl = document.getElementById("homeTitle");'
    new_bind = ('  var mmBtn = document.getElementById("myMitchieBtn");\n'
                '  if (mmBtn) mmBtn.addEventListener("click", toggleMyMitchie);\n'
                '  setMyMitchieIcon();\n'
                + old_bind)
    js = rep(js, old_bind, new_bind, "ボタンの登録")

    print("■ 検証")
    checks = [
        ("ボタンがある", 'id="myMitchieBtn"' in html),
        ("アイコンの場所がある", 'id="mmIcon"' in html),
        ("閉じるボタンがある", "function closeBtnHtml(" in js),
        ("開くとボタンを隠す", 'btn.style.display = closed' in js),
        ("県内という表現になった", '"内では <strong>"' in js),
        ("閉じるボタンのCSSがある", ".mm-close{" in css),
        ("アイコンに画像を入れている", "mmIcon" in js),
        ("中身の入れ物がある", 'id="myMitchieBody"' in html),
        ("最初は閉じている", 'class="mm-box hidden"' in html),
        ("CSS が追加された", ".mm-toggle{" in css),
        ("ボタンが中身幅になった", ".mm-toggle{display:inline-flex" in css),
        ("光るアニメがある", "@keyframes mmGlow" in css),
        ("動きを減らす配慮がある", "prefers-reduced-motion" in css),
        ("順位の計算がある", "function buildRanks(" in js),
        ("帯の描画がある", "function rankBar(" in js),
        ("目印がみっちーの絵", "IMGS.top" in js),
        ("端のはみ出し対策", "if (pos < 3) pos = 3;" in js),
        ("登録モードがある", "function startRegister(" in js),
        ("保存処理がある", "MYMITCHIE_KEY" in js),
        ("候補選択で分岐する", "if (registerMode) {" in js),
        ("開閉処理がある", "function toggleMyMitchie(" in js),
        ("既存の機能が残っている", "function goHome(" in js
         and "function calcHPref(" in js and "html2canvas(" in js),
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

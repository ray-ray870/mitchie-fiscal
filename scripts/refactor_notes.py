# -*- coding: utf-8 -*-
"""
総合スコアと個別指標が食い違うとき、スコアバーの上に1行の帯を出す。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_notes.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_notes.py apply     -> ルートに直接出力（本番へ昇格）

判定ルール:
  注意  70点以上（元気・絶好調）なのに、指標が黄または橙
        → 「ただし、経常収支比率は高い水準です」
  補足  50点未満（ぐったり・ひんし）なのに、指標が緑
        → 「実質公債費比率は健全な水準です」

該当件数（令和6年度データでの試算）:
  都道府県  注意2件 / 補足2件
  市区町村  注意25件 / 補足63件
  注意と補足が同時に出るケースはゼロ。
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

NOTE_FN = '''  /* --- スコアと指標の食い違いを知らせる帯 ---
     総合スコアだけを見て判断されるのを防ぐため、
     スコアが高いのに弱い指標があるとき／低いのに強い指標があるときに
     スコアバーの直上へ1行を出す。 */
  function noteHtml(d, h, isPref) {
    var GOOD = "#6dcfad", WARN = "#f0c46a";
    var warn = [], good = [];
    var cxv = colorX(d.x), cuv = colorU(d.u, isPref);
    var cdv = (d.d == null) ? "#7bb8e8"
            : d.d < 10 ? "#6dcfad" : d.d < 18 ? "#7bb8e8" : d.d < 25 ? "#f0c46a" : "#f0876a";
    var isWeak = function(c){ return c === "#f0c46a" || c === "#f0876a"; };
    var isBest = function(c){ return c === "#6dcfad"; };

    if (h >= 70) {
      if (isWeak(cxv)) warn.push("経常収支比率");
      if (isWeak(cuv)) warn.push("将来負担比率");
      if (isWeak(cdv)) warn.push("実質公債費比率");
    }
    if (h < 50) {
      if (isBest(cxv)) good.push("経常収支比率");
      if (isBest(cuv)) good.push("将来負担比率");
      if (isBest(cdv)) good.push("実質公債費比率");
    }
    if (!warn.length && !good.length) return "";

    var row = function(color, bg, icon, text) {
      return "<div style='background:" + bg + ";border-left:3px solid " + color +
        ";padding:9px 11px;margin-bottom:6px;display:flex;gap:8px;align-items:flex-start;'>" +
        "<span style='font-size:15px;flex-shrink:0;' aria-hidden='true'>" + icon + "</span>" +
        "<span style='font-size:13px;line-height:1.5;color:#6a5a2a;'>" + text + "</span></div>";
    };
    var out = "";
    warn.forEach(function(n){
      out += row(WARN, "#fdf5d4", "⚠️", "ただし、" + n + "は高い水準です");
    });
    good.forEach(function(n){
      out += row(GOOD, "#d4f0e8", "💡", n + "は健全な水準です");
    });
    return out;
  }

'''

ANCHOR = ("\"<h2 class='sr-only'>健康度スコア</h2><div class='meter' id='m0' "
          "role='button' tabindex='0' style='border:3px solid \"+pr.c+\";background:\"+pr.c+\"10;'>")

NEW_ANCHOR = ("\"<h2 class='sr-only'>健康度スコア</h2>\" + noteHtml(d, h, d.p === nm) + "
              "\"<div class='meter' id='m0' "
              "role='button' tabindex='0' style='border:3px solid \"+pr.c+\";background:\"+pr.c+\"10;'>")

# 詳細パネルの解説に、帯の意味を追記
OLD_DESC_TAIL = "目安\\n85点以上 → 絶好調\\n70点以上 → 元気\\n50点以上 → ちょっとしんどい\\n30点以上 → ぐったり\\n30点未満 → ひんし状態"

NEW_DESC_TAIL = (
    "目安\\n85点以上 → 絶好調\\n70点以上 → 元気\\n50点以上 → ちょっとしんどい\\n30点以上 → ぐったり\\n30点未満 → ひんし状態\\n"
    "\\n"
    "スコアの上に出る帯について\\n"
    "⚠️「ただし、〜は高い水準です」\\n"
    "総合スコアは高めでも、その指標だけが弱い場合に出ます。たとえば税収などの体力はあるものの、"
    "毎年の支出が固まっていて、新しい取り組みに回せるお金は少ない、という状態です。\\n"
    "\\n"
    "💡「〜は健全な水準です」\\n"
    "総合スコアは低めでも、その指標は明確に良い場合に出ます。全体としては厳しくても、"
    "その部分の管理はできている、という意味です。\\n"
    "\\n"
    "スコアは5つの指標をまとめた参考値です。1つの数字だけで判断せず、"
    "各指標もあわせて見てください。"
)


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def rep(text, old, new, label, expected):
    n = text.count(old)
    if n != expected:
        fail("%s: %d 件のはずが %d 件でした" % (label, expected, n))
    print("  置換 %-26s %d 件" % (label, n))
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

    if "function noteHtml(" in js:
        fail("すでに適用済みのようです（noteHtml が存在します）")
    if "function colorX(" not in js or "function calcHPref(" not in js:
        fail("先に色分けと都道府県スコアの変更を適用してください")

    print("■ 帯を作る関数を追加")
    anchor_fn = "  function calcHPref("
    if js.count(anchor_fn) != 1:
        fail("挿入位置を特定できませんでした")
    js = js.replace(anchor_fn, NOTE_FN + anchor_fn, 1)
    print("  noteHtml を追加")

    print("■ スコアバーの上に差し込み")
    js = rep(js, ANCHOR, NEW_ANCHOR, "スコアバーの直上", 1)

    print("■ 解説文に帯の説明を追記")
    js = rep(js, OLD_DESC_TAIL, NEW_DESC_TAIL, "総合スコアの解説", 1)

    print("■ 検証")
    checks = [
        ("noteHtml が定義されている", "function noteHtml(" in js),
        ("スコアバーの前で呼ばれている", "noteHtml(d, h, d.p === nm)" in js),
        ("注意の文言がある", "ただし、" in js),
        ("補足の文言がある", "は健全な水準です" in js),
        ("解説に帯の説明が入った", "スコアの上に出る帯について" in js),
        ("色判定を使っている", "colorX(d.x)" in js and "colorU(d.u," in js),
        ("m0 のメーターが残っている", "id='m0'" in js),
        ("都道府県スコアが残っている", "function calcHPref(" in js),
        ("診断ロジックが壊れていない", "html2canvas(" in js),
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

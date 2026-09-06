# -*- coding: utf-8 -*-
"""
都道府県の健全度スコアを、都道府県専用の基準で算出する。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_prefscore.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_prefscore.py apply     -> ルートに直接出力（本番へ昇格）

背景:
  現行は市区町村向けの配点を都道府県にも使っているため、47都道府県のうち
  46県が下位2段階に集中していた（鹿児島県24点「ひんし」など）。
  都道府県は高校・国道・河川など大規模資産を抱えるため、将来負担比率や
  経常収支比率の水準が構造的に高い。基準を分けて実態に合わせる。

  市区町村のスコアは一切変更しない。

都道府県の基準（47県の分布から設定。中央値の県が中位になるよう調整）:
  財政力指数      0.20 で0点 / 0.90 で満点   （中央値0.47）
  実質公債費比率  20%  で0点 / 6%   で満点   （中央値11.0%）
  経常収支比率    101% で0点 / 86%  で満点   （中央値93.8%）
  将来負担比率    340% で0点 / 80%  で満点   （中央値159.7%）
  基金比率        歳出比5% で満点            （中央値3.5%）
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

OLD_CALCH = '''function calcH(f,d,x,u,r,eo) {
    var sf = Math.min(f/1.2*25, 25);'''

NEW_CALCH = '''function calcH(f,d,x,u,r,eo,isPref) {
    if (isPref) return calcHPref(f,d,x,u,r,eo);
    var sf = Math.min(f/1.2*25, 25);'''

# 都道府県用のスコア関数（calcH の直前に挿入）
PREF_FN = '''  /* --- 都道府県専用のスコア ---
     市区町村向けの基準をそのまま使うと、47都道府県のうち46県が下位2段階に
     集中してしまう。都道府県は高校・国道・河川など大規模な資産を抱えるため、
     将来負担比率や経常収支比率の水準が構造的に高いことによる。
     47県の実際の分布をもとに、中央値の県が中位に来るよう基準を引き直した。 */
  function calcHPref(f,d,x,u,r,eo) {
    function band(v, zero, full) {
      if (v == null) return 0;
      var t = (zero - Math.min(Math.max(v, Math.min(zero, full)), Math.max(zero, full))) / (zero - full);
      return Math.min(Math.max(t, 0), 1);
    }
    var sf = Math.min(Math.max((f - 0.20) / (0.90 - 0.20), 0), 1) * 25;
    var sd = band(d, 20, 6) * 20;
    var sx = band(x, 101, 86) * 20;
    var su = (!u || u <= 0) ? 20 : band(u, 340, 80) * 20;
    var sr = (eo && eo > 0 && r != null) ? Math.min((r / eo * 100) / 5 * 15, 15) : 7.5;
    return Math.round(Math.min(sf + sd + sx + su + sr, 100));
  }

'''

# データ読み込み後に都道府県フラグを立てる
OLD_FLAG = '''      var cnt = Object.keys(DB).length;'''
NEW_FLAG = '''      Object.keys(DB).forEach(function(k){ if (DB[k] && DB[k].p === k) DB[k].__pref = true; });
      var cnt = Object.keys(DB).length;'''

# 呼び出し側（10箇所）
CALLS = [
    ('calcH(e.d.f,e.d.d,e.d.x,e.d.u,e.d.r,e.d.eo)',
     'calcH(e.d.f,e.d.d,e.d.x,e.d.u,e.d.r,e.d.eo,e.d.__pref)', 1),
    ('calcH(d.f,d.d,d.x,d.u,d.r,d.eo)',
     'calcH(d.f,d.d,d.x,d.u,d.r,d.eo,d.__pref)', 2),
    ('calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo)',
     'calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref)', 3),
    ('calcH(f,d,x,cur.u,cur.r,cur.eo)',
     'calcH(f,d,x,cur.u,cur.r,cur.eo,cur.__pref)', 1),
    ('calcH(e.f,e.d,e.x,e.u,e.r,e.eo)',
     'calcH(e.f,e.d,e.x,e.u,e.r,e.eo,e.__pref)', 2),
    ('calcH(cur.f, cur.d, cur.x, cur.u, cur.r, cur.eo)',
     'calcH(cur.f, cur.d, cur.x, cur.u, cur.r, cur.eo, cur.__pref)', 1),
]

# 「財政再生団体に相当する」は事実として不正確なので修正
OLD_MSG = "財政は非常に危機的な状況です。財政再生団体に相当する深刻な問題を抱えています。"
NEW_MSG = "財政は非常に厳しい状態です。複数の指標が全国でも下位の水準にあります。"

# 総合スコアの解説に、基準が分かれていることを明記
OLD_DESC = "総務省の公式データから財政力・借金返済・固定費・将来負担・貯金の5指標を用いてAIが独自に算出した参考スコアです（0〜100点）。"
NEW_DESC = ("総務省の公式データから財政力・借金返済・固定費・将来負担・貯金の5指標を用いて算出した、"
            "本アプリ独自の参考スコアです（0〜100点）。公式の格付けではありません。\\n"
            "\\n"
            "都道府県は高校・国道・河川など大規模な資産を抱えるため、将来負担比率や経常収支比率の水準が"
            "市区町村より構造的に高くなります。そのため都道府県には専用の基準を用いており、"
            "市区町村の点数とは直接比較できません。")


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def rep(text, old, new, label, expected):
    n = text.count(old)
    if n != expected:
        fail("%s: %d 件のはずが %d 件でした" % (label, expected, n))
    print("  置換 %-34s %d 件" % (label, n))
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

    if "calcHPref" in js:
        fail("すでに適用済みのようです（calcHPref が存在します）")

    print("■ 都道府県用のスコア関数を追加")
    anchor = "  function calcH(f,d,x,u,r,eo) {"
    if js.count(anchor) != 1:
        fail("calcH の位置を特定できませんでした")
    js = js.replace(anchor, PREF_FN + anchor, 1)
    print("  calcHPref を追加")

    print("■ calcH に都道府県判定を追加")
    js = rep(js, OLD_CALCH, NEW_CALCH, "calcH の入口", 1)

    print("■ 読み込み時に都道府県フラグを立てる")
    js = rep(js, OLD_FLAG, NEW_FLAG, "__pref フラグの付与", 1)

    print("■ 呼び出し側を差し替え")
    for old, new, cnt in CALLS:
        js = rep(js, old, new, old[:30], cnt)

    print("■ 説明文を修正")
    js = rep(js, OLD_MSG, NEW_MSG, "「財政再生団体に相当」の記述", 1)
    js = rep(js, OLD_DESC, NEW_DESC, "総合スコアの解説", 1)

    print("■ 検証")
    checks = [
        ("calcHPref が定義されている", "function calcHPref(" in js),
        ("calcH が isPref を受け取る", "function calcH(f,d,x,u,r,eo,isPref)" in js),
        ("__pref フラグを立てている", "DB[k].__pref = true" in js),
        ("呼び出しがすべて更新された", js.count("__pref)") == 10),
        ("古い呼び出しが残っていない", "cur.r,cur.eo)" not in js),
        ("誤った記述が消えている", "財政再生団体に相当する" not in js),
        ("AI表記が消えている", "AIが独自に算出" not in js),
        ("都道府県の説明が入っている", "都道府県には専用の基準" in js),
        ("市区町村の計算式が残っている", "Math.min(f/1.2*25, 25)" in js),
        ("色判定が残っている", "function colorX(" in js),
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

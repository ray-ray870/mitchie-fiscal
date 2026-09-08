# -*- coding: utf-8 -*-
"""
総合スコアの基金部分を、歳出比から標準財政規模比に変更する。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_score_sfs.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_score_sfs.py apply     -> ルートに直接出力（本番へ昇格）

前提: 先に refactor_reserve.py / refactor_reserve2.py を apply 済みであること

背景:
  基金の表示・色・判定文はすでに標準財政規模比に切り替えたが、
  総合スコア（calcH / calcHPref）の基金部分だけが歳出比のまま残っていた。
  スコア詳細に出る「基金 ○点／15点満点」の内訳も同様。

  歳出を分母にすると、災害対応などで歳出が一時的に膨らんだ自治体ほど
  基金の比率が低く出て、点数が不当に下がる。標準財政規模は災害で
  変わらないため、この歪みがなくなる。

満点ライン（基金カードの緑ラインと同じ）:
  市区町村  標準財政規模の20%で満点（従来は歳出の15%）
  都道府県  標準財政規模の10%で満点（従来は歳出の 5%）

影響（令和6年度データでの試算）:
  平均 +1.7点、中央値 +1点、判定ラベルが変わるのは171件（9.6%）。
  上げ幅が大きいのは能登の被災地など（珠洲市+12、輪島市+10）で、
  これは歳出比による歪みが解消された結果。
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

# --- 計算式の差し替え ---
OLD_PREF_SIG = "function calcHPref(f,d,x,u,r,eo) {"
NEW_PREF_SIG = "function calcHPref(f,d,x,u,r,eo,sfs) {"

OLD_PREF_SR = "var sr = (eo && eo > 0 && r != null) ? Math.min((r / eo * 100) / 5 * 15, 15) : 7.5;"
NEW_PREF_SR = "var sr = (sfs && sfs > 0 && r != null) ? Math.min((r / sfs * 100) / 10 * 15, 15) : 7.5;"

OLD_MUNI_SIG = "function calcH(f,d,x,u,r,eo,isPref) {\n    if (isPref) return calcHPref(f,d,x,u,r,eo);"
NEW_MUNI_SIG = "function calcH(f,d,x,u,r,eo,isPref,sfs) {\n    if (isPref) return calcHPref(f,d,x,u,r,eo,sfs);"

OLD_MUNI_SR = "var sr = (eo && eo > 0) ? Math.min((r/eo*100)/15*15, 15) : 7.5;"
NEW_MUNI_SR = "var sr = (sfs && sfs > 0 && r != null) ? Math.min((r/sfs*100)/20*15, 15) : 7.5;"

# --- 呼び出し側に sfs を渡す（10箇所） ---
CALLS = [
    ("calcH(cur.f, cur.d, cur.x, cur.u, cur.r, cur.eo, cur.__pref)",
     "calcH(cur.f, cur.d, cur.x, cur.u, cur.r, cur.eo, cur.__pref, cur.sfs)", 1),
    ("calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref)",
     "calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs)", 3),
    ("calcH(d.f,d.d,d.x,d.u,d.r,d.eo,d.__pref)",
     "calcH(d.f,d.d,d.x,d.u,d.r,d.eo,d.__pref,d.sfs)", 2),
    ("calcH(e.d.f,e.d.d,e.d.x,e.d.u,e.d.r,e.d.eo,e.d.__pref)",
     "calcH(e.d.f,e.d.d,e.d.x,e.d.u,e.d.r,e.d.eo,e.d.__pref,e.d.sfs)", 1),
    ("calcH(e.f,e.d,e.x,e.u,e.r,e.eo,e.__pref)",
     "calcH(e.f,e.d,e.x,e.u,e.r,e.eo,e.__pref,e.sfs)", 2),
    ("calcH(f,d,x,cur.u,cur.r,cur.eo,cur.__pref)",
     "calcH(f,d,x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs)", 1),
]

# --- スコア内訳の表示（基金 ○点／15点満点） ---
OLD_BD = "var bd_sr = (cur.eo && cur.eo > 0) ? Math.min((cur.r/cur.eo*100)/15*15, 15) : 7.5;"
NEW_BD = ("var bd_full = isPrefView ? 10 : 20;\n"
          "      var bd_sr = (cur.sfs && cur.sfs > 0 && cur.r != null) "
          "? Math.min((cur.r/cur.sfs*100)/bd_full*15, 15) : 7.5;")


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def rep(text, old, new, label, expected):
    n = text.count(old)
    if n != expected:
        fail("%s: %d 件のはずが %d 件でした" % (label, expected, n))
    print("  置換 %-40s %d 件" % (label, n))
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

    if "function calcHPref(f,d,x,u,r,eo,sfs)" in js:
        fail("すでに適用済みのようです")
    if "function reserveIsAmple(" not in js:
        fail("先に refactor_reserve2.py を適用してください")

    print("■ 都道府県の計算式")
    js = rep(js, OLD_PREF_SIG, NEW_PREF_SIG, "calcHPref の引数", 1)
    js = rep(js, OLD_PREF_SR, NEW_PREF_SR, "calcHPref の基金部分", 1)

    print("■ 市区町村の計算式")
    js = rep(js, OLD_MUNI_SIG, NEW_MUNI_SIG, "calcH の引数と分岐", 1)
    js = rep(js, OLD_MUNI_SR, NEW_MUNI_SR, "calcH の基金部分", 1)

    print("■ 呼び出し側に sfs を渡す")
    for old, new, cnt in CALLS:
        js = rep(js, old, new, old[:36], cnt)

    print("■ スコア内訳の表示")
    js = rep(js, OLD_BD, NEW_BD, "基金の内訳計算", 1)

    print("■ 検証")
    checks = [
        ("calcHPref が sfs を受け取る", "function calcHPref(f,d,x,u,r,eo,sfs)" in js),
        ("calcH が sfs を受け取る", "function calcH(f,d,x,u,r,eo,isPref,sfs)" in js),
        ("呼び出しがすべて更新された", js.count(".sfs)") == 10),
        ("歳出比の計算が残っていない", "r / eo * 100" not in js and "r/eo*100" not in js),
        ("市区町村は20%で満点", "(r/sfs*100)/20*15" in js),
        ("都道府県は10%で満点", "(r / sfs * 100) / 10 * 15" in js),
        ("内訳も標準財政規模比", "cur.r/cur.sfs*100" in js),
        ("基金カードの基準が残っている", "function reserveBands(" in js),
        ("共通判定が残っている", "function reserveIsAmple(" in js),
        ("色判定が残っている", "function colorR(" in js and "function colorF(" in js),
        ("注意書きが残っている", "function noteHtml(" in js),
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

# -*- coding: utf-8 -*-
"""
基金の判定に残っていた「歳出比」を、標準財政規模比に統一する。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_reserve2.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_reserve2.py apply     -> ルートに直接出力（本番へ昇格）

前提: 先に refactor_reserve.py を apply 済みであること（reserveBands が必要）

背景:
  基金カード本体は標準財政規模比に切り替えたが、他の指標（実質公債費比率・
  財政力指数・将来負担比率）の総合コメントの中で、基金を「歳出比10%以上」で
  判定している箇所が4つ残っていた。加えて補足文にも「歳出比」の記述が1つ。
  分母がばらばらのままでは、同じ「貯金が十分」でも基準が違うことになる。

  判定は reserveBands の緑ライン（市区町村20% / 都道府県10%）を使うため、
  基金カードの色と完全に一致する。
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

# 基金が「十分」かを判定する共通関数
HELPER_FN = '''  /* --- 基金が十分かどうかの共通判定 ---
     他の指標の総合コメントでも使う。基金カードの緑ラインと同じ基準なので、
     カードの色と文章が食い違わない。 */
  function reserveIsAmple(e, isPref) {
    if (!e || !e.sfs || e.sfs <= 0 || e.r == null) return false;
    return (e.r / e.sfs * 100) >= reserveBands(isPref).hi;
  }

'''

# 条件式の置換（4箇所）
COND_REPS = [
    ("cur.d < 10 && cur.eo && cur.r/cur.eo*100 >= 10",
     "cur.d < 10 && reserveIsAmple(cur, isPrefView)", "実質公債費比率のコメント"),
    ("cur.f >= 1.0 && cur.eo && cur.r/cur.eo*100 >= 10",
     "cur.f >= 1.0 && reserveIsAmple(cur, isPrefView)", "財政力指数のコメント"),
    ("cur.u <= 0 && cur.eo && cur.r/cur.eo*100 >= 10",
     "cur.u <= 0 && reserveIsAmple(cur, isPrefView)", "将来負担比率のコメント（負担なし）"),
    ("cur.u < 100 && cur.eo && cur.r/cur.eo*100 >= 10",
     "cur.u < 100 && reserveIsAmple(cur, isPrefView)", "将来負担比率のコメント（一定あり）"),
]

# 文言の置換
TEXT_REPS = [
    ("貯金（歳出比10%以上）", "貯金（標準財政規模比で多め）", "文言（将来負担）", 1),
    ("（歳出比10%以上）", "（標準財政規模比で多め）", "文言（その他）", 3),
    ("人口規模が小さい自治体ほど、歳出比で見た基金の比率が高く出やすい",
     "人口規模が小さい自治体ほど、標準財政規模に対する基金の比率が高く出やすい",
     "補足文", 1),
]


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

    if "function reserveIsAmple(" in js:
        fail("すでに適用済みのようです（reserveIsAmple が存在します）")
    if "function reserveBands(" not in js:
        fail("先に refactor_reserve.py を適用してください")

    print("■ 共通判定の関数を追加")
    anchor = "  function colorR(ratio, isPref) {"
    if js.count(anchor) != 1:
        fail("挿入位置を特定できませんでした")
    js = js.replace(anchor, HELPER_FN + anchor, 1)
    print("  reserveIsAmple を追加")

    print("■ 判定条件を差し替え")
    for old, new, label in COND_REPS:
        js = rep(js, old, new, label, 1)

    print("■ 文言を差し替え")
    for old, new, label, cnt in TEXT_REPS:
        js = rep(js, old, new, label, cnt)

    print("■ 検証")
    checks = [
        ("reserveIsAmple が定義されている", "function reserveIsAmple(" in js),
        ("呼び出しが4件", js.count("reserveIsAmple(cur, isPrefView)") == 4),
        # スコア内訳（bd_sr）は calcH と同じ計算なので、スコア変更時に一緒に直す
        ("コメントの歳出比計算が残っていない",
         "cur.eo && cur.r/cur.eo*100 >= 10" not in js),
        ("スコア内訳はそのまま残っている", "var bd_sr = " in js),
        ("「歳出比」の文言が残っていない", "歳出比" not in js),
        ("基金カードの基準が残っている", "function reserveBands(" in js),
        ("色判定が残っている", "function colorR(" in js and "function colorF(" in js),
        ("都道府県スコアが残っている", "function calcHPref(" in js),
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

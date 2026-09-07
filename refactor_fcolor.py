# -*- coding: utf-8 -*-
"""
財政力指数の色分けを見直す。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_fcolor.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_fcolor.py apply     -> ルートに直接出力（本番へ昇格）

背景:
  現行は 1.0以上=緑 / 0.7以上=青 / それ未満=橙 の3色で、
  市区町村の78%、都道府県の87%が最も濃い色になっていた。
  財政力指数の中央値は市区町村0.44・都道府県0.47。
  そもそも財政力が低いのは税収基盤の弱い地域では通常のことで、
  その分は地方交付税で補われるため、危険信号ではない。

変更後:
  0.70以上 → 緑 / 0.45以上 → 青 / 0.25以上 → 黄 / 0.25未満 → 橙

  市区町村  緑22% 青28% 黄30% 橙21%
  都道府県  緑13% 青45% 黄43% 橙0%
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

OLD_FC = 'var fc = d.f>=1.0?"#6dcfad":d.f>=0.7?"#7bb8e8":"#f0876a";'
NEW_FC = 'var fc = colorF(d.f);'

COLOR_FN = '''  /* --- 色判定：財政力指数 ---
     0.70以上=緑 / 0.45以上=青 / 0.25以上=黄 / 0.25未満=橙
     中央値は市区町村0.44・都道府県0.47。旧基準（1.0/0.7）では
     市区町村の78%が最も濃い色になり、判別の役に立っていなかった。
     財政力が低いこと自体は交付税で補われる前提の数字であり、
     危険信号ではないため、最も濃い色は下位2割程度に絞っている。 */
  function colorF(f) {
    if (f == null) return "#7bb8e8";
    return f >= 0.70 ? "#6dcfad" : f >= 0.45 ? "#7bb8e8" : f >= 0.25 ? "#f0c46a" : "#f0876a";
  }

'''

OLD_DESC = ("目安\\n1.0以上 → 不交付団体（財政力豊か）\\n0.7以上 → 比較的安定"
            "\\n0.5未満 → 交付税依存度が高い")

NEW_DESC = (
    "目安\\n"
    "🟢 0.70以上 → 税収基盤が強い\\n"
    "🔵 0.45〜0.70 → 標準的（中央値は市区町村0.44／都道府県0.47）\\n"
    "🟡 0.25〜0.45 → 交付税への依存が大きい\\n"
    "🟠 0.25未満 → 税収基盤が特に弱い\\n"
    "\\n"
    "なお1.0以上は不交付団体（地方交付税が交付されない団体）です。\\n"
    "\\n"
    "この数値が低いことは、それ自体では財政危機を意味しません。"
    "税収が少ない分は地方交付税で補われる仕組みになっているためです。"
    "人口が少ない地域や産業基盤の小さい地域では、低い値が出るのが通常です。"
)


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def rep(text, old, new, label, expected):
    n = text.count(old)
    if n != expected:
        fail("%s: %d 件のはずが %d 件でした" % (label, expected, n))
    print("  置換 %-24s %d 件" % (label, n))
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

    if "function colorF(" in js:
        fail("すでに適用済みのようです（colorF が存在します）")
    if "function colorX(" not in js:
        fail("先に色分けの見直しを適用してください")

    print("■ 色判定の関数を追加")
    anchor = "  function colorX(x) {"
    if js.count(anchor) != 1:
        fail("挿入位置を特定できませんでした")
    js = js.replace(anchor, COLOR_FN + anchor, 1)
    print("  colorF を追加")

    print("■ 色の呼び出しを差し替え")
    js = rep(js, OLD_FC, NEW_FC, "財政力指数の色", 2)

    print("■ 解説文を更新")
    js = rep(js, OLD_DESC, NEW_DESC, "財政力指数の解説", 1)

    print("■ 検証")
    checks = [
        ("colorF が定義されている", "function colorF(" in js),
        ("colorF の呼び出しが2件", js.count("colorF(d.f)") == 2),
        ("古い閾値が残っていない", 'd.f>=1.0?' not in js),
        ("新しい解説文が入っている", "税収基盤が特に弱い" in js),
        ("交付税の説明が入っている", "地方交付税で補われる仕組み" in js),
        ("不交付団体の記述が残っている", "不交付団体" in js),
        ("他の色判定が残っている", "function colorX(" in js and "function colorU(" in js),
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

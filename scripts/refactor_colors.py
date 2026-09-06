# -*- coding: utf-8 -*-
"""
経常収支比率・将来負担比率の色分けを見直す。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_colors.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_colors.py apply     -> ルートに直接出力（本番へ昇格）

変更内容:
  ① 経常収支比率の色  88/92/96 → 90/95/98
  ② 将来負担比率の色  3色 → 4色。都道府県は別基準
  ③ 上記2指標の解説文を、色の根拠がわかる内容に更新
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

OLD_XC = 'var xc = d.x<88?"#6dcfad":d.x<92?"#7bb8e8":d.x<96?"#f0c46a":"#f0876a";'
NEW_XC = 'var xc = colorX(d.x);'

OLD_UC = 'var uc = d.u<=0?"#6dcfad":d.u<100?"#7bb8e8":"#f0876a";'
NEW_UC = 'var uc = colorU(d.u, d.p === curName);'

HELPERS = '''
  /* --- 色判定：経常収支比率 ---
     90未満=緑 / 95未満=青 / 98未満=黄 / 98以上=橙
     2003年度以降、全国平均は90%を超え続けているため、90%を標準の入口とする。
     98%以上は全体の約9%で、余力がほぼない水準。 */
  function colorX(x) {
    if (x == null) return "#7bb8e8";
    return x < 90 ? "#6dcfad" : x < 95 ? "#7bb8e8" : x < 98 ? "#f0c46a" : "#f0876a";
  }

  /* --- 色判定：将来負担比率 ---
     都道府県は高校・国道・河川など大規模資産を抱えるため水準が構造的に高い。
     市区町村と同じ基準では9割が最も濃い色になるので、基準を分ける。 */
  function colorU(u, isPref) {
    var v = (u == null || u <= 0) ? 0 : u;
    if (isPref) {
      return v < 100 ? "#6dcfad" : v < 160 ? "#7bb8e8" : v < 250 ? "#f0c46a" : "#f0876a";
    }
    if (v <= 0) return "#6dcfad";
    return v < 60 ? "#7bb8e8" : v < 100 ? "#f0c46a" : "#f0876a";
  }

'''

DESC_X_OLD = ("目安\\n全国平均：約90%、中央値：約91%\\n88%未満 → 財政に弾力性がある状態"
              "\\n88〜95% → 普通\\n95%超 → 硬直化した状態")

DESC_X_NEW = (
    "目安\\n"
    "かつて「75〜80%が望ましい」とされてきましたが、これは法令上の基準ではなく慣例的な目安です。"
    "社会保障費の増加により全国的に上昇し、2003年度以降は全国平均が90%を超え続けています。\\n"
    "\\n"
    "🟢 90%未満 → 全国の中では余裕があるほう\\n"
    "🔵 90〜95% → 標準的な水準（市区町村の中央値91.5%／都道府県93.8%）\\n"
    "🟡 95〜98% → 新しい取り組みに回せるお金が少ない\\n"
    "🟠 98%以上 → 余力がほぼない（全体の約9%）\\n"
    "\\n"
    "この数字だけで良し悪しは判断できません。実質公債費比率や財政力指数と合わせて見てください。"
)

DESC_U_OLD = ("目安\\n0% → 将来負担なし\\n100%未満 → 一定の負担あり"
              "\\n100%以上 → 要注意\\n350%以上 → 早期健全化基準")

DESC_U_NEW = (
    "目安（市区町村）\\n"
    "🟢 負担なし・0%\\n"
    "🔵 60%未満 → 軽い\\n"
    "🟡 60〜100% → 一定の負担あり\\n"
    "🟠 100%以上 → 要注意\\n"
    "\\n"
    "目安（都道府県）\\n"
    "🟢 100%未満\\n"
    "🔵 100〜160% → 標準的（47都道府県の中央値は159.7%）\\n"
    "🟡 160〜250% → やや重い\\n"
    "🟠 250%以上 → 重い\\n"
    "\\n"
    "都道府県は高校・国道・河川など大規模な資産を抱えるため、市区町村より水準が高くなります。"
    "そのため色の基準を分けています。\\n"
    "\\n"
    "なお350%以上は法令上の早期健全化基準です（市区町村は350%、都道府県は400%）。"
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

    if "function colorX(" in js:
        fail("すでに適用済みのようです（colorX が存在します）")

    print("■ 色判定の関数を追加")
    anchor = "  function calcH("
    if js.count(anchor) != 1:
        fail("calcH の位置を特定できませんでした")
    js = js.replace(anchor, HELPERS + anchor, 1)
    print("  colorX / colorU を追加")

    print("■ 色の呼び出しを差し替え")
    js = rep(js, OLD_XC, NEW_XC, "経常収支比率の色", 2)
    js = rep(js, OLD_UC, NEW_UC, "将来負担比率の色", 2)

    print("■ 解説文を更新")
    js = rep(js, DESC_X_OLD, DESC_X_NEW, "経常収支比率の解説", 1)
    js = rep(js, DESC_U_OLD, DESC_U_NEW, "将来負担比率の解説", 1)

    print("■ 検証")
    checks = [
        ("colorX が定義されている", "function colorX(" in js),
        ("colorU が定義されている", "function colorU(" in js),
        ("colorX の呼び出しが2件", js.count("colorX(d.x)") == 2),
        ("colorU の呼び出しが2件", js.count("colorU(d.u,") == 2),
        ("古い閾値88が残っていない", "d.x<88" not in js),
        ("古い閾値が残っていない", "d.u<100?" not in js),
        ("新しい解説文が入っている", "2003年度以降" in js),
        ("都道府県の説明が入っている", "高校・国道・河川" in js),
        ("早期健全化基準の記述が残っている", "早期健全化基準" in js),
        ("診断ロジックが壊れていない", "html2canvas(" in js),
        ("curName が存在する", "curName = nm" in js),
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

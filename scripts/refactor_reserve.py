# -*- coding: utf-8 -*-
"""
財政調整基金の分母を、歳出から標準財政規模に変更する。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_reserve.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_reserve.py apply     -> ルートに直接出力（本番へ昇格）

前提: 先に fetch_sfs.py を実行し、data-*.json に sfs キーが入っていること

背景:
  ① 財政調整基金の水準は、実務では「標準財政規模に対する割合」で語られる。
     本アプリだけが歳出を分母にしていたため、世間の数字と比較できなかった。
     他の指標（実質公債費比率・将来負担比率など）はもともと標準財政規模が
     分母なので、これでアプリ内の分母が揃う。
  ② さらに、判定文は歳出比（10%/5%）、カードの色は金額（30億/10億）と
     基準がばらばらで、同じ画面で矛盾した表示が出ていた。
     （例：沖縄県は色が緑なのに「危うい状態です」と赤字で警告されていた）

基準の根拠:
  総務省が平成29年に行った「地方公共団体の基金の積立状況等に関する調査」で、
  財政調整基金の規模を「標準財政規模の一定割合」で考えていると回答した団体の
  具体的水準は、都道府県で「5%以下」「5%超10%以下」、市町村で「5%超10%以下」
  「10%超20%以下」が多かった。この実務水準に合わせている。
  なお法令上の基準は存在しない。

  市区町村  20%以上=緑 / 10%以上=青 / 5%以上=黄 / 5%未満=橙
  都道府県  10%以上=緑 /  5%以上=青 / 2.5%以上=黄 / 2.5%未満=橙
"""

import json
import os
import sys
import shutil

FILES = ["index.html", "style.css", "app.js"]

ROOT_ASSETS = [
    "manifest.json", "mitchie_doctor.png", "images.js",
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]

HELPER_FN = '''  /* --- 財政調整基金の基準 ---
     分母は標準財政規模。実務でもこの割合で語られる。
     水準は総務省「基金の積立状況等に関する調査」（平成29年）で
     各団体が回答した実務水準に合わせている（法令上の基準はない）。
     都道府県と市区町村で水準がまったく違うため、基準を分ける。
     （標準財政規模比の中央値は市区町村24.8%、都道府県6.4%） */
  function reserveBands(isPref) {
    return isPref ? {hi: 10, mid: 5, lo: 2.5} : {hi: 20, mid: 10, lo: 5};
  }

  function colorR(ratio, isPref) {
    if (ratio == null) return "#7bb8e8";
    var b = reserveBands(isPref);
    return ratio >= b.hi ? "#6dcfad" : ratio >= b.mid ? "#7bb8e8"
         : ratio >= b.lo ? "#f0c46a" : "#f0876a";
  }

'''

OLD_RC = 'var rc = d.r>30?"#6dcfad":d.r>10?"#7bb8e8":"#f0c46a";'
NEW_RC = 'var rc = colorR((d.sfs && d.sfs > 0) ? d.r / d.sfs * 100 : null, d.p === curName);'

OLD_GRAPH_RATIO = 'var reserveRatio = (cur && cur.eo && cur.eo > 0) ? (cur.r / cur.eo * 100) : null;'
NEW_GRAPH_RATIO = 'var reserveRatio = (cur && cur.sfs && cur.sfs > 0) ? (cur.r / cur.sfs * 100) : null;'

OLD_GRAPH_COLOR = ('reserve: reserveRatio!=null ? (reserveRatio>=10?"#6dcfad":reserveRatio>=5?'
                   '"#f0c46a":"#f0876a") : (val>30?"#6dcfad":val>10?"#7bb8e8":"#f0c46a"),')
NEW_GRAPH_COLOR = 'reserve: colorR(reserveRatio, isPrefView),'

OLD_DESC = ("目安（歳出総額比）\\n10%以上 → 安定的\\n5〜10% → やや余裕少なめ"
            "\\n5%未満 → 余裕が少ない状態")

NEW_DESC = (
    "目安（標準財政規模に対する割合）\\n"
    "標準財政規模とは、自治体が使い道を決められるお金（一般財源）の標準的な総額です。"
    "財政調整基金の水準は、実務でもこの割合で語られます。\\n"
    "\\n"
    "市区町村（中央値24.8%）\\n"
    "🟢 20%以上 → 一般に適正とされる上限に到達\\n"
    "🔵 10〜20% → 一般に適正とされる範囲\\n"
    "🟡 5〜10% → やや少なめ\\n"
    "🟠 5%未満 → 少ないほう\\n"
    "\\n"
    "都道府県（中央値6.4%）\\n"
    "🟢 10%以上 → 都道府県としては多いほう\\n"
    "🔵 5〜10% → 総務省調査で最も多い水準\\n"
    "🟡 2.5〜5% → やや少なめ\\n"
    "🟠 2.5%未満 → 少ないほう\\n"
    "\\n"
    "適正水準に法令上の基準はありません。総務省が平成29年に行った調査では、"
    "積立の考え方を「標準財政規模の一定割合」と答えた団体の水準は、"
    "都道府県で5%前後、市町村で5〜20%が多いという結果でした。"
    "都道府県と市区町村では水準が大きく違うため、基準を分けています。\\n"
    "\\n"
    "多いほど良いとは限りません。積立の原資は住民が納めた税金であり、"
    "貯め込みすぎは「使うべきところに使えていない」という見方もできます。"
)


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def rep(text, old, new, label, expected):
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

    sample = "data-kyushu.json"
    if os.path.exists(sample):
        db = json.load(open(sample, encoding="utf-8"))
        has = sum(1 for v in db.values() if v.get("sfs"))
        if has < len(db) * 0.95:
            fail("data-*.json に sfs がほとんど入っていません（%d/%d）。"
                 "先に fetch_sfs.py を実行してください。" % (has, len(db)))
        print("■ sfs の確認 OK（%s で %d/%d 件）" % (sample, has, len(db)))

    html = open("index.html", encoding="utf-8").read()
    css = open("style.css", encoding="utf-8").read()
    js = open("app.js", encoding="utf-8").read()

    if "function reserveBands(" in js:
        fail("すでに適用済みのようです（reserveBands が存在します）")
    if "function colorF(" not in js:
        fail("先に財政力指数の色分けを適用してください")

    here = os.path.dirname(os.path.abspath(__file__))
    block_path = os.path.join(here, "reserve_block.txt")
    if not os.path.exists(block_path):
        fail("reserve_block.txt が見つかりません（scripts/ に置いてください）")
    new_block = open(block_path, encoding="utf-8").read()

    print("■ 基準の関数を追加")
    anchor = "  function colorF(f) {"
    if js.count(anchor) != 1:
        fail("挿入位置を特定できませんでした")
    js = js.replace(anchor, HELPER_FN + anchor, 1)
    print("  reserveBands / colorR を追加")

    print("■ カードの色を標準財政規模比に変更")
    js = rep(js, OLD_RC, NEW_RC, "基金の色", 2)

    print("■ 判定文を差し替え")
    start = js.find('if (key === "reserve" && cur && cur.eo && cur.eo > 0) {')
    end = js.find('if (key === "growth" && cur && cur.pop) {')
    if start < 0 or end < 0 or end <= start:
        fail("判定文のブロックを特定できませんでした")
    js = js[:start] + new_block + js[end:]
    print("  基金の判定文ブロックを置換")

    print("■ グラフの色も同じ基準に揃える")
    js = rep(js, OLD_GRAPH_RATIO, NEW_GRAPH_RATIO, "グラフの比率計算", 1)
    n = js.count(OLD_GRAPH_COLOR)
    if n < 1:
        fail("グラフの色定義が見つかりませんでした")
    js = js.replace(OLD_GRAPH_COLOR, NEW_GRAPH_COLOR)
    print("  置換 %-28s %d 件" % ("グラフの色", n))

    print("■ 解説文を更新")
    js = rep(js, OLD_DESC, NEW_DESC, "基金の解説", 1)

    print("■ 検証")
    checks = [
        ("reserveBands が定義されている", "function reserveBands(" in js),
        ("colorR が定義されている", "function colorR(" in js),
        ("colorR の呼び出しが2件", js.count("var rc = colorR(") == 2),
        ("古い金額判定が残っていない", 'd.r>30?' not in js),
        ("分母が標準財政規模になっている", "cur.r / cur.sfs * 100" in js),
        ("歳出比の判定が残っていない", "cur.r / cur.eo * 100" not in js),
        ("グラフの色も統一された", "reserve: colorR(reserveRatio" in js),
        ("グラフの古い基準が残っていない", "reserveRatio>=10?" not in js),
        ("古い断定表現が消えている", "余裕が少ない状態です" not in js),
        ("新しい解説文が入っている", "標準財政規模に対する割合" in js),
        ("調査の出典が入っている", "平成29年に行った調査" in js),
        ("他の色判定が残っている", "function colorX(" in js and "function colorF(" in js),
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

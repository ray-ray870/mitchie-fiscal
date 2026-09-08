# -*- coding: utf-8 -*-
"""
教育費一般財源比率と子ども1人当たり投資額から、良し悪しの色分けを外す。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_neutral.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_neutral.py apply     -> ルートに直接出力（本番へ昇格）

背景:
  ① カードと詳細画面で色の基準が食い違っていた。
     子ども1人当たり投資額はカードが4色（120/90/70）、詳細が3色（120/70）で、
     沖縄県81.1万円はカードで黄、詳細で青と別々の色になっていた。
     教育費一般財源比率も同様（カード10/8/6、詳細10/6）。

  ② そもそもこの2つは「高いほど良い」と言えない指標だった。
     子ども1人当たり投資額は、子どもが少ない自治体ほど大きく出る。
     最大値は974万円だが、これは手厚いのではなく分母が小さいだけ。
     教育費一般財源比率も、高いのは「教育に力を入れている」とも
     「他に使う余裕がない」とも読める。都道府県が高いのは高校を
     持っているからで、優秀だからではない。

  ③ 中央値も市区町村と都道府県で大きく違う。
     子ども投資額：市区町村118.4万円 / 都道府県87.9万円
     教育費比率　：市区町村10.5% / 都道府県18.9%
     解説文の「全国平均83万円」は実は都道府県の水準だった。

  以上から、色による良し悪しの判定をやめ、中立色（紫）に統一する。
  数字と中央値との比較だけを示し、判断は読み手に委ねる。

  なおこの2指標は総合スコア（calcH）の計算には使われていないため、
  色を外してもスコアは変わらない。
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

NEUTRAL = "#a08be8"

# --- カードの色 ---
OLD_EDUC = 'var educ = d.edu>=10?"#6dcfad":d.edu>=8?"#7bb8e8":d.edu>=6?"#f0c46a":"#f0876a";'
NEW_EDUC = 'var educ = "%s";  /* 良し悪しを判定できない指標のため中立色 */' % NEUTRAL

OLD_CHC = 'var chc = d.ch>=120?"#6dcfad":d.ch>=90?"#7bb8e8":d.ch>=70?"#f0c46a":"#f0876a";'
NEW_CHC = 'var chc = "%s";  /* 良し悪しを判定できない指標のため中立色 */' % NEUTRAL

# --- グラフ・詳細画面の色 ---
OLD_CMAP_EDU = 'education: val>=10?"#6dcfad":val>=6?"#7bb8e8":"#f0876a",'
NEW_CMAP_EDU = 'education: "%s",' % NEUTRAL

OLD_CMAP_CH = 'childInvest: val>=120?"#6dcfad":val>=70?"#7bb8e8":"#f0876a"'
NEW_CMAP_CH = 'childInvest: "%s"' % NEUTRAL

# --- 判定文（教育費） ---
OLD_EDU_JUDGE = '''var ej = cur.edu>=10?"教育に積極投資しています":cur.edu>=6?"標準的な水準です":"教育への投資が少ない状態です";
      var ec2 = cur.edu>=10?"#6dcfad":cur.edu>=6?"#7bb8e8":"#f0876a";
      descHtml += "<br><br><strong style='color:"+ec2+";'>"+curName+"の教育費比率は"+cur.edu.toFixed(1)+"%で、"+ej+"。</strong>";'''

NEW_EDU_JUDGE = '''var eduMed = isPrefView ? 18.9 : 10.5;
      var eduUnit = isPrefView ? "47都道府県" : "全国の市区町村";
      var ej = cur.edu >= eduMed ? "中央値より高めです" : "中央値より低めです";
      descHtml += "<br><br><strong style='color:%s;'>"+curName+"の教育費比率は"+cur.edu.toFixed(1)+"%%で、"+eduUnit+"の"+ej+"（中央値"+eduMed+"%%）。</strong>";
      descHtml += "<br><span style='color:#6b5b95;font-size:14px;'>\\u2139\\uFE0F この数字は高い・低いが、そのまま良い・悪いを意味しません。高いのは教育を重視している場合もあれば、学校施設の老朽化対応や小規模校の維持で費用がかさんでいる場合もあります。都道府県は高校を持つため、市区町村より高く出ます。</span>";''' % NEUTRAL

# --- 判定文（子ども投資額） ---
OLD_CH_JUDGE = '''var cj2 = cur.ch>=120?"子どもへの投資が手厚い状態です":cur.ch>=70?"標準的な水準です":"子どもへの投資が少ない状態です";
      var cc2 = cur.ch>=120?"#6dcfad":cur.ch>=70?"#7bb8e8":"#f0876a";
      descHtml += "<br><br><strong style='color:"+cc2+";'>"+curName+"の子ども1人当たり投資額は"+cur.ch.toFixed(1)+"万円（全国平均83万円）で、"+cj2+"。</strong>";'''

NEW_CH_JUDGE = '''var chMed = isPrefView ? 87.9 : 118.4;
      var chUnit = isPrefView ? "47都道府県" : "全国の市区町村";
      var cj2 = cur.ch >= chMed ? "中央値より高めです" : "中央値より低めです";
      descHtml += "<br><br><strong style='color:%s;'>"+curName+"の子ども1人当たり投資額は"+cur.ch.toFixed(1)+"万円で、"+chUnit+"の"+cj2+"（中央値"+chMed+"万円）。</strong>";
      descHtml += "<br><span style='color:#6b5b95;font-size:14px;'>\\u2139\\uFE0F この数字は高い・低いが、そのまま良い・悪いを意味しません。子どもの人数で割った値なので、子どもが少ない自治体ほど大きく出ます。全国で最も高いのは974万円ですが、これは手厚いのではなく分母が小さいためです。</span>";''' % NEUTRAL

# --- 解説文の目安 ---
OLD_EDU_DESC = ("目安\\n全国平均：約8〜10%\\n10%超 → 教育重視"
                "\\n6〜10% → 標準的\\n6%未満 → 財政的制約が大きい可能性")

NEW_EDU_DESC = (
    "目安\\n"
    "中央値は市区町村10.5%、都道府県18.9%です。"
    "都道府県は高校・特別支援学校を持つため、市区町村より構造的に高くなります。\\n"
    "\\n"
    "⚠️ この数字には良し悪しがありません。そのため色分けをしていません。\\n"
    "高いのは教育を重視しているからとも、学校施設の老朽化対応や小規模校の維持で"
    "費用がかさんでいるからとも読めます。低いのは子どもの人口が多くて"
    "相対的に下がっている場合もあります。他の指標と合わせてご覧ください。"
)

OLD_CH_DESC = ("目安\\n全国平均：約83万円\\n120万円超 → 手厚い投資"
               "\\n70〜120万円 → 標準的\\n70万円未満 → 財政的制約が大きい状態")

NEW_CH_DESC = (
    "目安\\n"
    "中央値は市区町村118.4万円、都道府県87.9万円です。\\n"
    "\\n"
    "⚠️ この数字には良し悪しがありません。そのため色分けをしていません。\\n"
    "18歳未満の人数で割った値なので、子どもが少ない自治体ほど大きく出ます。"
    "全国で最も高いのは974万円ですが、これは投資が手厚いのではなく、"
    "分母となる子どもの数が極端に少ないためです。"
    "逆に子育て世代が多い新興住宅地では、分母が大きくなるため低く出ます。\\n"
    "\\n"
    "金額の大小ではなく、同じ規模の自治体との比較や、"
    "経年の変化を見るほうが実態をつかめます。"
)


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

    if "良し悪しを判定できない指標のため中立色" in js:
        fail("すでに適用済みのようです")

    print("■ カードの色を中立色に")
    js = rep(js, OLD_EDUC, NEW_EDUC, "教育費のカード色")
    js = rep(js, OLD_CHC, NEW_CHC, "子ども投資額のカード色")

    print("■ グラフ・詳細画面の色を中立色に")
    js = rep(js, OLD_CMAP_EDU, NEW_CMAP_EDU, "教育費のグラフ色")
    js = rep(js, OLD_CMAP_CH, NEW_CMAP_CH, "子ども投資額のグラフ色")

    print("■ 判定文を中立表現に")
    js = rep(js, OLD_EDU_JUDGE, NEW_EDU_JUDGE, "教育費の判定文")
    js = rep(js, OLD_CH_JUDGE, NEW_CH_JUDGE, "子ども投資額の判定文")

    print("■ 解説文の目安を更新")
    js = rep(js, OLD_EDU_DESC, NEW_EDU_DESC, "教育費の目安")
    js = rep(js, OLD_CH_DESC, NEW_CH_DESC, "子ども投資額の目安")

    print("■ 検証")
    checks = [
        ("カードが中立色になった", js.count('var educ = "%s"' % NEUTRAL) == 1
         and js.count('var chc = "%s"' % NEUTRAL) == 1),
        ("グラフも中立色になった", 'education: "%s"' % NEUTRAL in js
         and 'childInvest: "%s"' % NEUTRAL in js),
        ("良し悪しの断定が消えた", "教育に積極投資しています" not in js
         and "子どもへの投資が手厚い状態です" not in js),
        ("注意メッセージが入った", js.count("そのまま良い・悪いを意味しません") == 2),
        ("解説にも注意が入った", js.count("この数字には良し悪しがありません") == 2),
        ("中央値が入っている", "118.4" in js and "87.9" in js
         and "10.5" in js and "18.9" in js),
        ("古い全国平均83万円が消えた", "全国平均83万円" not in js),
        ("他の色判定が残っている", "function colorX(" in js
         and "function colorF(" in js and "function colorR(" in js),
        ("スコアが変わっていない", "function calcHPref(f,d,x,u,r,eo,sfs)" in js),
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

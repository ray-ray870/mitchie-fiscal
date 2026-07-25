# -*- coding: utf-8 -*-
"""
index.html を index.html + style.css + app.js に分割する。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_split.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_split.py apply     -> ルートに直接出力（本番へ昇格）

安全設計:
  - 検証に1つでも失敗したら、何も書き込まずに異常終了する
  - preview モードでは本番ファイルに一切触れない
"""

import os
import re
import sys
import shutil
import datetime

SRC = "index.html"

# preview/ から親のデータを読むために相対パスを付け替える対象
ROOT_ASSETS = [
    "manifest.json",
    "mitchie_doctor.png",
    "images.js",
    "data-hokkaido-tohoku.json",
    "data-kanto.json",
    "data-chubu.json",
    "data-kinki.json",
    "data-chugoku-shikoku.json",
    "data-kyushu.json",
]


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    if mode not in ("preview", "apply"):
        fail("モードは preview か apply を指定してください")

    if not os.path.exists(SRC):
        fail(SRC + " が見つかりません")

    with open(SRC, encoding="utf-8") as f:
        src = f.read()

    print("読み込み: %s (%d 文字 / %d 行)" % (SRC, len(src), src.count("\n") + 1))

    # ---------- 1. <style> を切り出す ----------
    if src.count("<style") != 1 or src.count("</style>") != 1:
        fail("<style> タグが1組ではありません。手動で確認してください")

    m_style = re.search(r"<style>(.*?)</style>", src, re.S)
    if not m_style:
        fail("<style> ブロックを抽出できませんでした")
    css = m_style.group(1).strip()

    # ---------- 2. 一番大きいインライン <script> を切り出す ----------
    blocks = []
    for m in re.finditer(r"<script([^>]*)>", src):
        attrs = m.group(1)
        if "src=" in attrs:
            continue  # 外部読み込みタグ（GA4/images.js/html2canvas）は動かさない
        end = src.find("</script>", m.end())
        if end == -1:
            fail("閉じられていない <script> があります")
        blocks.append((m.start(), end + len("</script>"), src[m.end():end]))

    if not blocks:
        fail("インライン <script> が見つかりません")

    main_block = max(blocks, key=lambda b: len(b[2]))
    if len(main_block[2]) < 50000:
        fail("メインスクリプトが小さすぎます（%d 文字）。構造が想定と違います" % len(main_block[2]))

    js = main_block[2].strip()
    print("抽出: CSS %d 文字 / JS %d 文字" % (len(css), len(js)))

    # ---------- 3. index.html を組み立て直す ----------
    ver = datetime.datetime.now().strftime("%Y%m%d%H%M")

    html = src[:main_block[0]] + \
        '<script src="app.js?v=' + ver + '"></script>' + \
        src[main_block[1]:]

    html = html.replace(
        m_style.group(0),
        '<link rel="stylesheet" href="style.css?v=' + ver + '">'
    )

    # ---------- 4. 出力先を決める ----------
    if mode == "preview":
        outdir = "preview"
        if os.path.isdir(outdir):
            shutil.rmtree(outdir)
        os.makedirs(outdir)
        # preview/ からは親ディレクトリの資産を参照する
        for name in ROOT_ASSETS:
            html = html.replace('"' + name + '"', '"../' + name + '"')
            js = js.replace('"' + name + '"', '"../' + name + '"')
        # OGPの絶対URLは書き換え不要（そのまま）
    else:
        outdir = "."

    # ---------- 5. 検証（書き込み前） ----------
    checks = []
    checks.append(("app.js の読み込みタグがある", "app.js?v=" in html))
    checks.append(("style.css の読み込みタグがある", "style.css?v=" in html))
    checks.append(("<style> が残っていない", "<style" not in html))
    checks.append(("images.js の読み込みが残っている", "images.js" in html))
    checks.append(("html2canvas の読み込みが残っている", "html2canvas" in html))
    checks.append(("GA4 タグが残っている", "G-5BGX6KQZFL" in html))
    checks.append(("OGP タグが残っている", "og:image" in html))
    checks.append(("images.js より後に app.js がある",
                   html.find("images.js") < html.find("app.js?v=")))
    checks.append(("html2canvas より後に app.js がある",
                   html.find("html2canvas") < html.find("app.js?v=")))
    checks.append(("app.js に診断ロジックが含まれる", "html2canvas(" in js))
    checks.append(("app.js にデータ読み込みが含まれる", ".json" in js))
    checks.append(("CSS が空でない", len(css) > 5000))
    checks.append(("元ファイルとの文字数差が想定内",
                   abs((len(html) + len(css) + len(js)) - len(src)) < 3000))

    ok = True
    for name, res in checks:
        print(("  OK   " if res else "  NG   ") + name)
        if not res:
            ok = False
    if not ok:
        fail("検証に失敗したため、ファイルは一切書き込みませんでした")

    # ---------- 6. 書き込み ----------
    def write(path, text):
        with open(os.path.join(outdir, path), "w", encoding="utf-8") as f:
            f.write(text)
        print("書き込み: %s (%d 文字)" % (os.path.join(outdir, path), len(text)))

    write("index.html", html)
    write("style.css", css)
    write("app.js", js)

    print("")
    print("完了（モード: %s）" % mode)
    if mode == "preview":
        print("確認先: https://ray-ray870.github.io/mitchie-fiscal/preview/")
    else:
        print("index.html は %d 行になりました" % (html.count("\n") + 1))


if __name__ == "__main__":
    main()

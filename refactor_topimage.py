# -*- coding: utf-8 -*-
"""
images.js の top（トップ画面のみっちー）を新しい画像に差し替える。

使い方（GitHub Actions の workflow_dispatch から実行）:
    python scripts/refactor_topimage.py preview   -> preview/ に出力（本番は無傷）
    python scripts/refactor_topimage.py apply     -> ルートに直接出力（本番へ昇格）

背景:
  これまでの top 画像は、お腹の白い部分まで透過されていた。
  白く不透明な画素が1つもなく、輪郭線と紫の部分だけが残っている状態で、
  背景が透けて見えていた。トップの吹き出しでも同じ画像を使っているため、
  両方で同じ症状が出ていた。

  お腹をきちんと白で塗った画像に差し替える。
  あわせて300pxに縮小し64色に減色したため、ファイルは 33KB → 9KB と軽くなる。
  （絵柄が単純なので見た目の劣化はない）
"""

import os
import sys
import shutil

FILES = ["index.html", "style.css", "app.js", "images.js"]

ROOT_ASSETS = [
    "manifest.json", "mitchie_doctor.png", "images.js",
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    if mode not in ("preview", "apply"):
        fail("モードは preview か apply を指定してください")

    for f in FILES:
        if not os.path.exists(f):
            fail(f + " が見つかりません")

    here = os.path.dirname(os.path.abspath(__file__))
    b64_path = os.path.join(here, "new_top_b64.txt")
    if not os.path.exists(b64_path):
        fail("new_top_b64.txt が見つかりません（scripts/ に置いてください）")
    new_b64 = open(b64_path, encoding="utf-8").read().strip()

    if len(new_b64) < 5000:
        fail("画像データが短すぎます（%d文字）" % len(new_b64))

    images = open("images.js", encoding="utf-8").read()
    html = open("index.html", encoding="utf-8").read()
    css = open("style.css", encoding="utf-8").read()
    js = open("app.js", encoding="utf-8").read()

    print("■ 現在の top を探す")
    import re
    m = re.search(r'(top:\s*")([^"]+)(")', images)
    if not m:
        fail("images.js の top が見つかりません")
    old_b64 = m.group(2)
    print("  現在: %d文字 / 新しい画像: %d文字" % (len(old_b64), len(new_b64)))

    if old_b64 == new_b64:
        fail("すでに同じ画像が入っています")

    print("■ 差し替え")
    images = images[:m.start(2)] + new_b64 + images[m.end(2):]
    print("  top を差し替えました")

    print("■ 検証")
    checks = [
        ("新しい画像が入っている", new_b64 in images),
        ("古い画像が残っていない", old_b64 not in images),
        ("他の画像が残っている",
         all(k + ':' in images for k in
             ["happy", "normal", "tired", "sick", "critical"])),
        ("末尾が壊れていない", images.rstrip().endswith("}") or images.rstrip().endswith(";")),
        ("IMGS の定義がある", "var IMGS" in images),
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
        # preview では images.js も置くので、親を参照させない
        for name in ROOT_ASSETS:
            if name == "images.js":
                continue
            html = html.replace('"' + name + '"', '"../' + name + '"')
            js = js.replace('"' + name + '"', '"../' + name + '"')
        with open(os.path.join(outdir, "images.js"), "w", encoding="utf-8") as f:
            f.write(images)
        print("書き込み: preview/images.js")
    else:
        outdir = "."
        with open("images.js", "w", encoding="utf-8") as f:
            f.write(images)
        print("書き込み: images.js")

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

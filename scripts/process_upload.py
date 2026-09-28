# -*- coding: utf-8 -*-
"""
upload/ フォルダに置かれたファイルを、正しい場所に上書きで移動する。
GitHub Actions「アップロードを反映」(.github/workflows/upload-inbox.yml) から呼ばれる。

スマホで保存すると「index-153.html」「ui (1).js」のように番号が付くので、
番号を取ってからリポジトリ内の同じ名前のファイルを探し、そこに上書きする。

置き場所の決め方:
  1. upload/ の中にフォルダを作って置いた場合（例: upload/preview/js/ui-3.js）
     → そのフォルダ構成どおり（preview/js/ui.js）
  2. upload/ の直下に置いた場合（ふつうはこちら）
     → リポジトリ内で同じ名前のファイルを探す
        ・1つだけ見つかればそこ
        ・複数あれば preview/ → scripts/ → その他 の順で優先
          （本番のファイルはプレビューから「本番に反映」で更新する決まりなので、
            index.html・ui.js・data-*.json などは必ず preview/ 側に入る）
        ・見つからない新しいファイルは .py なら scripts/ に置く。それ以外は止まる
  ・.github/workflows/ のファイル（.yml）はこの仕組みでは置けない
    （GitHubの制限。直接 .github/workflows/ にアップロードする）

1つでも置き場所が決まらないファイルがあれば、何も動かさずに止まる。
preview/ の js・css・images.js を更新したときは、preview/index.html の ?v= 番号も新しくする
（スマホのブラウザが古いファイルを使い続けないように）。
"""
import os
import re
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INBOX = "upload"
KEEP = {"使い方.md"}  # upload/ 直下に置いたままにするファイル（フォルダを消さないため）
PRIORITY = ["preview/", "scripts/"]

# upload/使い方.md の中身（フォルダがないときはこれで作る。GitHubの画面ではフォルダを作れないため）
HELP_MD = """# upload フォルダの使い方

Claude から受け取ったファイルは、**名前に番号が付いていても（index-153.html、ui (1).js など）そのまま、このフォルダにアップロード**してください。

1. GitHub でこの `upload` フォルダを開く
2. 「Add file」→「Upload files」で、受け取ったファイルをまとめて選んでコミット
3. 自動で「アップロードを反映」ワークフローが動き、1〜2分で
   - 名前の番号を取る
   - 正しい場所に上書きする（1回のコミットにまとめる）
   - 公開処理を実行する

削除や名前の変更は不要です。

## どこに入るか

- 同じ名前のファイルが本番とプレビューの両方にあるときは、**必ず preview/ 側**に入ります（index.html・ui.js・data-*.json など）。本番へは今までどおり「プレビューを本番に反映」「プレビューのデータを本番に反映」で反映します。
- scripts/ のファイル（build_furusato.py、README.md など）は scripts/ に入ります。
- 新しい .py ファイルは scripts/ に入ります。

## この仕組みでは置けないもの

- **ワークフロー（.yml）**：GitHub の制限で自動では置けません。今までどおり `.github/workflows/` に直接アップロードしてください。
- **リポジトリにまだない、.py 以外の新しいファイル**：置き場所が決められないので止まります。Claude に相談してください。

## うまくいかなかったとき

Actions タブの「アップロードを反映」に赤い×が付いたときは、そのときのファイルは1つも動いていません（upload フォルダに残っています）。赤い×の画面のスクリーンショットを Claude に見せてください。

残ったファイルは次のアップロードのときにもう一度処理されるので、置けなかったファイルは upload フォルダから削除しておいてください。

※ このファイル（使い方.md）は、upload フォルダを消さないために置いてあるので、削除しないでください。
"""


def fail(msg):
    print("::error::" + msg)
    print("NG: " + msg)
    sys.exit(1)


def tracked_files():
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [p for p in out.splitlines() if not p.startswith(INBOX + "/")]


def strip_number(name):
    """index-153.html / index (1).html / index(2).html → index.html"""
    m = re.match(r"^(.+?)(?:-\d+| ?\(\d+\))(\.[^./]+)$", name)
    return m.group(1) + m.group(2) if m else name


def choose(cands):
    if len(cands) == 1:
        return cands[0]
    for pre in PRIORITY:
        hit = [c for c in cands if c.startswith(pre)]
        if len(hit) == 1:
            return hit[0]
        if len(hit) > 1:
            return None
    root_hit = [c for c in cands if "/" not in c]
    return root_hit[0] if len(root_hit) == 1 else None


def main():
    inbox = os.path.join(ROOT, INBOX)
    help_path = os.path.join(inbox, "使い方.md")
    if not os.path.exists(help_path):
        os.makedirs(inbox, exist_ok=True)
        with open(help_path, "w", encoding="utf-8") as f:
            f.write(HELP_MD)
        print("upload/ フォルダと 使い方.md を作りました。")
    uploads = []
    for dp, _, fns in os.walk(inbox):
        for fn in fns:
            rel = os.path.relpath(os.path.join(dp, fn), inbox).replace(os.sep, "/")
            if rel in KEEP:
                continue
            uploads.append(rel)
    if not uploads:
        print("upload/ に処理するファイルはありません。")
        return

    files = tracked_files()
    by_name = {}
    for p in files:
        by_name.setdefault(os.path.basename(p), []).append(p)

    plan, errors = [], []
    for rel in sorted(uploads):
        d, fn = os.path.dirname(rel), os.path.basename(rel)
        # 元の名前でリポジトリにあればそのまま、なければ番号を取る
        name = fn if (by_name.get(fn) or (d and os.path.join(d, fn).replace(os.sep, "/") in files)) else strip_number(fn)
        if d:
            dest = d + "/" + name
            if dest.startswith(".github/"):
                errors.append("%s: .github/ には置けません（直接 .github/workflows/ にアップロードしてください）" % rel)
                continue
        else:
            cands = by_name.get(name, [])
            if not cands:
                if name.endswith((".yml", ".yaml")):
                    errors.append("%s: ワークフローのファイルはこの仕組みでは置けません（直接 .github/workflows/ にアップロードしてください）" % rel)
                    continue
                if name.endswith(".py"):
                    dest = "scripts/" + name
                else:
                    errors.append("%s: 「%s」という名前のファイルがリポジトリにありません（新しいファイルは upload/ の中に置き場所のフォルダを作って入れてください）" % (rel, name))
                    continue
            else:
                dest = choose(cands)
                if not dest:
                    errors.append("%s: 「%s」が複数あり置き場所を決められません: %s" % (rel, name, ", ".join(cands)))
                    continue
                if dest.startswith(".github/"):
                    errors.append("%s: ワークフローのファイルはこの仕組みでは置けません（直接 .github/workflows/ にアップロードしてください）" % rel)
                    continue
        plan.append((rel, dest))

    dests = [d for _, d in plan]
    for d in set(dests):
        if dests.count(d) > 1:
            errors.append("同じ置き場所（%s）に複数のファイルがあります: %s" % (d, ", ".join(r for r, x in plan if x == d)))
    if errors:
        fail("置き場所を決められないファイルがあるため、何も動かしていません。\n" + "\n".join("  ・" + e for e in errors))

    print("■ 置き場所")
    for rel, dest in plan:
        src = os.path.join(inbox, rel)
        dst = os.path.join(ROOT, dest)
        os.makedirs(os.path.dirname(dst) or ROOT, exist_ok=True)
        shutil.copyfile(src, dst)
        os.remove(src)
        print("  upload/%s → %s" % (rel, dest))

    # preview/ の js・css・images.js を更新したら preview/index.html の ?v= を新しくする
    bump = [d for d in dests if re.fullmatch(r"preview/(js/[^/]+\.js|style\.css|images\.js)", d)]
    idx = os.path.join(ROOT, "preview", "index.html")
    if bump and os.path.exists(idx):
        ver = time.strftime("%Y%m%d%H%M", time.gmtime())
        s = open(idx, encoding="utf-8").read()
        for d in bump:
            ref = d[len("preview/"):]
            s = re.sub(r"(%s\?v=)[0-9]+" % re.escape(ref), r"\g<1>" + ver, s)
        open(idx, "w", encoding="utf-8").write(s)
        print("■ preview/index.html の読み込み番号を %s に更新（%s）" % (ver, ", ".join(bump)))

    # 空になったサブフォルダを消す
    for dp, dns, fns in sorted(os.walk(inbox), key=lambda x: -len(x[0])):
        if dp != inbox and not os.listdir(dp):
            os.rmdir(dp)
    print("OK: %d件のファイルを配置しました" % len(plan))


if __name__ == "__main__":
    main()

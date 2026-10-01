# -*- coding: utf-8 -*-
"""
年次更新のリハーサル（確認専用・リポジトリのデータは書き換えない）

3月の年次更新と同じスクリプトを、今の公式データで「1年前の状態から」実行し、
今のアプリのデータ（preview/）と同じ結果になるかを確かめる。
同じになれば、3月に新しい年度のURLで実行しても、同じ手順で正しく取り込めるということ。

使い方（ワークフロー「年次更新のリハーサル」から実行される）
    python scripts/rehearse_annual_update.py prepare 作業フォルダ
        … preview/ のデータを作業フォルダにコピーして、最新の1年分を取り除く
          （財政：令和6年度 → 令和5年度まで、人口：令和8年 → 令和7年まで、公会計：令和5年度 → 令和4年度まで）
    （ここでワークフローが MITCHIE_DATA_DIR=作業フォルダ で年次更新のスクリプトを実行する）
    python scripts/rehearse_annual_update.py compare 作業フォルダ
        … 作業フォルダの結果と preview/ を比べる。違いがあれば赤い×
"""
import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "preview"
DATA_FILES = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
              "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]
FISCAL_FIELDS = ["f", "x", "d", "u", "r", "eo", "ei", "edu", "ch"]
POP_FIELDS = ["pop", "g"]
KK_FIELDS = [f"ka{i}" for i in range(1, 10)]
LABEL = {"f": "財政力指数", "x": "経常収支比率", "d": "実質公債費比率", "u": "将来負担比率", "r": "財政調整基金",
         "eo": "歳出", "ei": "歳入", "edu": "教育費比率", "ch": "子ども投資額", "pop": "人口", "g": "人口増減率",
         "sfs": "標準財政規模", "eog": "歳出の増減率", "eig": "歳入の増減率", "jr": "実質赤字比率", "rjr": "連結実質赤字比率", "grp": "公会計の類似団体区分", "pd": "人口動態（自然増減・社会増減）"}


def summary(text):
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


def newest(e, prefix):
    nums = [int(k[len(prefix) + 2:]) for k in e if k.startswith(prefix + "_r") and k[len(prefix) + 2:].isdigit()]
    return max(nums) if nums else None


def roll_back(e, prefix):
    """最新の値を捨てて、1つ前の年の値を最新に戻す"""
    n = newest(e, prefix)
    if n is None:
        e.pop(prefix, None)
        return
    e[prefix] = e.pop(f"{prefix}_r{n}")


def prepare(work):
    work.mkdir(parents=True, exist_ok=True)
    for f in DATA_FILES:
        db = json.loads((SRC / f).read_text(encoding="utf-8"))
        for e in db.values():
            for p in FISCAL_FIELDS + POP_FIELDS:
                if p in e or newest(e, p) is not None:
                    roll_back(e, p)
            # 標準財政規模は令和元年度と最新だけ持っているので、最新を消す（空いた年は空欄で埋まる）
            e.pop("sfs", None)
            # 年次更新で作り直す欄（歳出・歳入の増減率、実質赤字比率・連結実質赤字比率）も消しておく
            for k in ("eog", "eig", "jr", "rjr"):
                e.pop(k, None)
        (work / f).write_text(json.dumps(db, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kk = json.loads((SRC / "kokaikei.json").read_text(encoding="utf-8"))
    for n, e in kk.items():
        if n.startswith("_") or not isinstance(e, dict):
            continue
        for p in KK_FIELDS:
            if newest(e, p) is not None:
                roll_back(e, p)
    (work / "kokaikei.json").write_text(json.dumps(kk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    shutil.copy(SRC / "kana-index.json", work / "kana-index.json")
    summary("## 年次更新のリハーサル\n\n- preview/ のデータから最新の1年分を取り除いて、作業用のフォルダで年次更新を実行します"
            "（リポジトリのデータは書き換えません）。\n")


def same(a, b):
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) < 1e-9
    return a == b


def compare(work):
    diffs, added, examples = {}, {}, {}

    def cmp(name, a_e, b_e):
        for k in sorted(set(a_e) | set(b_e)):
            if k.startswith("_"):
                continue
            a, b = a_e.get(k), b_e.get(k)   # a＝今の preview、b＝リハーサルの結果
            if same(a, b):
                continue
            base = k.split("_r")[0]
            if a is None and b is not None:
                added[base] = added.get(base, 0) + 1
                continue
            diffs[k] = diffs.get(k, 0) + 1
            examples.setdefault(k, [])
            if len(examples[k]) < 5:
                examples[k].append(f"{name} {a}→{b}")

    for f in DATA_FILES:
        A = json.loads((SRC / f).read_text(encoding="utf-8"))
        B = json.loads((work / f).read_text(encoding="utf-8"))
        for n in set(A) | set(B):
            if n not in A or n not in B:
                diffs["（団体の顔ぶれ）"] = diffs.get("（団体の顔ぶれ）", 0) + 1
                continue
            cmp(n, A[n], B[n])
    KA = json.loads((SRC / "kokaikei.json").read_text(encoding="utf-8"))
    KB = json.loads((work / "kokaikei.json").read_text(encoding="utf-8"))
    for n in set(KA) | set(KB):
        if n.startswith("_"):
            continue
        cmp(n, KA.get(n) or {}, KB.get(n) or {})
    gm_same = json.dumps(KA.get("_groupMedians"), sort_keys=True) == json.dumps(KB.get("_groupMedians"), sort_keys=True)

    lines = []
    if not diffs and gm_same:
        lines.append("### ✅ リハーサル成功：年次更新の結果が、今のアプリのデータと一致しました")
        lines.append("")
        lines.append("3月に新しい年度のURLで同じ手順を実行すれば、同じように正しく取り込めます。")
    else:
        lines.append(f"### ⚠️ リハーサル：今のアプリのデータと違うところがあります（{sum(diffs.values())}件）")
        lines.append("")
        lines.append("| 欄 | 違う団体の数 | 例（今のデータ → リハーサルの結果） |")
        lines.append("|---|---|---|")
        for k in sorted(diffs, key=lambda x: -diffs[x]):
            lines.append(f"| {LABEL.get(k.split('_r')[0], k)}（{k}） | {diffs[k]} | {'、'.join(examples.get(k, []))} |")
        if not gm_same:
            lines.append("| 公会計の区分ごとの中央値 | — | 再計算の結果が違います |")
    if added:
        lines.append("")
        lines.append("参考：今は空欄で、リハーサルで値が入った欄（年次更新のたびに埋まる欄なら問題なし）："
                     + "、".join(f"{LABEL.get(k, k)}（{k}）{v}件" for k, v in added.items()))
    summary("\n".join(lines))
    if diffs or not gm_same:
        sys.exit(1)


if __name__ == "__main__":
    cmd, work = sys.argv[1], Path(sys.argv[2])
    {"prepare": prepare, "compare": compare}[cmd](work)

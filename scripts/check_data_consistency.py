# -*- coding: utf-8 -*-
"""
財政データ（data-*.json）・公会計データ（kokaikei.json）・かな検索インデックス
（kana-index.json）の3つが、自治体の顔ぶれという点でズレていないかを突き合わせるチェック。

年次のデータ更新（財政データの更新）を行った後、特に市区町村の合併・新設が
あった年に実行することを想定。build_kokaikei.py・かな検索インデックスの再生成を
忘れていないか、逆に古い自治体名のデータが残っていないかを検出する。

このスクリプト自体はファイルを書き換えない（読み取り専用のチェックのみ）。

使い方（リポジトリのルートで）:
    python scripts/check_data_consistency.py

終了コード: 問題なければ0、見過ごせない不整合があれば1（GitHub Actionsで
このまま失敗させることも、手元で結果を読むだけにも使える）。
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DATA_FILES = [
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]

KOKAIKEI_FILE = "kokaikei.json"
KANA_INDEX_FILE = "kana-index.json"

problems = []   # 見過ごせない不整合（終了コードを1にする）
notes = []      # 参考情報（正常にありうるもの。例：公会計データ未公表の自治体）


def load_json(rel_path):
    path = os.path.join(ROOT, rel_path)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_db():
    """財政データ（data-*.json、6ブロック）を1つにまとめた {自治体名: entry} を返す。"""
    db = {}
    for fn in DATA_FILES:
        d = load_json(fn)
        if d is None:
            problems.append("%s が見つかりません（財政データの一部が欠けています）" % fn)
            continue
        for k, v in d.items():
            if k in db:
                problems.append("財政データ内で自治体名が重複しています: %s" % k)
            db[k] = v
    return db


def main():
    print("■ 財政データ（data-*.json）を読み込み中")
    db = load_db()
    db_names = set(db.keys())
    print("  自治体数: %d" % len(db_names))

    # --- 公会計データ（kokaikei.json）との突き合わせ ---
    print("")
    print("■ 公会計データ（kokaikei.json）と突き合わせ中")
    kk = load_json(KOKAIKEI_FILE)
    if kk is None:
        problems.append("kokaikei.json が見つかりません")
    else:
        kk_names = set(k for k in kk.keys() if k != "_groupMedians")
        missing_in_kk = sorted(db_names - kk_names)
        stale_in_kk = sorted(kk_names - db_names)
        print("  kokaikei.jsonの自治体数: %d" % len(kk_names))
        if missing_in_kk:
            notes.append(
                "公会計データが未整備の自治体: %d件（総務省が未公表のケースを含むため、"
                "必ずしも異常ではない）\n    例: %s"
                % (len(missing_in_kk), "、".join(missing_in_kk[:15]))
            )
        if stale_in_kk:
            problems.append(
                "kokaikei.jsonに、財政データ側にもう存在しない自治体名が残っています"
                "（合併・改称などで名前が変わった後、古いデータが残っている可能性）: %d件\n"
                "    例: %s" % (len(stale_in_kk), "、".join(stale_in_kk[:15]))
            )

    # --- かな検索インデックス（kana-index.json）との突き合わせ ---
    print("")
    print("■ かな検索インデックス（kana-index.json）と突き合わせ中")
    kana = load_json(KANA_INDEX_FILE)
    if kana is None:
        problems.append("kana-index.json が見つかりません")
    else:
        covered = set()
        for reading, cities in kana.items():
            covered.update(cities)
        missing_in_kana = sorted(db_names - covered)
        stale_in_kana = sorted(covered - db_names)
        print("  かな検索でカバーされている自治体数: %d" % len(covered))
        if missing_in_kana:
            problems.append(
                "読み仮名で検索できない自治体があります（かな検索インデックスの再生成漏れの"
                "可能性）: %d件\n    例: %s"
                % (len(missing_in_kana), "、".join(missing_in_kana[:15]))
            )
        if stale_in_kana:
            problems.append(
                "かな検索インデックスに、財政データ側にもう存在しない自治体名が残っています"
                "（古い自治体名の読みが残っている可能性）: %d件\n    例: %s"
                % (len(stale_in_kana), "、".join(stale_in_kana[:15]))
            )

    # --- 結果表示 ---
    print("")
    print("=" * 40)
    if notes:
        print("【参考】")
        for n in notes:
            print("  ・" + n)
        print("")
    if problems:
        print("NG: 見過ごせない不整合が %d件 見つかりました。" % len(problems))
        for p in problems:
            print("  ・" + p)
        sys.exit(1)
    else:
        print("OK: 財政データ・公会計データ・かな検索インデックスの自治体の顔ぶれは一致しています。")
        sys.exit(0)


if __name__ == "__main__":
    main()

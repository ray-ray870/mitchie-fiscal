# -*- coding: utf-8 -*-
"""
総務省「都道府県コード及び市区町村コード」Excel（例: 000925835.xlsx）から
全自治体の読み仮名を抽出し、検索の読み仮名対応に使う kana-index.json を作る/更新する。

財政データ（data-*.json）とは完全に別ファイルで管理する。

使い方（ローカルまたは GitHub Actions から、リポジトリのルートで）:
    python scripts/build_kana_index.py <都道府県コード及び市区町村コード.xlsx>

Excelの想定フォーマット（1シート目、1行目が見出し）:
    A列: 団体コード
    B列: 都道府県名（漢字）
    C列: 市区町村名（漢字）  ※都道府県の行はここが空欄
    D列: 都道府県名（カナ、半角カタカナ）
    E列: 市区町村名（カナ、半角カタカナ）  ※都道府県の行はここが空欄

半角カタカナのままだと「ﾎｯｶｲﾄﾞｳ」のように濁点・半濁点が別文字になっており、
そのまま変換すると「ほつかいとﾞう」のように文字化けする（過去に実際に起きたバグ）。
そのため jaconv で 半角→全角カタカナ→ひらがな の順に正しく変換する。

出力（kana-index.json）は {読み仮名(ひらがな): [自治体名, ...]} の形。
値の自治体名は、このアプリのDB（data-*.json）のキーと完全一致させる
（同名自治体は「府中市（東京）」のようにDB側で既に都道府県名などで区別されているため、
Excel側の(都道府県, 自治体名)をDBと突き合わせてから、DB側のキーをそのまま使う）。

次回、自治体の合併・新設があった場合は、総務省サイトから最新のExcelを
ダウンロードして同じ1引数で再実行すれば、kana-index.json が作り直される。
"""
import json
import os
import re
import sys

import jaconv
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DATA_FILES = [
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def norm(name):
    """自治体名の表記ゆれを吸収する（他のスクリプトと共通のルール）。"""
    if name is None:
        return ""
    return (str(name).replace("ヶ", "ケ").replace("ヵ", "カ")
                      .replace("　", "").strip())


def to_hiragana(halfwidth_kana):
    """半角カタカナ（総務省Excelの表記）を正しくひらがなに変換する。
    h2z→kata2hiraの順で通さないと、濁点・半濁点が分離した文字化けが起きるので注意。"""
    if not halfwidth_kana:
        return ""
    full = jaconv.h2z(str(halfwidth_kana).strip(), kana=True, digit=False, ascii=False)
    return jaconv.kata2hira(full)


def load_db():
    """財政データ（data-*.json）を読み込み、{(都道府県, 自治体の素の名前): DBキー} と
    {都道府県名: DBキー} の対応表を作る。DBキーは、同名自治体の場合「府中市（東京）」の
    ようにアプリ側で既に区別済みの形になっている。"""
    muni_lookup = {}
    pref_lookup = {}
    total = 0
    for fn in DATA_FILES:
        path = os.path.join(ROOT, fn)
        if not os.path.exists(path):
            fail(fn + " が見つかりません")
        db = json.load(open(path, encoding="utf-8"))
        for k, v in db.items():
            total += 1
            p = v.get("p")
            is_pref = (p == k)
            if is_pref:
                pref_lookup[norm(k)] = k
            else:
                base_name = norm(re.sub(r"（[^）]*）$", "", k))
                muni_lookup[(norm(p), base_name)] = k
    return pref_lookup, muni_lookup, total


def main():
    if len(sys.argv) < 2:
        fail("使い方: python scripts/build_kana_index.py <都道府県コード及び市区町村コード.xlsx>")
    xlsx_path = sys.argv[1]

    print("■ アプリ側のDB（data-*.json）を読み込み中")
    pref_lookup, muni_lookup, db_total = load_db()
    print("  %d件（都道府県 %d / 市区町村 %d）" % (db_total, len(pref_lookup), len(muni_lookup)))

    print("■ Excelを読み込み中: %s" % xlsx_path)
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb[wb.sheetnames[0]]
    print("  シート: %s" % wb.sheetnames[0])

    kana_index = {}
    matched_keys = set()
    unmatched = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or row[1] is None:
            continue
        pref_kanji = row[1]
        muni_kanji = row[2] if len(row) > 2 else None
        pref_kana_half = row[3] if len(row) > 3 else None
        muni_kana_half = row[4] if len(row) > 4 else None

        if muni_kanji is None or str(muni_kanji).strip() == "":
            # 都道府県の行
            key = pref_lookup.get(norm(pref_kanji))
            if not key:
                unmatched.append("都道府県: %s" % pref_kanji)
                continue
            reading = to_hiragana(pref_kana_half)
        else:
            # 市区町村の行
            key = muni_lookup.get((norm(pref_kanji), norm(muni_kanji)))
            if not key:
                unmatched.append("市区町村: %s %s" % (pref_kanji, muni_kanji))
                continue
            reading = to_hiragana(muni_kana_half)

        if not reading:
            unmatched.append("読み仮名が空: %s" % key)
            continue

        kana_index.setdefault(reading, [])
        if key not in kana_index[reading]:
            kana_index[reading].append(key)
        matched_keys.add(key)

    all_db_keys = set(pref_lookup.values()) | set(muni_lookup.values())
    missing_keys = sorted(all_db_keys - matched_keys)

    print("")
    print("突合結果: %d / %d 件 (%.1f%%)" % (len(matched_keys), db_total, len(matched_keys) / db_total * 100))
    if unmatched:
        print("Excel側で未突合（先頭20件）: %s" % ", ".join(unmatched[:20]))
    if missing_keys:
        print("DB側で読み仮名が見つからなかった自治体（先頭20件）: %s" % ", ".join(missing_keys[:20]))

    # DBの全自治体に読み仮名が付いていない場合は、Excelの列位置がずれているなど
    # 何か根本的な問題がある可能性が高いので、書き込まずに止める
    coverage = len(matched_keys) / db_total if db_total else 0
    if coverage < 0.99:
        fail(
            "突合率が%.1f%%と低すぎます。Excelの列位置や自治体名の表記ゆれ対応を確認してください。"
            "（kana-index.jsonは書き込んでいません）" % (coverage * 100)
        )

    out_path = os.path.join(ROOT, "kana-index.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(kana_index, f, ensure_ascii=False, separators=(",", ":"))

    print("")
    print("kana-index.json に %d種類の読み仮名（%d自治体分）を書き込みました" % (len(kana_index), len(matched_keys)))


if __name__ == "__main__":
    main()

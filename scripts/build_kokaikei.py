# -*- coding: utf-8 -*-
"""
総務省「統一的な基準による財務書類に関する調」の指標一覧Excel（市町村・都道府県）から
9つの公会計指標を読み取り、kokaikei.json を作る/更新する。

財政データ（data-*.json）とは完全に別ファイルで管理する。

使い方（ローカルまたは GitHub Actions から）:
    python scripts/build_kokaikei.py <市町村指標一覧.xlsx> <都道府県指標一覧.xlsx>

シートは "R{当年}指標" "R{当年-1}指標" の2枚が1つのExcelに入っている想定
（総務省の配布形式がそうなっているため）。当年分を主値、1年前分を _r1 に入れる。

次回以降、新しい年度のExcelを総務省サイトからダウンロードして同じ2引数で
再実行すれば、主値が新年度に、旧主値が _r1 に、旧_r1が_r2に…と自動でスライドする
（update_fiscal_data.py / fetch_sfs.py と同じ考え方）。
"""
import json
import os
import re
import sys

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

DATA_FILES = [
    "data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
    "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json",
]

# 指標コード: (説明, 市町村シートの「当該値」列, 都道府県シートの「当該値」列)
# 列番号は1始まり（openpyxl準拠）
INDICATORS = [
    ("ka1", "住民一人当たり資産額（万円）", 7, 6),
    ("ka2", "歳入額対資産比率（年）", 10, 9),
    ("ka3", "有形固定資産減価償却率（％）", 13, 12),
    ("ka4", "純資産比率（％）", 16, 15),
    ("ka5", "将来世代負担比率（％）", 19, 18),
    ("ka6", "住民一人当たり行政コスト（万円）", 22, 21),
    ("ka7", "住民一人当たり負債額（万円）", 25, 24),
    ("ka8", "業務・投資活動収支（百万円）", 28, 27),
    ("ka9", "受益者負担比率（％）", 31, 30),
]


def norm(name):
    """自治体名の表記ゆれを吸収する（他のスクリプトと共通のルール）。"""
    if name is None:
        return ""
    return (str(name).replace("ヶ", "ケ").replace("ヵ", "カ")
                      .replace("\u3000", "").strip())


def fail(msg):
    print("NG: " + msg)
    sys.exit(1)


def find_sheets(wb):
    """"R5指標" "R4指標" のように並んでいる2枚を、新しい方・古い方の順で返す。"""
    sheets = [s for s in wb.sheetnames if re.match(r"^R\d+指標$", s)]
    if len(sheets) < 2:
        fail("シート名が想定と違います（R◯指標が2枚見つかりません）: %s" % wb.sheetnames)
    sheets.sort(key=lambda s: -int(re.search(r"\d+", s).group()))
    return sheets[0], sheets[1]  # 新しい方, 古い方


def read_muni_sheet(ws):
    """市町村シートを {(都道府県, 自治体名): {code: 値, "grp": 類団区分}} にする。"""
    out = {}
    for row in ws.iter_rows(min_row=5, values_only=True):
        if not row or row[1] is None or row[2] is None:
            continue
        pref = norm(row[1])
        name = norm(row[2])
        vals = {}
        for code, _label, muni_col, _pref_col in INDICATORS:
            v = row[muni_col - 1]
            if isinstance(v, (int, float)):
                vals[code] = round(v, 1)
        grp = row[3]
        if grp:
            vals["grp"] = str(grp).strip()
        out[(pref, name)] = vals
    return out


def read_pref_sheet(ws):
    """都道府県シートを {都道府県名: {code: 値, "grp": 類団区分}} にする。"""
    out = {}
    for row in ws.iter_rows(min_row=5, values_only=True):
        if not row or row[1] is None:
            continue
        pref = norm(row[1])
        vals = {}
        for code, _label, _muni_col, pref_col in INDICATORS:
            v = row[pref_col - 1]
            if isinstance(v, (int, float)):
                vals[code] = round(v, 1)
        grp = row[2]
        if grp:
            vals["grp"] = str(grp).strip()
        out[pref] = vals
    return out


def slide_and_set(entry, code, new_value, max_total=8):
    """他の履歴フィールドと同じ考え方でスライドする。"""
    old_main = entry.get(code)
    if new_value is not None and old_main is not None and new_value == old_main:
        return
    n = 0
    while (code + "_r" + str(1 + n)) in entry:
        n += 1
    if n < max_total - 1:
        if old_main is not None:
            entry[code + "_r" + str(1 + n)] = old_main
    else:
        for i in range(1, n):
            entry[code + "_r" + str(i)] = entry.get(code + "_r" + str(i + 1))
        if old_main is not None:
            entry[code + "_r" + str(n)] = old_main
    if new_value is not None:
        entry[code] = new_value


def main():
    if len(sys.argv) < 3:
        fail("使い方: python scripts/build_kokaikei.py <市町村指標一覧.xlsx> <都道府県指標一覧.xlsx>")
    muni_path, pref_path = sys.argv[1], sys.argv[2]

    print("■ 市町村指標一覧を読み込み中")
    wb_m = openpyxl.load_workbook(muni_path, data_only=True)
    new_sheet_m, old_sheet_m = find_sheets(wb_m)
    print("  新しい方のシート: %s / 古い方のシート: %s" % (new_sheet_m, old_sheet_m))
    muni_new = read_muni_sheet(wb_m[new_sheet_m])
    muni_old = read_muni_sheet(wb_m[old_sheet_m])
    print("  %d件（新）/ %d件（旧）" % (len(muni_new), len(muni_old)))

    print("■ 都道府県指標一覧を読み込み中")
    wb_p = openpyxl.load_workbook(pref_path, data_only=True)
    new_sheet_p, old_sheet_p = find_sheets(wb_p)
    pref_new = read_pref_sheet(wb_p[new_sheet_p])
    pref_old = read_pref_sheet(wb_p[old_sheet_p])
    print("  %d件（新）/ %d件（旧）" % (len(pref_new), len(pref_old)))

    # --- アプリ側の自治体名リストを読み込み、突き合わせながら kokaikei.json を組み立てる ---
    kokaikei = {}
    total = matched = 0
    missing = []
    for fn in DATA_FILES:
        path = os.path.join(ROOT, fn)
        if not os.path.exists(path):
            fail(fn + " が見つかりません")
        db = json.load(open(path, encoding="utf-8"))
        for k, v in db.items():
            total += 1
            p = v.get("p")
            base_name = norm(re.sub(r"（[^）]*）$", "", k))
            is_pref = (p == k)
            if is_pref:
                new_vals = pref_new.get(base_name)
                old_vals = pref_old.get(base_name)
            else:
                new_vals = muni_new.get((p, base_name))
                old_vals = muni_old.get((p, base_name))
            has_any = new_vals and any(
                new_vals.get(code) is not None for code, _l, _mc, _pc in INDICATORS
            )
            if not has_any:
                missing.append(k)
                continue
            entry = kokaikei.setdefault(k, {})
            for code, _label, _mc, _pc in INDICATORS:
                nv = new_vals.get(code)
                ov = old_vals.get(code) if old_vals else None
                if nv is not None:
                    entry[code] = nv
                if ov is not None and code + "_r1" not in entry:
                    entry[code + "_r1"] = ov
            if new_vals.get("grp"):
                entry["grp"] = new_vals["grp"]
            matched += 1

    # --- 類団区分ごとの中央値（規模で変わりやすい①⑥⑦⑧向け） ---
    GROUP_CODES = ["ka1", "ka6", "ka7", "ka8"]

    def median(vals):
        s = sorted(vals)
        n = len(s)
        if n == 0:
            return None
        mid = n // 2
        return round((s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2), 1)

    group_medians = {"muni": {}, "pref": {}}
    for fn in DATA_FILES:
        db = json.load(open(os.path.join(ROOT, fn), encoding="utf-8"))
        for k, v in db.items():
            entry = kokaikei.get(k)
            if not entry or "grp" not in entry:
                continue
            bucket = "pref" if v.get("p") == k else "muni"
            grp = entry["grp"]
            g = group_medians[bucket].setdefault(grp, {c: [] for c in GROUP_CODES})
            for c in GROUP_CODES:
                if c in entry:
                    g[c].append(entry[c])
    for bucket in group_medians:
        for grp, vals in group_medians[bucket].items():
            group_medians[bucket][grp] = {
                c: median(v) for c, v in vals.items() if v
            }
            group_medians[bucket][grp]["_n"] = max(
                (len(v) for v in vals.values()), default=0
            )

    kokaikei["_groupMedians"] = group_medians

    out_path = os.path.join(ROOT, "kokaikei.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(kokaikei, f, ensure_ascii=False, separators=(",", ":"))

    print("")
    print("突合結果: %d / %d 件 (%.1f%%)" % (matched, total, matched / total * 100))
    if missing:
        print("未取得（先頭20件）: %s" % ", ".join(missing[:20]))
    print("kokaikei.json に %d件 書き込みました（類団区分ごとの中央値を含む）" % len(kokaikei))


if __name__ == "__main__":
    main()

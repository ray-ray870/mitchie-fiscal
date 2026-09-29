# -*- coding: utf-8 -*-
"""
財政調整基金の履歴の作り直し（使い捨て・2026-09-29）

財政調整基金(r)の履歴が1年分欠けている市町村（令和元〜4年度の4年分しかない197団体と、
履歴が1件もない大月町・日之影町）について、総務省「基金残高等一覧」の公式Excel（市区町村、
令和元年度〜令和6年度の6年分）から r_r1〜r_r5 と r（令和6年度）を作り直す。
原因：年次更新の「前年と同じ値なら履歴を送らない」重複防止で、1年分が記録されなかったと考えられる。

安全のための仕組み
  ・ExcelのURLは、総務省の一覧ページ(PAGE)に実際に載っているかを確認してから使う。
  ・列の位置と単位は、履歴が5年分そろっている市町村の値と一番よく一致する列・単位を探して決める
    （9割以上一致しなければ止まる）。
  ・対象の市町村の既存の値が、公式データのどの年とも合わない場合は、別の行を読んだとみなして止まる。
  ・書き換えるのは preview/data-*.json の対象市町村の r / r_r1〜r_r5 だけ。
  ・参考として、履歴が5年分そろっている市町村が公式データと何件食い違っているかも表示する（書き換えはしない）。

実行は GitHub Actions の「財政調整基金の履歴の作り直し」から。
"""
import collections
import io
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "preview"
DATA_FILES = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
              "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]

PAGE = "https://www.soumu.go.jp/iken/kikinzandaka.html"
# 令和k年度の市区町村のExcel（k=6 がアプリの最新値 r）
MUNI_FILES = {
    1: "https://www.soumu.go.jp/main_content/000810024.xlsx",
    2: "https://www.soumu.go.jp/main_content/000810030.xlsx",
    3: "https://www.soumu.go.jp/main_content/000877373.xlsx",
    4: "https://www.soumu.go.jp/main_content/000954018.xlsx",
    5: "https://www.soumu.go.jp/main_content/001010452.xlsx",
    6: "https://www.soumu.go.jp/main_content/001066238.xlsx",
}
LATEST = 6
FULL_KEYS = [1, 2, 3, 4, 5]
SCALES = [1 / 100, 1 / 1000, 1 / 10000, 1 / 100000, 1 / 1000000, 1 / 100000000]

PREFS = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
         "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
         "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
         "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
         "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]
UA = {"User-Agent": "Mozilla/5.0 (mitchie-fiscal data update)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read()


def norm_name(v):
    s = re.sub(r"[\s　]", "", str(v))
    s = re.sub(r"（.*?）|\(.*?\)", "", s)
    s = re.sub(r"^.+?郡(?=.{2,}$)", "", s)  # 郡名を外す（上郡町のような町名は外さない）
    return s.replace("檮", "梼").replace("惠", "恵").replace("ヶ", "ケ")


def to_num(v):
    try:
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return None
        s = str(v).replace(",", "").strip()
        if s in ("", "-", "－", "―"):
            return None
        return float(s)
    except ValueError:
        return None


def index_rows(url):
    """(都道府県, 正規化した名前) -> 行 の辞書を作る。同じキーが2回出たらNone（あいまい）にする。"""
    content = fetch(url)
    engine = "xlrd" if url.lower().endswith(".xls") else "openpyxl"
    rows = pd.read_excel(io.BytesIO(content), header=None, dtype=object, engine=engine).values.tolist()
    idx, cur_pref = {}, None
    for row in rows:
        for v in row[:6]:
            s = re.sub(r"[\s　]", "", str(v))
            if s in PREFS:
                cur_pref = s
                break
        if not cur_pref:
            continue
        names = set()
        for v in row[:8]:
            if isinstance(v, str):
                n = norm_name(v)
                if n and n not in PREFS and re.search(r"[市町村区]$", n):
                    names.add(n)
        for n in names:
            key = (cur_pref, n)
            idx[key] = None if key in idx else row
    return idx


def main():
    page = fetch(PAGE).decode("utf-8", errors="ignore")
    for k, url in MUNI_FILES.items():
        if url.rsplit("/", 1)[-1] not in page:
            print(f"❌ 令和{k}年度のExcel({url})が総務省の一覧ページに見つかりません")
            sys.exit(1)
    print("✅ 6年分のExcelのURLが総務省の一覧ページに載っていることを確認")

    dbs = {f: json.loads((DATA_DIR / f).read_text(encoding="utf-8")) for f in DATA_FILES}
    entries = []
    for f, d in dbs.items():
        for n, e in d.items():
            if n == e.get("p"):
                continue  # 都道府県は対象外（別ファイル）
            ks = sorted(int(m.group(1)) for k in e for m in [re.fullmatch(r"r_r(\d+)", k)] if m)
            entries.append((f, n, e, ks))
    refs = [(f, n, e) for f, n, e, ks in entries if ks == FULL_KEYS and e.get("r") is not None]
    targets = [(f, n, e) for f, n, e, ks in entries if ks != FULL_KEYS]
    print(f"対象：{len(targets)}団体（履歴が5年分そろっている基準の団体：{len(refs)}）")

    def ref_val(e, k):
        return e.get("r") if k == LATEST else e.get(f"r_r{k}")

    official = {}  # (都道府県, 名前) -> {k: 億円（小数1桁に丸めた値）}
    raw = {}       # (都道府県, 名前) -> {k: 億円（丸める前の値）}。照合は丸める前の値で行う
    # 照合の許容幅：アプリの値は小数1桁に丸めてあり、4.85億円が4.8にも4.9にもなりうるため、
    # 丸める前の値と比べて0.1億円未満のずれは同じ値とみなす（2026-09-29：北竜町で判明）
    TOL = 0.1
    mismatch_full = collections.Counter()
    for k in range(1, LATEST + 1):
        idx = index_rows(MUNI_FILES[k])
        # --- 列と単位を、基準の団体との一致率で決める ---
        tally, tried = collections.Counter(), 0
        for f, n, e in refs:
            row = idx.get((e["p"], norm_name(n)))
            rv = ref_val(e, k)
            if row is None or rv is None:
                continue
            tried += 1
            for ci, v in enumerate(row):
                x = to_num(v)
                if x is None:
                    continue
                for sc in SCALES:
                    if abs(round(x * sc, 1) - rv) < 0.051:
                        tally[(ci, sc)] += 1
        if not tally or tried == 0:
            print(f"❌ 令和{k}年度：基準の団体の値と一致する列が見つかりません")
            sys.exit(1)
        (col, sc), hits = tally.most_common(1)[0]
        rate = hits / tried
        print(f"令和{k}年度：列={col} 単位=×{sc:g} 一致率={rate:.1%}（{hits}/{tried}団体）")
        if rate < 0.9:
            print(f"❌ 令和{k}年度：一致率が低すぎます（9割未満）。列や単位の判定を確認してください")
            sys.exit(1)
        for key, row in idx.items():
            if row is None:
                continue
            x = to_num(row[col])
            if x is not None:
                official.setdefault(key, {})[k] = round(x * sc, 1)
                raw.setdefault(key, {})[k] = x * sc
        for f, n, e in refs:
            o = raw.get((e["p"], norm_name(n)), {}).get(k)
            rv = ref_val(e, k)
            if o is not None and rv is not None and abs(o - rv) >= TOL:
                mismatch_full[k] += 1

    # --- 対象の団体を作り直す ---
    lines = ["| 団体 | 変更前（R1〜の履歴 → 最新） | 公式（R1〜R5 → R6） |", "|---|---|---|"]
    changed = set()
    main_diff = []
    for f, n, e in targets:
        o = official.get((e["p"], norm_name(n)))
        ro = raw.get((e["p"], norm_name(n)), {})
        if not o or any(o.get(k) is None for k in range(1, LATEST + 1)):
            print(f"❌ {e['p']}{n}：公式データに6年分そろっていません（{o}）")
            sys.exit(1)
        olds = [v for key, v in e.items() if (key == "r" or re.fullmatch(r"r_r\d+", key)) and v is not None]
        for old in olds:
            if not any(abs(old - ro[k]) < TOL for k in range(1, LATEST + 1)):
                print(f"❌ {e['p']}{n}：既存の値{old}が公式データのどの年（{o}）とも合いません。別の行を読んだ可能性があります")
                sys.exit(1)
        before = [e.get(f"r_r{k}") for k in range(1, 6)] + [e.get("r")]
        if e.get("r") is not None and abs(e["r"] - ro[LATEST]) >= TOL:
            main_diff.append(n)
        for key in [x for x in e if re.fullmatch(r"r_r\d+", x)]:
            del e[key]
        for k in range(1, LATEST):
            e[f"r_r{k}"] = o[k]
        e["r"] = o[LATEST]
        changed.add(f)
        lines.append(f"| {e['p']}{n} | {before[:-1]} → {before[-1]} | {[o[k] for k in range(1, 6)]} → {o[6]} |")

    for f in changed:
        (DATA_DIR / f).write_text(json.dumps(dbs[f], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    report = [f"## 財政調整基金の履歴を作り直しました（preview・{len(targets)}団体）", "",
              f"- 最新値(令和6年度)が変わった団体：{len(main_diff)}件 {main_diff[:20]}",
              f"- 【参考・書き換えなし】履歴が5年分ある{len(refs)}団体のうち、公式データと食い違う件数（年度別）："
              f"{dict(sorted(mismatch_full.items()))}", "", "<details><summary>団体ごとの変更内容</summary>", ""] + lines + ["", "</details>"]
    text = "\n".join(report)
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


if __name__ == "__main__":
    main()

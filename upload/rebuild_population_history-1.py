# -*- coding: utf-8 -*-
"""
人口履歴の作り直し（使い捨て・2026-09-29）

令和8年のデータが欠けていた／履歴が崩れていた8町村について、総務省「住民基本台帳に
基づく人口、人口動態及び世帯数」の公式Excel（総計＝日本人＋外国人、市区町村別）を
令和元年〜令和8年の8年分ダウンロードし、pop / g の履歴をまるごと作り直す。

  対象：梼原町・大月町（高知）、上郡町（兵庫）、須恵町（福岡）、西米良村・日之影町（宮崎）、
        喜茂別町・泊村（北海道）

安全のための仕組み
  ・Excelの列の位置は年によって違う可能性があるため、固定の列番号は使わない。
    データが正しいとわかっている基準の市（姶良市・霧島市・鹿児島市）の値と一致する列を
    「人口」「増減率」の列として探す。見つからなければ何も書き換えずに止まる。
  ・作り直した結果、人口と増減率が合わない町村があれば、何も書き換えずに止まる。
  ・書き換えるのは preview/data-*.json の8町村だけ。

実行は GitHub Actions の「人口履歴の作り直し（8町村）」から。
"""
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "preview"
DATA_FILES = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
              "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]

# 各年の報道資料ページ（令和k年1月1日現在）。k=1 は平成31年1月1日現在。
PRESS_PAGES = {
    1: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000193.html",
    2: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000220.html",
    3: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000233.html",
    4: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000259.html",
    5: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000289.html",
    6: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000316.html",
    7: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000389.html",
    8: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000428.html",
}
LATEST = 8  # 令和8年＝アプリの最新値（pop / g）

TARGETS = [("梼原町", "高知県"), ("大月町", "高知県"), ("上郡町", "兵庫県"), ("須恵町", "福岡県"),
           ("西米良村", "宮崎県"), ("日之影町", "宮崎県"), ("喜茂別町", "北海道"), ("泊村", "北海道")]
REFS = [("姶良市", "鹿児島県"), ("霧島市", "鹿児島県"), ("鹿児島市", "鹿児島県")]

PREFS = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
         "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
         "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
         "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
         "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]
NORTHERN_TERRITORY_DISTRICTS = ("国後郡", "択捉郡", "色丹郡", "紗那郡", "蕊取郡")
UA = {"User-Agent": "Mozilla/5.0 (mitchie-fiscal data update)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def find_excel_url(k):
    raw = fetch(PRESS_PAGES[k])
    html = None
    for enc in ("utf-8", "cp932"):
        try:
            html = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    links = re.findall(r'<a[^>]+href="([^"]+\.xlsx?)"[^>]*>(.*?)</a>', html, flags=re.S | re.I)
    cands = []
    for href, text in links:
        t = re.sub(r"<[^>]+>|\s", "", text)
        if "市区町村別" in t and "人口" in t and "世帯数" in t and "年齢" not in t \
                and "日本人" not in t and "外国人" not in t:
            cands.append((href, t))
    if not cands:
        print(f"❌ 令和{k}年：総計・市区町村別のExcelリンクが見つかりません。ページ内のExcelリンク一覧：")
        for href, text in links:
            print("   ", re.sub(r"<[^>]+>|\s", "", text), href)
        sys.exit(1)
    cands.sort(key=lambda c: 0 if "総計" in c[1] else 1)
    href, text = cands[0]
    if href.startswith("/"):
        href = "https://www.soumu.go.jp" + href
    print(f"令和{k}年：{text}\n    {href}")
    return href


def norm_name(v):
    s = re.sub(r"[\s　]", "", str(v))
    if s.startswith(NORTHERN_TERRITORY_DISTRICTS):
        return None  # 北方領土の同名村（国後郡泊村など）と衝突させない
    # 郡名を外す（例：赤穂郡上郡町→上郡町）。「上郡町」のように町名自体に「郡」を含む場合は
    # 外すと「町」だけになってしまうため、郡の後ろに2文字以上残るときだけ外す。
    s = re.sub(r"^.+?郡(?=.{2,}$)", "", s)
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


def load_rows(url):
    content = fetch(url)
    engine = "xlrd" if url.lower().endswith(".xls") else "openpyxl"
    df = pd.read_excel(io.BytesIO(content), header=None, dtype=object, engine=engine)
    return df.values.tolist()


def find_row(rows, name, pref):
    want = norm_name(name)
    cur_pref, hits = None, []
    for row in rows:
        for v in row[:4]:
            s = re.sub(r"[\s　]", "", str(v))
            if s in PREFS:
                cur_pref = s
                break
        if cur_pref != pref:
            continue
        for v in row:
            if isinstance(v, str) and norm_name(v) == want:
                hits.append(row)
                break
    return hits


def main():
    dbs = {f: json.loads((DATA_DIR / f).read_text(encoding="utf-8")) for f in DATA_FILES}
    all_entries = {}
    for f, d in dbs.items():
        for n, e in d.items():
            all_entries[n] = (f, e)

    def ref_pop(e, k):
        return e.get("pop") if k == LATEST else e.get(f"pop_r{k}")

    def ref_g(e, k):
        # 増減率の基準値：前年の人口がある年は人口から計算（小数1桁で保存された年があるため）
        p0, p1 = ref_pop(e, k - 1) if k > 1 else None, ref_pop(e, k)
        if p0 and p1:
            return (p1 - p0) / p0 * 100
        return e.get("g") if k == LATEST else e.get(f"g_r{k}")

    results = {name: {} for name, _ in TARGETS}
    for k in range(1, LATEST + 1):
        rows = load_rows(find_excel_url(k))
        # --- 基準の市で「人口」「増減率」の列を特定する ---
        pop_cols, g_cols = None, None
        for rname, rpref in REFS:
            e = all_entries[rname][1]
            hit = find_row(rows, rname, rpref)
            if len(hit) != 1:
                print(f"❌ 令和{k}年：基準の{rname}の行が{len(hit)}件見つかりました（1件のはず）")
                sys.exit(1)
            row = hit[0]
            rp, rg = ref_pop(e, k), ref_g(e, k)
            pc = {i for i, v in enumerate(row) if to_num(v) is not None and rp is not None and abs(to_num(v) - rp) < 0.5}
            gc = {i for i, v in enumerate(row) if to_num(v) is not None and rg is not None and abs(to_num(v) - rg) < 0.06}
            pop_cols = pc if pop_cols is None else pop_cols & pc
            g_cols = gc if g_cols is None else g_cols & gc
        if not pop_cols:
            print(f"❌ 令和{k}年：基準の市の人口と一致する列が見つかりません")
            sys.exit(1)
        pc = min(pop_cols)
        gc = min(g_cols) if g_cols else None
        print(f"    人口の列={pc}  増減率の列={gc if gc is not None else 'なし（人口から計算）'}")
        # --- 対象の町村 ---
        for name, pref in TARGETS:
            hit = find_row(rows, name, pref)
            if len(hit) != 1:
                print(f"❌ 令和{k}年：{pref}{name}の行が{len(hit)}件見つかりました（1件のはず）")
                sys.exit(1)
            row = hit[0]
            p = to_num(row[pc])
            g = to_num(row[gc]) if gc is not None else None
            results[name][k] = (int(round(p)) if p is not None else None, g)

    # --- 増減率が無い年は人口から計算 ---
    for name, _ in TARGETS:
        r = results[name]
        for k in range(1, LATEST + 1):
            p, g = r[k]
            if g is None and k > 1 and r[k - 1][0]:
                r[k] = (p, (p - r[k - 1][0]) / r[k - 1][0] * 100)
            if r[k][0] is None or r[k][1] is None:
                print(f"❌ {name} 令和{k}年の人口または増減率が取得できません")
                sys.exit(1)

    # --- 整合チェック（人口の変化と増減率が合うか） ---
    bad = False
    for name, _ in TARGETS:
        r = results[name]
        for k in range(2, LATEST + 1):
            calc = (r[k][0] - r[k - 1][0]) / r[k - 1][0] * 100
            if abs(calc - r[k][1]) > 0.3:
                print(f"❌ {name} 令和{k}年：人口{r[k][0]}と増減率{r[k][1]:.3f}%が合いません（計算上{calc:.2f}%）")
                bad = True
    if bad:
        sys.exit(1)

    # --- 既存データとの照合（正しい町村の行を読んだかの確認） ---
    # 既存データは年の位置が1年ずれて入っていることがある（例：梼原町の pop_r6 が実は令和7年の値）。
    # そのため「同じ年」ではなく、既存の人口の値それぞれが、公式データのどこかの年と一致するかで確かめる。
    for name, _ in TARGETS:
        e = all_entries[name][1]
        official = [results[name][k][0] for k in range(1, LATEST + 1)]
        olds = [v for key, v in e.items() if (key == "pop" or re.fullmatch(r"pop_r\d+", key)) and v]
        for old in olds:
            if not any(abs(o - old) / old <= 0.005 for o in official):
                print(f"❌ {name}：既存の人口{old}が公式データのどの年（{official}）とも合いません。別の行を読んだ可能性があります")
                sys.exit(1)

    # --- 書き換え ---
    summary = ["| 町村 | 令和元年 | 令和7年 | 令和8年 | 前年比 | 変更前の最新 |", "|---|---|---|---|---|---|"]
    changed_files = set()
    for name, pref in TARGETS:
        f, e = all_entries[name]
        if e.get("p") != pref:
            print(f"❌ {name}：データの都道府県({e.get('p')})が想定({pref})と違います")
            sys.exit(1)
        before = f"{e.get('pop')}人 / {e.get('g')}%"
        for key in [k for k in e if re.fullmatch(r"(pop|g)_r\d+", k)]:
            del e[key]
        r = results[name]
        for k in range(1, LATEST):
            e[f"pop_r{k}"] = r[k][0]
            e[f"g_r{k}"] = round(r[k][1], 3)
        e["pop"] = r[LATEST][0]
        e["g"] = round(r[LATEST][1], 3)
        changed_files.add(f)
        summary.append(f"| {pref}{name} | {r[1][0]:,}人 | {r[7][0]:,}人 | {r[8][0]:,}人 | {r[8][1]:+.3f}% | {before} |")

    for f in changed_files:
        (DATA_DIR / f).write_text(json.dumps(dbs[f], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    text = "\n".join(summary)
    print("\n" + text)
    summary_path = __import__("os").environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as fp:
            fp.write("## 人口履歴を作り直しました（preview）\n\n" + text + "\n")


if __name__ == "__main__":
    main()

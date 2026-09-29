# -*- coding: utf-8 -*-
"""
財政指標4項目の履歴の作り直し（使い捨て・2026-09-29）

財政力指数 f・経常収支比率 x・実質公債費比率 d・将来負担比率 u の履歴（_r1〜_r5）が、多くの団体で
1年ずれていた（2026-09-29の事前診断で判明）：
    アプリの R1 … 令和5年度の値のコピー（約85%）
    アプリの R2〜R4 … 実際は令和元〜3年度の値
    令和4年度 … どこにも入っていない
    アプリの R5・最新 … 正しい（公式と100%一致）
全市町村・全都道府県について、総務省「主要財政指標一覧」（令和元〜5年度）から _r1〜_r5 を作り直す。
最新値（令和6年度）は正しいので変更しない。

安全のための仕組み
  ・列は見出しの文字（財政力指数など）で探す（アプリの履歴そのものが間違っているため）。
  ・次のどれかに当てはまったら、何も書き換えずに止まる：
      令和5年度の公式値とアプリのR5の一致率が95%未満／令和6年度と最新値の一致率が95%未満
      令和元〜3年度の公式値と、アプリの1年ずれた欄（R2〜R4）の一致率が75%未満
      令和4年度の列の位置が、令和3年度とも令和5年度とも違う
実行は GitHub Actions の「財政指標の履歴の作り直し」から。
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
FISCAL_PAGES = {
    1: "https://www.soumu.go.jp/iken/zaisei/R01_chiho.html",
    2: "https://www.soumu.go.jp/iken/zaisei/R02_chiho.html",
    3: "https://www.soumu.go.jp/iken/zaisei/R03_chiho.html",
    4: "https://www.soumu.go.jp/iken/zaisei/R04_chiho.html",
    5: "https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000131.html",
    6: "https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000135.html",
}
LATEST = 6
HEAD = {"f": "財政力指数", "x": "経常収支比率", "d": "実質公債費比率", "u": "将来負担比率"}
TOL = {"f": 0.006, "x": 0.06, "d": 0.06, "u": 0.06}
DEC = {"f": 3, "x": 1, "d": 1, "u": 1}

PREFS = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
         "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
         "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
         "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
         "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]
NORTHERN_TERRITORY_DISTRICTS = ("国後郡", "択捉郡", "色丹郡", "紗那郡", "蕊取郡")
UA = {"User-Agent": "Mozilla/5.0 (mitchie-fiscal data update)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def pick(url, must, label):
    raw = fetch(url)
    html = raw.decode("utf-8", errors="ignore")
    if "財政" not in html:
        html = raw.decode("cp932", errors="ignore")
    links = []
    for href, text in re.findall(r'<a[^>]+href="([^"]+\.xlsx?)"[^>]*>(.*?)</a>', html, flags=re.S | re.I):
        t = re.sub(r"<[^>]+>|\s", "", text)
        links.append(("https://www.soumu.go.jp" + href if href.startswith("/") else href, t))
    c = [h for h, t in links if must in t]
    if len(c) != 1:
        print(f"❌ {label}：「{must}」のExcelリンクが{len(c)}件（{url}）")
        for h, t in links:
            print("   ", t, h)
        sys.exit(1)
    return c[0]


def rows_of(url):
    engine = "xlrd" if url.lower().endswith(".xls") else "openpyxl"
    return pd.read_excel(io.BytesIO(fetch(url)), header=None, dtype=object, engine=engine).values.tolist()


def norm_name(v):
    s = re.sub(r"[\s　]", "", str(v))
    if s.startswith(NORTHERN_TERRITORY_DISTRICTS):
        return None
    s = re.sub(r"（.*?）|\(.*?\)", "", s)
    s = re.sub(r"^.+?郡(?=.{2,}$)", "", s)
    return s.replace("檮", "梼").replace("惠", "恵").replace("ヶ", "ケ")


def to_num(v):
    try:
        if v is None or (isinstance(v, float) and pd.isna(v)):
            return None
        s = str(v).replace(",", "").strip()
        if s in ("", "-", "－", "―", "…"):
            return None
        return float(s)
    except ValueError:
        return None


def header_cols(rows, label):
    cols = {}
    for row in rows[:20]:
        for ci, v in enumerate(row):
            s = re.sub(r"[\s　]", "", str(v))
            for p, h in HEAD.items():
                if p not in cols and h in s:
                    cols[p] = ci
    if len(cols) != 4:
        print(f"❌ {label}：見出しが見つからない項目があります（見つかった列：{cols}）")
        sys.exit(1)
    return cols


def index_muni(rows):
    idx, cur = {}, None
    for row in rows:
        cells = [re.sub(r"[\s　]", "", str(v)) for v in row]
        for s in cells:
            if s in PREFS:
                cur = s
                break
        if not cur:
            continue
        for v in row:
            if isinstance(v, str):
                n = norm_name(v)
                if n and n not in PREFS and len(n) <= 10 and re.search(r"[市町村区]$", n):
                    key = (cur, n)
                    idx[key] = None if key in idx else row
    return idx


def index_pref(rows):
    idx = {}
    for row in rows:
        for v in row[:4]:
            s = re.sub(r"[\s　]", "", str(v))
            if s in PREFS and s not in idx:
                idx[s] = row
    return idx


def main():
    dbs = {f: json.loads((DATA_DIR / f).read_text(encoding="utf-8")) for f in DATA_FILES}
    ents = []
    for f, d in dbs.items():
        for n, e in d.items():
            is_pref = n == e.get("p")
            ents.append((f, n, e, is_pref, e["p"] if is_pref else (e["p"], norm_name(n))))

    official = collections.defaultdict(dict)  # (is_pref, key, p) -> {k: 値}
    cols_by_year = {}
    for k in range(1, LATEST + 1):
        for is_pref, must, indexer in ((False, "全市町村の主要財政指標", index_muni), (True, "全都道府県の主要財政指標", index_pref)):
            label = f"令和{k}年度 {'都道府県' if is_pref else '市町村'}"
            rows = rows_of(pick(FISCAL_PAGES[k], must, label))
            cols = header_cols(rows, label)
            cols_by_year[(k, is_pref)] = cols
            print(f"{label}：列 {cols}")
            for key, row in indexer(rows).items():
                if row is None:
                    continue
                for p, ci in cols.items():
                    official[(is_pref, key, p)][k] = to_num(row[ci])

    # ---------- 安全チェック ----------
    def rate(p, k, app_slot, is_pref):
        hit = tried = 0
        for f, n, e, ip, key in ents:
            if ip != is_pref:
                continue
            o = official.get((ip, key, p), {}).get(k)
            a = e.get(p) if app_slot == "main" else e.get(f"{p}_r{app_slot}")
            if o is None or a is None:
                continue
            tried += 1
            hit += abs(o - a) < TOL[p]
        return (hit / tried if tried else 0.0), tried

    ok = True
    lines = ["| 区分 | 項目 | 公式R5→アプリR5 | 公式R6→最新 | 公式R1→アプリR2 | 公式R2→R3 | 公式R3→R4 |", "|---|---|---|---|---|---|---|"]
    for is_pref in (False, True):
        c3, c4, c5 = cols_by_year[(3, is_pref)], cols_by_year[(4, is_pref)], cols_by_year[(5, is_pref)]
        if c4 != c3 and c4 != c5:
            print(f"❌ {'都道府県' if is_pref else '市町村'}：令和4年度の列の位置が令和3年度・5年度のどちらとも違います")
            ok = False
        for p in HEAD:
            r5, _ = rate(p, 5, 5, is_pref)
            r6, _ = rate(p, 6, "main", is_pref)
            rs = [rate(p, k, k + 1, is_pref)[0] for k in (1, 2, 3)]
            lines.append(f"| {'都道府県' if is_pref else '市町村'} | {p} | {r5:.0%} | {r6:.0%} | " + " | ".join(f"{r:.0%}" for r in rs) + " |")
            if r5 < 0.95 or r6 < 0.95 or min(rs) < 0.75:
                ok = False
    check = "\n".join(["## 安全チェック（公式データとアプリの一致率）", ""] + lines)
    print(check)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if not ok:
        if sp:
            with open(sp, "a", encoding="utf-8") as fp:
                fp.write(check + "\n\n❌ チェックに通らなかったため、データは書き換えていません。\n")
        print("❌ 安全チェックに通らなかったため、データは書き換えていません")
        sys.exit(1)

    # ---------- 書き換え（_r1〜_r5。最新値はそのまま） ----------
    changed_files, n_changed, n_skipped = set(), collections.Counter(), []
    sample = []
    for f, n, e, is_pref, key in ents:
        vals = {p: official.get((is_pref, key, p), {}) for p in HEAD}
        if any(not all(k in vals[p] for k in range(1, 6)) for p in HEAD) or \
                any(vals[p].get(k) is None for p in ("f", "x", "d") for k in range(1, 6)):
            n_skipped.append(n)
            continue
        before = {p: [e.get(f"{p}_r{k}") for k in range(1, 6)] for p in HEAD}
        for p in HEAD:
            for kk in [x for x in e if re.fullmatch(p + r"_r\d+", x)]:
                del e[kk]
            for k in range(1, 6):
                v = vals[p][k]
                e[f"{p}_r{k}"] = None if v is None else round(v, DEC[p])
            after = [e.get(f"{p}_r{k}") for k in range(1, 6)]
            if after != before[p]:
                n_changed[p] += 1
        changed_files.add(f)
        if n in ("姶良市", "大月町", "東京都"):
            sample.append(f"| {n} | 財政力指数 | {before['f']} | {[e.get(f'f_r{k}') for k in range(1, 6)]} |")

    for f in changed_files:
        (DATA_DIR / f).write_text(json.dumps(dbs[f], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    text = "\n".join([check, "", "## 財政指標の履歴を作り直しました（preview）", "",
                      f"- 履歴が変わった団体数：{dict(n_changed)}",
                      f"- 公式データが6年分そろわず、変更しなかった団体：{len(n_skipped)}件 {n_skipped[:20]}", "",
                      "| 団体 | 項目 | 変更前（R1〜R5） | 変更後 |", "|---|---|---|---|"] + sample)
    print(text[len(check):])
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


if __name__ == "__main__":
    main()

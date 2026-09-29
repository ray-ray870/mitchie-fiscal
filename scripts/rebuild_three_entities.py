# -*- coding: utf-8 -*-
"""
3団体の財政データの履歴の作り直し（使い捨て・2026-09-29）

  大月町（高知）・日之影町（宮崎）：財政力指数 f・経常収支比率 x・実質公債費比率 d・将来負担比率 u、
      歳出 eo・歳入 ei、教育費比率 edu、子ども1人当たり投資額 ch の履歴が欠けている
  新発田市（新潟）：子ども1人当たり投資額 ch の履歴が1年分欠けている

総務省の公式Excel（令和元年度〜令和6年度）から、上の項目の履歴と最新値を作り直す。

  f/x/d/u … 主要財政指標一覧「全市町村の主要財政指標」
  eo/ei   … 市町村別決算状況調「概況」（都市別・町村別）
  edu     … 目的別歳出内訳の教育費 ÷ 歳出総額
  ch      … （目的別歳出内訳の児童福祉費＋教育費）÷ 18歳未満人口 × 0.1
             18歳未満人口は住民基本台帳の年齢階級別人口（令和k年度 ↔ 令和k+1年1月1日）で、
             0〜4歳＋5〜9歳＋10〜14歳＋15〜19歳×3/5（年次更新スクリプトと同じ計算）

安全のための仕組み
  ・各年度のページからExcelを探し、列の位置・単位は、データがそろっている市町村（基準）の値と
    一番よく一致するものを選ぶ。9割未満しか一致しなければ止まる。
  ・対象の団体の既存の値が、公式データのどの年とも合わなければ止まる。
  ・書き換えるのは preview/data-*.json の、上の3団体の上の項目だけ。

実行は GitHub Actions の「3団体の財政データの作り直し」から。
"""
import collections
import io
import json
import os
import random
import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "preview"
DATA_FILES = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
              "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]

FISCAL_PAGES = {  # 主要財政指標一覧（令和k年度）
    1: "https://www.soumu.go.jp/iken/zaisei/R01_chiho.html",
    2: "https://www.soumu.go.jp/iken/zaisei/R02_chiho.html",
    3: "https://www.soumu.go.jp/iken/zaisei/R03_chiho.html",
    4: "https://www.soumu.go.jp/iken/zaisei/R04_chiho.html",
    5: "https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000131.html",
    6: "https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000135.html",
}
KESSAN_PAGES = {k: f"https://www.soumu.go.jp/iken/zaisei/r0{k}_shichouson.html" for k in range(1, 7)}
AGE_PAGES = {  # 住民基本台帳（令和k+1年1月1日現在）→ 令和k年度の子ども投資額に使う
    1: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000220.html",
    2: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000233.html",
    3: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000259.html",
    4: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000289.html",
    5: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000316.html",
    6: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000389.html",
}
LATEST = 6
TARGETS = {
    # 財政指標4項目（f/x/d/u）は rebuild_fiscal_history.py で全団体まとめて直したので、ここでは扱わない
    ("高知県", "大月町"): ["eo", "ei", "edu", "ch"],
    ("宮崎県", "日之影町"): ["eo", "ei", "edu", "ch"],
    ("新潟県", "新発田市"): ["ch"],
}
HIST_FROM = {"f": 1, "x": 1, "d": 1, "u": 1, "eo": 2, "ei": 2, "edu": 1, "ch": 1}
TOL = {"f": 0.006, "x": 0.06, "d": 0.06, "u": 0.06, "eo": 0.06, "ei": 0.06, "edu": 0.06, "ch": 0.06}

PREFS = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
         "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
         "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
         "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
         "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]
NORTHERN_TERRITORY_DISTRICTS = ("国後郡", "択捉郡", "色丹郡", "紗那郡", "蕊取郡")
UA = {"User-Agent": "Mozilla/5.0 (mitchie-fiscal data update)"}
_cache = {}


def fetch(url):
    if url not in _cache:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=120) as r:
            _cache[url] = r.read()
    return _cache[url]


def page_links(url):
    raw = fetch(url)
    html = None
    for enc in ("utf-8", "cp932"):
        try:
            html = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    out = []
    for href, text in re.findall(r'<a[^>]+href="([^"]+\.xlsx?)"[^>]*>(.*?)</a>', html, flags=re.S | re.I):
        t = re.sub(r"<[^>]+>|\s", "", text)
        if href.startswith("/"):
            href = "https://www.soumu.go.jp" + href
        out.append((href, t))
    return out


def pick(url, must, must_not=(), many=False, label=""):
    links = page_links(url)
    c = [h for h, t in links if all(m in t for m in must) and not any(n in t for n in must_not)]
    if not c or (not many and len(c) != 1):
        print(f"❌ {label}：条件{must}に合うExcelリンクが{len(c)}件（ページ：{url}）。ページ内のリンク一覧：")
        for h, t in links:
            print("   ", t, h)
        sys.exit(1)
    return c if many else c[0]


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


def rows_of(url):
    content = fetch(url)
    engine = "xlrd" if url.lower().endswith(".xls") else "openpyxl"
    return pd.read_excel(io.BytesIO(content), header=None, dtype=object, engine=engine).values.tolist()


def index_rows(urls, sex_total=False):
    """(都道府県, 名前) -> 行。sex_total=True のときは「計」の行だけ（年齢別人口用）。同じキーが2回出たらNone。"""
    idx = {}
    for url in urls:
        cur_pref = None
        for row in rows_of(url):
            cells = [re.sub(r"[\s　]", "", str(v)) for v in row]
            for s in cells:
                if s in PREFS:
                    cur_pref = s
                    break
            if not cur_pref:
                continue
            if sex_total and "計" not in cells:
                continue
            names = set()
            for v in row:
                if isinstance(v, str):
                    n = norm_name(v)
                    if n and n not in PREFS and len(n) <= 10 and re.search(r"[市町村区]$", n):
                        names.add(n)
            for n in names:
                key = (cur_pref, n)
                idx[key] = None if key in idx else row
    return idx


def best(tally, tried, label):
    if not tally or not tried:
        print(f"❌ {label}：基準の団体と一致する列が見つかりません")
        sys.exit(1)
    key, hits = tally.most_common(1)[0]
    rate = hits / tried
    print(f"   {label}：{key} 一致率={rate:.1%}（{hits}/{tried}）")
    if rate < 0.9:
        print(f"❌ {label}：一致率が9割未満です")
        sys.exit(1)
    return key


def main():
    dbs = {f: json.loads((DATA_DIR / f).read_text(encoding="utf-8")) for f in DATA_FILES}
    ents = []
    for f, d in dbs.items():
        for n, e in d.items():
            if n != e.get("p"):
                ents.append((f, n, e, (e["p"], norm_name(n))))
    tkeys = set(TARGETS)
    found = {k for *_, k in ents if k in tkeys}
    if found != tkeys:
        print(f"❌ 対象の団体がデータに見つかりません：{tkeys - found}")
        sys.exit(1)

    def hist(e, p, k):
        return e.get(p) if k == LATEST else e.get(f"{p}_r{k}")

    def full(e, p):
        return all(f"{p}_r{k}" in e for k in range(HIST_FROM[p], LATEST)) and e.get(p) is not None

    refs = {p: [(n, e, key) for f, n, e, key in ents if key not in tkeys and full(e, p)] for p in TOL}
    # ---------- 事前診断：公式の各年度が、アプリのどの年の値と一致するか ----------
    # （2026-09-29：令和元年度の財政力指数が24%しか一致しなかったため追加。年が1つずれて保存されている
    #   可能性などを、データを書き換える前に確かめる）
    def col_rate(idx, p, j, conv):
        tally, tried = collections.Counter(), 0
        for n, e, key in refs[p]:
            row, rv = idx.get(key), hist(e, p, j)
            if row is None or rv is None:
                continue
            tried += 1
            for ci, v in enumerate(row):
                x = to_num(v)
                if x is not None and abs(conv(x) - rv) < TOL[p]:
                    tally[ci] += 1
        if not tally or not tried:
            return 0.0, None
        ci, h = tally.most_common(1)[0]
        return h / tried, ci
    ok = True
    table = ["| 公式の年度 | 項目 | アプリのR1 | R2 | R3 | R4 | R5 | R6（最新） |", "|---|---|---|---|---|---|---|---|"]
    for k in range(1, LATEST + 1):
        fi = index_rows([pick(FISCAL_PAGES[k], ["全市町村の主要財政指標"], label=f"令和{k}年度 主要財政指標")])
        gai = index_rows(pick(KESSAN_PAGES[k], ["概況"], many=True, label=f"令和{k}年度 概況"))
        for p, idx, conv in (("f", fi, lambda x: x), ("x", fi, lambda x: x), ("d", fi, lambda x: x), ("u", fi, lambda x: x),
                             ("eo", gai, lambda x: round(x / 100000, 1)), ("ei", gai, lambda x: round(x / 100000, 1))):
            rates = []
            for j in range(1, LATEST + 1):
                if j < HIST_FROM[p]:
                    rates.append(None)
                    continue
                rates.append(col_rate(idx, p, j, conv)[0])
            valid = [(r, j) for j, r in enumerate(rates, 1) if r is not None]
            bj = max(valid)[1]
            if rates[k - 1] is not None and (bj != k or rates[k - 1] < 0.9):
                ok = False
            table.append(f"| 令和{k}年度 | {p} | " + " | ".join("－" if r is None else f"{r:.0%}" for r in rates) + " |")
    diag_text = "\n".join(["## 事前診断：公式データの各年度と、アプリに保存されている各年の一致率", ""] + table)
    print(diag_text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(diag_text + "\n\n")
    if not ok:
        print("❌ 公式データの年度と、アプリの年がそろっていない項目があります（上の表）。データは書き換えていません")
        sys.exit(1)

    random.seed(0)
    official = collections.defaultdict(dict)  # (key, p) -> {k: 値}
    ref_bad = collections.Counter()

    for k in range(1, LATEST + 1):
        print(f"令和{k}年度")
        # ---------- 主要財政指標（f/x/d/u） ----------
        fi = index_rows([pick(FISCAL_PAGES[k], ["全市町村の主要財政指標"], label=f"令和{k}年度 主要財政指標")])
        for p in ("f", "x", "d", "u"):
            tally, tried = collections.Counter(), 0
            for n, e, key in refs[p]:
                row, rv = fi.get(key), hist(e, p, k)
                if row is None or rv is None:
                    continue
                tried += 1
                for ci, v in enumerate(row):
                    x = to_num(v)
                    if x is not None and abs(x - rv) < TOL[p]:
                        tally[ci] += 1
            col = best(tally, tried, f"{p} の列")
            for key, row in fi.items():
                if row is not None:
                    official[(key, p)][k] = to_num(row[col])
        # ---------- 決算の概況（eo/ei） ----------
        gai = index_rows(pick(KESSAN_PAGES[k], ["概況"], many=True, label=f"令和{k}年度 概況"))
        cols = {}
        for p in ("eo", "ei"):
            if k < HIST_FROM[p]:
                continue
            tally, tried = collections.Counter(), 0
            for n, e, key in refs[p]:
                row, rv = gai.get(key), hist(e, p, k)
                if row is None or rv is None:
                    continue
                tried += 1
                for ci, v in enumerate(row):
                    x = to_num(v)
                    if x is not None and abs(round(x / 100000, 1) - rv) < TOL[p]:
                        tally[ci] += 1
            cols[p] = best(tally, tried, f"{p} の列")
        # ---------- 目的別歳出（edu）：歳出総額の列が不明な年（令和元年度）は、教育費の列と組で探す ----------
        moku = index_rows(pick(KESSAN_PAGES[k], ["目的別歳出"], many=True, label=f"令和{k}年度 目的別歳出"))
        sample = random.sample(refs["edu"], min(400, len(refs["edu"])))
        tally, tried = collections.Counter(), 0
        for n, e, key in sample:
            rg, rm, rv = gai.get(key), moku.get(key), hist(e, "edu", k)
            if rg is None or rm is None or rv is None:
                continue
            tried += 1
            eo_cands = [cols["eo"]] if "eo" in cols else [i for i, v in enumerate(rg) if to_num(v)]
            for ce in eo_cands:
                eo = to_num(rg[ce])
                if not eo:
                    continue
                eo_oku = round(eo / 100000, 1)
                if not eo_oku:
                    continue
                for cm, v in enumerate(rm):
                    x = to_num(v)
                    if x is not None and abs(round(x / (eo_oku * 100000) * 100, 1) - rv) < TOL["edu"]:
                        tally[(ce, cm)] += 1
        ce, cm_edu = best(tally, tried, "（歳出総額の列, 教育費の列）")
        # ---------- 子ども投資額（ch）：児童福祉費の列と、年齢別人口の列（0〜4歳の位置）を組で探す ----------
        age = index_rows([pick(AGE_PAGES[k], ["年齢階級別", "市区町村別"], must_not=["日本人", "外国人"],
                               label=f"令和{k + 1}年 年齢階級別人口")], sex_total=True)
        sample = random.sample(refs["ch"], min(300, len(refs["ch"])))
        tally, tried = collections.Counter(), 0
        for n, e, key in sample:
            rm, ra, rv = moku.get(key), age.get(key), hist(e, "ch", k)
            if rm is None or ra is None or rv is None:
                continue
            edu_exp = to_num(rm[cm_edu])
            if edu_exp is None:
                continue
            tried += 1
            for o in range(len(ra) - 3):
                a = [to_num(ra[o + i]) for i in range(4)]
                if any(v is None for v in a):
                    continue
                ap = a[0] + a[1] + a[2] + a[3] * 3 / 5
                if ap <= 0:
                    continue
                for cj, v in enumerate(rm):
                    x = to_num(v)
                    if x is not None and abs(round((x + edu_exp) / ap * 0.1, 1) - rv) < TOL["ch"]:
                        tally[(o, cj)] += 1
        o_age, cj = best(tally, tried, "（0〜4歳の列, 児童福祉費の列）")
        # ---------- 公式値を計算 ----------
        for key in set(gai) | set(moku):
            rg, rm, ra = gai.get(key), moku.get(key), age.get(key)
            if rg is not None:
                for p in ("eo", "ei"):
                    if p in cols and to_num(rg[cols[p]]) is not None:
                        official[(key, p)][k] = round(to_num(rg[cols[p]]) / 100000, 1)
            if rg is not None and rm is not None:
                eo = to_num(rg[ce])
                edu_exp = to_num(rm[cm_edu])
                if eo and edu_exp is not None and round(eo / 100000, 1):
                    official[(key, "edu")][k] = round(edu_exp / (round(eo / 100000, 1) * 100000) * 100, 1)
                if ra is not None and edu_exp is not None:
                    a = [to_num(ra[o_age + i]) for i in range(4)]
                    jido = to_num(rm[cj])
                    if all(v is not None for v in a) and jido is not None:
                        ap = a[0] + a[1] + a[2] + a[3] * 3 / 5
                        if ap > 0:
                            official[(key, "ch")][k] = round((jido + edu_exp) / ap * 0.1, 1)
        for p, lst in refs.items():
            for n, e, key in lst:
                o, rv = official.get((key, p), {}).get(k), hist(e, p, k)
                if o is not None and rv is not None and abs(o - rv) >= TOL[p]:
                    ref_bad[(p, k)] += 1

    # ---------- 対象の団体を書き換え ----------
    lines = ["| 団体 | 項目 | 変更前 | 公式（令和元〜6年度） |", "|---|---|---|---|"]
    changed = set()
    for f, n, e, key in ents:
        if key not in TARGETS:
            continue
        for p in TARGETS[key]:
            o = official.get((key, p), {})
            need = range(HIST_FROM[p], LATEST + 1)
            missing = [k for k in need if k not in o or (o[k] is None and p != "u")]
            if missing:
                print(f"❌ {key}：{p} の令和{missing}年度が公式データから取れません")
                sys.exit(1)
            olds = [v for kk, v in e.items() if (kk == p or re.fullmatch(p + r"_r\d+", kk)) and v is not None]
            for old in olds:
                if not any(o[k] is not None and abs(old - o[k]) < TOL[p] for k in need):
                    print(f"❌ {key}：{p} の既存の値{old}が公式データのどの年（{o}）とも合いません")
                    sys.exit(1)
            before = [e.get(f"{p}_r{k}") for k in range(1, LATEST)] + [e.get(p)]
            for kk in [x for x in e if re.fullmatch(p + r"_r\d+", x)]:
                del e[kk]
            for k in range(HIST_FROM[p], LATEST):
                e[f"{p}_r{k}"] = o[k]
            e[p] = o[LATEST]
            changed.add(f)
            lines.append(f"| {n} | {p} | {before} | {[o[k] for k in need]} |")

    for f in changed:
        (DATA_DIR / f).write_text(json.dumps(dbs[f], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    bad = {f"{p}:R{k}": v for (p, k), v in sorted(ref_bad.items())}
    text = "\n".join([f"## 3団体の財政データを作り直しました（preview）", "",
                      f"- 【参考・書き換えなし】データがそろっている団体のうち、公式データと食い違う件数：{bad if bad else 'なし'}",
                      ""] + lines)
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


if __name__ == "__main__":
    main()

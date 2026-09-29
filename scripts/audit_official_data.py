# -*- coding: utf-8 -*-
"""
公式データ照合（確認専用・データは書き換えない）

アプリのデータ（data-*.json）を、総務省の公式Excelと全項目・全年度・全団体で突き合わせ、
食い違いを一覧にする。3月の年次更新の後や、データを直した後に実行する。

  照合する項目（市町村・都道府県の両方）
    人口 pop・人口増減率 g           … 住民基本台帳（令和元年〜最新年の1月1日現在）
    財政力指数 f・経常収支比率 x・
    実質公債費比率 d・将来負担比率 u … 主要財政指標一覧
    財政調整基金 r                   … 基金残高等一覧
    歳出 eo・歳入 ei                  … 決算状況調（市町村：概況／都道府県：決算状況）
    教育費比率 edu・子ども投資額 ch  … 目的別歳出内訳・年齢別人口から、年次更新と同じ式で計算

  照合の仕方
    ・列の位置と単位は、アプリの値と一番よく一致する列を使う（大半が合っていれば、合わない団体が
      「食い違い」として見つかる）。
    ・年のずれの診断：公式の各年が、アプリのどの年の欄と一番よく一致するかを調べる。
      同じ年の欄と一致しない、または一致率が95%未満なら ⚠️ を付ける。
    ・食い違いは「端数程度（小さなずれ）」と「大きなずれ」に分けて数え、例を表示する。
  問題が見つかったら最後に赤い×で終わる（データは変更しない）。

  対象外（別の仕組みで作っているため）：標準財政規模 sfs、公会計（kokaikei.json）、ふるさと納税

年度が増えたら、下の *_PAGES に新しい年のページを1行ずつ追加する。
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
DATA_FILES = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
              "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]

# ---- 公式データのページ（令和k年／令和k年度） ----
POP_PAGES = {  # 住民基本台帳（令和k年1月1日現在）
    1: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000193.html",
    2: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000220.html",
    3: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000233.html",
    4: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000259.html",
    5: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000289.html",
    6: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000316.html",
    7: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000389.html",
    8: "https://www.soumu.go.jp/menu_news/s-news/01gyosei02_02000428.html",
}
FISCAL_PAGES = {  # 主要財政指標一覧（令和k年度）
    1: "https://www.soumu.go.jp/iken/zaisei/R01_chiho.html",
    2: "https://www.soumu.go.jp/iken/zaisei/R02_chiho.html",
    3: "https://www.soumu.go.jp/iken/zaisei/R03_chiho.html",
    4: "https://www.soumu.go.jp/iken/zaisei/R04_chiho.html",
    5: "https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000131.html",
    6: "https://www.soumu.go.jp/menu_seisaku/toukei/02zaisei07_04000135.html",
}
KIKIN_PAGE = "https://www.soumu.go.jp/iken/kikinzandaka.html"
KIKIN_FILES = {  # 基金残高等一覧（令和k年度）：(市区町村, 都道府県)
    1: ("000810024", "000810022"), 2: ("000810030", "000810004"), 3: ("000877373", "000877162"),
    4: ("000954018", "000939581"), 5: ("001010452", "001005492"), 6: ("001066238", "001066237"),
}
KESSAN_MUNI = {k: f"https://www.soumu.go.jp/iken/zaisei/r0{k}_shichouson.html" for k in range(1, 7)}
KESSAN_PREF = {k: f"https://www.soumu.go.jp/iken/zaisei/r0{k}_todohuken.html" for k in range(1, 7)}

POP_LATEST, FISCAL_LATEST = max(POP_PAGES), max(FISCAL_PAGES)
TOL = {"pop": 0.5, "g": 0.06, "f": 0.006, "x": 0.06, "d": 0.06, "u": 0.06,
       "r": 0.06, "eo": 0.06, "ei": 0.06, "edu": 0.06, "ch": 0.06}
# 端数の範囲：これ以下のずれは四捨五入の違いとみなす。これを超えたら「食い違い」
# （2026-09-29：割合で判定すると、毎年ほぼ同じ値の団体で年のずれを見逃したため、値の桁で判定する）
ROUND = {"pop": 1.5, "g": 0.06, "f": 0.011, "x": 0.11, "d": 0.11, "u": 0.11,
         "r": 0.11, "eo": 0.11, "ei": 0.11, "edu": 0.11, "ch": 0.11}
LABEL = {"pop": "人口", "g": "人口増減率", "f": "財政力指数", "x": "経常収支比率", "d": "実質公債費比率",
         "u": "将来負担比率", "r": "財政調整基金", "eo": "歳出", "ei": "歳入", "edu": "教育費比率", "ch": "子ども投資額"}
MONEY_SCALES = [1 / 100, 1 / 1000, 1 / 10000, 1 / 100000, 1 / 1000000, 1 / 100000000]

PREFS = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
         "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
         "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
         "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
         "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]
NORTHERN = ("国後郡", "択捉郡", "色丹郡", "紗那郡", "蕊取郡")
UA = {"User-Agent": "Mozilla/5.0 (mitchie-fiscal data audit)"}
_cache = {}


# ---------------------------------------------------------------- 取得・解析の道具
def fetch(url):
    if url not in _cache:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=120) as r:
            _cache[url] = r.read()
    return _cache[url]


def page_html(url):
    raw = fetch(url)
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp932", errors="ignore")


def links(url, after=None):
    """ページ内のExcelリンクを (URL, リンクの文字) の順に返す。after を指定すると、その文字より後ろにあるリンクだけ"""
    html = page_html(url)
    if after:
        i = html.find(after)
        html = html[i:] if i >= 0 else ""
    out = []
    for href, text in re.findall(r'<a[^>]+href="([^"]+\.xlsx?)"[^>]*>(.*?)</a>', html, flags=re.S | re.I):
        t = re.sub(r"<[^>]+>|\s", "", text)
        out.append(("https://www.soumu.go.jp" + href if href.startswith("/") else href, t))
    return out


class SourceMissing(Exception):
    pass


def pick(url, test, many=False, label=""):
    ls = links(url)
    c = [h for h, t in ls if test(t)]
    if not c or (not many and len(c) != 1):
        raise SourceMissing(f"{label}：Excelのリンクが{len(c)}件（{url}）")
    return c if many else c[0]


def rows_of(url):
    engine = "xlrd" if url.lower().endswith(".xls") else "openpyxl"
    books = pd.read_excel(io.BytesIO(fetch(url)), header=None, dtype=object, engine=engine, sheet_name=None)
    return [df.values.tolist() for df in books.values()]


def norm_name(v):
    s = re.sub(r"[\s　]", "", str(v))
    if s.startswith(NORTHERN):
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


def index(urls, pref_level, sex_total=False):
    """市町村：(都道府県, 名前)->行、都道府県：都道府県名->行。シートをまたいだ重複は先に見つかった方。"""
    idx = {}
    for url in urls:
        for sheet in rows_of(url):
            sidx, cur = {}, None
            for row in sheet:
                cells = [re.sub(r"[\s　]", "", str(v)) for v in row]
                for s in cells:
                    if s in PREFS:
                        cur = s
                        break
                if not cur:
                    continue
                if sex_total and "計" not in cells:
                    continue
                names = set()
                for v in row:
                    if isinstance(v, str):
                        n = norm_name(v)
                        if n and n not in PREFS and len(n) <= 10 and re.search(r"[市町村区]$", n):
                            names.add(n)
                if pref_level:
                    if not names and cur not in sidx and any(to_num(v) is not None for v in row):
                        sidx[cur] = row
                else:
                    for n in names:
                        key = (cur, n)
                        sidx[key] = None if key in sidx else row
            for key, row in sidx.items():
                if key not in idx:
                    idx[key] = row
    return idx


# ---------------------------------------------------------------- 照合
def main():
    entities = []  # (名前, データ, 都道府県か, 公式側のキー)
    for f in DATA_FILES:
        for n, e in json.loads((ROOT / f).read_text(encoding="utf-8")).items():
            is_pref = n == e.get("p")
            entities.append((n, e, is_pref, e["p"] if is_pref else (e["p"], norm_name(n))))

    def app(e, p, k, latest):
        return e.get(p) if k == latest else e.get(f"{p}_r{k}")

    report, problems, skipped = [], [], []
    align_rows = ["| 項目 | 区分 | 公式の年 | 一番一致したアプリの年 | 一致率 | 判定 |", "|---|---|---|---|---|---|"]
    mis_rows = ["| 項目 | 区分 | 年 | 照合した団体 | 端数のずれ | 食い違い | 食い違いの例（アプリ → 公式） |", "|---|---|---|---|---|---|---|"]
    official_cache = {}

    def best_conv(idx, p, is_pref, k_app, latest, money):
        """アプリの令和k_app年の値と一番よく一致する（列, 単位）と一致率を返す"""
        tally, tried = collections.Counter(), 0
        for n, e, ip, key in entities:
            if ip != is_pref:
                continue
            row, av = idx.get(key), app(e, p, k_app, latest)
            if row is None or av is None:
                continue
            tried += 1
            for ci, v in enumerate(row):
                x = to_num(v)
                if x is None:
                    continue
                for sc in (MONEY_SCALES if money else [1]):
                    xv = round(x * sc, 1) if money else x
                    if abs(xv - av) < TOL[p]:
                        tally[(ci, sc)] += 1
        if not tally:
            return None, 0.0, tried
        cs, h = tally.most_common(1)[0]
        return cs, h / tried, tried

    def check(p, is_pref, k, latest, off, app_years):
        """公式値 off（キー->値）と、アプリの各年を比べて、年のずれ診断と食い違い一覧を作る"""
        grp = "都道府県" if is_pref else "市町村"
        rates = {}
        for j in app_years:
            h = t = 0
            for n, e, ip, key in entities:
                if ip != is_pref or key not in off or off[key] is None:
                    continue
                av = app(e, p, j, latest)
                if av is None:
                    continue
                t += 1
                h += abs(av - off[key]) < TOL[p]
            if t:
                rates[j] = h / t
        if not rates:
            return
        bj = max(rates, key=lambda j: rates[j])
        own = rates.get(k)
        ok = own is not None and bj == k and own >= 0.95
        if own is None:
            verdict = "（アプリにこの年の欄なし）"
        else:
            verdict = "✅" if ok else "⚠️ 年のずれ・食い違いの可能性"
            if not ok:
                problems.append(f"{LABEL[p]}（{grp}）令和{k}年：同じ年の一致率{own:.0%}、一番一致したのはアプリのR{bj}（{rates[bj]:.0%}）")
        align_rows.append(f"| {LABEL[p]} | {grp} | 令和{k} | R{bj}{'（最新）' if bj == latest else ''} | "
                          f"{(own if own is not None else rates[bj]):.1%} | {verdict} |")
        if own is None:
            return
        small, big, ex, tried = 0, 0, [], 0
        for n, e, ip, key in entities:
            if ip != is_pref or key not in off or off[key] is None:
                continue
            av = app(e, p, k, latest)
            if av is None:
                continue
            tried += 1
            dv = abs(av - off[key])
            if dv < TOL[p]:
                continue
            if dv > ROUND[p]:
                big += 1
                if len(ex) < 8:
                    ex.append(f"{n} {av}→{round(off[key], 3)}")
            else:
                small += 1
        if big:
            problems.append(f"{LABEL[p]}（{grp}）令和{k}年：食い違い{big}件（例：{'、'.join(ex[:3])}）")
        mis_rows.append(f"| {LABEL[p]} | {grp} | 令和{k} | {tried} | {small} | {big} | {'、'.join(ex)} |")

    # ---------- 人口・人口増減率 ----------
    for k in POP_PAGES:
        try:
            url = pick(POP_PAGES[k], lambda t: "市区町村別" in t and "人口" in t and "世帯数" in t and "年齢" not in t
                       and "日本人" not in t and "外国人" not in t, many=True, label=f"令和{k}年 住民基本台帳")
            url = url[0]  # 日本人・外国人のファイルは除外済み。残りは総計
            for is_pref in (False, True):
                idx = index([url], is_pref)
                for p in ("pop", "g"):
                    cs, rate, _ = best_conv(idx, p, is_pref, k, POP_LATEST, False)
                    if cs is None:
                        problems.append(f"{LABEL[p]}（{'都道府県' if is_pref else '市町村'}）令和{k}年：公式の列が特定できません")
                        continue
                    off = {key: to_num(row[cs[0]]) for key, row in idx.items() if row is not None}
                    check(p, is_pref, k, POP_LATEST, off, range(1, POP_LATEST + 1))
        except SourceMissing as ex:
            skipped.append(str(ex))

    # ---------- 財政指標・財政調整基金・歳出歳入・教育費・子ども投資額（令和k年度） ----------
    kikin_page = fetch(KIKIN_PAGE).decode("utf-8", errors="ignore")
    for k in FISCAL_PAGES:
        for is_pref in (False, True):
            grp = "都道府県" if is_pref else "市町村"
            try:
                # 財政指標4項目
                u = pick(FISCAL_PAGES[k], lambda t: ("全都道府県の主要財政指標" if is_pref else "全市町村の主要財政指標") in t,
                         label=f"令和{k}年度 主要財政指標（{grp}）")
                idx = index([u], is_pref)
                for p in ("f", "x", "d", "u"):
                    cs, rate, _ = best_conv(idx, p, is_pref, k, FISCAL_LATEST, False)
                    if cs is None:
                        problems.append(f"{LABEL[p]}（{grp}）令和{k}年度：公式の列が特定できません")
                        continue
                    off = {key: to_num(row[cs[0]]) for key, row in idx.items() if row is not None}
                    check(p, is_pref, k, FISCAL_LATEST, off, range(1, FISCAL_LATEST + 1))
            except SourceMissing as ex:
                skipped.append(str(ex))
            try:
                # 財政調整基金
                fid = KIKIN_FILES[k][1 if is_pref else 0]
                if fid not in kikin_page:
                    raise SourceMissing(f"令和{k}年度 基金残高（{grp}）：一覧ページにファイル{fid}が見つかりません")
                idx = index([f"https://www.soumu.go.jp/main_content/{fid}.xlsx"], is_pref)
                cs, rate, _ = best_conv(idx, "r", is_pref, k, FISCAL_LATEST, True)
                if cs is None:
                    problems.append(f"財政調整基金（{grp}）令和{k}年度：公式の列が特定できません")
                else:
                    off = {key: round(to_num(row[cs[0]]) * cs[1], 1) for key, row in idx.items()
                           if row is not None and to_num(row[cs[0]]) is not None}
                    check("r", is_pref, k, FISCAL_LATEST, off, range(1, FISCAL_LATEST + 1))
            except SourceMissing as ex:
                skipped.append(str(ex))
            try:
                # 歳出・歳入・教育費・子ども投資額
                if is_pref:
                    # 都道府県のページは「第1表 決算状況」「第5表 目的別歳出内訳 → 都道府県別内訳」の順に並んでいる。
                    # リンクの文字だけでは区別できないことがあるため、見出しより後ろにある最初のリンクを使う（2026-09-29）
                    c = [h for h, t in links(KESSAN_PREF[k]) if "決算状況" in t and "単年度" not in t and "実質収支" not in t]
                    if not c:
                        c = [h for h, t in links(KESSAN_PREF[k], after="第1表")]
                    c5 = [h for h, t in links(KESSAN_PREF[k], after="目的別歳出") if "都道府県別" in t]
                    if not c or not c5:
                        raise SourceMissing(f"令和{k}年度 決算状況・目的別歳出（都道府県）：リンクが見つかりません（{KESSAN_PREF[k]}）")
                    gai_urls, moku_urls = [c[0]], [c5[0]]
                else:
                    gai_urls = pick(KESSAN_MUNI[k], lambda t: "概況" in t, many=True, label=f"令和{k}年度 概況（市町村）")
                    moku_urls = pick(KESSAN_MUNI[k], lambda t: "目的別歳出" in t, many=True, label=f"令和{k}年度 目的別歳出（市町村）")
                gai, moku = index(gai_urls, is_pref), index(moku_urls, is_pref)
                eo_col = None
                for p in ("eo", "ei"):
                    has_slot = any(app(e, p, k, FISCAL_LATEST) is not None for n, e, ip, key in entities if ip == is_pref)
                    if not has_slot:
                        continue
                    cs, rate, _ = best_conv(gai, p, is_pref, k, FISCAL_LATEST, True)
                    if cs is None:
                        problems.append(f"{LABEL[p]}（{grp}）令和{k}年度：公式の列が特定できません")
                        continue
                    if p == "eo":
                        eo_col = cs
                    off = {key: round(to_num(row[cs[0]]) * cs[1], 1) for key, row in gai.items()
                           if row is not None and to_num(row[cs[0]]) is not None}
                    check(p, is_pref, k, FISCAL_LATEST, off, range(1, FISCAL_LATEST + 1))
                # 教育費：歳出総額の列（不明な年は組で探す）と教育費の列
                random.seed(k)
                pool = [(n, e, key) for n, e, ip, key in entities if ip == is_pref and app(e, "edu", k, FISCAL_LATEST) is not None]
                sample = random.sample(pool, min(400, len(pool)))
                tally, tried = collections.Counter(), 0
                for n, e, key in sample:
                    rg, rm, rv = gai.get(key), moku.get(key), app(e, "edu", k, FISCAL_LATEST)
                    if rg is None or rm is None:
                        continue
                    tried += 1
                    ecands = [eo_col] if eo_col else [(i, 1 / 100000) for i, v in enumerate(rg) if to_num(v)]
                    for ce in ecands:
                        eo = to_num(rg[ce[0]])
                        if not eo:
                            continue
                        eo_oku = round(eo * ce[1], 1)
                        if not eo_oku:
                            continue
                        for cm, v in enumerate(rm):
                            x = to_num(v)
                            if x is not None and abs(round(x / (eo_oku * 100000) * 100, 1) - rv) < TOL["edu"]:
                                tally[(ce, cm)] += 1
                if not tally:
                    problems.append(f"教育費比率（{grp}）令和{k}年度：公式の列が特定できません")
                    continue
                (ce, cm_edu), _ = tally.most_common(1)[0]
                off_edu = {}
                for key in gai:
                    rg, rm = gai.get(key), moku.get(key)
                    if rg is None or rm is None:
                        continue
                    eo, ed = to_num(rg[ce[0]]), to_num(rm[cm_edu])
                    if eo and ed is not None and round(eo * ce[1], 1):
                        off_edu[key] = round(ed / (round(eo * ce[1], 1) * 100000) * 100, 1)
                check("edu", is_pref, k, FISCAL_LATEST, off_edu, range(1, FISCAL_LATEST + 1))
                # 子ども投資額：年齢別人口（令和k+1年）と児童福祉費の列
                if k + 1 not in POP_PAGES:
                    continue
                age_url = pick(POP_PAGES[k + 1], lambda t: "年齢階級別" in t and ("都道府県別" if is_pref else "市区町村別") in t
                               and "日本人" not in t and "外国人" not in t, label=f"令和{k + 1}年 年齢別人口（{grp}）")
                age = index([age_url], is_pref, sex_total=True)
                pool = [(n, e, key) for n, e, ip, key in entities if ip == is_pref and app(e, "ch", k, FISCAL_LATEST) is not None]
                sample = random.sample(pool, min(300, len(pool)))
                tally, tried = collections.Counter(), 0
                for n, e, key in sample:
                    rm, ra, rv = moku.get(key), age.get(key), app(e, "ch", k, FISCAL_LATEST)
                    if rm is None or ra is None or to_num(rm[cm_edu]) is None:
                        continue
                    ed = to_num(rm[cm_edu])
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
                            if x is not None and abs(round((x + ed) / ap * 0.1, 1) - rv) < TOL["ch"]:
                                tally[(o, cj)] += 1
                if not tally:
                    problems.append(f"子ども投資額（{grp}）令和{k}年度：公式の列が特定できません")
                    continue
                (o_age, cj), _ = tally.most_common(1)[0]
                off_ch = {}
                for key in moku:
                    rm, ra = moku.get(key), age.get(key)
                    if rm is None or ra is None:
                        continue
                    a = [to_num(ra[o_age + i]) for i in range(4)]
                    ed, jd = to_num(rm[cm_edu]), to_num(rm[cj])
                    if all(v is not None for v in a) and ed is not None and jd is not None:
                        ap = a[0] + a[1] + a[2] + a[3] * 3 / 5
                        if ap > 0:
                            off_ch[key] = round((jd + ed) / ap * 0.1, 1)
                check("ch", is_pref, k, FISCAL_LATEST, off_ch, range(1, FISCAL_LATEST + 1))
            except SourceMissing as ex:
                skipped.append(str(ex))

    # ---------- 報告 ----------
    head = "## ✅ 公式データとの照合：問題なし" if not problems else f"## ⚠️ 公式データとの照合：確認が必要な点が{len(problems)}件"
    report = [head, "", "データは書き換えていません。", ""]
    if problems:
        report += ["### 確認が必要な点", ""] + [f"- {x}" for x in problems] + [""]
    if skipped:
        report += ["### 照合できなかったもの（公式ファイルが見つからない）", ""] + [f"- {x}" for x in skipped] + [""]
    report += ["### 年のずれの診断", "", "公式の各年が、アプリのどの年の欄と一番よく一致したか。", ""] + align_rows + [""]
    report += ["### 食い違いの件数", "",
               "端数のずれ＝四捨五入の違い程度（0.1、財政力指数は0.01、人口は1人以内）。それより大きいものは「食い違い」。",
               ""] + mis_rows + ["", "対象外：標準財政規模、公会計、ふるさと納税"]
    text = "\n".join(report)
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")
    if problems or skipped:
        sys.exit(1)


if __name__ == "__main__":
    main()

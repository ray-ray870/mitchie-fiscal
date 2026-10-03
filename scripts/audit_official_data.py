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

    公会計9指標 ka1〜ka9（kokaikei.json）… 統一的な基準による財務書類に関する情報「指標一覧」（年度ごとのページ）
    ふるさと納税 受入額 fuH・住民税控除額 fk … ふるさと納税に関する現況調査（受入額の推移・最新の控除額）
    人口の増減の内訳 pd             … 住民基本台帳（最新の年。転入・出生・転出・死亡・増減・自然増減・社会増減）
    歳入・目的別歳出・教育費の内訳 bd … 決算状況調の歳入内訳・目的別歳出内訳（最新の年度）と、前年度の目的別歳出
      （内訳は、値が一致した列の見出しが項目名と合っているかも確かめる。2026-10-01追加）
    標準財政規模 sfs                 … 決算状況調（市町村：概況／都道府県：決算状況）の標準財政規模の列（最新の年度と1年前）
      （アプリは決算カードから取り込んでいるので、別の表と照合する。2026-10-01追加）

年度が増えても、このファイルを書き換える必要はない（2026-09-30〜）。
  ・最新の年は、アプリのデータ（欄の数）から自動で決まる。
  ・下の *_PAGES に無い年は、scripts/audit_sources.json（年次更新のワークフローが、照合に成功したときに
    その年の config.json のURLを記録するファイル）と、最新の年なら scripts/config.json のURLを使う。
  ・照合するデータの場所は環境変数 MITCHIE_DATA_DIR（年次更新のワークフローは preview/）。
  ・--record を付けて実行すると、照合に成功したときに今の config.json のURLを audit_sources.json に記録する。
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
DATA_DIR = Path(os.environ.get("MITCHIE_DATA_DIR") or ROOT)
if not DATA_DIR.is_absolute():
    DATA_DIR = ROOT / DATA_DIR
CONFIG_PATH = ROOT / "scripts" / "config.json"
SOURCES_PATH = ROOT / "scripts" / "audit_sources.json"
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
# 公会計（統一的な基準による財務書類に関する情報）：年度 y（0=平成30年度、1=令和元年度…）のページ
def kk_page(y):
    return f"https://www.soumu.go.jp/iken/kokaikei/{'H30' if y == 0 else 'R%02d' % y}_chihou_zaimusyorui.html"
# ふるさと納税（現況調査）：受入額の推移（全年度が1ファイル）と、最新の住民税控除額
FURU_PAGE = "https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/archive/"
FURU_FIRST_YEAR = 0  # アプリの fuH[0] の年度（0=平成30年度）。fuH は8年分

KESSAN_MUNI = {k: f"https://www.soumu.go.jp/iken/zaisei/r{k:02d}_shichouson.html" for k in range(1, 31)}
KESSAN_PREF = {k: f"https://www.soumu.go.jp/iken/zaisei/r{k:02d}_todohuken.html" for k in range(1, 31)}

# 人口の増減の内訳（pd）と、歳入・目的別歳出の内訳（bd）の項目（2026-10-01追加）
#   (項目, 見出しに含まれるべき言葉, 含まれてはいけない言葉)
PD_ITEMS = [("in", "転入者数", ()), ("b", "出生者数", ()), ("out", "転出者数", ()), ("dth", "死亡者数", ()),
            ("chg", "増減数", ("自然", "社会")), ("nat", "自然増減数", ()), ("soc", "社会増減数", ())]
PD_LABEL = {"in": "転入", "b": "出生", "out": "転出", "dth": "死亡", "chg": "人口の増減", "nat": "自然増減", "soc": "社会増減"}
BD_ITEMS = {
    "rv": [("tax", ("地方税", "道府県税", "都道府県税"), ()), ("lat", ("地方交付税",), ()), ("nat", ("国庫支出金",), ()),
           ("prf", ("都道府県支出金",), ()), ("bond", ("地方債",), ()), ("tr", ("繰入金",), ())],
    "ex": [("gikai", ("議会費",), ()), ("somu", ("総務費",), ("教育総務費",)), ("minsei", ("民生費",), ()),
           ("jido", ("児童福祉費",), ()), ("eisei", ("衛生費",), ()), ("rodo", ("労働費",), ()), ("norin", ("農林水産業費",), ()),
           ("shoko", ("商工費",), ()), ("doboku", ("土木費",), ()), ("keisatsu", ("警察費",), ()), ("shobo", ("消防費",), ()),
           ("edu", ("教育費",), ()), ("saigai", ("災害復旧費",), ()), ("kosai", ("公債費",), ())],
    "ed": [("somu", ("教育総務費",), ()), ("sho", ("小学校費",), ()), ("chu", ("中学校費",), ()), ("koko", ("高等学校費",), ()),
           ("tokushi", ("特別支援学校費",), ()), ("yochi", ("幼稚園費",), ()), ("shakai", ("社会教育費",), ()),
           ("kyu", ("学校給食費",), ())],
}
BD_LABEL = {"rv": {"tax": "地方税", "lat": "地方交付税", "nat": "国庫支出金", "prf": "都道府県支出金", "bond": "地方債", "tr": "繰入金"},
            "ex": {"gikai": "議会費", "somu": "総務費", "minsei": "民生費", "jido": "児童福祉費", "eisei": "衛生費", "rodo": "労働費",
                   "norin": "農林水産業費", "shoko": "商工費", "doboku": "土木費", "keisatsu": "警察費", "shobo": "消防費",
                   "edu": "教育費", "saigai": "災害復旧費", "kosai": "公債費"},
            "ed": {"somu": "教育総務費", "sho": "小学校費", "chu": "中学校費", "koko": "高等学校費", "tokushi": "特別支援学校費",
                   "yochi": "幼稚園費", "shakai": "社会教育費", "kyu": "学校給食費"}}
DASHES = ("-", "－", "‐", "―", "")

TOL = {"pop": 0.5, "g": 0.06, "f": 0.006, "x": 0.06, "d": 0.06, "u": 0.06,
       "r": 0.06, "eo": 0.06, "ei": 0.06, "edu": 0.06, "ch": 0.06,
       **{f"ka{i}": 0.06 for i in range(1, 10)}, "fu": 0.06, "fk": 0.06, "sfs": 0.06}
# 端数の範囲：これ以下のずれは四捨五入の違いとみなす。これを超えたら「食い違い」
# （2026-09-29：割合で判定すると、毎年ほぼ同じ値の団体で年のずれを見逃したため、値の桁で判定する）
ROUND = {"pop": 1.5, "g": 0.06, "f": 0.011, "x": 0.11, "d": 0.11, "u": 0.11,
         "r": 0.11, "eo": 0.11, "ei": 0.11, "edu": 0.11, "ch": 0.11,
         **{f"ka{i}": 0.11 for i in range(1, 10)}, "fu": 0.11, "fk": 0.11, "sfs": 0.11}
LABEL = {"pop": "人口", "g": "人口増減率", "f": "財政力指数", "x": "経常収支比率", "d": "実質公債費比率",
         "u": "将来負担比率", "r": "財政調整基金", "eo": "歳出", "ei": "歳入", "edu": "教育費比率", "ch": "子ども投資額",
         "ka1": "公会計 一人当たり資産額", "ka2": "公会計 歳入額対資産比率", "ka3": "公会計 有形固定資産減価償却率",
         "ka4": "公会計 純資産比率", "ka5": "公会計 将来世代負担比率", "ka6": "公会計 一人当たり行政コスト",
         "ka7": "公会計 一人当たり負債額", "ka8": "公会計 基礎的財政収支", "ka9": "公会計 受益者負担比率",
         "fu": "ふるさと納税 受入額", "fk": "ふるさと納税 住民税控除額", "sfs": "標準財政規模"}
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


def rows_of(url, sheet_re=None, strict=False):
    """全シートの行を返す。sheet_re を指定すると、名前がそれに合うシートだけ（無ければ1枚目だけ。strict なら空）"""
    engine = "xlrd" if url.lower().endswith(".xls") else "openpyxl"
    books = pd.read_excel(io.BytesIO(fetch(url)), header=None, dtype=object, engine=engine, sheet_name=None)
    items = list(books.items())
    if sheet_re:
        hit = [(n, df) for n, df in items if re.search(sheet_re, str(n))]
        items = hit if hit else ([] if strict else items[:1])
    return [df.values.tolist() for n, df in items]


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


def index(urls, pref_level, sex_total=False, sheet_re=None, strict=False):
    """市町村：(都道府県, 名前)->行、都道府県：都道府県名->行。シートをまたいだ重複は先に見つかった方。"""
    idx = {}
    for url in urls:
        for sheet in rows_of(url, sheet_re, strict):
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
def reiwa_num(label):
    m = re.search(r"令和\s*(元|\d+)", label or "")
    if not m:
        raise ValueError(f"年の書き方が読めません：{label}")
    return 1 if m.group(1) == "元" else int(m.group(1))


def slots(ents, prefix):
    """データの中で一番多い「_r番号」の欄の数"""
    return max((sum(1 for k in range(1, 40) if f"{prefix}_r{k}" in e) for e in ents), default=0)


def load_sources():
    """年ごとの直接のURL（audit_sources.json と、最新の年は config.json）"""
    rec = json.loads(SOURCES_PATH.read_text(encoding="utf-8")) if SOURCES_PATH.exists() else {}
    return rec, json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def config_sources(cfg):
    fis = {k: {kk: v for kk, v in cfg[k].items() if not kk.startswith("_")}
           for k in ("fiscal_indicators", "reserve_fund", "budget", "purpose_expenditure", "age_population")}
    pop = {"muni": cfg["population"]["muni"]}
    return fis, pop


def record_sources(fiscal_latest, pop_latest):
    """照合に成功したとき、今の config.json のURLを、その年の分として audit_sources.json に残す"""
    rec, cfg = load_sources()
    fis, pop = config_sources(cfg)
    changed = []
    if fiscal_latest not in FISCAL_PAGES and rec.get("fiscal", {}).get(str(fiscal_latest)) != fis:
        rec.setdefault("fiscal", {})[str(fiscal_latest)] = fis
        changed.append(f"令和{fiscal_latest}年度の財政データ")
    if pop_latest not in POP_PAGES and rec.get("population", {}).get(str(pop_latest)) != pop:
        rec.setdefault("population", {})[str(pop_latest)] = pop
        changed.append(f"令和{pop_latest}年の人口")
    if changed:
        rec["_readme"] = ("年次更新のワークフローが自動で書くファイル（手で書き換えない）。"
                          "照合に成功した年の config.json のURLを残し、翌年以降も過去の年として照合できるようにする。")
        SOURCES_PATH.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


_heads_cache = {}


def heads_of(url):
    """表の見出し（列ごとの文字）。最初に都道府県名が出てくる行より上の、数字でない文字を列ごとにつなげる"""
    if url in _heads_cache:
        return _heads_cache[url]
    hs = []
    for sheet in rows_of(url):
        first = next((i for i, row in enumerate(sheet)
                      if any(re.sub(r"[\s　]", "", str(v)) in PREFS for v in row)), None)
        if first is None:
            continue
        width = max(len(r) for r in sheet[:first + 1])
        for j in range(width):
            parts = []
            for r in sheet[:first]:
                v = r[j] if j < len(r) else None
                if v is None or (isinstance(v, float) and pd.isna(v)):
                    continue
                s = re.sub(r"[\s　]", "", str(v))
                if s and to_num(s) is None:
                    parts.append(s)
            hs.append("".join(parts))
        break
    _heads_cache[url] = hs
    return hs


def head_ok(h, words, excl):
    return any(w in h for w in words) and not any(x in h for x in excl)


def off_val(v):
    """公式の値。空のセルは None、「-」などは 0（取り込みと同じ扱い）"""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    x = to_num(v)
    if x is None:
        return 0.0 if re.sub(r"[\s　]", "", str(v)) in DASHES else None
    return float(round(x))


def match_col(idx, pairs):
    """アプリの値（0以外）と一番多く一致する列。pairs＝[(公式側のキー, アプリの値)]。(列, 比べた数, 一致率)"""
    tally, tried = collections.Counter(), 0
    for key, av in pairs:
        row = idx.get(key)
        if not av or row is None:
            continue
        tried += 1
        for ci, v in enumerate(row):
            x = to_num(v)
            if x is not None and abs(x - av) < 0.5:
                tally[ci] += 1
    if not tally:
        return None, tried, 0.0
    ci, h = tally.most_common(1)[0]
    return ci, tried, h / tried


def audit_details(entities, fiscal_latest, pop_latest, pop_url, check, problems, skipped):
    """人口の増減の内訳（pd）と、歳入・目的別歳出・教育費の内訳（bd）を、総務省のExcelと全団体で照合する（2026-10-01追加）。
    列は値が一番一致する列を使い、その列の見出しが項目名と合っているかも確かめる（列の取り違えの検出）。
    参考情報（照合した件数など）の一覧を返す"""
    notes = []
    idx_cache = {}

    def idx_of(url, ip):
        if (url, ip) not in idx_cache:
            idx_cache[(url, ip)] = index([url], ip)
        return idx_cache[(url, ip)]

    def run(p, label, words, excl, urls, ip, app_ents, ylab):
        """1つの項目を照合する。app_ents＝[(名前, {p: 値}, 都道府県か, キー)]"""
        grp = "都道府県" if ip else "市町村"
        LABEL[p], TOL[p], ROUND[p] = label, 0.5, 0.5
        off = {}
        for u in urls:
            idx = idx_of(u, ip)
            hs = heads_of(u)
            ci, tried, rate = match_col(idx, [(key, ev[p]) for n, ev, _, key in app_ents])
            if ci is None:
                if tried:
                    problems.append(f"{label}（{grp}）：公式の列が特定できません（{u.rsplit('/', 1)[-1]}）")
                    continue
                # アプリの値がこのファイルの団体で全部0のとき：見出しで列を決める
                ci = next((j for j, h in enumerate(hs) if head_ok(h, words, excl)), None)
                if ci is None:
                    if any(key in idx for n, ev, _, key in app_ents):
                        problems.append(f"{label}（{grp}）：公式の列が見つかりません（{u.rsplit('/', 1)[-1]}）")
                    continue
            h = hs[ci] if ci < len(hs) else ""
            if not head_ok(h, words, excl):
                problems.append(f"{label}（{grp}）：値が一致した列の見出しが「{h or '（空）'}」で、項目名と合いません"
                                f"（{u.rsplit('/', 1)[-1]}）")
                continue
            for key, row in idx.items():
                if row is not None and ci < len(row):
                    off[key] = off_val(row[ci])
        if off:
            check(p, ip, 1, 1, off, range(1, 2), ents=app_ents, ylab=ylab)
        return sum(1 for n, ev, _, key in app_ents if key in off)

    # ---- 人口の増減の内訳（最新の年の住民基本台帳。前の年の1年間の出生・死亡・転入・転出） ----
    if pop_url is None:
        skipped.append(f"人口の増減の内訳：令和{pop_latest}年の住民基本台帳のファイルが見つかりません")
    else:
        for ip in (False, True):
            grp = "都道府県" if ip else "市町村"
            base = [(n, e["pd"], eip, key) for n, e, eip, key in entities if eip == ip and isinstance(e.get("pd"), dict)]
            if not base:
                continue
            got = 0
            for f, word, excl in PD_ITEMS:
                p = f"pd_{f}"
                ents = [(n, {p: d[f]}, eip, key) for n, d, eip, key in base if d.get(f) is not None]
                got = max(got, run(p, f"人口の増減の内訳 {PD_LABEL[f]}", (word,), excl, [pop_url], ip, ents,
                                   lambda k: f"令和{pop_latest}年"))
            notes.append(f"人口の増減の内訳（{grp}）：アプリに内訳がある{len(base)}団体のうち、公式の表で見つかった{got}団体を照合")

    # ---- 歳入・目的別歳出・教育費の内訳（最新の年度）と、前年度の目的別歳出 ----
    stale = [n for n, e, ip, key in entities if isinstance(e.get("bd"), dict) and e["bd"].get("y") != fiscal_latest]
    if stale:
        problems.append(f"歳入・歳出の内訳：最新の令和{fiscal_latest}年度ではない内訳が{len(stale)}団体に残っています（例：{'、'.join(stale[:3])}）")

    def files(k):
        ml = links(KESSAN_MUNI[k])
        m_rv = [h for h, t in ml if "歳入内訳" in t]
        m_ex = [h for h, t in ml if "目的別歳出" in t]
        p_rv = [h for h, t in links(KESSAN_PREF[k], after="歳入内訳") if "都道府県別" in t][:1]
        p_ex = [h for h, t in links(KESSAN_PREF[k], after="目的別歳出") if "都道府県別" in t][:1]
        return {"rv": (m_rv, p_rv), "ex": (m_ex, p_ex)}

    try:
        cur = files(fiscal_latest)
    except OSError as ex:
        skipped.append(f"歳入・歳出の内訳：令和{fiscal_latest}年度のページが読めません（{ex}）")
        return notes
    try:
        prev = files(fiscal_latest - 1)
    except OSError as ex:
        prev = None
        skipped.append(f"前年度の目的別歳出：令和{fiscal_latest - 1}年度のページが読めません（{ex}）")
    plan = [("rv", "歳入", BD_ITEMS["rv"], cur["rv"], fiscal_latest, "rv"),
            ("ex", "目的別歳出", BD_ITEMS["ex"], cur["ex"], fiscal_latest, "ex"),
            ("ed", "教育費の内訳", BD_ITEMS["ed"], cur["ex"], fiscal_latest, "ed")]
    if prev:
        plan.append(("exp", "前年度の目的別歳出", BD_ITEMS["ex"], prev["ex"], fiscal_latest - 1, "ex"))
    for g, glabel, items, (m_urls, p_urls), yr, lab_g in plan:
        for ip in (False, True):
            grp = "都道府県" if ip else "市町村"
            base = [(n, e["bd"][g], eip, key) for n, e, eip, key in entities
                    if eip == ip and isinstance(e.get("bd"), dict) and isinstance(e["bd"].get(g), dict)]
            if not base:
                continue
            urls = p_urls if ip else m_urls
            if len(urls) != (1 if ip else 2):
                skipped.append(f"{glabel}（{grp}）令和{yr}年度：Excelのリンクが{len(urls)}件（{(KESSAN_PREF if ip else KESSAN_MUNI)[yr]}）")
                continue
            got = 0
            for f, words, excl in items:
                p = f"bd_{g}_{f}"
                ents = [(n, {p: d[f]}, eip, key) for n, d, eip, key in base if d.get(f) is not None]
                if not ents:
                    continue
                got = max(got, run(p, f"{glabel} {BD_LABEL[lab_g][f]}", words, excl, urls, ip, ents,
                                   lambda k, yr=yr: f"令和{yr}年度"))
            notes.append(f"{glabel}（{grp}）令和{yr}年度：アプリに内訳がある{len(base)}団体のうち、公式の表で見つかった{got}団体を照合")
    return notes


def main():
    entities = []  # (名前, データ, 都道府県か, 公式側のキー)
    for f in DATA_FILES:
        for n, e in json.loads((DATA_DIR / f).read_text(encoding="utf-8")).items():
            is_pref = n == e.get("p")
            entities.append((n, e, is_pref, e["p"] if is_pref else (e["p"], norm_name(n))))

    # 最新の年はデータから決める（f_r1〜f_r5 があれば 令和6年度 が最新）
    all_e = [e for n, e, ip, key in entities]
    FISCAL_LATEST = slots(all_e, "f") + 1
    POP_LATEST = slots(all_e, "pop") + 1
    rec, cfg = load_sources()
    cfg_fis, cfg_pop = config_sources(cfg)
    fis_src = {int(k): v for k, v in rec.get("fiscal", {}).items()}
    pop_src = {int(k): v for k, v in rec.get("population", {}).items()}
    # リハーサル用：最新の年は、ページからではなく config.json のURLで照合する（3月の本番と同じ読み方を試すため）
    force_cfg = os.environ.get("AUDIT_USE_CONFIG_FOR_LATEST") == "1"
    fis_pages = {k: v for k, v in FISCAL_PAGES.items() if not (force_cfg and k == FISCAL_LATEST)}
    pop_pages = {k: v for k, v in POP_PAGES.items() if not (force_cfg and k == POP_LATEST)}
    if FISCAL_LATEST not in fis_pages:
        fis_src.setdefault(FISCAL_LATEST, cfg_fis)  # 最新の年で記録がまだ無ければ config.json のURL
    if POP_LATEST not in pop_pages:
        pop_src.setdefault(POP_LATEST, cfg_pop)
    print(f"照合するデータ：{DATA_DIR}（財政：令和{FISCAL_LATEST}年度まで／人口：令和{POP_LATEST}年まで）")

    def app(e, p, k, latest):
        return e.get(p) if k == latest else e.get(f"{p}_r{k}")

    report, problems, skipped = [], [], []
    sfs_diag = []  # 標準財政規模の列が見つからなかったときの手がかり
    align_rows = ["| 項目 | 区分 | 公式の年 | 一番一致したアプリの年 | 一致率 | 判定 |", "|---|---|---|---|---|---|"]
    mis_rows = ["| 項目 | 区分 | 年 | 照合した団体 | 端数のずれ | 食い違い | 食い違いの例（アプリ → 公式） |", "|---|---|---|---|---|---|---|"]

    def best_conv(idx, p, is_pref, k_app, latest, money, ents=None, scales=None):
        """アプリの令和k_app年の値と一番よく一致する（列, 単位）と一致率を返す"""
        tally, tried = collections.Counter(), 0
        for n, e, ip, key in (ents or entities):
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
                for sc in (scales or (MONEY_SCALES if money else [1])):
                    xv = round(x * sc, 1) if money else x
                    if abs(xv - av) < TOL[p]:
                        tally[(ci, sc)] += 1
        if not tally:
            return None, 0.0, tried
        cs, h = tally.most_common(1)[0]
        return cs, h / tried, tried

    def check(p, is_pref, k, latest, off, app_years, ents=None, ylab=None):
        """公式値 off（キー->値）と、アプリの各年を比べて、年のずれ診断と食い違い一覧を作る。
        ents：照合するデータ（省略時は data-*.json）、ylab：年の番号→表示名（省略時は 令和k）"""
        grp = "都道府県" if is_pref else "市町村"
        ylab = ylab or (lambda y: f"令和{y}")
        ents = ents or entities
        rates = {}
        for j in app_years:
            h = t = 0
            for n, e, ip, key in ents:
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
                problems.append(f"{LABEL[p]}（{grp}）{ylab(k)}：同じ年の一致率{own:.0%}、一番一致したのはアプリの{ylab(bj)}の欄（{rates[bj]:.0%}）")
        align_rows.append(f"| {LABEL[p]} | {grp} | {ylab(k)} | {ylab(bj)}{'（最新）' if bj == latest else ''} | "
                          f"{(own if own is not None else rates[bj]):.1%} | {verdict} |")
        if own is None:
            return
        small, big, ex, tried = 0, 0, [], 0
        for n, e, ip, key in ents:
            if ip != is_pref or key not in off:
                continue
            av = app(e, p, k, latest)
            if av is None:
                continue
            if off[key] is None:
                # 公式は空欄（「－」など）なのに、アプリに値がある＝前の年の値が残っている可能性（2026-09-30 追加）
                big += 1
                if len(ex) < 8:
                    ex.append(f"{n} {av}→空欄")
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
            problems.append(f"{LABEL[p]}（{grp}）{ylab(k)}：食い違い{big}件（例：{'、'.join(ex[:3])}）")
        mis_rows.append(f"| {LABEL[p]} | {grp} | {ylab(k)} | {tried} | {small} | {big} | {'、'.join(ex)} |")

    # config.json の年とデータの最新の年が合っているか
    for lab, key, latest in (("財政", "fiscal_year_label", FISCAL_LATEST), ("人口", "population_year_label", POP_LATEST)):
        try:
            cy = reiwa_num(cfg.get(key))
        except ValueError as ex:
            problems.append(f"config.json の {key}：{ex}")
            continue
        if cy != latest:
            problems.append(f"config.json の {key}（令和{cy}）と、データの最新の年（令和{latest}）が合っていません")

    # ---------- 人口・人口増減率 ----------
    pop_latest_url = None
    for k in range(1, POP_LATEST + 1):
        try:
            if k in pop_pages:
                url = pick(POP_PAGES[k], lambda t: "市区町村別" in t and "人口" in t and "世帯数" in t and "年齢" not in t
                           and "日本人" not in t and "外国人" not in t, many=True, label=f"令和{k}年 住民基本台帳")
                url = url[0]  # 日本人・外国人のファイルは除外済み。残りは総計
            elif k in pop_src:
                url = pop_src[k]["muni"]
            else:
                raise SourceMissing(f"令和{k}年 住民基本台帳：ファイルの記録がありません（audit_sources.json）")
            if k == POP_LATEST:
                pop_latest_url = url
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
    for k in range(1, FISCAL_LATEST + 1):
        src = fis_src.get(k) if k not in fis_pages else None
        for is_pref in (False, True):
            grp = "都道府県" if is_pref else "市町村"
            if k not in fis_pages and src is None:
                skipped.append(f"令和{k}年度（{grp}）：ファイルの記録がありません（audit_sources.json）")
                continue
            side = "pref" if is_pref else "muni"
            fis_idx = kikin_idx = None  # 標準財政規模の照合でも使う（概況・決算状況に無い場合の候補）
            fis_url = kikin_url = None
            try:
                # 財政指標4項目
                if src:
                    u = src["fiscal_indicators"][side]
                else:
                    u = pick(FISCAL_PAGES[k], lambda t: ("全都道府県の主要財政指標" if is_pref else "全市町村の主要財政指標") in t,
                             label=f"令和{k}年度 主要財政指標（{grp}）")
                idx = index([u], is_pref)
                fis_idx, fis_url = idx, u
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
                if src:
                    kikin_url = src["reserve_fund"][side]
                    idx = index([kikin_url], is_pref)
                else:
                    fid = KIKIN_FILES[k][1 if is_pref else 0]
                    if fid not in kikin_page:
                        raise SourceMissing(f"令和{k}年度 基金残高（{grp}）：一覧ページにファイル{fid}が見つかりません")
                    kikin_url = f"https://www.soumu.go.jp/main_content/{fid}.xlsx"
                    idx = index([kikin_url], is_pref)
                kikin_idx = idx
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
                if src:
                    gai_urls = [src["budget"]["pref"]] if is_pref else [src["budget"]["city"], src["budget"]["town"]]
                    moku_urls = ([src["purpose_expenditure"]["pref"]] if is_pref
                                 else [src["purpose_expenditure"]["city"], src["purpose_expenditure"]["town"]])
                elif is_pref:
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
                # 標準財政規模（2026-10-01追加）：アプリは決算カードから取り込んでいるので、別の表（概況・決算状況）と照合する。
                # sfs＝最新の年度、sfs_r1＝その1年前（ほかの項目の _r番号＝令和の年 とは意味が違う）
                for k_s, field in ((FISCAL_LATEST, "sfs"), (FISCAL_LATEST - 1, "sfs_r1")):
                    if k != k_s:
                        continue
                    s_ents = [(n, {"sfs": e[field]}, ip, key) for n, e, ip, key in entities
                              if ip == is_pref and e.get(field) is not None and e.get("sfs_y") == FISCAL_LATEST]
                    if not s_ents:
                        continue
                    # 表の候補：決算状況調（概況・決算状況）→ 主要財政指標一覧 → 基金残高等一覧（2026-10-01：
                    # 都道府県の決算状況の表には標準財政規模の列が無かったため、候補を増やした）
                    hit = None
                    for tname, tidx in (("決算状況調", gai), ("主要財政指標一覧", fis_idx), ("基金残高等一覧", kikin_idx)):
                        if tidx is None:
                            continue
                        cs, rate, _ = best_conv(tidx, "sfs", is_pref, 1, 1, True, ents=s_ents)
                        if cs is not None and rate >= 0.5:
                            hit = (tname, tidx, cs)
                            break
                    if hit is None and is_pref:
                        # 都道府県：決算状況調のページにあるほかの表もすべて探す（2026-10-01。決算状況・主要財政指標一覧・
                        # 基金残高等一覧には、都道府県の標準財政規模の列が無かったため）
                        try:
                            for lu, lt in links(KESSAN_PREF[k]):
                                try:
                                    tidx = index([lu], True)
                                except Exception:
                                    continue
                                cs, rate, _ = best_conv(tidx, "sfs", is_pref, 1, 1, True, ents=s_ents)
                                if cs is not None and rate >= 0.5:
                                    hit = (f"決算状況調「{lt[:20]}」", tidx, cs)
                                    break
                        except OSError:
                            pass
                    if hit is None:
                        problems.append(f"標準財政規模（{grp}）令和{k}年度：公式の表（決算状況調・主要財政指標一覧・基金残高等一覧）で一致する列が見つかりません")
                        # 原因を調べるための手がかり：アプリの値に近い（±25%）セルと、その列の見出し（2団体まで）
                        for n0, ev0, _, key0 in s_ents[:2]:
                            av0 = ev0["sfs"]
                            for tname, tidx, turl in (("決算状況調", gai, gai_urls[0] if len(gai_urls) == 1 else None),
                                                      ("主要財政指標一覧", fis_idx, fis_url), ("基金残高等一覧", kikin_idx, kikin_url)):
                                row0 = tidx.get(key0) if tidx else None
                                if row0 is None:
                                    sfs_diag.append(f"{n0}（アプリ {av0}億円）／{tname}：この団体の行が見つかりません")
                                    continue
                                hs0 = heads_of(turl) if turl else []
                                near = []
                                for ci, v in enumerate(row0):
                                    x = to_num(v)
                                    if x is None:
                                        continue
                                    for sc in MONEY_SCALES:
                                        if av0 and abs(x * sc - av0) <= abs(av0) * 0.25:
                                            near.append(f"列{ci}「{(hs0[ci] if ci < len(hs0) else '')[:30]}」{round(x * sc, 1)}億円")
                                            break
                                sfs_diag.append(f"{n0}（アプリ {av0}億円）／{tname}：" + ("、".join(near) if near else "近い値の列なし"))
                        continue
                    tname, tidx, cs = hit
                    LABEL["sfs"] = f"標準財政規模（{tname}と照合）"
                    off = {key: round(to_num(row[cs[0]]) * cs[1], 1) for key, row in tidx.items()
                           if row is not None and to_num(row[cs[0]]) is not None}
                    check("sfs", is_pref, 1, 1, off, range(1, 2), ents=s_ents, ylab=lambda _k, k=k: f"令和{k}年度")
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
                if src:
                    age_url = src["age_population"][side]
                elif k + 1 in POP_PAGES:
                    age_url = pick(POP_PAGES[k + 1], lambda t: "年齢階級別" in t and ("都道府県別" if is_pref else "市区町村別") in t
                                   and "日本人" not in t and "外国人" not in t, label=f"令和{k + 1}年 年齢別人口（{grp}）")
                else:
                    continue
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

    # ---------- 共通：列の選び方（同じ年で合わなければ、ほかの年の欄とも比べて一番合う列を使う） ----------
    def choose_col(idx, p, ip, k_app, latest, slots, ents, scales=None):
        cs, rate, tried = best_conv(idx, p, ip, k_app, latest, bool(scales), ents=ents, scales=scales)
        if cs is not None and rate >= 0.5:
            return cs
        best = (cs, rate)
        for j in slots:
            if j == k_app:
                continue
            c2, r2, _ = best_conv(idx, p, ip, j, latest, bool(scales), ents=ents, scales=scales)
            if c2 is not None and r2 > best[1]:
                best = (c2, r2)
        return best[0]

    def year_lab(k):  # 公会計・ふるさと納税の欄番号 → 年度（1=平成30年度）
        return "平成30年度" if k == 1 else ("令和元年度" if k == 2 else f"令和{k - 1}年度")

    pref_of = {n: e.get("p") for n, e, ip, key in entities}

    # ---------- 公会計（9指標）：kokaikei.json ----------
    # アプリの欄：ka◯_r1 が一番古い年、主値が最新（令和{KK_LATEST_YEAR}年度）。年度 y（0=平成30年度）→ 欄番号 y+1
    try:
        kk_raw = json.loads((DATA_DIR / "kokaikei.json").read_text(encoding="utf-8"))
        kk_ents = []
        for n, e in kk_raw.items():
            p0 = pref_of.get(n)
            if p0 is None:
                continue
            ip = n == p0
            kk_ents.append((n, e, ip, p0 if ip else (p0, norm_name(n))))
        KK_LATEST_YEAR = slots([e for n, e, ip, key in kk_ents], "ka1")  # ka1_r1〜r5 があれば 令和5年度 が最新
        KK_PAGES = {y: kk_page(y) for y in range(0, KK_LATEST_YEAR + 1)}
        kk_latest = KK_LATEST_YEAR + 1
        kk_notes = []
        kk_detail = ["| 年度 | 団体 | アプリの値（9指標） | 公式Excelの行（そのまま） | アプリの値と一致する同じ県の団体 |", "|---|---|---|---|---|"]
        kk_slots = range(1, kk_latest + 1)
        def kk_sheet_re(y):
            return r"H\s*30" if y == 0 else (r"R\s*(元|0?1)(?!\d)" if y == 1 else rf"R\s*0?{y}(?!\d)")

        def kk_url(y, ip):
            return pick(KK_PAGES[y], lambda t: ("都道府県指標一覧" if ip else "市区町村指標一覧") in t,
                        label=f"{year_lab(y + 1)} 公会計 指標一覧（{grp}）")

        for y in KK_PAGES:
            sheet_re = kk_sheet_re(y)
            for ip in (False, True):
                grp = "都道府県" if ip else "市町村"
                try:
                    u = kk_url(y, ip)
                except SourceMissing as ex:
                    skipped.append(str(ex))
                    continue
                # 公会計の指標一覧は1ファイルに「その年度」と「前年度」の2年分が入っていて、前年度の値は
                # 翌年に修正されていることがある（2026-09-29の照合で判明）。翌年のファイルに前年度のシートが
                # あれば、その修正後の値（最新の公表値）と比べ、最初の公表値との違いは参考として件数だけ出す。
                idx_first = index([u], ip, sheet_re=sheet_re)
                idx, revised = idx_first, False
                if y + 1 in KK_PAGES:
                    try:
                        idx_rev = index([kk_url(y + 1, ip)], ip, sheet_re=sheet_re, strict=True)
                        if len(idx_rev) >= 0.9 * len(idx_first):
                            idx, revised = idx_rev, True
                    except SourceMissing:
                        pass
                if revised:
                    diff_first = 0
                    for key, row in idx.items():
                        r0 = idx_first.get(key)
                        if row is None or r0 is None:
                            continue
                        a = [to_num(v) for v in row if to_num(v) is not None]
                        b = [to_num(v) for v in r0 if to_num(v) is not None]
                        diff_first += a != b
                    kk_notes.append(f"{year_lab(y + 1)}（{grp}）：翌年度のファイルの修正後の値と照合。最初の公表値から修正された団体 {diff_first}件")
                kk_cols = {}
                for i in range(1, 10):
                    p = f"ka{i}"
                    cs = choose_col(idx, p, ip, y + 1, kk_latest, kk_slots, kk_ents)
                    if cs is None:
                        problems.append(f"{LABEL[p]}（{grp}）{year_lab(y + 1)}：公式の列が特定できません")
                        continue
                    kk_cols[p] = cs[0]
                    off = {key: round(to_num(row[cs[0]]), 1) for key, row in idx.items()
                           if row is not None and to_num(row[cs[0]]) is not None}
                    check(p, ip, y + 1, kk_latest, off, kk_slots, ents=kk_ents, ylab=year_lab)
                # ---- 食い違いの詳細（原因を調べるため、例を最大4団体まで表示） ----
                if "ka1" in kk_cols and "ka6" in kk_cols:
                    shown = 0
                    for n, e, eip, key in kk_ents:
                        if eip != ip or shown >= 4:
                            continue
                        row = idx.get(key)
                        av = [app(e, f"ka{i}", y + 1, kk_latest) for i in range(1, 10)]
                        if row is None or av[0] is None or to_num(row[kk_cols["ka1"]]) is None:
                            continue
                        if abs(to_num(row[kk_cols["ka1"]]) - av[0]) <= ROUND["ka1"]:
                            continue
                        shown += 1
                        # アプリの値（資産額・行政コスト）と一致する、同じ都道府県の別の行を探す
                        other = []
                        for k2, r2 in idx.items():
                            if r2 is None or k2 == key or (k2[0] if isinstance(k2, tuple) else k2) != (key[0] if isinstance(key, tuple) else key):
                                continue
                            hit = 0
                            for i in range(1, 10):
                                c = kk_cols.get(f"ka{i}")
                                v2 = to_num(r2[c]) if c is not None else None
                                if v2 is not None and av[i - 1] is not None and abs(v2 - av[i - 1]) <= 0.11:
                                    hit += 1
                            if hit >= 6:
                                other.append(k2[1] if isinstance(k2, tuple) else k2)
                        cells = [str(v)[:10] for v in row if str(v) not in ("nan", "None")][:16]
                        kk_detail.append(f"| {year_lab(y + 1)} | {n} | {av} | {cells} | {'、'.join(other) if other else 'なし'} |")
    except (SourceMissing, OSError) as ex:
        skipped.append(f"公会計：{ex}")
        kk_notes = []
        kk_detail = []

    # ---------- ふるさと納税：受入額（fuH、8年分）と最新の住民税控除額（fk） ----------
    try:
        fl = links(FURU_PAGE)
        uk = [h for h, t in fl if "受入額及び受入件数" in t and "平成20年度" in t]
        kj = [h for h, t in fl if "住民税控除額" in t and "課税" in t]
        if not uk:
            raise SourceMissing(f"ふるさと納税：受入額の推移のExcelが見つかりません（{FURU_PAGE}）")
        fu_ents, fk_ents = [], []
        for n, e, ip, key in entities:
            h = e.get("fuH")
            if isinstance(h, list) and len(h) == 8:
                e2 = {f"fu_r{i + 1}": h[i] for i in range(7)}
                e2["fu"] = h[7]
                fu_ents.append((n, e2, ip, key))
            if e.get("fk") is not None:
                fk_ents.append((n, {"fk": e["fk"]}, ip, key))
        fu_scales = [0.1, 1, 0.01, 0.001, 0.0001]
        for ip in (False, True):
            grp = "都道府県" if ip else "市町村"
            idx = index([uk[0]], ip)
            for k in range(1, 9):
                cs = choose_col(idx, "fu", ip, k, 8, range(1, 9), fu_ents, scales=fu_scales)
                if cs is None:
                    problems.append(f"{LABEL['fu']}（{grp}）{year_lab(k)}：公式の列が特定できません")
                    continue
                off = {key: round(to_num(row[cs[0]]) * cs[1], 1) for key, row in idx.items()
                       if row is not None and to_num(row[cs[0]]) is not None}
                check("fu", ip, k, 8, off, range(1, 9), ents=fu_ents, ylab=year_lab)
            # 控除額（最新の課税年度）：市町村民税分＋道府県民税分の2列の合計（円→万円）
            if not kj:
                skipped.append("ふるさと納税：住民税控除額のExcelが見つかりません")
                continue
            idk = index([kj[0]], ip)
            tally, tried = collections.Counter(), 0
            for n, e2, eip, key in fk_ents:
                row = idk.get(key)
                if eip != ip or row is None:
                    continue
                tried += 1
                nums = [(ci, to_num(v)) for ci, v in enumerate(row) if to_num(v) is not None]
                for a in range(len(nums)):
                    for b in range(a + 1, len(nums)):
                        if abs(round((nums[a][1] + nums[b][1]) / 1e4, 1) - e2["fk"]) < TOL["fk"]:
                            tally[(nums[a][0], nums[b][0])] += 1
            if not tally:
                problems.append(f"{LABEL['fk']}（{grp}）：公式の列が特定できません")
                continue
            (ca, cb), _ = tally.most_common(1)[0]
            off = {}
            for key, row in idk.items():
                if row is None:
                    continue
                va, vb = to_num(row[ca]), to_num(row[cb])
                if va is not None and vb is not None:
                    off[key] = round((va + vb) / 1e4, 1)
            check("fk", ip, 1, 1, off, range(1, 2), ents=fk_ents, ylab=lambda k: "最新の課税年度")
    except (SourceMissing, OSError) as ex:
        skipped.append(str(ex))

    # 標準財政規模の年（sfs_y）が最新の年度か
    old_sfs = [n for n, e, ip, key in entities if e.get("sfs") is not None and e.get("sfs_y") != FISCAL_LATEST]
    if old_sfs:
        problems.append(f"標準財政規模：最新の令和{FISCAL_LATEST}年度ではない値が{len(old_sfs)}団体にあります（例：{'、'.join(old_sfs[:3])}）")

    # ---------- 人口の増減の内訳・歳入と歳出の内訳（最新の年） ----------
    try:
        detail_notes = audit_details(entities, FISCAL_LATEST, POP_LATEST, pop_latest_url, check, problems, skipped)
    except (SourceMissing, OSError) as ex:
        skipped.append(f"内訳：{ex}")
        detail_notes = []

    # ---------- 報告 ----------
    head = "## ✅ 公式データとの照合：問題なし" if not problems else f"## ⚠️ 公式データとの照合：確認が必要な点が{len(problems)}件"
    report = [head, "", "データは書き換えていません。", ""]
    if problems:
        report += ["### 確認が必要な点", ""] + [f"- {x}" for x in problems] + [""]
    if skipped:
        report += ["### 照合できなかったもの（公式ファイルが見つからない）", ""] + [f"- {x}" for x in skipped] + [""]
    if sfs_diag:
        report += ["### 標準財政規模の手がかり（列が見つからなかったとき）", "",
                   "アプリの値に近いセルがある列と、その見出しです。", ""] + [f"- {x}" for x in sfs_diag] + [""]
    if detail_notes:
        report += ["### 内訳の照合（参考情報）", ""] + [f"- {x}" for x in detail_notes] + [""]
    if kk_notes:
        report += ["### 公会計の参考情報", ""] + [f"- {x}" for x in kk_notes] + [""]
    if len(kk_detail) > 2:
        report += ["### 公会計の食い違いの詳細（例）", "",
                   "アプリの値と、公式Excelの同じ団体の行を並べています。原因（行のずれ・列のずれ）を調べるためのものです。", ""] + kk_detail + [""]
    report += ["### 年のずれの診断", "", "公式の各年が、アプリのどの年の欄と一番よく一致したか。", ""] + align_rows + [""]
    report += ["### 食い違いの件数", "",
               "端数のずれ＝四捨五入の違い程度（0.1、財政力指数は0.01、人口は1人以内）。それより大きいものは「食い違い」。内訳（人数・千円）は1つでも違えば「食い違い」。",
               ""] + mis_rows
    text = "\n".join(report)
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")
    # 年次更新（--record）のときは、古い年の公式ファイルが見つからないだけなら止めない（最新の年は必ず照合される）
    if problems or (skipped and "--record" not in sys.argv):
        sys.exit(1)
    if "--record" in sys.argv:
        changed = record_sources(FISCAL_LATEST, POP_LATEST)
        msg = (f"\n照合に使ったURLを記録しました：{'、'.join(changed)}（scripts/audit_sources.json）" if changed
               else "\n記録するURLはありません（すべて記録済み）")
        print(msg)
        if sp:
            with open(sp, "a", encoding="utf-8") as fp:
                fp.write(msg + "\n")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
歳入内訳・目的別歳出内訳を取り込む（年次更新の「1b」。2026-10-01追加）

詳細画面の「🔍 内訳から分かること」に使う金額を、総務省の決算状況調から取り込み、各自治体の bd に入れる。
    bd = {"y": 令和の年度,
          "rv": 歳入（tax 地方税／lat 地方交付税／nat 国庫支出金／prf 都道府県支出金／bond 地方債／tr 繰入金）,
          "ex": 目的別歳出（minsei 民生費／jido 児童福祉費／somu 総務費／eisei 衛生費／doboku 土木費／edu 教育費／
                kosai 公債費／shobo 消防費／keisatsu 警察費／norin 農林水産業費／shoko 商工費／saigai 災害復旧費／rodo 労働費／gikai 議会費）,
          "ed": 教育費の内訳（kyu 学校給食費／sho 小学校費／chu 中学校費／koko 高等学校費／tokushi 特別支援学校費／yochi 幼稚園費／shakai 社会教育費／somu 教育総務費）,
          "exp": 前年度の目的別歳出（ex と同じ項目。前年度からの変化に使う）}
    金額はすべて千円（Excelのまま）。

・ファイルは年度ごとの総務省のページ（r0k_shichouson.html／r0k_todohuken.html）のリンクから自動で探す（config.json の書き換え不要）
・列は見出しの文字で探す（列の位置が変わっても取り違えない）
・取り込んだ教育費・児童福祉費から計算した教育費比率が、アプリの教育費比率（edu）と一致するかで、列の取り違えを確かめる
・どこかで取り込めなくても、年次更新は止めない（その年は 🔍 の欄が出ないだけ。古い年の bd は消す）
"""
import io
import json
import os
import re
import sys
import urllib.request
from html import unescape
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
from update_fiscal_data import CONFIG_PATH, DATA_DIR, REGION_FILES, lookup_muni, reiwa_num  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (mitchie-fiscal)"}
RV = {"tax": ["地方税", "道府県税", "都道府県税"], "lat": ["地方交付税"], "nat": ["国庫支出金"], "prf": ["都道府県支出金"],
      "bond": ["地方債"], "tr": ["繰入金"]}
EX = {"gikai": ["議会費"], "somu": ["総務費"], "minsei": ["民生費"], "jido": ["児童福祉費"], "eisei": ["衛生費"], "rodo": ["労働費"],
      "norin": ["農林水産業費"], "shoko": ["商工費"], "doboku": ["土木費"], "keisatsu": ["警察費"], "shobo": ["消防費"],
      "edu": ["教育費"], "saigai": ["災害復旧費"], "kosai": ["公債費"]}
ED = {"somu": ["教育総務費"], "sho": ["小学校費"], "chu": ["中学校費"], "koko": ["高等学校費"], "tokushi": ["特別支援学校費"],
      "yochi": ["幼稚園費"], "shakai": ["社会教育費"], "kyu": ["学校給食費"]}


def out(t=""):
    print(t)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(t + "\n")


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def page_links(url):
    """(リンクの文字, URL, ページ内の位置) の一覧"""
    raw = get(url)
    try:
        html = raw.decode("utf-8")
    except UnicodeDecodeError:
        html = raw.decode("cp932", errors="ignore")
    res = []
    for m in re.finditer(r'<a[^>]+href="([^"]+\.xlsx?)"[^>]*>(.*?)</a>', html, flags=re.S | re.I):
        t = re.sub(r"<[^>]+>|\s", "", unescape(m.group(2)))
        h = m.group(1)
        h = "https://www.soumu.go.jp" + h if h.startswith("/") else h
        res.append((t, h, m.start()))
    return html, res


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    s = str(v).strip().replace(",", "")
    if s in ("-", "－", "‐", "―", ""):
        return 0
    try:
        return int(round(float(s)))
    except ValueError:
        return None


def clean(v):
    return re.sub(r"[\s　]", "", str(v)) if v is not None else ""


def read_table(data, pref_file):
    """(行のリスト, 見出しの列ごとの文字, 名前の列) を返す。
    市町村のファイル：団体コード（6桁）の列の右が団体名。都道府県のファイル：最初の列が団体名で「北海道」の行から"""
    wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    first = None
    name_col = 0
    for i, r in enumerate(rows):
        if pref_file:
            if r and clean(r[0]) == "北海道":
                first, name_col = i, 0
                break
        else:
            for j, v in enumerate(r[:30]):
                if v is not None and re.fullmatch(r"\d{5,6}", clean(v)) and j + 1 < len(r) and r[j + 1] and not re.fullmatch(r"[\d,.\-]+", clean(r[j + 1])):
                    first, name_col = i, j + 1
                    break
            if first is not None:
                break
    if first is None:
        raise ValueError("データの始まりの行が見つかりません")
    # 市町村のファイルは、最初の団体の上に都道府県の見出し行（「北海道」などコードなし）があるので、そこから読む
    while not pref_file and first >= 1 and name_col < len(rows[first - 1]) and rows[first - 1][name_col] \
            and not clean(rows[first - 1][name_col - 1] if name_col - 1 < len(rows[first - 1]) else ""):
        first -= 1
    width = max(len(r) for r in rows[:first + 1])
    heads = []
    for j in range(width):
        heads.append("".join(clean(rows[i][j]) for i in range(first) if j < len(rows[i]) and rows[i][j] is not None))
    return rows[first:], heads, name_col


def find_cols(heads, name_col, spec):
    """見出しにその言葉を含む、いちばん左の列（団体名より右）"""
    cols = {}
    for k, words in spec.items():
        for j in range(name_col + 1, len(heads)):
            if any(w in heads[j] for w in words):
                cols[k] = j
                break
    return cols


def index_rows(rows, name_col, pref_file):
    """{(都道府県, 団体名): 行}。市町村のファイルは都道府県の見出し行（コードなし）で区切られている"""
    idx = {}
    cur_pref = None
    for r in rows:
        if name_col >= len(r) or not r[name_col]:
            continue
        nm = clean(r[name_col])
        if pref_file:
            idx[(nm, nm)] = r
            continue
        code = clean(r[name_col - 1]) if name_col >= 1 else ""
        if not re.fullmatch(r"\d{5,6}", code):
            cur_pref = nm
            continue
        idx[(cur_pref, nm)] = r
    return idx


def load(urls, pref_file, spec, label):
    """複数のファイル（市・町村）をまとめて読む。{(都道府県, 団体名): {項目: 千円}}"""
    res = {}
    for u in urls:
        rows, heads, nc = read_table(get(u), pref_file)
        cols = find_cols(heads, nc, spec)
        missing = [k for k in spec if k not in cols]
        need = {"tax", "lat", "bond"} if spec is RV else {"minsei", "edu", "kosai"} if spec is EX else {"sho"}
        if need - set(cols):
            raise ValueError(f"{label}：必要な列が見つかりません {sorted(need - set(cols))}（{u}）")
        out(f"- {label}：{u.rsplit('/', 1)[-1]}（見つからない列：{missing or 'なし'}）")
        for key, r in index_rows(rows, nc, pref_file).items():
            res[key] = {k: num(r[c]) for k, c in cols.items() if c < len(r) and num(r[c]) is not None}
    return res


def files_for_year(k):
    """令和k年度の (市町村の歳入, 市町村の目的別, 都道府県の歳入, 都道府県の目的別) のURL"""
    _, ml = page_links(f"https://www.soumu.go.jp/iken/zaisei/r{k:02d}_shichouson.html")
    m_rv = [h for t, h, p in ml if "歳入内訳" in t]
    m_ex = [h for t, h, p in ml if "目的別歳出" in t]
    html, pl = page_links(f"https://www.soumu.go.jp/iken/zaisei/r{k:02d}_todohuken.html")

    def after(word):
        i = html.find(word)
        return [h for t, h, p in pl if i >= 0 and p > i and "都道府県別" in t]
    p_rv = after("歳入内訳")[:1]
    p_ex = after("目的別歳出")[:1]
    return m_rv, m_ex, p_rv, p_ex


def main():
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    fy = reiwa_num(cfg["fiscal_year_label"])
    out(f"## 1b. 歳入内訳・目的別歳出（{cfg['fiscal_year_label']}、前年度との比較用に令和{fy - 1}年度も）\n")
    def safe(fn, *args):
        try:
            return fn(*args)
        except Exception as ex:
            out(f"- ⚠️ {args[-1]}：読めませんでした（{ex}）")
            return {}
    RVm = EXm = EDm = RVp = EXp = EDp = PEXm = PEXp = {}
    try:
        m_rv, m_ex, p_rv, p_ex = files_for_year(fy)
        out(f"- 令和{fy}年度のファイル：市町村 歳入{len(m_rv)}・目的別{len(m_ex)}／都道府県 歳入{len(p_rv)}・目的別{len(p_ex)}")
        if len(m_rv) == 2 and len(m_ex) == 2:
            RVm, EXm, EDm = safe(load, m_rv, False, RV, "市町村 歳入"), safe(load, m_ex, False, EX, "市町村 目的別"), safe(load, m_ex, False, ED, "市町村 教育費の内訳")
        if p_rv and p_ex:
            RVp, EXp, EDp = safe(load, p_rv, True, RV, "都道府県 歳入"), safe(load, p_ex, True, EX, "都道府県 目的別"), safe(load, p_ex, True, ED, "都道府県 教育費の内訳")
        try:
            pm_rv, pm_ex, pp_rv, pp_ex = files_for_year(fy - 1)
            if len(pm_ex) == 2:
                PEXm = safe(load, pm_ex, False, EX, f"令和{fy - 1}年度 市町村 目的別")
            if pp_ex:
                PEXp = safe(load, pp_ex, True, EX, f"令和{fy - 1}年度 都道府県 目的別")
        except Exception as ex:
            out(f"- ⚠️ 前年度のファイルを探せませんでした（{ex}）。前年度からの変化は出しません")
    except Exception as ex:
        out(f"- ⚠️ 総務省のページを読めませんでした（{ex}）。今年は「🔍 内訳から分かること」を出しません（年次更新は続けます）")

    n_ok = n_miss = n_bad = 0
    bad = []
    for fname, prefs in REGION_FILES.items():
        path = DATA_DIR / fname
        db = json.loads(path.read_text(encoding="utf-8"))
        for name, e in db.items():
            is_pref = name in prefs
            key_lookup = (lambda idx: idx.get((name, name))) if is_pref else (lambda idx: lookup_muni(idx, e.get("p"), name))
            rv, ex, ed = key_lookup(RVp if is_pref else RVm), key_lookup(EXp if is_pref else EXm), key_lookup(EDp if is_pref else EDm)
            if not rv or not ex:
                e.pop("bd", None)
                n_miss += 1
                continue
            # 列の取り違えがないか：教育費 ÷ 歳出 がアプリの教育費比率と一致するか
            if e.get("edu") is not None and e.get("eo") and ex.get("edu") is not None:
                ratio = round(ex["edu"] / (e["eo"] * 100000) * 100, 1)
                if abs(ratio - e["edu"]) > 0.15:
                    bad.append(f"{name}（教育費比率 {ratio}% と {e['edu']}%）")
                    e.pop("bd", None)
                    n_bad += 1
                    continue
            bd = {"y": fy, "rv": rv, "ex": ex}
            if ed:
                bd["ed"] = ed
            pex = key_lookup(PEXp if is_pref else PEXm) if (PEXp or PEXm) else None
            if pex:
                bd["exp"] = pex
            e["bd"] = bd
            n_ok += 1
        path.write_text(json.dumps(db, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    out(f"\n- 取り込み：{n_ok}自治体　見つからない：{n_miss}　教育費比率が合わず使わなかった：{n_bad}")
    if bad:
        out("  - " + "、".join(bad[:20]))
    if n_ok < 1500:
        out("- ⚠️ 取り込めた自治体が少なすぎます。総務省のExcelの形式が変わった可能性があります")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
財政状況資料集から、国の基準を超えた自治体の「自治体自身の説明」を取り込む（年次更新の6番目）

対象：実質公債費比率18%以上、または将来負担比率が基準以上（市町村350%・都道府県と政令市400%）の自治体だけ。
取り込むもの（各自治体が財政状況資料集に書いた文章を、言い換えずにそのまま）：
    reserve … 財政調整基金の増減理由・今後の方針（「基金残高に係る経年分析」）
    debt    … 実質公債費比率の分析欄（「実質公債費比率（分子）の構造」）
    future  … 将来負担比率の分析欄（「将来負担比率（分子）の構造」）
取得先：
    都道府県 … 総務省の財政状況資料集のページ（年度ごとの一覧）にある Excel
    市町村   … 総務省の一覧ページからリンクされている各都道府県のページの表から ZIP / Excel を探す
結果は MITCHIE_DATA_DIR（ふつうは preview）/shiryou.json に保存する。
・どの自治体も取り込めなくても、エラーで止めない（年次更新は続ける）。取り込めなかったことは Summary に出す。
・ファイルが別の自治体・別の年度のものなら使わない（名前と年度を確かめる）。
・取り込めなかった自治体は shiryou.json に入れない（前の年の文章を残さない）。
"""
import io
import json
import os
import re
import urllib.request
from urllib.parse import urljoin
import zipfile
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / os.environ.get("MITCHIE_DATA_DIR", "preview")
DATA_FILES = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
              "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]
PREFS_SUFFIX = ("都", "道", "府", "県")
UA = {"User-Agent": "Mozilla/5.0 (mitchie-fiscal)"}


def out(text=""):
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def is_pref(name, e):
    return name == e.get("p") and name.endswith(PREFS_SUFFIX)


def reiwa_num(label):
    m = re.search(r"令和(\d+|元)", label)
    return 1 if m.group(1) == "元" else int(m.group(1))


# 政令指定都市（20市）。将来負担比率の早期健全化基準は、都道府県と同じ400%（総務省「早期健全化基準と財政再生基準」）
SEIREI = {"札幌市": "北海道", "仙台市": "宮城県", "さいたま市": "埼玉県", "千葉市": "千葉県", "横浜市": "神奈川県",
          "川崎市": "神奈川県", "相模原市": "神奈川県", "新潟市": "新潟県", "静岡市": "静岡県", "浜松市": "静岡県",
          "名古屋市": "愛知県", "京都市": "京都府", "大阪市": "大阪府", "堺市": "大阪府", "神戸市": "兵庫県",
          "岡山市": "岡山県", "広島市": "広島県", "北九州市": "福岡県", "福岡市": "福岡県", "熊本市": "熊本県"}


def badge_entities():
    res = []
    for f in DATA_FILES:
        for name, e in json.loads((DATA / f).read_text(encoding="utf-8")).items():
            pref = is_pref(name, e)
            d, u = e.get("d") or 0, e.get("u") or 0
            if d >= 18 or u >= (400 if pref or SEIREI.get(name) == e.get("p") else 350):
                res.append((name, e.get("p"), pref, d, u))
    return res


def decode_html(raw):
    """総務省のページは Shift_JIS のことがあるので、文字コードを判定して読む"""
    m = re.search(rb'charset=["\']?([A-Za-z0-9_\-]+)', raw[:3000])
    enc = (m.group(1).decode().lower() if m else "utf-8")
    if enc in ("shift_jis", "shift-jis", "sjis", "x-sjis"):
        enc = "cp932"
    try:
        return raw.decode(enc)
    except Exception:
        for e in ("utf-8", "cp932", "euc_jp"):
            try:
                return raw.decode(e)
            except Exception:
                pass
    return raw.decode("utf-8", errors="replace")


def anchors(html, base):
    """ページ内のリンクを順番に (文字, URL) で返す"""
    res = []
    for m in re.finditer(r"<a\s[^>]*href=\"([^\"]+)\"[^>]*>(.*?)</a>", html, re.S | re.I):
        text = re.sub(r"<[^>]+>", "", unescape(m.group(2))).strip()
        href = urljoin(base, unescape(m.group(1)))
        res.append((text, href, m.start()))
    return res


def shapes_text(xlsx_bytes):
    """Excelの図形（テキストボックス）の文章を、図形ごとに取り出す"""
    z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
    texts = []
    for n in sorted(z.namelist()):
        if not re.match(r"xl/drawings/drawing\d+\.xml$", n):
            continue
        s = z.read(n).decode("utf-8")
        for sp in re.findall(r"<xdr:sp[\s>].*?</xdr:sp>", s, re.S):
            paras = []
            for p in re.findall(r"<a:p[\s>].*?</a:p>", sp, re.S):
                t = "".join(re.findall(r"<a:t(?:\s[^>]*)?>(.*?)</a:t>", p, re.S))
                if t.strip():
                    paras.append(unescape(t).strip())
            if paras:
                texts.append("\n".join(paras))
    return texts


def shapes_by_sheet(xlsx_bytes):
    """シートごとに、図形（テキストボックス）の位置と文章を取り出す
    戻り値：{シート名: [(上の行, 左の列, 下の行, 文章), ...]}"""
    z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
    wb = z.read("xl/workbook.xml").decode("utf-8")
    rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    rmap = {}
    for m in re.finditer(r"<Relationship\s[^>]*>", rels):
        tag = m.group(0)
        i, t = re.search(r'Id="([^"]+)"', tag), re.search(r'Target="([^"]+)"', tag)
        if i and t:
            rmap[i.group(1)] = t.group(1)
    res = {}
    for m in re.finditer(r"<sheet\s[^>]*>", wb):
        tag = m.group(0)
        nm, rid = re.search(r'name="([^"]+)"', tag), re.search(r'r:id="([^"]+)"', tag)
        if not nm or not rid or rid.group(1) not in rmap:
            continue
        sheet_file = rmap[rid.group(1)].split("/")[-1]
        try:
            srels = z.read(f"xl/worksheets/_rels/{sheet_file}.rels").decode("utf-8")
        except KeyError:
            continue
        d = re.search(r'Target="\.\./drawings/(drawing\d+\.xml)"', srels)
        if not d:
            continue
        xml = z.read("xl/drawings/" + d.group(1)).decode("utf-8")
        items = []
        for a in re.findall(r"<xdr:(?:twoCellAnchor|oneCellAnchor)[\s>].*?</xdr:(?:twoCellAnchor|oneCellAnchor)>", xml, re.S):
            fr = re.search(r"<xdr:from><xdr:col>(\d+)</xdr:col>.*?<xdr:row>(\d+)</xdr:row>", a, re.S)
            to = re.search(r"<xdr:to><xdr:col>(\d+)</xdr:col>.*?<xdr:row>(\d+)</xdr:row>", a, re.S)
            paras = []
            for pp in re.findall(r"<a:p[\s>].*?</a:p>", a, re.S):
                t = "".join(re.findall(r"<a:t(?:\s[^>]*)?>(.*?)</a:t>", pp, re.S))
                if t.strip():
                    paras.append(unescape(t).strip())
            if fr and paras:
                items.append((int(fr.group(2)), int(fr.group(1)), int(to.group(2)) if to else int(fr.group(2)), "\n".join(paras)))
        res[unescape(nm.group(1))] = items
    return res


def is_comment(t):
    """分析欄の文章らしいか（数字の羅列・注意書き・見出しを除く）"""
    t1 = t.replace("\n", "")
    return len(t1) >= 30 and not t1.startswith("※") and len(re.findall(r"[ぁ-ん]", t1)) >= 10


def extract_comments(xlsx_bytes):
    """財政状況資料集から、①財政調整基金 ②実質公債費比率 ③将来負担比率 の自治体の説明を取り出す"""
    sheets = shapes_by_sheet(xlsx_bytes)
    res = {}
    # ① 財政調整基金：「財政調整基金」という見出しの図形のすぐ下にある文章
    for nm, items in sheets.items():
        if "基金残高" not in nm:
            continue
        labels = [it for it in items if it[3].strip() == "財政調整基金"]
        for lr, lc, lto, _ in labels:
            below = sorted([it for it in items if is_comment(it[3]) and lto - 1 <= it[0] <= lto + 3 and abs(it[1] - lc) <= 2])
            if below:
                res["財政調整基金"] = below[0][3]
                break
    # ②③ 「実質公債費比率（分子）の構造」「将来負担比率（分子）の構造」の分析欄（いちばん上の文章）
    for key in ("実質公債費比率", "将来負担比率"):
        for nm, items in sheets.items():
            if key in nm and "構造" in nm:
                cs = sorted(it for it in items if is_comment(it[3]))
                if cs:
                    res[key] = cs[0][3]
                break
    return res, sheets


def find_in_table_rows(page_url, name):
    """都道府県のページの表で、市町村名が書かれた行にある ZIP / Excel を開いて、その市町村の Excel を探す。
    （北海道庁のように「夕張市、岩見沢市、美唄市｜1／8（ZIP）」と並んでいる形）
    戻り値：(Excelの中身, 説明) または (None, 説明)"""
    html = decode_html(get(page_url))
    notes = []
    rows = re.findall(r"<tr[\s>].*?</tr>", html, re.S | re.I)
    cand = []
    for r in rows:
        text = re.sub(r"<[^>]+>", "", unescape(r))
        if name not in text:
            continue
        for t, h, p in anchors(r, page_url):
            low = h.lower().split("?")[0]
            # 「夕張市~歌志内市」のように範囲で書かれたリンクは決算カードなので後回し
            if low.endswith((".zip", ".xlsx", ".xls")) and h not in [c[1] for c in cand]:
                cand.append(("~" in t or "～" in t, h, t))
    cand.sort(key=lambda c: c[0])
    notes.append(f"{name}の行にあったファイル：{len(cand)}（" + "、".join(t for _, h, t in cand) + "）")
    for _, h, t in cand:
        data = get(h)
        if h.lower().split("?")[0].endswith(".zip"):
            zf = zipfile.ZipFile(io.BytesIO(data))
            for n, info in zip_names(zf):
                if name in n and n.lower().endswith((".xlsx", ".xlsm")):
                    notes.append(f"見つけたファイル：{t} の中の {n}")
                    return zf.read(info), notes
            notes.append(f"{t}：中身 " + "、".join(n for n, _ in zip_names(zf)[:6]))
        elif name in t:
            notes.append(f"見つけたファイル：{t}")
            return data, notes
    return None, notes


def find_on_pref_site(start_url, name, max_pages=40):
    """都道府県のページから、市町村名の付いた Excel を探す（同じサイト内を2階層まで）"""
    from urllib.parse import urlparse
    host = urlparse(start_url).netloc
    seen, queue, tried = set(), [(start_url, 0)], []
    while queue and len(seen) < max_pages:
        url, depth = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            html = decode_html(get(url))
        except Exception as ex:
            tried.append(f"{url}（読めず：{ex}）")
            continue
        tried.append(url)
        links = anchors(html, url)
        for t, h, p in links:
            low = h.lower().split("?")[0]
            if name in t and low.endswith((".xlsx", ".xls", ".xlsm")):
                return h, tried
        # Excel のリンク文字が「Excel」だけのときは、前後の文字に名前があるかで判定
        for t, h, p in links:
            low = h.lower().split("?")[0]
            if low.endswith((".xlsx", ".xls", ".xlsm")) and name in re.sub(r"<[^>]+>", "", html[max(0, p - 300):p]):
                return h, tried
        if depth < 2:
            for t, h, p in links:
                low = h.lower().split("?")[0].split("#")[0]
                if urlparse(h).netloc == host and low.endswith((".html", ".htm", "/")) and h not in seen:
                    if depth == 0 or name in t or "財政状況資料集" in t or "資料集" in t:
                        queue.append((h.split("#")[0], depth + 1))
    return None, tried


def zip_names(zf):
    res = []
    for info in zf.infolist():
        name = info.filename
        if not info.flag_bits & 0x800:
            try:
                name = name.encode("cp437").decode("cp932")
            except Exception:
                pass
        res.append((name, info))
    return res



LABELS = {"reserve": "財政調整基金", "debt": "実質公債費比率", "future": "将来負担比率"}


def collect(name, xlsx_bytes, fy_label):
    """Excelから3つの説明を取り出す。名前・年度が違えば None"""
    res, sheets = extract_comments(xlsx_bytes)
    joined = "\n".join(it[3] for items in sheets.values() for it in items)
    base = re.sub(r"（.*?）", "", name)
    if base not in joined:
        out(f"- ❌ このExcelの中に「{base}」の名前がないため使いません")
        return None
    if not any(it[3].strip() == fy_label for items in sheets.values() for it in items):
        out(f"- ❌ このExcelは{fy_label}のものではないため使いません")
        return None
    entry = {}
    for k, label in LABELS.items():
        if label in res:
            entry[k] = res[label].strip()
        else:
            out(f"- ⚠️ {label}の説明が見つかりませんでした")
    return entry


def find_excel(name, pref, isp, links, pos_muni):
    """(Excelの中身, 取得元URL) を返す。見つからなければ (None, None)"""
    if isp:
        cand = [h for t, h, p in links if h.lower().endswith(".xlsx") and name in t and (pos_muni < 0 or p < pos_muni)]
        return (get(cand[0]), cand[0]) if cand else (None, None)
    after = [(t, h) for t, h, p in links if p > pos_muni]
    pref_pages = [h for t, h in after if pref in t and not h.lower().endswith((".zip", ".pdf", ".xlsx"))]
    if not pref_pages:
        return None, None
    data, notes = find_in_table_rows(pref_pages[0], re.sub(r"（.*?）", "", name))
    for nt in notes:
        out(f"- {nt}")
    if data is not None:
        return data, pref_pages[0]
    xl, tried = find_on_pref_site(pref_pages[0], re.sub(r"（.*?）", "", name))
    if xl:
        return get(xl), xl
    return None, None


def main():
    cfg = json.loads((ROOT / "scripts" / "config.json").read_text(encoding="utf-8"))
    fy_label = cfg["fiscal_year_label"]
    fy = reiwa_num(fy_label)
    index_url = f"https://www.soumu.go.jp/iken/zaisei/jyoukyou_shiryou/r{fy:02d}/index.html"
    out("## 6. 財政状況資料集（国の基準を超えた自治体の説明）\n")
    targets = badge_entities()
    out(f"- 年度：{fy_label}、対象：" + ("、".join(n for n, *_ in targets) if targets else "なし"))
    result = {"_year": fy_label,
              "_note": "財政状況資料集に各自治体が書いた説明（言い換えなし）。scripts/fetch_shiryou.py が年次更新で作る。"}
    try:
        html = decode_html(get(index_url))
        links = anchors(html, index_url)
        pos_muni = html.find("市町村の財政状況資料集")
    except Exception as ex:
        out(f"- ⚠️ 総務省の一覧ページを読めませんでした（{ex}）。今年は説明なしで続けます")
        targets, links, pos_muni = [], [], -1
    for name, pref, isp, d, u in targets:
        out(f"### {name}")
        try:
            data, src = find_excel(name, pref, isp, links, pos_muni)
            if data is None:
                out("- ⚠️ 財政状況資料集のExcelが見つかりませんでした")
                continue
            entry = collect(name, data, fy_label)
            if entry:
                entry["src"] = src
                result[name] = entry
                out("- ✅ 取り込みました：" + "、".join(LABELS[k] for k in LABELS if k in entry))
        except Exception as ex:
            out(f"- ⚠️ エラーのため取り込めませんでした（{ex}）")
    path = DATA / "shiryou.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n = len([k for k in result if not k.startswith("_")])
    out(f"\n- {path.relative_to(ROOT)} に保存しました（{n}自治体）")


if __name__ == "__main__":
    main()

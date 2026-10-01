# -*- coding: utf-8 -*-
"""
財政状況資料集の取り込みテスト（確認専用・データは書き換えない）

国の基準を超えた自治体（実質公債費比率18%以上、将来負担比率が基準以上）だけについて、
総務省の「財政状況資料集」をダウンロードして、自治体が書いた説明文
（基金残高の増減理由・今後の方針など）を取り出せるかを確かめる。
結果はワークフローの Summary に表示するだけ。
"""
import io
import json
import os
import re
import sys
import urllib.request
from urllib.parse import urljoin
import zipfile
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "preview"
DATA_FILES = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
              "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]
PREFS_SUFFIX = ("都", "道", "府", "県")
UA = {"User-Agent": "Mozilla/5.0 (mitchie-fiscal check)"}


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


def badge_entities():
    res = []
    for f in DATA_FILES:
        for name, e in json.loads((DATA / f).read_text(encoding="utf-8")).items():
            pref = is_pref(name, e)
            d, u = e.get("d") or 0, e.get("u") or 0
            if d >= 18 or u >= (400 if pref else 350):
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


def show_fund_text(label, xlsx_bytes):
    res, sheets = extract_comments(xlsx_bytes)
    joined = "\n".join(it[3] for items in sheets.values() for it in items)
    base = re.sub(r"（.*?）", "", label)
    if base not in joined:
        out(f"- ❌ このExcelの中に「{base}」の名前がありません（別の自治体のファイルの可能性）")
        return False
    out("")
    for key in ("財政調整基金", "実質公債費比率", "将来負担比率"):
        out(f"**{label}：{key}についての説明**\n")
        out("```")
        out(res.get(key, "（見つかりませんでした）"))
        out("```")
        out("")
    ok = all(k in res for k in ("財政調整基金", "実質公債費比率", "将来負担比率"))
    out(f"- {'✅ 3つとも取り出せました' if ok else '⚠️ 取り出せなかった説明があります：' + '、'.join(k for k in ('財政調整基金', '実質公債費比率', '将来負担比率') if k not in res)}")
    return ok


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


def main():
    cfg = json.loads((ROOT / "scripts" / "config.json").read_text(encoding="utf-8"))
    fy = reiwa_num(cfg["fiscal_year_label"])
    index_url = f"https://www.soumu.go.jp/iken/zaisei/jyoukyou_shiryou/r{fy:02d}/index.html"
    out("## 財政状況資料集の取り込みテスト（確認のみ）\n")
    out(f"- 年度：{cfg['fiscal_year_label']}（{index_url}）")
    targets = badge_entities()
    out("- 対象（国の基準を超えた自治体）：" + "、".join(f"{n}（実質公債費比率{d}%・将来負担比率{u}%）" for n, p, pr, d, u in targets))
    out("")

    html = decode_html(get(index_url))
    links = anchors(html, index_url)
    pos_muni = html.find("市町村の財政状況資料集")
    out(f"- 一覧ページのリンク数：{len(links)}（Excel {sum(1 for t, h, p in links if h.lower().endswith('.xlsx'))}・ZIP {sum(1 for t, h, p in links if h.lower().endswith('.zip'))}）、市町村の欄の位置：{pos_muni}")
    out("- リンクの例：" + "、".join(f"{t}→{h}" for t, h, p in links if h.lower().endswith(('.xlsx', '.zip')))[:600])
    out("")
    ok_all = True
    for name, pref, isp, d, u in targets:
        out(f"### {name}")
        try:
            if isp:
                cand = [(t, h) for t, h, p in links if h.lower().endswith(".xlsx") and name in t and (pos_muni < 0 or p < pos_muni)]
                if not cand:
                    out("- ❌ 一覧ページにExcelのリンクが見つかりません")
                    ok_all = False
                    continue
                out(f"- Excel：{cand[0][1]}")
                found = show_fund_text(name, get(cand[0][1]))
            else:
                after = [(t, h) for t, h, p in links if p > pos_muni]
                pref_pages = [h for t, h in after if pref in t and not h.lower().endswith((".zip", ".pdf", ".xlsx"))]
                if pref_pages:
                    out(f"- {pref}のページ：{pref_pages[0]}")
                    data, notes = find_in_table_rows(pref_pages[0], name)
                    for nt in notes:
                        out(f"- {nt}")
                    if data is not None:
                        if show_fund_text(name, data):
                            out(f"- ✅ 説明を取り出せました（{pref}のサイトの表から）")
                            out("")
                            continue
                        out("- ⚠️ Excelはありましたが、見つからない説明がありました")
                    xl, tried = find_on_pref_site(pref_pages[0], name)
                    out(f"- 調べたページ：{len(tried)}（" + "、".join(tried[:6]) + ("…" if len(tried) > 6 else "") + "）")
                    if xl:
                        out(f"- {name}のExcel：{xl}")
                        if show_fund_text(name, get(xl)):
                            out(f"- ✅ 説明を取り出せました（{pref}のサイトから）")
                            out("")
                            continue
                        out("- ⚠️ Excelはありましたが、見つからない説明がありました")
                    else:
                        out(f"- ⚠️ {pref}のサイトで{name}のExcelが見つかりませんでした。総務省のZIPを試します")
                zips = []
                for i, (t, h) in enumerate(after):
                    if pref in t:
                        for t2, h2 in after[i + 1:i + 4]:
                            if h2.lower().endswith(".zip"):
                                zips.append(h2)
                                break
                        if zips:
                            break
                if not zips:
                    out(f"- ❌ {pref}の市町村分のZIPが見つかりません")
                    ok_all = False
                    continue
                out(f"- ZIP（{pref}の市町村・概要版）：{zips[0]}")
                zf = zipfile.ZipFile(io.BytesIO(get(zips[0])))
                names = zip_names(zf)
                exts = {}
                for n, _ in names:
                    exts[n.rsplit(".", 1)[-1].lower()] = exts.get(n.rsplit(".", 1)[-1].lower(), 0) + 1
                out(f"- ZIPの中身：{len(names)} ファイル（{exts}）")
                mine = [(n, info) for n, info in names if name in n]
                out("- " + name + "のファイル：" + ("、".join(n for n, _ in mine) if mine else "見つかりません"))
                out("- 例（先頭5つ）：" + "、".join(n for n, _ in names[:5]))
                found = False
                for n, info in mine:
                    data = zf.read(info)
                    if n.lower().endswith((".xlsx", ".xlsm")):
                        found = show_fund_text(name, data) or found
                    elif n.lower().endswith(".pdf"):
                        from pypdf import PdfReader
                        txt = "\n".join((pg.extract_text() or "") for pg in PdfReader(io.BytesIO(data)).pages)
                        k = txt.find("基金残高")
                        out(f"\n**{name}：PDFから取り出した文章**（全{len(txt)}文字）\n\n```")
                        out(txt[k:k + 1500] if k >= 0 else "（基金残高の欄が見つかりませんでした）先頭：" + txt[:300])
                        out("```\n")
                        found = found or ("財政調整基金" in txt)
            out(f"- {'✅ 説明を取り出せました' if found else '⚠️ 見つからない説明がありました'}")
            ok_all = ok_all and found
        except Exception as ex:
            out(f"- ❌ エラー：{ex}")
            ok_all = False
        out("")
    out("### " + ("✅ すべての対象で取り出せました" if ok_all else "⚠️ 取り出せなかったものがあります（上を確認）"))


if __name__ == "__main__":
    main()

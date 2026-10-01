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


def show_fund_text(label, xlsx_bytes):
    texts = shapes_text(xlsx_bytes)
    hit = [t for t in texts if "増減理由" in t or "今後の方針" in t or "基金" in t[:40]]
    out(f"- 図形の文章：全部で {len(texts)} 個、基金に関係しそうなもの {len(hit)} 個")
    joined = "\n".join(texts)
    base = re.sub(r"（.*?）", "", label)
    if base not in joined:
        out(f"- ❌ このExcelの中に「{base}」の名前がありません（別の自治体のファイルの可能性）")
        return False
    i = joined.find("財政調整基金")
    out("")
    out(f"**{label}：基金残高に係る経年分析の文章**\n")
    out("```")
    k = joined.find("基金残高")
    out(joined[k:k + 1500] if k >= 0 else "（見つかりませんでした）")
    out("```")
    out("")
    return i >= 0


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
                    xl, tried = find_on_pref_site(pref_pages[0], name)
                    out(f"- 調べたページ：{len(tried)}（" + "、".join(tried[:6]) + ("…" if len(tried) > 6 else "") + "）")
                    if xl:
                        out(f"- {name}のExcel：{xl}")
                        if show_fund_text(name, get(xl)):
                            out(f"- ✅ 財政調整基金の説明を取り出せました（{pref}のサイトから）")
                            out("")
                            continue
                        out("- ⚠️ Excelはありましたが、財政調整基金の説明が見つかりませんでした")
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
            out(f"- {'✅ 財政調整基金の説明を取り出せました' if found else '⚠️ 財政調整基金の説明が見つかりませんでした'}")
            ok_all = ok_all and found
        except Exception as ex:
            out(f"- ❌ エラー：{ex}")
            ok_all = False
        out("")
    out("### " + ("✅ すべての対象で取り出せました" if ok_all else "⚠️ 取り出せなかったものがあります（上を確認）"))


if __name__ == "__main__":
    main()

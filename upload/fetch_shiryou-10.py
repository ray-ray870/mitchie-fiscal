# -*- coding: utf-8 -*-
"""
財政状況資料集から、「自治体自身の説明」を取り込む（年次更新の6番目）

対象：
  ① 国の基準を超えた自治体（実質公債費比率18%以上、または将来負担比率が基準以上（市町村350%・都道府県と政令市400%））
  ② 総合スコアで、前の年度からみっちーの体調（絶好調・元気・ちょっとしんどい・ぐったり・ひんし）が変わった、
     または10点以上動いた自治体（2026-10-15〜）。詳細画面の「点数の動き」に、自治体自身の説明として出す
取り込むもの（各自治体が財政状況資料集に書いた文章を、言い換えずにそのまま）：
    reserve … 財政調整基金の増減理由・今後の方針（「基金残高に係る経年分析」）
    debt    … 実質公債費比率の分析欄（「実質公債費比率（分子）の構造」）
    future  … 将来負担比率の分析欄（「将来負担比率（分子）の構造」）
  ② の自治体（score の中に入れる）：
    f・x・d・u … 「財政比較分析表」の 財政力指数・経常収支比率・実質公債費比率・将来負担比率 の分析欄
    r          … 財政調整基金の増減理由・今後の方針（①の reserve と同じ欄）
取得先：
    都道府県 … 総務省の財政状況資料集のページ（年度ごとの一覧）にある Excel
    市町村   … 総務省の一覧ページからリンクされている各都道府県のページの表から ZIP / Excel を探す
結果は MITCHIE_DATA_DIR（ふつうは preview）/shiryou.json に保存する。
・どの自治体も取り込めなくても、エラーで止めない（年次更新は続ける）。取り込めなかったことは Summary に出す。
・ファイルが別の自治体・別の年度のものなら使わない（名前と年度を確かめる）。
・取り込めなかった自治体は、前回取り込んだ同じ年度の文章があればそれを残す。違う年度の文章は残さない。
"""
import collections
import io
import json
import os
import re
import urllib.request
from urllib.parse import urljoin, unquote
import zipfile
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / os.environ.get("MITCHIE_DATA_DIR", "preview")
DATA_FILES = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
              "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]
PREFS_SUFFIX = ("都", "道", "府", "県")
# ふつうのブラウザと同じ名乗り方にする（2026-10-15：独自の名乗りだと断る都道府県のサイトがあったため）
UA = {"User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
      "Accept-Language": "ja,en;q=0.8"}


def out(text=""):
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


_CACHE = {}


def get(url):
    # 同じページ・ファイルを何度も取りに行かない（都道府県のページは、その県の市町村の数だけ使うため）
    if url in _CACHE:
        return _CACHE[url]
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if len(_CACHE) < 400:
        _CACHE[url] = data
    return data


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


def name_variants(name):
    """「七ヶ浜町／七ケ浜町」「鰺ヶ沢町／鯵ヶ沢町」のような書き方のゆれをまとめて返す"""
    base = re.sub(r"（.*?）", "", name)
    vs = {base}
    for a, b in (("ヶ", "ケ"), ("ケ", "ヶ"), ("鰺", "鯵"), ("鯵", "鰺"), ("檮", "梼"), ("梼", "檮"), ("須惠", "須恵")):
        vs |= {v.replace(a, b) for v in list(vs)}
    return sorted(vs, key=len, reverse=True)


def has_name(text, name):
    if any(v in text for v in name_variants(name)):
        return True
    t = re.sub(r"\s|&nbsp;|&#160;|&#12288;", "", text)
    return any(v in t for v in name_variants(name))


def _score(e, sfx, pref):
    """score.js の calcH と同じ式（sfx：""＝最新の年度、"_r5"＝令和5年度…）。計算できなければ None"""
    g = lambda k: e.get(k + sfx)
    f, d, x, u, r, sfs = g("f"), g("d"), g("x"), g("u"), g("r"), g("sfs")
    if None in (f, d, x, r):
        return None
    if pref:
        def band(v, zero, full):
            t = (zero - min(max(v, min(zero, full)), max(zero, full))) / (zero - full)
            return min(max(t, 0), 1)
        p = [min(max((f - 0.20) / 0.70, 0), 1) * 25, band(d, 20, 6) * 20, band(x, 101, 86) * 20,
             20 if (not u or u <= 0) else band(u, 340, 80) * 20,
             min((r / sfs * 100) / 10 * 15, 15) if (sfs and sfs > 0) else 7.5]
    else:
        p = [min(f / 1.2 * 25, 25), max((25 - min(d, 25)) / 25 * 20, 0), min(max((100 - x) / 15 * 20, 0), 20),
             20 if (not u or u <= 0) else max((200 - min(u, 200)) / 200 * 20, 0),
             min((r / sfs * 100) / 20 * 15, 15) if (sfs and sfs > 0) else 7.5]
    return int(min(sum(p), 100) + 0.5)


def _state(sc):
    return 0 if sc >= 85 else 1 if sc >= 70 else 2 if sc >= 50 else 3 if sc >= 30 else 4


def moved_entities(fy):
    """前の年度から、みっちーの体調が変わった、または10点以上動いた自治体"""
    res = []
    for f in DATA_FILES:
        for name, e in json.loads((DATA / f).read_text(encoding="utf-8")).items():
            pref = is_pref(name, e)
            a, b = _score(e, "_r%d" % (fy - 1), pref), _score(e, "", pref)
            if a is not None and b is not None and (_state(a) != _state(b) or abs(b - a) >= 10):
                res.append((name, e.get("p"), pref, e.get("d"), e.get("u")))
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
    # href="…" だけでなく href='…' や引用符なしも読む（2026-10-16：茨城県・香川県で Excel のリンクを見落としていたため）
    for m in re.finditer(r"<a\s[^>]*?href\s*=\s*(?:\"([^\"]+)\"|'([^']+)'|([^\s>]+))[^>]*>(.*?)</a>", html, re.S | re.I):
        text = re.sub(r"<[^>]+>", "", unescape(m.group(4))).strip()
        href = urljoin(base, unescape(m.group(1) or m.group(2) or m.group(3)).strip())
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
        # 図形の書き方は、Excel以外のソフトで保存されたファイルだと少し違う（2026-10-16：静岡県・北海道などで
        # 図形が1つも読めていなかった）。名前の前の「xdr:」などの有無・改行・パスの書き方・古い形式（VML）にも対応する
        items = []
        for tg in re.findall(r'Target="([^"]*drawings/(?:vmlDrawing|drawing)[^"/]*)"', srels):
            path = "xl/drawings/" + tg.split("/")[-1]
            try:
                xml = z.read(path).decode("utf-8", "replace")
            except KeyError:
                continue
            if path.endswith(".vml"):
                items += vml_items(xml)
                continue
            for a in re.findall(r"<(?:\w+:)?(?:twoCellAnchor|oneCellAnchor)[\s>].*?</(?:\w+:)?(?:twoCellAnchor|oneCellAnchor)>", xml, re.S):
                # 静岡県などのファイルは <xdr:from xmlns:xdr="…"> のように、タグに付け足しがある（2026-10-16 磐田市のファイルで確認）
                fr = re.search(r"<(?:\w+:)?from(?:\s[^>]*)?>\s*<(?:\w+:)?col(?:\s[^>]*)?>(\d+)</(?:\w+:)?col>.*?<(?:\w+:)?row(?:\s[^>]*)?>(\d+)</(?:\w+:)?row>", a, re.S)
                to = re.search(r"<(?:\w+:)?to(?:\s[^>]*)?>\s*<(?:\w+:)?col(?:\s[^>]*)?>(\d+)</(?:\w+:)?col>.*?<(?:\w+:)?row(?:\s[^>]*)?>(\d+)</(?:\w+:)?row>", a, re.S)
                paras = []
                for pp in re.findall(r"<(?:\w+:)?p[\s>](?:(?!<(?:\w+:)?p[\s>]).)*?</(?:\w+:)?p>", a, re.S):
                    t = "".join(re.findall(r"<(?:\w+:)?t(?:\s[^>]*)?>(.*?)</(?:\w+:)?t>", pp, re.S))
                    if t.strip():
                        paras.append(unescape(t).strip())
                if fr and paras:
                    items.append((int(fr.group(2)), int(fr.group(1)), int(to.group(2)) if to else int(fr.group(2)), "\n".join(paras)))
        if not items and not re.search(r"drawings/", srels):
            continue
        res[unescape(nm.group(1))] = items
    return res


def sheet_cells(xlsx_bytes, want):
    """名前に want を含むシートの、文字が入ったセルを (行, 列, 行, 文字) で返す（行・列は図形と同じく0から）"""
    z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
    try:
        ss = cell_strings(xlsx_bytes)
        wb = z.read("xl/workbook.xml").decode("utf-8")
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    except KeyError:
        return {}
    rmap = {}
    for m in re.finditer(r"<Relationship\s[^>]*>", rels):
        i, t = re.search(r'Id="([^"]+)"', m.group(0)), re.search(r'Target="([^"]+)"', m.group(0))
        if i and t:
            rmap[i.group(1)] = t.group(1).split("/")[-1]
    res = {}
    for m in re.finditer(r"<sheet\s[^>]*>", wb):
        nm, rid = re.search(r'name="([^"]+)"', m.group(0)), re.search(r'r:id="([^"]+)"', m.group(0))
        if not nm or not rid or want not in unescape(nm.group(1)) or rid.group(1) not in rmap:
            continue
        try:
            xml = z.read("xl/worksheets/" + rmap[rid.group(1)]).decode("utf-8")
        except KeyError:
            continue
        items = []
        for c in re.finditer(r'<c\s[^>]*r="([A-Z]+)(\d+)"([^>]*)>(.*?)</c>', xml, re.S):
            col = 0
            for ch in c.group(1):
                col = col * 26 + ord(ch) - 64
            body, attrs = c.group(4), c.group(3)
            if 't="s"' in attrs:
                v = re.search(r"<v>(\d+)</v>", body)
                t = ss[int(v.group(1))] if v and int(v.group(1)) < len(ss) else ""
            elif 'inlineStr' in attrs:
                t = unescape("".join(re.findall(r"<t(?:\s[^>]*)?>(.*?)</t>", body, re.S))).strip()
            else:
                continue
            if t.strip():
                items.append((int(c.group(2)) - 1, col - 1, int(c.group(2)) - 1, t.strip()))
        res[unescape(nm.group(1))] = items
    return res


def drawing_peek(xlsx_bytes):
    """図形が読めなかったときの手がかり：「財政比較分析表」のシートの図形のファイルの中身の一部"""
    try:
        z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
        names = z.namelist()
        wb = z.read("xl/workbook.xml").decode("utf-8")
        rels = z.read("xl/_rels/workbook.xml.rels").decode("utf-8")
        m = re.search(r'<sheet\s[^>]*name="財政比較分析表"[^>]*r:id="([^"]+)"', wb)
        tgt = re.search(r'Id="%s"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="%s"' % (m.group(1), m.group(1)), rels) if m else None
        sf = (tgt.group(1) or tgt.group(2)).split("/")[-1] if tgt else ""
        srels = z.read(f"xl/worksheets/_rels/{sf}.rels").decode("utf-8", "replace") if f"xl/worksheets/_rels/{sf}.rels" in names else ""
        out = {"files": [n for n in names if "drawing" in n][:30], "sheet": sf, "srels": srels[:800]}
        d = re.search(r'Target="([^"]*drawings/[^"]+)"', srels)
        if d:
            x = z.read("xl/drawings/" + d.group(1).split("/")[-1]).decode("utf-8", "replace")
            out["size"] = len(x)
            out["tags"] = collections.Counter(re.findall(r"<([\w:]+)", x)).most_common(25)
            i = x.find("分析欄")
            out["around"] = x[max(0, i - 600):i + 100] if i >= 0 else x[:600]
        return out
    except Exception as ex:
        return {"error": str(ex)}


def vml_items(xml):
    """古い形式（VML）の図形の文章と位置。位置は <x:Anchor> 左の列, ずれ, 上の行, ずれ, 右の列, ずれ, 下の行, ずれ"""
    items = []
    for sh in re.findall(r"<v:shape[\s>].*?</v:shape>", xml, re.S):
        an = re.search(r"<x:Anchor>\s*([\d,\s]+)</x:Anchor>", sh)
        tb = re.search(r"<v:textbox[^>]*>(.*?)</v:textbox>", sh, re.S)
        if not an or not tb:
            continue
        nums = [int(x) for x in an.group(1).replace(" ", "").split(",") if x.strip()]
        body = re.sub(r"<br\s*/?>|</div>|</p>", "\n", tb.group(1))
        t = unescape(re.sub(r"<[^>]+>", "", body))
        t = "\n".join(x.strip() for x in t.split("\n") if x.strip())
        if len(nums) >= 8 and t:
            items.append((nums[2], nums[0], nums[6], t))
    return items


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
    # 「財政比較分析表」の各指標の分析欄：「◯◯の分析欄」という見出しの図形のすぐ下にある文章（2026-10-15）
    # 県によって見出しの書き方・置き方が少し違うので、空白を除いて比べ、見つからなければ少し離れた所まで探す
    aliases = {"財政力指数": ("財政力指数", "財政力"), "経常収支比率": ("経常収支比率", "財政構造の弾力性"),
               "実質公債費比率": ("実質公債費比率", "公債費負担の状況"), "将来負担比率": ("将来負担比率", "将来負担の状況")}
    norm = lambda t: re.sub(r"\s", "", t)
    # 図形で見つからない項目は、セルに書かれた見出し・文章からも探す（2026-10-16：静岡県・北海道の一部の自治体）
    cells_by_sheet = {}
    try:
        for nm, cl in sheet_cells(xlsx_bytes, "財政比較").items():
            cells_by_sheet[nm] = sheets.get(nm, []) + cl
    except Exception:
        pass
    for nm, items in list(sheets.items()) + [(k, v) for k, v in cells_by_sheet.items()]:
        if "財政比較" not in nm and not any(norm(it[3]) == "財政力指数の分析欄" for it in items):
            continue
        for key, als in aliases.items():
            if "比較_" + key in res:
                continue
            labels = [it for it in items if len(norm(it[3])) <= 20 and norm(it[3]).endswith("分析欄") and any(a in norm(it[3]) for a in als)]
            for lr, lc, lto, _ in labels:
                near = sorted([it for it in items if is_comment(it[3]) and lto - 1 <= it[0] <= lto + 4 and abs(it[1] - lc) <= 3])
                if not near:
                    near = sorted([it for it in items if is_comment(it[3]) and lto - 1 <= it[0] <= lto + 15 and abs(it[1] - lc) <= 8],
                                  key=lambda it: (abs(it[0] - lto) + abs(it[1] - lc)))
                if near:
                    res["比較_" + key] = near[0][3]
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


YEAR_MARKS = ("令和6", "令和６", "R6", "Ｒ６", "R06", "2024", "６年度", "6年度")
FILE_EXT = (".xlsx", ".xls", ".xlsm")
NOT_FILE = (".pdf", ".html", ".htm", ".zip", ".csv", ".docx", ".doc", ".jpg", ".png", "/")


def _ym(text, year_marks):
    return any(m in text for m in year_marks)


def _zip_cands(zurl, name, base_score, year_marks):
    """ZIP の中から、名前の付いた Excel を候補にする"""
    res = []
    try:
        zf = zipfile.ZipFile(io.BytesIO(get(zurl)))
    except Exception:
        return res
    for n, info in zip_names(zf):
        if has_name(n, name) and n.lower().endswith((".xlsx", ".xlsm")):
            res.append((base_score + 3 + (2 if _ym(n + zurl, year_marks) else 0), "zip", zurl, n))
    return res


def table_candidates(page_url, name, year_marks):
    """都道府県のページの表で、市町村名が書かれた行にある Excel / ZIP を候補にする
    （北海道庁の「夕張市、岩見沢市…｜1／8（ZIP）」や、香川県の「市町名｜R2 R3 … R6」のような形）"""
    html = decode_html(get(page_url))
    res = []
    for r in re.findall(r"<tr[\s>].*?</tr>", html, re.S | re.I):
        text = re.sub(r"<[^>]+>", "", unescape(r))
        if not has_name(text, name):
            continue
        for t, h, p in anchors(r, page_url):
            low = h.lower().split("?")[0]
            ym = 2 if _ym(t + h, year_marks) else 0
            if low.endswith(FILE_EXT):
                # 範囲で書かれたリンク（「夕張市~歌志内市」）は決算カードなので低く
                res.append((ym + (3 if has_name(t, name) else 1) - (2 if ("~" in t or "～" in t) else 0), "url", h, t))
            elif low.endswith(".zip"):
                res += _zip_cands(h, name, ym - (2 if ("~" in t or "～" in t) else 0), year_marks)
    return res


def _link_priority(t, h, name, year_marks):
    sc = 0
    if "資料集" in t:
        sc += 3
    if _ym(t + " " + h, year_marks):
        sc += 2
    if has_name(t, name):
        sc += 4
    if any(w in t for w in ("市町村", "区市町村", "市町", "団体別")):
        sc += 1
    return sc


_MUNIS = {}


def pref_munis(pref):
    """その都道府県の市町村名の一覧（データファイルから）"""
    if not _MUNIS:
        for f in DATA_FILES:
            try:
                for n, e in json.loads((DATA / f).read_text(encoding="utf-8")).items():
                    if not is_pref(n, e):
                        _MUNIS.setdefault(e.get("p"), []).append(n)
            except Exception:
                pass
    return _MUNIS.get(pref, [])


def owner_candidates(html, url, name, munis, year_marks):
    """リンクの前に最後に出てきた自治体名を、そのリンクの持ち主とみなす
    （2026-10-16：香川県のように、自治体名の横に R2〜R6 のリンクが並ぶ形。表の形でなくても読めるように）"""
    res, owner, last = [], None, 0
    others = [m for m in munis if m != name]
    for t, h, p in anchors(html, url):
        seg = re.sub(r"\s|&nbsp;|&#160;", "", re.sub(r"<[^>]+>", "", unescape(html[last:p])))
        best = -1
        for m in [name] + others:
            for v in name_variants(m):
                i = seg.rfind(v)
                if i > best or (i == best and i >= 0 and m == name):
                    best, owner = i, m
        last = p + 1
        low = h.lower().split("?")[0].split("#")[0]
        if owner == name and low.endswith(FILE_EXT) and not has_name(t, name):
            res.append((2 + (2 if _ym(t + " " + h, year_marks) else 0), "url", h, t))
    return res


def site_candidates(start_url, name, max_pages=60, year_marks=YEAR_MARKS, munis=()):
    """都道府県のページから、その市町村の財政状況資料集の Excel の候補を集める（2026-10-15 作り直し）
    ・「資料集」「令和6年度」などの文字があるリンクから先に見る（関係のないページで上限を使い切らないように）
    ・「資料集」の文字があるリンクは、ほかのサイト（北海道のオープンデータなど）でもたどる
    ・市町村名のリンクから入ったページ（東京都の団体別のページなど）では、「令和６年度」の文字のリンクも候補にする
      （ファイル名に拡張子が無いサイトがあるため。中身が Excel かどうかは取り込むときに確かめる）
    ・ページにある ZIP の中も探す（北海道のように地域ごとの ZIP にまとめている県のため）
    戻り値：(候補のリスト, 見たページ)。候補＝(点, "url"/"zip", URL, ZIPの中の名前 or リンクの文字)"""
    from urllib.parse import urlparse
    host = urlparse(start_url).netloc
    seen, queue, tried, cands, zips = set(), [(0, 0, start_url, False)], [], [], []
    while queue and len(seen) < max_pages:
        queue.sort(key=lambda q: (q[1], -q[0]))
        pri, depth, url, named = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            html = decode_html(get(url))
        except Exception as ex:
            tried.append(f"{url}（読めず：{ex}）")
            continue
        tried.append(url)
        title = " ".join(re.findall(r"<title[^>]*>(.*?)</title>|<h1[^>]*>(.*?)</h1>", html, re.S | re.I)[0]) if re.search(r"<title|<h1", html, re.I) else ""
        named = named or has_name(re.sub(r"<[^>]+>", "", title), name)
        if munis:
            cands += owner_candidates(html, url, name, munis, year_marks)
        for t, h, p in anchors(html, url):
            low = h.lower().split("?")[0].split("#")[0]
            ym = 2 if _ym(t + " " + h, year_marks) else 0
            if low.endswith(FILE_EXT):
                if has_name(t, name):
                    cands.append((3 + ym, "url", h, t))
                elif has_name(re.sub(r"<[^>]+>", "", html[max(0, p - 120):p]), name):
                    cands.append((1 + ym, "url", h, t))
                elif named and ym:
                    cands.append((2 + ym, "url", h, t))
            elif low.endswith(".zip"):
                if h not in zips and ("資料集" in t or "資料集" in unquote(h) or has_name(t, name) or "ダウンロード" in t):
                    zips.append(h)
            elif named and ym and not low.endswith(NOT_FILE) and urlparse(h).netloc in (host, ""):
                cands.append((1 + ym, "url", h, t))      # 拡張子の無いファイル（東京都など）
            elif depth < 3 and h.split("#")[0] not in seen and not low.endswith((".pdf", ".xlsx", ".xls", ".csv", ".docx")):
                other = urlparse(h).netloc != host
                if other and "資料集" not in t:
                    continue
                pr = _link_priority(t, h, name, year_marks)
                if depth == 0 or pr >= 2:
                    queue.append((pr, depth + 1, h.split("#")[0], has_name(t, name)))
        if any(c[0] >= 5 for c in cands):
            break   # 名前と年度の両方が合うものが見つかったら、それ以上は探さない
    if not any(c[0] >= 3 for c in cands):
        for z in zips[:20]:
            cands += _zip_cands(z, name, 0, year_marks)
    return cands, tried


def fetch_candidate(c):
    """候補の中身（Excel のバイト列）と、取得元の説明を返す"""
    sc, kind, url, extra = c
    if kind == "zip":
        zf = zipfile.ZipFile(io.BytesIO(get(url)))
        for n, info in zip_names(zf):
            if n == extra:
                return zf.read(info), url + " の中の " + n
        return None, url
    return get(url), url


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


FAIL_REASON = {}   # 取れなかった理由（Summary の表に出す）
TRIED = {}         # 都道府県ごとに、探したページ（Summary に出す手がかり）
TRIED_FILES = {}   # 取れなかった自治体ごとに、試したファイル
DIAG = {}          # 取れなかったときの詳しい手がかり（次に直すため。アプリは使わない）
SCORE_LABELS = {"f": "比較_財政力指数", "x": "比較_経常収支比率", "d": "比較_実質公債費比率", "u": "比較_将来負担比率", "r": "財政調整基金"}


def cell_strings(xlsx_bytes):
    """Excel のセルの文字（sharedStrings）"""
    try:
        z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
        x = z.read("xl/sharedStrings.xml").decode("utf-8")
    except Exception:
        return []
    return [unescape("".join(re.findall(r"<t(?:\s[^>]*)?>(.*?)</t>", si, re.S))).strip() for si in re.findall(r"<si>.*?</si>", x, re.S)]


def cell_texts(xlsx_bytes):
    """名前・年度を確かめるためのセルの文字（sharedStrings と、セルに直接書かれた文字）"""
    res = cell_strings(xlsx_bytes)
    try:
        z = zipfile.ZipFile(io.BytesIO(xlsx_bytes))
        for n in z.namelist():
            if re.match(r"xl/worksheets/sheet\d+\.xml$", n):
                x = z.read(n).decode("utf-8")
                res += [unescape("".join(re.findall(r"<t(?:\s[^>]*)?>(.*?)</t>", i, re.S))).strip() for i in re.findall(r"<is>.*?</is>", x, re.S)]
    except Exception:
        pass
    return res


def collect(name, xlsx_bytes, fy_label, badge=True, moved=False, quiet=False, src=""):
    """Excelから3つの説明を取り出す。名前・年度が違えば None"""
    res, sheets = extract_comments(xlsx_bytes)
    joined = "\n".join(it[3] for items in sheets.values() for it in items)
    cells = cell_texts(xlsx_bytes)
    base = re.sub(r"（.*?）", "", name)
    say = (lambda m: None) if quiet else out
    # 名前・年度は、図形の文字とセルの文字の両方で確かめる（県によって、団体名や年度をセルに書いているため。2026-10-15）
    if not has_name(joined, name) and not any(has_name(c, name) for c in cells if len(c) <= 30):
        if FAIL_REASON.get(name) != "分析欄が見つからない":   # いちばん手がかりになる理由を残す
            FAIL_REASON[name] = "別の自治体のExcel"
        say(f"- ❌ {name}：このExcelの中に「{base}」の名前がないため使いません")
        return None
    half = lambda t: re.sub(r"\s", "", t.translate(str.maketrans("０１２３４５６７８９", "0123456789")))
    texts = [it[3].strip() for items in sheets.values() for it in items] + cells
    fname = unquote(src.replace(" の中の ", "/")).split("/")[-1]
    by_name = str(2018 + reiwa_num(fy_label)) in fname and has_name(fname, name)
    if not by_name and not any(half(t) in (fy_label, fy_label + "決算") for t in texts if len(t) <= 12):
        if FAIL_REASON.get(name) != "分析欄が見つからない":
            FAIL_REASON[name] = "年度が違うExcel"
        say(f"- ❌ {name}：このExcelは{fy_label}のものではないため使いません")
        return None
    entry = {}
    if badge:
        for k, label in LABELS.items():
            if label in res:
                entry[k] = res[label].strip()
            elif not quiet:
                out(f"- ⚠️ {label}の説明が見つかりませんでした")
    if moved:
        sc = {}
        for k, label in SCORE_LABELS.items():
            if label in res:
                sc[k] = res[label].strip()
        if sc:
            entry["score"] = sc
        else:
            FAIL_REASON[name] = "分析欄が見つからない"
            try:
                cl = sheet_cells(xlsx_bytes, "")
            except Exception:
                cl = {}
            DIAG[name] = {"sheets": list(sheets.keys())[:40],
                          "shape_labels": [it[3][:30] for its in sheets.values() for it in its if "分析" in it[3]][:15],
                          "cell_labels": [(nm, it[0], it[1], it[3][:30]) for nm, its in cl.items() for it in its if "分析" in it[3]][:15],
                          "drawing": drawing_peek(xlsx_bytes)}
            if not quiet:
                out(f"- ⚠️ {name}：財政比較分析表の分析欄が見つかりませんでした")
    return entry


def find_excel(name, pref, isp, links, pos_muni):
    """財政状況資料集の Excel の候補を、よさそうな順に返す（取り込むときに、名前と年度が合うものを使う）"""
    if isp or name in SEIREI:
        # 都道府県と政令市（2026-10-16 追加：浜松市）は、総務省のページに直接 Excel がある
        cand = [h for t, h, p in links if h.lower().endswith(".xlsx") and name in t and (pos_muni < 0 or p < pos_muni)]
        if cand or isp:
            return [(9, "url", h, name) for h in cand]
    after = [(t, h) for t, h, p in links if p > pos_muni]
    pref_pages = [h for t, h in after if pref in t and not h.lower().endswith((".zip", ".pdf", ".xlsx"))]
    if not pref_pages:
        FAIL_REASON[name] = "都道府県のページが見つからない"
        return []
    cands = []
    try:
        cands += table_candidates(pref_pages[0], name, YEAR_MARKS)
    except Exception as ex:
        print(f"- {name}：表を読めず（{ex}）")
    if not any(c[0] >= 5 for c in cands):
        more, tried = site_candidates(pref_pages[0], name, munis=pref_munis(pref))
        cands += more
        TRIED.setdefault(pref, tried[:8])
    uniq, seen = [], set()
    for c in sorted(cands, key=lambda c: -c[0]):
        if (c[2], c[3] if c[1] == "zip" else "") not in seen:
            seen.add((c[2], c[3] if c[1] == "zip" else ""))
            uniq.append(c)
    if not uniq:
        FAIL_REASON[name] = "Excelが見つからない"
    if not any(c[0] >= 5 for c in uniq) and pref not in DIAG:
        try:
            raw = get(pref_pages[0])
            html = decode_html(raw)
            ls = anchors(html, pref_pages[0])
            xl = [(t, h) for t, h, p in ls if ".xls" in h.lower()]
            DIAG[pref] = {"page": pref_pages[0], "bytes": len(raw), "head": raw[:300].decode("ascii", "replace"),
                          "links": len(ls), "excel_links": len(xl), "excel_sample": xl[:5],
                          "name_in_page": has_name(html, name), "xlsx_text_count": html.lower().count(".xls"),
                          "title": re.sub(r"<[^>]+>", "", (re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I) or re.search(r"(.*)", "")).group(1 if re.search(r"<title", html, re.I) else 0))[:80],
                          "text": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.S | re.I)))[:300]}
        except Exception as ex:
            DIAG[pref] = {"page": pref_pages[0], "error": str(ex)}
    return uniq


def main():
    cfg = json.loads((ROOT / "scripts" / "config.json").read_text(encoding="utf-8"))
    fy_label = cfg["fiscal_year_label"]
    fy = reiwa_num(fy_label)
    index_url = f"https://www.soumu.go.jp/iken/zaisei/jyoukyou_shiryou/r{fy:02d}/index.html"
    out("## 6. 財政状況資料集（自治体自身の説明）\n")
    badge = badge_entities()
    moved = moved_entities(fy)
    badge_names = set(n for n, *_ in badge)
    moved_names = set(n for n, *_ in moved)
    targets = badge + [t for t in moved if t[0] not in badge_names]
    out(f"- 年度：{fy_label}")
    out(f"- 国の基準を超えた自治体：" + ("、".join(n for n, *_ in badge) if badge else "なし"))
    out(f"- みっちーの体調が変わった、または10点以上動いた自治体：{len(moved)}団体")
    result = {"_year": fy_label,
              "_note": "財政状況資料集に各自治体が書いた説明（言い換えなし）。scripts/fetch_shiryou.py が年次更新で作る。"}
    try:
        html = decode_html(get(index_url))
        links = anchors(html, index_url)
        pos_muni = html.find("市町村の財政状況資料集")
    except Exception as ex:
        out(f"- ⚠️ 総務省の一覧ページを読めませんでした（{ex}）。今年は説明なしで続けます")
        targets, links, pos_muni = [], [], -1
    # 同じ年度の取り込みをやり直したときに、今回は取れなかった自治体は、前回取れた同じ年度の文章を残す
    # （2026-10-15：夕張市のように、都道府県のサイトの都合で取れない回があるため。違う年度の文章は残さない）
    try:
        prev = json.loads((DATA / "shiryou.json").read_text(encoding="utf-8"))
    except Exception:
        prev = {}
    if prev.get("_year") != fy_label:
        prev = {}
    got_by_pref = {}
    result_ok = set()
    detail = len(targets) <= 20   # 対象が多いときは、取れなかった自治体だけ書く（Summary が長くなりすぎないように）
    for name, pref, isp, d, u in targets:
        if detail or name in badge_names:
            out(f"### {name}")
        ok = False
        # 同じ年度で前回取れた自治体は、取り直さない（2026-10-16：全部取り直すと1時間以上かかるため。
        # 取れなかった自治体だけを探し直す。年度が変われば前回の分は使わないので、年次更新では全部取り直す）
        pe = prev.get(name)
        if isinstance(pe, dict) and (name not in moved_names or "score" in pe) and (name not in badge_names or any(k in pe for k in LABELS)):
            result[name] = pe
            result_ok.add(name)
            if name in badge_names:
                out("- ↩️ 前回取り込んだ同じ年度の文章を使います")
            if name in moved_names:
                g = got_by_pref.setdefault(pref or name, [0, 0])
                g[0] += 1
                g[1] += 1
            continue
        try:
            cands = find_excel(name, pref, isp, links, pos_muni)
            for c in cands[:10]:   # よさそうな順に、名前と年度が合う Excel が見つかるまで（10まで）
                try:
                    data, src = fetch_candidate(c)
                except Exception as ex:
                    FAIL_REASON[name] = "Excelを読み込めない"
                    continue
                if not data or not data[:2] == b"PK":
                    FAIL_REASON.setdefault(name, "Excelではないファイル")
                    continue
                entry = collect(name, data, fy_label, badge=name in badge_names, moved=name in moved_names, quiet=True, src=src)
                if entry and ("score" in entry or name in badge_names):
                    entry["src"] = src
                    result[name] = entry
                    ok = True
                    FAIL_REASON.pop(name, None)
                    if name in badge_names:
                        out("- ✅ 取り込みました：" + "、".join(LABELS[k] for k in LABELS if k in entry))
                    break
            if not ok:
                TRIED_FILES[name] = [c[2] + (" の中の " + c[3] if c[1] == "zip" else "") for c in cands[:10]]
                out(f"- ⚠️ {name}：{FAIL_REASON.get(name, '財政状況資料集のExcelが見つかりませんでした')}")
        except Exception as ex:
            out(f"- ⚠️ {name}：エラーのため取り込めませんでした（{ex}）")
        if not ok and name not in result and isinstance(prev.get(name), dict):
            result[name] = prev[name]
            ok = "score" in prev[name] or name in badge_names
            out(f"- ↩️ {name}：前回取り込んだ同じ年度の文章を残しました")
        if ok:
            result_ok.add(name)
        if name in moved_names:
            g = got_by_pref.setdefault(pref or name, [0, 0])
            g[1] += 1
            g[0] += 1 if ok else 0
    if moved:
        total_ok = sum(v[0] for v in got_by_pref.values())
        out(f"\n### 体調が変わった・10点以上動いた自治体の説明：{total_ok} / {len(moved)} 団体で取り込めました\n")
        out("| 都道府県 | 取り込めた / 対象 | 取れなかった理由 |\n|---|---|---|")
        for pf, (a, b) in sorted(got_by_pref.items(), key=lambda x: (x[1][0] / x[1][1], x[0])):
            rs = collections.Counter(FAIL_REASON.get(n, "その他") for n, p, *_ in moved if (p or n) == pf and n not in result_ok)
            out(f"| {pf} | {a} / {b}{' ⚠️' if a < b else ''} | " + "、".join(f"{k} {v}" for k, v in rs.most_common()) + " |")
        bad = [pf for pf, (a, b) in got_by_pref.items() if a < b and pf in TRIED]
        if bad:
            out("\n<details><summary>取れなかった都道府県で見たページ（手がかり）</summary>\n")
            for pf in sorted(bad):
                out(f"- **{pf}**：" + " → ".join(TRIED[pf]))
            out("\n</details>")
    # 取れなかった自治体の理由と、見たページを残す（Summary を見なくても、次に直すときの手がかりにできるように。アプリは使わない）
    if moved:
        result["_fail"] = {n: FAIL_REASON.get(n, "その他") for n, *_ in moved if n not in result_ok}
        result["_tried"] = {pf: TRIED[pf] for pf in TRIED}
        result["_tried_files"] = {n: TRIED_FILES[n] for n in TRIED_FILES if n in result["_fail"]}
        result["_diag"] = DIAG
    path = DATA / "shiryou.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n = len([k for k in result if not k.startswith("_")])
    try:
        shown = path.relative_to(ROOT)
    except ValueError:
        shown = path
    out(f"\n- {shown} に保存しました（{n}自治体）")


if __name__ == "__main__":
    main()

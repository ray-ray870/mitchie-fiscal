# -*- coding: utf-8 -*-
"""
人口・人口増減率の履歴の作り直し（使い捨て・2026-09-29）

公式データとの照合で、約840市町村の人口増減率（令和2〜5年）が1年ずれていることがわかった
（アプリのR2〜R5に、公式の令和3〜6年の値が入っていた）。同じ909市町村は令和2〜5年の人口も空欄だった。
全市町村・全都道府県の pop / g（令和元年〜最新年）を、総務省「住民基本台帳」の公式Excelで入れ直す。

安全のための仕組み
  ・ファイルの読み方は scripts/audit_official_data.py（照合）と同じものを使う。
  ・人口の列は、アプリの人口と一致する列（毎年95%以上）を使う。
  ・増減率の列は、アプリが正しい年（令和元年・6〜8年）で95%以上一致する列を使い、全年で同じ列であること、
    さらに公式の人口の変化から計算した増減率と95%以上一致することを確かめる。
  ・どれかに当てはまらなければ、何も書き換えずに止まる。
  ・書き換えるのは preview/data-*.json の pop / g とその履歴だけ。公式データに8年分そろわない団体は変更しない。
実行は GitHub Actions の「人口履歴の作り直し（全団体）」から。
"""
import collections
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_official_data import POP_PAGES, DATA_FILES, pick, index, to_num, norm_name  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "preview"
LATEST = max(POP_PAGES)
TRUSTED = [1, 6, 7, LATEST]  # 照合で100%一致していた年（増減率の列を決めるのに使う）


def main():
    dbs = {f: json.loads((DATA_DIR / f).read_text(encoding="utf-8")) for f in DATA_FILES}
    ents = []
    for f, d in dbs.items():
        for n, e in d.items():
            ip = n == e.get("p")
            ents.append((f, n, e, ip, e["p"] if ip else (e["p"], norm_name(n))))

    def app(e, p, k):
        return e.get(p) if k == LATEST else e.get(f"{p}_r{k}")

    idx = {}
    for k in POP_PAGES:
        url = pick(POP_PAGES[k], lambda t: "市区町村別" in t and "人口" in t and "世帯数" in t and "年齢" not in t
                   and "日本人" not in t and "外国人" not in t, many=True, label=f"令和{k}年 住民基本台帳")[0]
        idx[(k, False)] = index([url], False)
        idx[(k, True)] = index([url], True)

    def best_col(k, ip, p, years_ok):
        tally, tried = collections.Counter(), 0
        for f, n, e, eip, key in ents:
            if eip != ip:
                continue
            row, av = idx[(k, ip)].get(key), app(e, p, k)
            if row is None or av is None:
                continue
            tried += 1
            for ci, v in enumerate(row):
                x = to_num(v)
                if x is not None and abs(x - av) < (0.5 if p == "pop" else 0.06):
                    tally[ci] += 1
        if not tally:
            return None, 0.0
        ci, h = tally.most_common(1)[0]
        return ci, h / tried

    lines, ok = ["| 区分 | 年 | 人口の列（一致率） | 増減率の列（一致率／人口から計算した値との一致率） |", "|---|---|---|---|"], True
    cols = {}
    for ip in (False, True):
        grp = "都道府県" if ip else "市町村"
        gcols = set()
        for k in TRUSTED:
            gc, gr = best_col(k, ip, "g", True)
            if gc is None or gr < 0.95:
                print(f"❌ {grp} 令和{k}年：増減率の列の一致率が低い（{gr:.0%}）")
                ok = False
            gcols.add(gc)
        if len(gcols) != 1:
            print(f"❌ {grp}：増減率の列の位置が年によって違います {gcols}")
            ok = False
        gcol = min(c for c in gcols if c is not None) if any(c is not None for c in gcols) else None
        for k in POP_PAGES:
            pc, pr = best_col(k, ip, "pop", True)
            if pc is None or pr < 0.95:
                print(f"❌ {grp} 令和{k}年：人口の列の一致率が低い（{pr:.0%}）")
                ok = False
            cols[(k, ip)] = (pc, gcol)
        # 増減率の列が、公式の人口の変化と合っているか
        for k in POP_PAGES:
            pc, gc = cols[(k, ip)]
            h = t = 0
            if k > 1 and pc is not None and gc is not None:
                for key, row in idx[(k, ip)].items():
                    prev = idx[(k - 1, ip)].get(key)
                    if row is None or prev is None:
                        continue
                    p1, p0, g = to_num(row[pc]), to_num(prev[cols[(k - 1, ip)][0]]), to_num(row[gc])
                    if p1 is None or not p0 or g is None:
                        continue
                    t += 1
                    h += abs((p1 - p0) / p0 * 100 - g) < 0.1
            rate = h / t if t else None
            if rate is not None and rate < 0.95:
                print(f"❌ {grp} 令和{k}年：公式の増減率が公式の人口の変化と合いません（{rate:.0%}）")
                ok = False
            _, pr = best_col(k, ip, "pop", True)
            lines.append(f"| {grp} | 令和{k} | {pc}（{pr:.1%}） | {gc}（{'－' if rate is None else f'{rate:.1%}'}） |")
    check = "\n".join(["## 安全チェック", ""] + lines)
    print(check)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if not ok:
        if sp:
            with open(sp, "a", encoding="utf-8") as fp:
                fp.write(check + "\n\n❌ チェックに通らなかったため、データは書き換えていません。\n")
        sys.exit(1)

    changed = collections.Counter()
    filled, skipped, files = 0, [], set()
    for f, n, e, ip, key in ents:
        vals = {}
        for k in POP_PAGES:
            row = idx[(k, ip)].get(key)
            pc, gc = cols[(k, ip)]
            if row is None:
                break
            p, g = to_num(row[pc]), to_num(row[gc])
            if p is None or g is None:
                break
            vals[k] = (int(round(p)), round(g, 3))
        if len(vals) != len(POP_PAGES):
            skipped.append(n)
            continue
        before_g = [app(e, "g", k) for k in POP_PAGES]
        before_pnull = sum(1 for k in POP_PAGES if app(e, "pop", k) is None)
        for k, (p, g) in vals.items():
            if k == LATEST:
                e["pop"], e["g"] = p, g
            else:
                e[f"pop_r{k}"], e[f"g_r{k}"] = p, g
        after_g = [app(e, "g", k) for k in POP_PAGES]
        if any(b is None or abs(b - a) >= 0.06 for a, b in zip(after_g, before_g)):
            changed["増減率が変わった団体"] += 1
        if before_pnull:
            filled += 1
        files.add(f)

    for f in files:
        (DATA_DIR / f).write_text(json.dumps(dbs[f], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    sample = []
    for f, n, e, ip, key in ents:
        if n in ("当別町", "姶良市", "千葉県"):
            sample.append(f"| {n} | {[app(e, 'g', k) for k in POP_PAGES]} |")
    text = "\n".join([check, "", "## 人口・人口増減率を作り直しました（preview）", "",
                      f"- 増減率が変わった団体：{changed['増減率が変わった団体']}",
                      f"- 空欄だった人口を埋めた団体：{filled}",
                      f"- 公式データに{len(POP_PAGES)}年分そろわず、変更しなかった団体：{len(skipped)}件 {skipped[:20]}", "",
                      "| 団体 | 増減率（令和元年〜最新） |", "|---|---|"] + sample)
    print(text[len(check):])
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
公会計（kokaikei.json）の履歴の作り直し（使い捨て・2026-09-29）

公式データとの照合で、約126団体の公会計9指標の履歴に「途中の空欄」があり、値が前に詰めて
入っていることがわかった（例：大船渡市のアプリの平成30年度の欄に、公式の令和2年度の値）。
全団体の ka1〜ka9 の履歴（_r1＝平成30年度 … _r5＝令和4年度）と最新値（令和5年度）を、総務省
「統一的な基準による財務書類に関する情報」の指標一覧から入れ直す。

  ・その年度の値は、翌年度のファイルに入っている修正後の値（最新の公表値）を使う。
    翌年度のファイルが無い最新年度は、その年度のファイルの値を使う。
  ・公式に値が無い年は、年の位置を保ったまま空欄(null)にする（前に詰めない）。
  ・最新値は、公式に値が無ければ今の値のまま。

安全のための仕組み
  ・ファイルの読み方は scripts/audit_official_data.py（照合）と同じものを使う。
  ・列は、履歴がそろっている団体のアプリの値と一致する列を使い、どの年も9割以上一致し、
    9指標の列がすべて別々であることを確かめる。
  ・今のアプリの値（空欄以外）は、公式のどこかの年の値（最初の公表値・修正後の値）と一致するはず。
    一致しない値が1つでもあれば、別の行を読んだとみなして止まる。
  ・どれかに当てはまったら、何も書き換えずに止まる。書き換えるのは preview/kokaikei.json だけ。
実行は GitHub Actions の「公会計の履歴の作り直し」から。
"""
import collections
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from audit_official_data import (KK_PAGES, DATA_FILES, pick, index, to_num, norm_name,  # noqa: E402
                                 SourceMissing)

ROOT = Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "preview"
LATEST_Y = max(KK_PAGES)          # 5 = 令和5年度
CODES = [f"ka{i}" for i in range(1, 10)]


def ylab(y):
    return "平成30年度" if y == 0 else ("令和元年度" if y == 1 else f"令和{y}年度")


def sheet_re(y):
    return r"H\s*30" if y == 0 else (r"R\s*(元|0?1)(?!\d)" if y == 1 else rf"R\s*0?{y}(?!\d)")


def slot(code, y):
    return code if y == LATEST_Y else f"{code}_r{y + 1}"


def fmt(v):
    v = round(v, 1)
    return int(v) if float(v).is_integer() else v


def main():
    kk = json.loads((PREVIEW / "kokaikei.json").read_text(encoding="utf-8"))
    pref_of = {}
    for f in DATA_FILES:
        for n, e in json.loads((PREVIEW / f).read_text(encoding="utf-8")).items():
            pref_of[n] = e.get("p")
    ents = []  # (名前, データ, 都道府県か, 公式側のキー)
    for n, e in kk.items():
        if not isinstance(e, dict) or n not in pref_of:
            continue
        ip = n == pref_of[n]
        ents.append((n, e, ip, pref_of[n] if ip else (pref_of[n], norm_name(n))))
    full = [x for x in ents if all(x[1].get(slot("ka1", y)) is not None for y in KK_PAGES)]
    print(f"対象：{len(ents)}団体（履歴がそろっている団体：{len(full)}）")

    def url(y, ip):
        return pick(KK_PAGES[y], lambda t: ("都道府県指標一覧" if ip else "市区町村指標一覧") in t,
                    label=f"{ylab(y)} 公会計 指標一覧（{'都道府県' if ip else '市町村'}）")

    lines = ["| 年度 | 区分 | 使った値 | 読めた団体 | 列（指標1〜9） | 最低の一致率 |", "|---|---|---|---|---|---|"]
    ok = True
    official = {}        # (ip, key) -> {y: {code: 値}}   … 入れる値（修正後があれば修正後）
    seen = collections.defaultdict(set)  # (名前, code) -> 公式に出てくる値（最初の公表値・修正後）
    for y in KK_PAGES:
        for ip in (False, True):
            grp = "都道府県" if ip else "市町村"
            first = index([url(y, ip)], ip, sheet_re=sheet_re(y))
            idx, used = first, "その年度のファイル"
            if y + 1 in KK_PAGES:
                rev = index([url(y + 1, ip)], ip, sheet_re=sheet_re(y), strict=True)
                if len(rev) >= 0.9 * len(first):
                    idx, used = rev, "翌年度のファイル（修正後）"
            cols, worst = {}, 1.0
            for code in CODES:
                tally, tried = collections.Counter(), 0
                for n, e, eip, key in full:
                    row, av = idx.get(key), e.get(slot(code, y))
                    if eip != ip or row is None or av is None:
                        continue
                    tried += 1
                    for ci, v in enumerate(row):
                        x = to_num(v)
                        if x is not None and abs(round(x, 1) - av) < 0.11:
                            tally[ci] += 1
                if not tally or not tried:
                    print(f"❌ {ylab(y)}（{grp}）{code}：列が特定できません")
                    ok = False
                    continue
                ci, h = tally.most_common(1)[0]
                cols[code] = ci
                worst = min(worst, h / tried)
            if len(set(cols.values())) != len(cols):
                print(f"❌ {ylab(y)}（{grp}）：同じ列が複数の指標に選ばれました {cols}")
                ok = False
            if worst < 0.9:
                print(f"❌ {ylab(y)}（{grp}）：一致率が低い（{worst:.0%}）")
                ok = False
            lines.append(f"| {ylab(y)} | {grp} | {used} | {sum(1 for r in idx.values() if r is not None)} | "
                         f"{[cols.get(c) for c in CODES]} | {worst:.1%} |")
            for src in (first, idx):
                for key, row in src.items():
                    if row is None:
                        continue
                    for code, ci in cols.items():
                        x = to_num(row[ci])
                        if x is not None:
                            seen[(key, code)].add(round(x, 1))
            for key, row in idx.items():
                if row is None:
                    continue
                vals = {code: to_num(row[ci]) for code, ci in cols.items()}
                official.setdefault((ip, key), {})[y] = vals

    # 今のアプリの値が、公式のどこかに出てくるか（別の行を読んでいないかの確認）
    bad = []
    for n, e, ip, key in ents:
        for code in CODES:
            for y in KK_PAGES:
                v = e.get(slot(code, y))
                if v is None:
                    continue
                if not any(abs(v - s) < 0.11 for s in seen.get((key, code), ())):
                    bad.append(f"{n} {code} {v}")
    check = "\n".join(["## 安全チェック", ""] + lines + ["",
                       f"- 今のアプリの値で、公式のどの年にも出てこない値：{len(bad)}件 {bad[:10]}"])
    print(check)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if bad or not ok:
        if sp:
            with open(sp, "a", encoding="utf-8") as fp:
                fp.write(check + "\n\n❌ チェックに通らなかったため、データは書き換えていません。\n")
        sys.exit(1)

    changed, filled, emptied, sample = collections.Counter(), 0, 0, []
    for n, e, ip, key in ents:
        o = official.get((ip, key), {})
        before = {code: [e.get(slot(code, y)) for y in KK_PAGES] for code in CODES}
        had_gap = any(e.get(slot("ka1", y)) is None for y in KK_PAGES)
        for code in CODES:
            for y in KK_PAGES:
                v = o.get(y, {}).get(code)
                if v is None:
                    if y == LATEST_Y:
                        continue  # 最新値は、公式に無ければ今の値のまま
                    e[slot(code, y)] = None
                else:
                    e[slot(code, y)] = fmt(v)
            if [e.get(slot(code, y)) for y in KK_PAGES] != before[code]:
                changed[code] += 1
        if had_gap and all(e.get(slot("ka1", y)) is not None for y in KK_PAGES):
            filled += 1
        if any(e.get(slot("ka1", y)) is None for y in KK_PAGES):
            emptied += 1
        if n in ("大船渡市", "一関市", "姶良市"):
            sample.append(f"| {n} | {before['ka1']} | {[e.get(slot('ka1', y)) for y in KK_PAGES]} |")

    (PREVIEW / "kokaikei.json").write_text(json.dumps(kk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    text = "\n".join([check, "", "## 公会計の履歴を作り直しました（preview/kokaikei.json）", "",
                      f"- 履歴が変わった団体数（指標ごと）：{dict(changed)}",
                      f"- 途中の空欄が埋まった団体：{filled}",
                      f"- 公式にも値が無く、空欄が残った団体：{emptied}", "",
                      "| 団体 | 一人当たり資産額（変更前：平成30〜令和5年度） | 変更後 |", "|---|---|---|"] + sample)
    print(text[len(check):])
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


if __name__ == "__main__":
    try:
        main()
    except SourceMissing as ex:
        print(f"❌ {ex}")
        sys.exit(1)

# -*- coding: utf-8 -*-
"""
公会計（kokaikei.json）の年次更新。総務省「統一的な基準による財務書類に関する情報」の指標一覧から、
9つの公会計指標（ka1〜ka9）の新しい年度を取り込む。（2026-09-30 作り直し）

使い方（年次更新のワークフローから自動で実行される）:
    python scripts/build_kokaikei.py            … 次の年度が公表されていれば取り込む。まだなら何もしない
    python scripts/build_kokaikei.py --year 5   … 指定した年度（5＝令和5年度）で取り込み直す（リハーサル用）

データの持ち方（アプリの js/kokaikei.js と同じ）
  ka◯_r1＝平成30年度、ka◯_r2＝令和元年度 … と、番号がそのまま年度を表す。主値（ka◯）が最新の年度。
  値が無い年は空欄(null)のまま位置を保つ（前に詰めない）。

以前のこのスクリプトの問題（2026-09-30に判明）
  ・毎回空のファイルから作り直していて、実行すると過去の履歴が消えるところだった
  ・「空いている次の欄に入れる」仕組みで、年の位置がずれることがあった
  ・手元にダウンロードしたExcelが必要だった

取り込み方
  ・総務省の指標一覧のExcelには「その年度」と「前年度」の2年分が入っている。
    その年度の値を最新値に、前年度の値（翌年に修正されていることがある）を前年度の欄に入れる。
  ・列の位置は、前年度のシートの値と今のアプリの値が9割以上一致する列を使う（一致しなければ止まる）。
  ・類似団体の区分（grp）と、区分ごとの中央値（_groupMedians）も更新する。
  ・書き込み先は環境変数 MITCHIE_DATA_DIR（年次更新のワークフローは preview/）。
"""
import collections
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from audit_official_data import (DATA_FILES, pick, index, to_num, norm_name, SourceMissing,  # noqa: E402
                                 fetch)

ROOT = HERE.parent
DATA_DIR = Path(os.environ.get("MITCHIE_DATA_DIR") or ROOT)
if not DATA_DIR.is_absolute():
    DATA_DIR = ROOT / DATA_DIR
CODES = [f"ka{i}" for i in range(1, 10)]
GROUP_CODES = ["ka1", "ka6", "ka7", "ka8"]


def page_url(y):
    return f"https://www.soumu.go.jp/iken/kokaikei/{'H30' if y == 0 else 'R%02d' % y}_chihou_zaimusyorui.html"


def ylab(y):
    return "平成30年度" if y == 0 else ("令和元年度" if y == 1 else f"令和{y}年度")


def sheet_re(y):
    return r"H\s*30" if y == 0 else (r"R\s*(元|0?1)(?!\d)" if y == 1 else rf"R\s*0?{y}(?!\d)")


def fmt(v):
    v = round(v, 1)
    return int(v) if float(v).is_integer() else v


def summary(text):
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")


def fail(msg):
    summary(f"❌ 公会計：{msg}（公会計のデータは書き換えていません）")
    sys.exit(1)


def median(vals):
    s = sorted(vals)
    if not s:
        return None
    m = len(s) // 2
    return round(s[m] if len(s) % 2 else (s[m - 1] + s[m]) / 2, 1)


def main():
    kk_path = DATA_DIR / "kokaikei.json"
    kk = json.loads(kk_path.read_text(encoding="utf-8"))
    pref_of = {}
    for f in DATA_FILES:
        for n, e in json.loads((DATA_DIR / f).read_text(encoding="utf-8")).items():
            pref_of[n] = e.get("p")
    ents = []
    for n, e in kk.items():
        if n.startswith("_") or not isinstance(e, dict) or n not in pref_of:
            continue
        ip = n == pref_of[n]
        ents.append((n, e, ip, pref_of[n] if ip else (pref_of[n], norm_name(n))))

    # 今のデータの最新年度（ka1_r1＝平成30年度から並ぶ欄の数）
    cur_y = max(sum(1 for k in range(1, 30) if f"ka1_r{k}" in e) for n, e, ip, key in ents)
    if "--year" in sys.argv:
        new_y = int(sys.argv[sys.argv.index("--year") + 1])
        if new_y not in (cur_y, cur_y + 1):
            fail(f"--year {new_y} は指定できません（今のデータの最新は{ylab(cur_y)}。同じ年度か次の年度だけ）")
    else:
        new_y = cur_y + 1
    print(f"今の公会計データ：{ylab(cur_y)}まで／取り込む年度：{ylab(new_y)}")

    # 公表されているか（ページとExcelがあるか）
    try:
        fetch(page_url(new_y))
    except Exception:
        summary(f"ℹ️ 公会計：{ylab(new_y)}はまだ総務省から公表されていません。公会計は今のまま（{ylab(cur_y)}まで）です。")
        return
    urls = {}
    for ip in (False, True):
        try:
            urls[ip] = pick(page_url(new_y), lambda t: ("都道府県指標一覧" if ip else "市区町村指標一覧") in t,
                            label=f"{ylab(new_y)} 公会計 指標一覧")
        except SourceMissing as ex:
            fail(str(ex))

    new_slot = lambda code: code                     # 新しい年度＝主値
    prev_key = lambda code: f"{code}_r{new_y}"      # 前年度（new_y-1）の欄＝ _r{new_y}
    # （_r◯ の番号＝年度＋1。前年度 new_y-1 の番号は new_y）

    lines = ["| 区分 | 読めた団体（新／前年度） | 列（指標1〜9） | 前年度の値とアプリの一致率 |", "|---|---|---|---|"]
    rows_new, rows_prev, cols_of = {}, {}, {}
    for ip in (False, True):
        grp = "都道府県" if ip else "市町村"
        idx_new = index([urls[ip]], ip, sheet_re=sheet_re(new_y), strict=True)
        idx_prev = index([urls[ip]], ip, sheet_re=sheet_re(new_y - 1), strict=True)
        if not idx_new or not idx_prev:
            fail(f"{grp}のExcelに{ylab(new_y)}・{ylab(new_y - 1)}のシートが見つかりません")
        # 前年度のシートと、アプリの前年度の値（今の主値 or _r{new_y}）を比べて列を決める
        cols, worst = {}, 1.0
        for code in CODES:
            tally, tried = collections.Counter(), 0
            for n, e, eip, key in ents:
                if eip != ip:
                    continue
                av = e.get(code) if new_y == cur_y + 1 else e.get(prev_key(code))
                row = idx_prev.get(key)
                if row is None or av is None:
                    continue
                tried += 1
                for ci, v in enumerate(row):
                    x = to_num(v)
                    if x is not None and abs(round(x, 1) - av) < 0.11:
                        tally[ci] += 1
            if not tally:
                fail(f"{grp} {code}：列が特定できません")
            ci, h = tally.most_common(1)[0]
            cols[code] = ci
            worst = min(worst, h / tried)
        if len(set(cols.values())) != len(cols):
            fail(f"{grp}：同じ列が複数の指標に選ばれました {cols}")
        if worst < 0.9:
            fail(f"{grp}：前年度の値とアプリの値の一致率が低すぎます（{worst:.0%}）。Excelの形式が変わった可能性があります")
        # 区分（grp）の列：今のアプリの区分と一致する列（区分は数年おきに見直されるので、半分以上一致すれば採用）
        gt, gtried = collections.Counter(), 0
        for n, e, eip, key in ents:
            row = idx_new.get(key)
            if eip != ip or row is None or not e.get("grp"):
                continue
            gtried += 1
            for ci, v in enumerate(row):
                if isinstance(v, str) and v.strip() == e["grp"]:
                    gt[ci] += 1
        grp_col = None
        if gt and gt.most_common(1)[0][1] >= 0.5 * gtried:
            grp_col = gt.most_common(1)[0][0]
        rows_new[ip], rows_prev[ip], cols_of[ip] = idx_new, idx_prev, (cols, grp_col)
        lines.append(f"| {grp} | {sum(1 for r in idx_new.values() if r is not None)}／{sum(1 for r in idx_prev.values() if r is not None)} | "
                     f"{[cols[c] for c in CODES]} | {worst:.1%} |")

    # 書き込み
    missing, changed_prev = [], 0
    for n, e, ip, key in ents:
        cols, grp_col = cols_of[ip]
        rn, rp = rows_new[ip].get(key), rows_prev[ip].get(key)
        if rn is None:
            missing.append(n)
        for code in CODES:
            ci = cols[code]
            vn = to_num(rn[ci]) if rn is not None else None
            vp = to_num(rp[ci]) if rp is not None else None
            if new_y == cur_y + 1:
                # 今の最新値を前年度の欄へ（修正後の値があればそれを使う）
                old = e.get(code)
                e[prev_key(code)] = fmt(vp) if vp is not None else old
            else:
                before = e.get(prev_key(code))
                if vp is not None:
                    e[prev_key(code)] = fmt(vp)
                if e.get(prev_key(code)) != before:
                    changed_prev += 1
            e[new_slot(code)] = fmt(vn) if vn is not None else None
        if rn is not None and grp_col is not None and isinstance(rn[grp_col], str) and rn[grp_col].strip():
            e["grp"] = rn[grp_col].strip()

    if len(missing) > max(20, 0.05 * len(ents)):
        fail(f"{ylab(new_y)}のExcelに見つからない団体が多すぎます（{len(missing)}団体）")

    # 類似団体の区分ごとの中央値（最新の年度の値で）
    gm = {"muni": {}, "pref": {}}
    for n, e, ip, key in ents:
        if not e.get("grp"):
            continue
        g = gm["pref" if ip else "muni"].setdefault(e["grp"], {c: [] for c in GROUP_CODES})
        for c in GROUP_CODES:
            if e.get(c) is not None:
                g[c].append(e[c])
    for b in gm:
        for grp_name, vals in gm[b].items():
            out = {c: median(v) for c, v in vals.items() if v}
            out["_n"] = max((len(v) for v in vals.values()), default=0)
            gm[b][grp_name] = out
    kk["_groupMedians"] = gm

    kk_path.write_text(json.dumps(kk, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    summary("\n".join(["## 公会計の更新", "", f"- 取り込んだ年度：{ylab(new_y)}（前年度 {ylab(new_y - 1)} は修正後の値に更新）",
                       f"- {ylab(new_y)}の値が無かった団体（空欄）：{len(missing)}団体 {missing[:15]}", ""] + lines))


if __name__ == "__main__":
    main()

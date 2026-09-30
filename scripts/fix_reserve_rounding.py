# -*- coding: utf-8 -*-
"""
財政調整基金（r）の四捨五入をそろえる（使い捨て・2026-09-30）

総務省の基金残高等一覧は「百万円」単位の整数（例：785）で、アプリは億円の小数1桁（7.9）で持つ。
785 のような「ちょうど5」の値は、今までの計算（Pythonの round）では 7.8 になったり 7.9 に
なったりと、団体や年によってばらばらだった（2026-09-30 のリハーサルで判明）。
年次更新はふつうの四捨五入（7.85 → 7.9）に直したので、過去の値も同じ四捨五入にそろえる。

  ・令和元年度〜最新年度の全年度・市町村と都道府県の両方を、公式Excelから計算し直す。
  ・書き換えるのは「公式の値を四捨五入した値」と0.1億円だけ違う（＝丸め方の違いだけの）ものに限る。
    それより大きく違うものがあれば、何も書き換えずに止まる。
  ・書き込み先は preview/（MITCHIE_DATA_DIR で変更可）。
"""
import collections
import json
import os
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from audit_official_data import (DATA_FILES, KIKIN_FILES, index, to_num, norm_name)  # noqa: E402

ROOT = HERE.parent
DATA_DIR = Path(os.environ.get("MITCHIE_DATA_DIR") or (ROOT / "preview"))
if not DATA_DIR.is_absolute():
    DATA_DIR = ROOT / DATA_DIR
DIVS = [100, 1000, 10000, 100000, 1000000, 100000000]  # 公式の単位 → 億円


def half_up(x):
    return float(x.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def summary(t):
    print(t)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(t + "\n")


def main():
    dbs = {f: json.loads((DATA_DIR / f).read_text(encoding="utf-8")) for f in DATA_FILES}
    ents = []
    for f, d in dbs.items():
        for n, e in d.items():
            ip = n == e.get("p")
            ents.append((n, e, ip, e["p"] if ip else (e["p"], norm_name(n))))
    latest = max(sum(1 for k in range(1, 40) if f"f_r{k}" in e) for n, e, ip, key in ents) + 1
    changes, bad, lines = [], [], []
    for k in range(1, latest + 1):
        slot = "r" if k == latest else f"r_r{k}"
        for ip in (False, True):
            grp = "都道府県" if ip else "市町村"
            fid = KIKIN_FILES[k][1 if ip else 0]
            idx = index([f"https://www.soumu.go.jp/main_content/{fid}.xlsx"], ip)
            # 列と単位：アプリの値と0.1億円以内で一致する数が一番多い組み合わせ
            tally, tried = collections.Counter(), 0
            for n, e, eip, key in ents:
                row, av = idx.get(key), e.get(slot)
                if eip != ip or row is None or av is None:
                    continue
                tried += 1
                for ci, v in enumerate(row):
                    x = to_num(v)
                    if x is None:
                        continue
                    for dv in DIVS:
                        if abs(x / dv - av) <= 0.1 + 1e-9:
                            tally[(ci, dv)] += 1
            if not tally:
                bad.append(f"令和{k}年度 {grp}：列が特定できません")
                continue
            (ci, dv), hit = tally.most_common(1)[0]
            if hit < 0.9 * tried:
                bad.append(f"令和{k}年度 {grp}：一致率が低すぎます（{hit}/{tried}）")
                continue
            n_fix = 0
            for n, e, eip, key in ents:
                row, av = idx.get(key), e.get(slot)
                if eip != ip or row is None or av is None or to_num(row[ci]) is None:
                    continue
                correct = half_up(Decimal(str(to_num(row[ci]))) / dv)
                diff = abs(correct - av)
                if diff < 1e-9:
                    continue
                if diff <= 0.1 + 1e-9:
                    changes.append((e, slot, correct))
                    n_fix += 1
                    if n_fix <= 3:
                        lines.append(f"  - 令和{k}年度 {n}：{av} → {correct}")
                else:
                    bad.append(f"令和{k}年度 {n}：アプリ {av}／公式 {correct}（丸め方の違いより大きい）")
            summary(f"- 令和{k}年度（{grp}）：列{ci}・単位1/{dv}、そろえる値 {n_fix}件")
    if lines:
        summary("\n例：\n" + "\n".join(lines))
    if bad:
        summary("\n### ❌ 丸め方の違いでは説明できない食い違いがあるため、何も書き換えていません\n\n"
                + "\n".join(f"- {b}" for b in bad[:40]))
        sys.exit(1)
    for e, slot, v in changes:
        e[slot] = v
    for f, d in dbs.items():
        (DATA_DIR / f).write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    summary(f"\n### ✅ 財政調整基金の四捨五入をそろえました（{len(changes)}件）")


if __name__ == "__main__":
    main()

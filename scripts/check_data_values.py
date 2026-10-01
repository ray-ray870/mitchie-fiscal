# -*- coding: utf-8 -*-
"""
財政データ（data-*.json）の「中身」が正しい範囲に収まっているかを確かめるチェック。

check_data_consistency.py（自治体の顔ぶれの突き合わせ）から自動で呼ばれる。
単体でも動かせる（リポジトリのルートで `python scripts/check_data_values.py`）。
ファイルは書き換えない（読み取り専用）。

■ 見過ごせない問題（problems → 終了コード1で停止）
  ・自治体数が想定値と合わない（合計・市区町村・都道府県）
  ・自治体名の重複
  ・必須の項目が欠けている／数値でない（過去年度のキー構造の崩れを含む）
  ・財政力指数・各比率・人口が、あり得ない範囲にある
  ・総合スコアが0〜100に収まらない／計算できない（順位の分母が実データ件数と合わなくなる原因）
■ 参考（notes → 止めない）
  ・前の年度から大きく動いた値（本当にそうなったのか、取り込み誤りかを人が見て判断する）

【年次更新・合併のときにやること】
  自治体の数が変わったら、下の EXPECTED_* を新しい数に直す（ここで止まるのが正しい動き）。
  範囲（RANGES）は、実際のデータの分布より広めに取ってある。
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# ---- 想定値（自治体の数が変わったらここだけ直す）----
EXPECTED_TOTAL = 1788
EXPECTED_MUNI = 1741
EXPECTED_PREF = 47

# ---- 必須の項目（現在のデータ構造。年度別のキー＝過去年度の構造もここで守る）----
# 現在年度の値（数値が必須）
REQUIRED_NUM = ["f", "d", "x", "r", "g", "eo", "ei", "edu", "ch", "pop", "sfs"]
# 数値が必須の年度別キー（_r1〜）
REQUIRED_HIST = {
    "f": [1, 2, 3, 4, 5], "d": [1, 2, 3, 4, 5], "x": [1, 2, 3, 4, 5],
    "r": [1, 2, 3, 4, 5], "edu": [1, 2, 3, 4, 5], "ch": [2, 3, 4, 5],
    "pop": [1, 2, 3, 4, 5, 6, 7], "g": [1, 2, 3, 4, 5, 6, 7],
    "eo": [2, 3, 4, 5], "ei": [2, 3, 4, 5],
}
# 将来負担比率は「実質ゼロ」の自治体が null になるため、null か数値のどちらか
NULLABLE_NUM = ["u"] + ["u_r%d" % i for i in range(1, 6)] + ["ch_r1"]   # ch_r1 は大月町・日之影町が元から空
# 年度別の数値（sfs_r1 は2団体で欠けているのが正常なので必須にしない）

# ---- あり得る範囲（実データの分布より広め）----
# (下限, 上限)
RANGES = {
    "f": (0.0, 3.0),        # 財政力指数
    "d": (-30.0, 100.0),    # 実質公債費比率（%）
    "x": (30.0, 200.0),     # 経常収支比率（%）
    "u": (0.0, 1000.0),     # 将来負担比率（%）
    "g": (-30.0, 30.0),     # 人口増減率（%）
    "edu": (0.0, 100.0),    # 教育費比率（%）
    "ch": (0.0, 3000.0),    # 子ども1人あたり（万円）
    "pop": (1, 20000000),   # 人口
}
# 参考：前の年度（_r5）から、これ以上動いたら notes に出す
JUMP_NOTE = {"f": 0.3, "x": 30.0, "d": 25.0}


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf")


def calc_h(e):
    """score.js の calcH（市区町村）と同じ式。"""
    f, d, x, u, r, sfs = e["f"], e["d"], e["x"], e.get("u"), e["r"], e.get("sfs")
    sf = min(f / 1.2 * 25, 25)
    sd = max((25 - min(d, 25)) / 25 * 20, 0)
    sx = min(max((100 - x) / 15 * 20, 0), 20)
    su = 20 if (not u or u <= 0) else max((200 - min(u, 200)) / 200 * 20, 0)
    sr = min((r / sfs * 100) / 20 * 15, 15) if (sfs and sfs > 0 and r is not None) else 7.5
    return min(sf + sd + sx + su + sr, 100)


def calc_h_pref(e):
    """score.js の calcHPref（都道府県）と同じ式。"""
    f, d, x, u, r, sfs = e["f"], e["d"], e["x"], e.get("u"), e["r"], e.get("sfs")

    def band(v, zero, full):
        if v is None:
            return 0
        t = (zero - min(max(v, min(zero, full)), max(zero, full))) / (zero - full)
        return min(max(t, 0), 1)

    sf = min(max((f - 0.20) / (0.90 - 0.20), 0), 1) * 25
    sd = band(d, 20, 6) * 20
    sx = band(x, 101, 86) * 20
    su = 20 if (not u or u <= 0) else band(u, 340, 80) * 20
    sr = min((r / sfs * 100) / 10 * 15, 15) if (sfs and sfs > 0 and r is not None) else 7.5
    return min(sf + sd + sx + su + sr, 100)


def check(db, problems, notes):
    """db = {自治体名: entry}。見つかった問題を problems / notes に足す。"""
    prefs = [k for k, v in db.items() if isinstance(v, dict) and v.get("p") == k]
    munis = [k for k in db if k not in set(prefs)]
    print("")
    print("■ 財政データの中身をチェック中（件数・必須項目・範囲・スコア）")
    print("  合計 %d件（市区町村 %d・都道府県 %d）" % (len(db), len(munis), len(prefs)))

    # 1. 件数
    if len(db) != EXPECTED_TOTAL:
        problems.append("自治体の合計が想定（%d件）と違います: %d件（合併・新設があった年は、scripts/check_data_values.py の EXPECTED_* を直してください）" % (EXPECTED_TOTAL, len(db)))
    if len(munis) != EXPECTED_MUNI:
        problems.append("市区町村の数が想定（%d件）と違います: %d件" % (EXPECTED_MUNI, len(munis)))
    if len(prefs) != EXPECTED_PREF:
        problems.append("都道府県の数が想定（%d件）と違います: %d件" % (EXPECTED_PREF, len(prefs)))

    bad_key, bad_range, bad_score = [], [], []
    scores = {}
    for name, e in db.items():
        if not isinstance(e, dict):
            bad_key.append("%s: データが辞書になっていません" % name)
            continue
        # 2. 必須項目（現在年度）
        for k in REQUIRED_NUM:
            if not is_num(e.get(k)):
                bad_key.append("%s: %s が欠けています／数値ではありません（%r）" % (name, k, e.get(k)))
        # 過去年度のキー構造
        for base, yrs in REQUIRED_HIST.items():
            for y in yrs:
                kk = "%s_r%d" % (base, y)
                if not is_num(e.get(kk)):
                    bad_key.append("%s: %s が欠けています／数値ではありません（%r）" % (name, kk, e.get(kk)))
        for k in NULLABLE_NUM:
            if k in e and e[k] is not None and not is_num(e[k]):
                bad_key.append("%s: %s が数値でも空でもありません（%r）" % (name, k, e[k]))
        if not isinstance(e.get("p"), str) or not e.get("p"):
            bad_key.append("%s: 都道府県名（p）が欠けています" % name)
        # 3. 範囲
        for k, (lo, hi) in RANGES.items():
            v = e.get(k)
            if is_num(v) and not (lo <= v <= hi):
                bad_range.append("%s: %s=%s（想定 %s〜%s）" % (name, k, v, lo, hi))
        if is_num(e.get("pop")) and e["pop"] <= 0:
            bad_range.append("%s: 人口が0以下です" % name)
        # 4. スコア
        try:
            s = calc_h_pref(e) if name in prefs else calc_h(e)
            if not is_num(s) or not (0 <= s <= 100):
                bad_score.append("%s: スコア=%r" % (name, s))
            else:
                scores[name] = s
        except Exception as ex:
            bad_score.append("%s: スコアを計算できません（%s）" % (name, ex))
        # 参考：前の年度から大きく動いた値
        for k, th in JUMP_NOTE.items():
            a, b = e.get(k), e.get(k + "_r5")
            if is_num(a) and is_num(b) and abs(a - b) > th:
                notes.append("%s の %s が前年度から大きく動いています（%s → %s）。取り込み誤りでないか確認してください" % (name, k, b, a))

    for label, lst in (("必須項目・年度別キー", bad_key), ("あり得ない範囲の値", bad_range), ("総合スコア（0〜100）", bad_score)):
        if lst:
            problems.append("%s の問題: %d件\n    例: %s" % (label, len(lst), "／".join(lst[:8])))

    # 順位の分母＝スコアを計算できた件数が、市区町村・都道府県の件数と一致するか
    n_m = len([k for k in munis if k in scores])
    n_p = len([k for k in prefs if k in scores])
    if n_m != len(munis) or n_p != len(prefs):
        problems.append("順位の分母（スコアを計算できた件数 市区町村 %d・都道府県 %d）が、実データの件数（%d・%d）と一致しません" % (n_m, n_p, len(munis), len(prefs)))
    if scores:
        print("  スコア範囲: %.1f〜%.1f" % (min(scores.values()), max(scores.values())))


def main():
    data_dir = os.environ.get("MITCHIE_DATA_DIR") or ROOT
    if not os.path.isabs(data_dir):
        data_dir = os.path.join(ROOT, data_dir)
    files = ["data-hokkaido-tohoku.json", "data-kanto.json", "data-chubu.json",
             "data-kinki.json", "data-chugoku-shikoku.json", "data-kyushu.json"]
    db, problems, notes = {}, [], []
    for fn in files:
        path = os.path.join(data_dir, fn)
        if not os.path.exists(path):
            problems.append("%s が見つかりません" % fn)
            continue
        with open(path, encoding="utf-8") as f:
            for k, v in json.load(f).items():
                if k in db:
                    problems.append("自治体名が重複しています: %s" % k)
                db[k] = v
    check(db, problems, notes)
    print("=" * 40)
    if notes:
        print("【参考】 %d件" % len(notes))
        for n in notes[:20]:
            print("  ・" + n)
    if problems:
        print("NG: %d件" % len(problems))
        for p in problems:
            print("  ・" + p)
        sys.exit(1)
    print("OK: データの中身は想定の範囲内です。")


if __name__ == "__main__":
    main()

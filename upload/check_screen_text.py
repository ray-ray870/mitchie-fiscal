# -*- coding: utf-8 -*-
"""
画面の文章のチェック（確認専用・データもプログラムも書き換えない）（2026-10-15）

全自治体 × 全詳細画面（財政11画面＋公会計9画面）を実際にブラウザで開き、
表示された文章を読んで、次のものを一覧にする。

  ・食い違いの候補：同じ画面の中で、同じ話題（貯金・借金・税収など）が
    「高め」と「低め」、または「高め／低め」と「ほぼ同じ」で書かれているもの
    （比べる相手が違うもの＝「全国」と「似ている自治体」は別扱い。
      「ただ、」で始まる文は、わざと対比させている文なので除く）
  ・同じ文の重複：同じ画面の中に、同じ文が2回以上出ているもの

止めない（見つかっても終了コードは0）。結果は Summary の【参考】に出すので、
年次更新のあとに目で見て、直すかどうかを相談する。

audit_official_data.py（公式データとの照合）の最後から自動で呼ばれる。
単体でも動かせる（リポジトリのルートで `python scripts/check_screen_text.py`、
preview を調べるときは `python scripts/check_screen_text.py preview`）。
照合と同じく、環境変数 MITCHIE_DATA_DIR があればその場所（年次更新・「プレビュー」を選んだ照合では preview/）を調べる。

ブラウザ（Playwright の Chromium）が無ければ、その場で入れる（GitHub Actions で数分かかる）。
入れられなかったときは、何もせずに終わる。
"""
import collections
import functools
import http.server
import json
import multiprocessing
import os
import re
import subprocess
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORKERS = 4

# ---------- 文章を集める（ブラウザの中で動かす） ----------
COLLECT_JS = r"""
(chunk) => {
  const keys = ["health","debt","fiscalPower","flex","future","reserve","growth","budget","education","childInvest","furusato"];
  const kk = Object.keys(KK_META);
  const res = [];
  function blocks() {
    const out = [];
    [document.getElementById('shTop'), document.getElementById('shDesc')].forEach(function(r){
      if (!r) return;
      r.querySelectorAll('div').forEach(function(el){
        if (el.closest('#spWrap')) return;
        // 「もっと詳しく」の中（どの自治体でも同じ一般的な説明）は除く
        const fc = el.closest('.hk-fc');
        if (fc && fc.previousElementSibling && /more-/.test(fc.previousElementSibling.getAttribute('onclick') || '')) return;
        if (el.querySelector('div')) return;
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) out.push(t);
      });
    });
    return out;
  }
  for (const n of chunk) {
    try { render(find(n), true); } catch (e) { res.push({n: n, k: 'render', err: String(e)}); continue; }
    for (const k of keys) { try { openD(k, true); res.push({n: n, k: k, t: blocks()}); } catch (e) { res.push({n: n, k: k, err: String(e)}); } }
    for (const k of kk) { try { kkOpenDetail(k, true); res.push({n: n, k: k, t: blocks()}); } catch (e) { res.push({n: n, k: k, err: String(e)}); } }
  }
  return res;
}
"""

# ---------- 文章を読む ----------
# 話題（同じ話題の中で、向きが食い違っていないかを見る）
TOPICS = [
    ("drawdown", ["取り崩し"]), ("newborrow", ["新たに借りた", "借りた額"]),
    ("national", ["国から", "交付税", "交付金", "国庫支出金", "国の補助"]), ("tax", ["税収", "自前"]),
    ("reserve", ["貯金", "財政調整基金", "基金"]), ("borrow", ["借金に頼る", "地方債", "新たな借金", "新しく借り"]),
    ("repay", ["返済の負担", "返済", "公債費"]), ("fixed", ["決まって出ていく", "経常収支"]),
    ("future", ["将来", "負担"]), ("edu", ["教育"]), ("child", ["子ども"]), ("pop", ["人口"]),
    ("asset", ["資産"]), ("cost", ["行政コスト", "費用"]), ("debtkk", ["負債"]),
]
DIRS = [
    ("hi", ["高め", "多め", "大きめ", "重め", "厚め", "高い水準", "より高い"]),
    ("lo", ["低め", "少なめ", "小さめ", "軽め", "低い水準", "より低い"]),
    ("same", ["同じくらい", "ほぼ同じ", "ほぼ同水準", "並み"]),
]
DIR_RE = re.compile("|".join(re.escape(w) for _, ws in DIRS for w in ws))


def _dir_of(word):
    for d, ws in DIRS:
        if word in ws:
            return d


def _topic_of(ctx):
    best, score = None, (-1, -1)
    for t, ws in TOPICS:
        for w in ws:
            i = ctx.rfind(w)
            if i >= 0 and (i + len(w), len(w)) > score:
                best, score = t, (i + len(w), len(w))
    return best


def _base_of(sent):
    if "似ている" in sent or "類似" in sent or "同じタイプ" in sent:
        return "peer"
    if "全国" in sent or "中央値" in sent:
        return "nat"
    if "基準" in sent:
        return "law"
    return "-"


def _norm(s, name):
    return re.sub(r"[0-9０-９][0-9０-９,.．]*", "#", s.replace(name, "◯"))


def analyze(rows):
    conflicts = collections.defaultdict(list)
    dups = collections.defaultdict(list)
    errors = []
    for r in rows:
        if "err" in r:
            errors.append("%s %s: %s" % (r["n"], r["k"], r["err"]))
            continue
        n, k = r["n"], r["k"]
        found, seen = [], collections.Counter()
        for line in r["t"]:
            # 総合スコアの「スコアが近い自治体」の札と、グラフの年の並びは文章ではないので除く
            if re.match(r"^[（(]?[A-I] 財政力", line) or re.match(r"^[HR#]+$", re.sub(r"[0-9]", "#", line)):
                continue
            for sent in re.split(r"(?<=[。！])", line):
                sent = sent.strip()
                if not sent:
                    continue
                if len(sent) >= 12 and not re.match(r"^[0-9]", sent) and not sent.startswith("🔍 クロスチェック") and not re.match(r"^全国の中央値(とほぼ同水準|より高め|より低め)$", sent):
                    seen[sent] += 1
                if sent.startswith("ただ") or sent.startswith("→ ただ"):
                    continue   # わざと対比させている文
                for m in DIR_RE.finditer(sent):
                    ctx = sent[max(0, m.start() - 40):m.start()]
                    clause = re.split(r"[、。]", ctx)[-1] or ctx
                    t = _topic_of(clause) or _topic_of(ctx)
                    b = _base_of(sent)
                    if t and b != "law":
                        found.append((t, _dir_of(m.group()), b, sent))
        for s, c in seen.items():
            if c >= 2:
                dups[(k, _norm(s, n))].append(n)
        by_topic = collections.defaultdict(list)
        for t, d, b, s in found:
            by_topic[t].append((d, b, s))
        for t, lst in by_topic.items():
            for i in range(len(lst)):
                for j in range(i + 1, len(lst)):
                    d1, b1, s1 = lst[i]
                    d2, b2, s2 = lst[j]
                    if d1 == d2 or s1 == s2:
                        continue
                    if b1 != b2 and "-" not in (b1, b2):
                        continue   # 「全国」と「似ている自治体」は比べる相手が違う
                    key = (k, t) + tuple(sorted([_norm(s1, n), _norm(s2, n)]))
                    conflicts[key].append(n)
    return conflicts, dups, errors


# ---------- ブラウザで開く ----------
class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def _serve(directory):
    handler = functools.partial(_Quiet, directory=directory)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def _ensure_playwright():
    try:
        import playwright  # noqa: F401
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)
    # ブラウザがすでに使えるなら何もしない
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            p.chromium.launch().close()
        return
    except Exception:
        pass
    env = dict(os.environ)
    cmd = [sys.executable, "-m", "playwright", "install", "chromium"]
    if os.environ.get("GITHUB_ACTIONS"):
        cmd.insert(4, "--with-deps")
    subprocess.run(cmd, check=True, env=env)


def _worker(args):
    url, part, nparts = args
    from playwright.sync_api import sync_playwright
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        page.route(re.compile(r"googletagmanager|fonts\.g|cdnjs"), lambda r: r.abort())
        page.goto(url)
        page.wait_for_function('typeof DB==="object" && DB && Object.keys(DB).length>1000', timeout=120000)
        page.wait_for_timeout(1500)
        names = page.evaluate("([part,n]) => Object.keys(DB).filter((k,i)=>i%n===part)", [part, nparts])
        for i in range(0, len(names), 20):
            rows += page.evaluate(COLLECT_JS, names[i:i + 20])
        b.close()
    return rows


def collect(directory):
    srv = _serve(directory)
    url = "http://127.0.0.1:%d/index.html" % srv.server_address[1]
    try:
        with multiprocessing.Pool(WORKERS) as pool:
            parts = pool.map(_worker, [(url, i, WORKERS) for i in range(WORKERS)])
    finally:
        srv.shutdown()
    return [r for part in parts for r in part]


def report(conflicts, dups, errors, n_screens):
    lines = ["## 画面の文章のチェック（参考・止めません）", "",
             "全自治体の詳細画面 %d 画面を開いて読みました。" % n_screens, ""]
    if errors:
        lines += ["### ⚠️ 画面を開けなかったもの（%d件）" % len(errors), ""] + ["- " + e for e in errors[:20]] + [""]
    if not conflicts and not dups:
        lines += ["✅ 食い違いの候補・同じ文の重複は見つかりませんでした。", ""]
        return "\n".join(lines)
    if conflicts:
        lines += ["### 食い違いの候補（%d種類）" % len(conflicts), "",
                  "同じ画面の中で、同じ話題が反対の向きで書かれているもの。比べる相手や指標が違うだけのこともあるので、目で見て判断してください。", ""]
        for key, ns in sorted(conflicts.items(), key=lambda x: -len(x[1]))[:15]:
            lines.append("- 画面 `%s`・%d団体（例：%s）" % (key[0], len(ns), "、".join(ns[:3])))
            lines.append("  - %s" % key[2])
            lines.append("  - %s" % key[3])
        lines.append("")
    if dups:
        lines += ["### 同じ文の重複（%d種類）" % len(dups), ""]
        for (k, s), ns in sorted(dups.items(), key=lambda x: -len(x[1]))[:15]:
            lines.append("- 画面 `%s`・%d団体（例：%s）：%s" % (k, len(ns), "、".join(ns[:3]), s[:120]))
        lines.append("")
    return "\n".join(lines)


def run(subdir=""):
    # 調べる場所：引数 → 環境変数 MITCHIE_DATA_DIR（照合・年次更新と同じ場所。プレビューなら preview/）→ リポジトリのルート
    subdir = subdir or os.environ.get("MITCHIE_DATA_DIR") or ""
    directory = os.path.join(ROOT, subdir) if subdir else ROOT
    if not os.path.isfile(os.path.join(directory, "index.html")):
        directory = ROOT
    try:
        _ensure_playwright()
        rows = collect(directory)
    except Exception as e:   # ブラウザが用意できないときなどは、何もせずに終わる
        text = "## 画面の文章のチェック\n\n⚠️ ブラウザを用意できなかったため、今回は行いませんでした（%s）\n" % e
    else:
        conflicts, dups, errors = analyze(rows)
        text = report(conflicts, dups, errors, len(rows))
    print(text)
    sp = os.environ.get("GITHUB_STEP_SUMMARY")
    if sp:
        with open(sp, "a", encoding="utf-8") as fp:
            fp.write(text + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(run(sys.argv[1] if len(sys.argv) > 1 else ""))

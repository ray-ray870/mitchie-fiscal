  var HEALTH_LABELS = {happy:["絶好調","#6dcfad"],normal:["元気","#7bb8e8"],tired:["ちょっとしんどい","#f0c46a"],sick:["ぐったり","#f0876a"],critical:["ひんし","#d0505a"]};

  /* 金額（億円）の表示（読みやすさのため）。
       ・1万億円（1兆円）以上：「9兆5,337億円」（兆と、四捨五入した億円）
       ・100億円以上：小数なしの億円「6,449億円」
       ・100億円未満：小数第1位まで（「3.5億円」。ちょうど整数なら「71億円」）
     v：億円の数値。
     符号は呼び出し側で付ける（負の値のときだけ先頭に「-」が付く） */
  function fmtOku(v) {
    if (v == null || isNaN(v)) return "－";
    var a = Math.abs(v), sign = v < 0 ? "-" : "";
    var r1 = Math.round(a * 10) / 10;
    if (r1 >= 10000 || Math.round(a) >= 10000) {
      var cho = Math.floor(a / 10000), rest = Math.round(a - cho * 10000);
      if (rest >= 10000) { cho += 1; rest = 0; }
      return sign + cho.toLocaleString() + "兆" + (rest > 0 ? rest.toLocaleString() + "億" : "") + "円";
    }
    if (r1 >= 100) return sign + Math.round(a).toLocaleString() + "億円";
    return sign + r1.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 1}) + "億円";
  }

  function healthState(score) {
    if (score>=85) return "happy";
    if (score>=70) return "normal";
    if (score>=50) return "tired";
    if (score>=30) return "sick";
    return "critical";
  }

  /* --- 色判定：経常収支比率 ---
     90未満=緑 / 95未満=青 / 98未満=黄 / 98以上=橙
     2003年度以降、全国平均は90%を超え続けているため、90%を標準の入口とする。
     98%以上は全体の約9%で、余力がほぼない水準。 */
  /* --- 色判定：財政力指数 ---
     0.70以上=緑 / 0.45以上=青 / 0.25以上=黄 / 0.25未満=橙
     中央値は市区町村0.44・都道府県0.47。旧基準（1.0/0.7）では
     市区町村の78%が最も濃い色になり、判別の役に立っていなかった。
     財政力が低いこと自体は交付税で補われる前提の数字であり、
     危険信号ではないため、最も濃い色は下位2割程度に絞っている。 */
  /* --- 財政調整基金の基準 ---
     分母は標準財政規模。実務でもこの割合で語られる。
     水準は総務省「基金の積立状況等に関する調査」（平成29年）で
     各団体が回答した実務水準に合わせている（法令上の基準はない）。
     都道府県と市区町村で水準がまったく違うため、基準を分ける。
     （標準財政規模比の中央値は市区町村24.8%、都道府県6.4%） */
  function reserveBands(isPref) {
    return isPref ? {hi: 10, mid: 5, lo: 2.5} : {hi: 20, mid: 10, lo: 5};
  }

  // 将来負担比率が「重い」と言える水準か判定する。都道府県は100〜160%が標準的（中央値159.7%）なので、
  // 市区町村と同じ100%を基準にすると都道府県が軒並み「重い」と誤判定されてしまう。
  function futureBurdenHigh(u, isPref) {
    if (u == null) return false;
    return isPref ? u > 160 : u > 100;
  }

  function colorR(ratio, isPref) {
    if (ratio == null) return "#7bb8e8";
    var b = reserveBands(isPref);
    return ratio >= b.hi ? "#6dcfad" : ratio >= b.mid ? "#7bb8e8"
         : ratio >= b.lo ? "#f0c46a" : "#f0876a";
  }

  function colorF(f) {
    if (f == null) return "#7bb8e8";
    return f >= 0.70 ? "#6dcfad" : f >= 0.45 ? "#7bb8e8" : f >= 0.25 ? "#f0c46a" : "#f0876a";
  }

  /* --- 色判定：実質公債費比率 ---
     10未満=緑 / 18未満=青 / 25未満=黄 / 25以上=橙（18%・25%は国の基準） */
  function colorD(d) {
    if (d == null) return "#7bb8e8";
    return d < 10 ? "#6dcfad" : d < 18 ? "#7bb8e8" : d < 25 ? "#f0c46a" : "#f0876a";
  }

  /* --- 色判定：人口増減率 ---
     説明文の「目安」と同じ：+0.1%以上=緑 / ±0.1%未満=青（ほぼ横ばい） / -0.5%まで=黄 / それより大きい減少=橙 */
  function colorG(g) {
    if (g == null) return "#7bb8e8";
    return g >= 0.1 ? "#6dcfad" : g > -0.1 ? "#7bb8e8" : g >= -0.5 ? "#f0c46a" : "#f0876a";
  }

  function colorX(x) {
    if (x == null) return "#7bb8e8";
    return x < 90 ? "#6dcfad" : x < 95 ? "#7bb8e8" : x < 98 ? "#f0c46a" : "#f0876a";
  }

  /* --- 色判定：将来負担比率 ---
     都道府県は高校・国道・河川など大規模資産を抱えるため水準が構造的に高い。
     市区町村と同じ基準では9割が最も濃い色になるので、基準を分ける。 */
  function colorU(u, isPref) {
    var v = (u == null || u <= 0) ? 0 : u;
    if (isPref) {
      return v < 100 ? "#6dcfad" : v < 160 ? "#7bb8e8" : v < 250 ? "#f0c46a" : "#f0876a";
    }
    if (v <= 0) return "#6dcfad";
    return v < 60 ? "#7bb8e8" : v < 100 ? "#f0c46a" : "#f0876a";
  }

  /* --- 「軽め」「重め」などの短い言葉（2026-09-30）---
     詳細画面の最初の一文・カードの色・「公会計と比べてみると」の欄で、同じ値に違う言葉が
     付かないように1か所にまとめる（以前は 84% が「やや高め」と「軽め」の両方で表示されていた）。 */
  function futureLevelLabel(u, isPref) {
    if (u == null || u <= 0) return "実質ゼロ";
    var c = colorU(u, isPref);
    if (isPref) return c === "#6dcfad" ? "低め" : c === "#7bb8e8" ? "標準的" : c === "#f0c46a" ? "やや重め" : "重め";
    return c === "#7bb8e8" ? "軽め" : c === "#f0c46a" ? "一定の負担あり" : "重め";
  }
  function debtLevelLabel(d, isPref) {
    if (d == null) return "－";
    return d < 10 ? "軽め" : (isPref && d < 14) ? "標準的" : d < 18 ? "やや重め" : "重め";
  }
  function reserveLevelLabel(ratio, isPref) {
    if (ratio == null) return "－";
    var b = reserveBands(isPref);
    return ratio >= b.hi ? "多め" : ratio >= b.mid ? "標準的" : ratio >= b.lo ? "やや少なめ" : "少なめ";
  }

  /* --- 都道府県専用のスコア ---
     市区町村向けの基準をそのまま使うと、47都道府県のうち46県が下位2段階に
     集中してしまう。都道府県は高校・国道・河川など大規模な資産を抱えるため、
     将来負担比率や経常収支比率の水準が構造的に高いことによる。
     47県の実際の分布をもとに、中央値の県が中位に来るよう基準を引き直した。 */
  /* --- スコアと指標の食い違いを知らせる帯 ---
     総合スコアだけを見て判断されるのを防ぐため、
     スコアが高いのに弱い指標があるとき／低いのに強い指標があるときに
     スコアバーの直上へ1行を出す。 */
  function noteHtml(d, h, isPref) {
    var GOOD = "#6dcfad", WARN = "#f0c46a";
    var warn = [], good = [];
    var cxv = colorX(d.x), cuv = colorU(d.u, isPref);
    var cdv = colorD(d.d);
    var isWeak = function(c){ return c === "#f0c46a" || c === "#f0876a"; };
    var isBest = function(c){ return c === "#6dcfad"; };

    if (h >= 70) {
      if (isWeak(cxv)) warn.push("経常収支比率");
      if (isWeak(cuv)) warn.push("将来負担比率");
      if (isWeak(cdv)) warn.push("実質公債費比率");
    }
    if (h < 50) {
      if (isBest(cxv)) good.push("経常収支比率");
      if (isBest(cuv)) good.push("将来負担比率");
      if (isBest(cdv)) good.push("実質公債費比率");
    }
    if (!warn.length && !good.length) return "";

    var row = function(color, bg, icon, text) {
      return "<div style='background:" + bg + ";border-left:3px solid " + color +
        ";padding:9px 11px;margin-bottom:6px;display:flex;gap:8px;align-items:flex-start;'>" +
        "<span style='font-size:15px;flex-shrink:0;' aria-hidden='true'>" + icon + "</span>" +
        "<span style='font-size:13px;line-height:1.5;color:#6a5a2a;'>" + text + "</span></div>";
    };
    var out = "";
    warn.forEach(function(n){
      out += row(WARN, "#fdf5d4", "⚠️", "ただし、" + n + "は高い水準です");
    });
    good.forEach(function(n){
      out += row(GOOD, "#d4f0e8", "💡", n + "は健全な水準です");
    });
    return out;
  }

  /* --- 総合スコアの内訳（2026-09-30）---
     総合スコア（calcH）と、詳細画面の「内訳を見る」の両方がこの式を使う。
     都道府県は専用の基準、市区町村は 財政力25＋公債費20＋経常収支20＋将来負担20＋基金15。 */
  function scoreBreakdown(d, isPref) {
    var f = d.f, dd = d.d, x = d.x, u = d.u, r = d.r, sfs = d.sfs;
    var p = {};
    if (isPref) {
      var band = function(v, zero, full) {
        if (v == null) return 0;
        var t = (zero - Math.min(Math.max(v, Math.min(zero, full)), Math.max(zero, full))) / (zero - full);
        return Math.min(Math.max(t, 0), 1);
      };
      p.f = Math.min(Math.max((f - 0.20) / (0.90 - 0.20), 0), 1) * 25;
      p.d = band(dd, 20, 6) * 20;
      p.x = band(x, 101, 86) * 20;
      p.u = (!u || u <= 0) ? 20 : band(u, 340, 80) * 20;
      p.r = (sfs && sfs > 0 && r != null) ? Math.min((r / sfs * 100) / 10 * 15, 15) : 7.5;
    } else {
      p.f = Math.min(f/1.2*25, 25);
      p.d = Math.max((25-Math.min(dd,25))/25*20, 0);
      p.x = Math.min(Math.max((100-x)/15*20, 0), 20);
      p.u = (!u || u <= 0) ? 20 : Math.max((200-Math.min(u,200))/200*20, 0);
      p.r = (sfs && sfs > 0 && r != null) ? Math.min((r/sfs*100)/20*15, 15) : 7.5;
    }
    return p;
  }

  /* --- 「気になる点」（2026-09-30）---
     トップ画面のカードの色（黄・オレンジ）と同じ判定で、気になる指標を名指しする。
     カードの色と食い違わないよう、色の判定関数をそのまま使う。 */
  function weakPoints(d, isPref) {
    var ORANGE = "#f0876a", YELLOW = "#f0c46a";
    var rr = (d.sfs && d.sfs > 0 && d.r != null) ? d.r / d.sfs * 100 : null;
    var cd = (d.d == null) ? null : colorD(d.d);
    var items = [
      {c: colorF(d.f), y: "税収でまかなえる度合いが低め（財政力指数）", o: "税収でまかなえる度合いがかなり低い（財政力指数）"},
      {c: cd, y: "借金返済が重め（実質公債費比率）", o: "借金返済がとても重い（実質公債費比率）"},
      {c: colorX(d.x), y: "決まって出ていくお金の割合が高め（経常収支比率）", o: "決まって出ていくお金の割合がかなり高い（経常収支比率）"},
      {c: (d.u == null || d.u <= 0) ? null : colorU(d.u, isPref), y: isPref ? "将来に残る負担がやや重め（将来負担比率）" : "将来に残る負担が一定程度ある（将来負担比率）", o: "将来に残る負担が重め（将来負担比率）"},
      {c: rr == null ? null : colorR(rr, isPref), y: "貯金がやや少なめ（財政調整基金）", o: "貯金が少なめ（財政調整基金）"}
    ];
    var out = [];
    items.forEach(function(it){ if (it.c === ORANGE) out.push(it.o); });
    items.forEach(function(it){ if (it.c === YELLOW) out.push(it.y); });
    return out;
  }

  // 総合スコア（0〜100点）。第6引数（eo）は以前の名残で使っていない
  function calcH(f,d,x,u,r,eo,isPref,sfs) {
    var p = scoreBreakdown({f: f, d: d, x: x, u: u, r: r, sfs: sfs}, isPref);
    return Math.round(Math.min(p.f + p.d + p.x + p.u + p.r, 100));
  }


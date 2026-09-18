  var HEALTH_LABELS = {happy:["絶好調","#6dcfad"],normal:["元気","#7bb8e8"],tired:["ちょっとしんどい","#f0c46a"],sick:["ぐったり","#f0876a"],critical:["ひんし","#d0505a"]};

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

  /* --- 基金が十分かどうかの共通判定 ---
     他の指標の総合コメントでも使う。基金カードの緑ラインと同じ基準なので、
     カードの色と文章が食い違わない。 */
  function reserveIsAmple(e, isPref) {
    if (!e || !e.sfs || e.sfs <= 0 || e.r == null) return false;
    return (e.r / e.sfs * 100) >= reserveBands(isPref).hi;
  }

  // 財政調整基金が「少ない」と言えるか。cur.rは絶対額（億円）なので、規模の大きい自治体・小さい自治体を
  // 同じ金額で比べると不公平になる。標準財政規模との比率（reserveBandsの「少ないほう」の目安）で判定する。
  function reserveIsLow(e, isPref) {
    if (!e || !e.sfs || e.sfs <= 0 || e.r == null) return false;
    return (e.r / e.sfs * 100) < reserveBands(isPref).lo;
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
    var cdv = (d.d == null) ? "#7bb8e8"
            : d.d < 10 ? "#6dcfad" : d.d < 18 ? "#7bb8e8" : d.d < 25 ? "#f0c46a" : "#f0876a";
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

  function calcHPref(f,d,x,u,r,eo,sfs) {
    function band(v, zero, full) {
      if (v == null) return 0;
      var t = (zero - Math.min(Math.max(v, Math.min(zero, full)), Math.max(zero, full))) / (zero - full);
      return Math.min(Math.max(t, 0), 1);
    }
    var sf = Math.min(Math.max((f - 0.20) / (0.90 - 0.20), 0), 1) * 25;
    var sd = band(d, 20, 6) * 20;
    var sx = band(x, 101, 86) * 20;
    var su = (!u || u <= 0) ? 20 : band(u, 340, 80) * 20;
    var sr = (sfs && sfs > 0 && r != null) ? Math.min((r / sfs * 100) / 10 * 15, 15) : 7.5;
    return Math.round(Math.min(sf + sd + sx + su + sr, 100));
  }

  function calcH(f,d,x,u,r,eo,isPref,sfs) {
    if (isPref) return calcHPref(f,d,x,u,r,eo,sfs);
    var sf = Math.min(f/1.2*25, 25);
    var sd = Math.max((25-Math.min(d,25))/25*20, 0);
    var sx = Math.min(Math.max((100-x)/15*20, 0), 20);
    var su = (!u || u <= 0) ? 20 : Math.max((200-Math.min(u,200))/200*20, 0);
    var sr = (sfs && sfs > 0 && r != null) ? Math.min((r/sfs*100)/20*15, 15) : 7.5;
    return Math.round(Math.min(sf+sd+sx+su+sr, 100));
  }


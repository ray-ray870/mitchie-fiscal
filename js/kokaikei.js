/* ===== 公会計機能 ===== */
  var KK = null;
  var KK_MEDIANS = {
    ka1: {muni: 226, pref: 141.4},
    ka2: {muni: 3.3, pref: 2.2},
    ka3: {muni: 65.1, pref: 63},
    ka4: {muni: 73.1, pref: 20.7},
    ka5: {muni: 18.3, pref: 58.4},
    ka6: {muni: 54.2, pref: 41.1},
    ka7: {muni: 62.7, pref: 104.2},
    ka9: {muni: 3.9, pref: 4.1}
  };
  // 2つの値を比べて「◯◯→◯◯（+/-◯◯）と着実に増加」のような自然文を作る汎用関数
  // グラフの線色（黄・水色など薄い色）をそのまま文字色に使うと読みにくいため、文字専用の濃い色を対応表として持つ（財政・公会計グラフ共通）
  var TEXT_COLOR_MAP = {"#6dcfad":"#1f7a5c","#7bb8e8":"#2a5a9a","#f0c46a":"#96690a","#f0876a":"#a8502e","#d0505a":"#a02030","#a08be8":"#5a3fa0"};
  // getVal(i): i=0が現在値、i=1が1年前(_r1)...という関数を受け取り、
  // 直近で同じ方向に動き続けている区間を遡って探し、「R3年度から減少傾向」のような文言を返す
  // 推移フレーズに、指標ごとの意味づけメッセージを付け加える
  var TREND_MEANING = {
    u:   {"増加":"将来世代への負担が重くなる方向で推移しています。", "減少":"将来世代への負担が軽くなる方向で推移しています。"},
    d:   {"増加":"毎年の返済負担が重くなる方向で推移しています。", "減少":"毎年の返済負担が軽くなる方向で推移しています。"},
    r:   {"増加":"貯金を積み増す方向で推移しています。", "減少":"貯金を取り崩す方向で推移しています。"},
    ka3: {"増加":"施設の老朽化が進む方向で推移しています。", "減少":"老朽化の割合が下がる方向で推移しています（建て替えや新しい施設の整備などで下がります）。"},
    ka4: {"増加":"資産のうち借金などに頼らない割合が高まる方向で推移しています。", "減少":"資産のうち借金などに頼る割合が高まる方向で推移しています。"},
    // 2026-10-01：「今後の数字にも注目です」のような評価の言葉はやめ、向きの事実だけにする
    ka1: {"増加":"住民1人あたりの資産が増える方向で推移しています。", "減少":"住民1人あたりの資産が減る方向で推移しています。"},
    ka6: {"増加":"住民1人あたりの行政コストが増える方向で推移しています。", "減少":"住民1人あたりの行政コストが減る方向で推移しています。"},
    ka7: {"増加":"住民1人あたりの負債が増える方向で推移しています。", "減少":"住民1人あたりの負債が減る方向で推移しています。"}
  };
  function withTrendMeaning(metricKey, phrase) {
    if (!phrase) return phrase;
    // 最新の向きで判定する（「R4年度に一度増加しましたが、R5年度は減少」なら減少。2026-09-30：以前は
    // 先に出てくる「増加」で判定していて、最新が減少なのに増加の意味の文が付いていた）
    var dir = phrase.lastIndexOf("増加") > phrase.lastIndexOf("減少") ? "増加" : "減少";
    var m = TREND_MEANING[metricKey];
    return m ? phrase + "。" + m[dir] : phrase;
  }
  // valsArr: 古い年→新しい年の順で並んだ配列（例:[R1,R2,R3,R4,R5,現在]）をそのまま渡す
  function trendSincePhrase(valsArr, currentYear, unit, decimals) {
    var start = 0;
    while (start < valsArr.length && valsArr[start] == null) start++;
    var vals = valsArr.slice(start);
    if (vals.length < 2) return null;
    var n = vals.length;
    var yrLabels = [];
    for (var k=0; k<n; k++) {
      var yrNum = currentYear - (n-1-k);
      yrLabels.push(yrNum <= 0 ? ("H"+(30+yrNum)) : ("R"+yrNum));
    }
    var lastDir = null, startIdx = n-1;
    for (var j=n-1; j>0; j--) {
      var d = vals[j] - vals[j-1];
      var dir = d>0 ? 1 : d<0 ? -1 : 0;
      if (dir === 0) break;
      if (lastDir === null) { lastDir = dir; startIdx = j-1; }
      else if (dir === lastDir) { startIdx = j-1; }
      else break;
    }
    if (lastDir === null) return null;
    var dirWord = lastDir > 0 ? "増加" : "減少";
    var runSteps = (n - 1) - startIdx; // 同方向が何年連続したか
    if (runSteps >= 2) {
      // 2年以上連続で同じ方向に動いている→従来通り「傾向」と言ってよい
      return yrLabels[startIdx] + "年度から" + dirWord + "傾向";
    }
    // 直近1年だけの変化。「傾向」と言い切ると誤解を招くため、
    // 直前に逆方向の動き（反転）があれば、それも合わせて一言で説明する
    if (startIdx > 0) {
      var prevDiff = vals[startIdx] - vals[startIdx - 1];
      var prevDir = prevDiff > 0 ? 1 : prevDiff < 0 ? -1 : 0;
      if (prevDir !== 0 && prevDir !== lastDir) {
        var prevDirWord = prevDir > 0 ? "増加" : "減少";
        var lastValStr = unit ? (vals[n-1] + unit + "に") : "";
        return yrLabels[startIdx] + "年度に一度" + prevDirWord + "しましたが、" + yrLabels[n-1] + "年度は" + lastValStr + dirWord;
      }
    }
    return yrLabels[startIdx] + "年度から" + yrLabels[n-1] + "年度にかけて" + dirWord;
  }
  // pointSteps を渡すと、割合（%）ではなく差（ポイント）で度合いを決める。
  // 経常収支比率のように90%前後で動く指標は、96.8→91.1%（5.7ポイント）でも割合では6%しか変わらず
  // 「微減」になってしまうため（2026-09-30）
  function trendDescribe(oldVal, newVal, unit, decimals, pointSteps) {
    if (oldVal == null || newVal == null) return null;
    decimals = decimals == null ? 1 : decimals;
    var diff = newVal - oldVal;
    var pct = oldVal !== 0 ? Math.abs(diff) / Math.abs(oldVal) : 0;
    var dir = diff > 0 ? "増加" : diff < 0 ? "減少" : "横ばい";
    var tier;
    if (pointSteps) {
      var ad = Math.abs(diff);
      tier = ad < pointSteps[0] ? "横ばい" : ad < pointSteps[1] ? "微" + dir.charAt(0) : ad < pointSteps[2] ? "着実に" + dir : "大きく" + dir;
    }
    else if (pct < 0.03) tier = "横ばい";
    else if (pct < 0.10) tier = "微" + dir.charAt(0);
    else if (pct < 0.30) tier = "着実に" + dir;
    else tier = "大きく" + dir;
    var sign = diff >= 0 ? "+" : "";
    var oldStr = oldVal.toFixed(decimals);
    var newStr = newVal.toFixed(decimals);
    var diffStr = sign + diff.toFixed(decimals);
    return { text: oldStr+unit+"→"+newStr+unit+"（"+diffStr+unit+"）と"+tier, tier: tier, dir: dir, diff: diff, pct: pct };
  }
  // 住民一人当たりの指標（資産額・行政コストなど）が伸びていない理由を、
  // 実際の人口動向(g)とその指標自身の過去推移(_r4=最も古い年)から判定する
  // 指標の過去(_r4=最も古い年)と現在を比べて、増加/横ばい/減少を判定する
  function kkMetricTrend(entry, code, curVal) {
    if (!entry) return null;
    var oldVal = entry[code + "_r1"];
    if (oldVal == null || curVal == null) return null;
    var pctChange = oldVal !== 0 ? (curVal - oldVal) / Math.abs(oldVal) : 0;
    if (pctChange <= -0.05) return "declining";
    if (pctChange >= 0.05) return "growing";
    return "flat";
  }

  var KK_CROSSCHECK_CAVEAT = "<div style='background:rgba(160,139,232,0.08);border-radius:10px;padding:12px 14px;margin-top:10px;'>" +
    "<div style='font-size:15px;color:#6b5b80;line-height:1.7;'>起債計画や基金の使い方によって、この2つの指標の動き方は自治体ごとに大きく異なります。この自治体の具体的な背景は、自治体の実施計画や財政状況資料集で確認できます。</div>" +
    "<div style='font-size:14px;color:#888;margin-top:6px;line-height:1.6;'>※「軽め」「重め」「高め」「低め」は総務省の公式区分ではなく、当アプリが分かりやすさのために設けた独自の目安です。</div>" +
    "</div>";
  // 将来負担比率×(老朽化率/資産額/行政コスト)の判定ロジックを1箇所にまとめる（財政タブ・公会計タブ両方から呼ばれる）
  var FUTURE_COMBO_META = {
    ka3: {label:"有形固定資産減価償却率", fullLabel:"有形固定資産減価償却率（老朽化率）", unit:"%", nearNoun:"老朽化率"},
    ka1: {label:"住民一人当たり資産額", fullLabel:"住民一人当たり資産額", unit:"万円", nearNoun:"資産額"},
    ka6: {label:"住民一人当たり行政コスト", fullLabel:"住民一人当たり行政コスト", unit:"万円", nearNoun:"行政コスト"}
  };
  function buildFutureComboBody(code, kkVal, med, uHigh, entry, uLabel) {
    var m = FUTURE_COMBO_META[code];
    var near = Math.abs(kkVal - med) <= med * 0.1;
    var high = kkVal > med;
    var judge, fact, analysis;
    if (near) {
      judge = "全国の中央値とほぼ同水準";
      fact = "<strong style='color:#c0623a;'>[公会計]</strong>" + m.label + "は中央値とほぼ同水準です。<strong style='color:#3a9970;'>[財政]</strong>将来への借金は" + (uHigh?"重め":"軽め") + "です。";
      analysis = "この" + (uLabel ? levelNoun(uLabel) : (uHigh?"重さ":"軽さ")) + "は" + m.nearNoun + "以外の要因によるものと考えられます。";
      return {judge:judge, analysis:analysis};
    }
    if (code === "ka3") {
      if (!uHigh && !high) { judge="全国の中央値より低め"; fact="<strong style='color:#3a9970;'>[財政]</strong>将来への借金・<strong style='color:#c0623a;'>[公会計]</strong>施設の老朽化、どちらの面から見ても軽い状態です。"; analysis=""; }
      else if (uHigh && high) { judge="全国の中央値より高め"; fact="<strong style='color:#3a9970;'>[財政]</strong>将来への借金・<strong style='color:#c0623a;'>[公会計]</strong>施設の老朽化、どちらの面から見ても重い状態です。"; analysis="老朽化した施設の更新をこれから借金で行うと、将来負担がさらに増える可能性があります。"; }
      else if (!uHigh && high) {
        judge = "全国の中央値より高め";
        fact = "<strong style='color:#3a9970;'>[財政]</strong>将来への借金は軽めですが、<strong style='color:#c0623a;'>[公会計]</strong>施設の老朽化は進んでいます。";
        var ka1Trend = kkMetricTrend(entry, "ka1", entry ? entry.ka1 : null);
        analysis = ka1Trend === "growing"
          ? "②既存施設を活用しながら、新しい整備も進めている可能性も考えられます。"
          : "①必要な投資が行われず、老朽化対策が先送りにされている可能性も考えられます。";
      }
      else { judge="全国の中央値より低め"; fact="<strong style='color:#3a9970;'>[財政]</strong>将来への借金は重めですが、<strong style='color:#c0623a;'>[公会計]</strong>施設の老朽化は進んでいません。"; analysis="借金をしてでも施設の更新・整備を積極的に進めている可能性があります。"; }
    } else if (code === "ka1") {
      if (!uHigh && high) { judge="全国の中央値より高め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>資産規模は大きめですが、<strong style='color:#3a9970;'>[財政]</strong>将来への借金は軽めです。"; analysis="借金に頼らず資産を築けています。"; }
      else if (uHigh && high) { judge="全国の中央値より高め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>資産規模・<strong style='color:#3a9970;'>[財政]</strong>将来への借金、どちらも大きめです。"; analysis="大型の資産整備を借金でまかなってきた可能性があります。"; }
      else if (uHigh && !high) { judge="全国の中央値より低め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>資産規模は控えめですが、<strong style='color:#3a9970;'>[財政]</strong>将来への借金は重めです。"; analysis="資産形成に見合わない借金を抱えている可能性があります。"; }
      else { judge="全国の中央値より低め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>資産規模・<strong style='color:#3a9970;'>[財政]</strong>将来への借金、どちらも小さめです。"; analysis="資産の規模と将来世代への負担のバランスは取れている状態です。"; }
    } else {
      if (!uHigh && !high) { judge="全国の中央値より低め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>行政コスト・<strong style='color:#3a9970;'>[財政]</strong>将来への借金、どちらも軽めです。"; analysis="コンパクトな運営と言えます。"; }
      else if (uHigh && high) { judge="全国の中央値より高め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>行政コスト・<strong style='color:#3a9970;'>[財政]</strong>将来への借金、どちらも重めです。"; analysis="サービス水準を維持するための借金が将来負担として残っている可能性があります。"; }
      else if (!uHigh && high) { judge="全国の中央値より高め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>行政コストは高めですが、<strong style='color:#3a9970;'>[財政]</strong>将来への借金は軽めです。"; analysis="手厚いサービスを借金に頼らず提供できています。"; }
      else { judge="全国の中央値より低め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>行政コストは抑えめですが、<strong style='color:#3a9970;'>[財政]</strong>将来への借金は重めです。"; analysis="過去の投資の返済が今の身軽さと引き換えになっている可能性があります。"; }
    }
    return {judge:judge, analysis:analysis};
  }
  /* --- クロスチェックで分かること（2026-09-30）---
     財政の指標（毎年のやりくり・借金などの残り）と、公会計の指標（施設の古さ・量・資産と負債のバランス）は
     見ているものが違う。2つを組み合わせて、片方だけでは分からないことを書く。
     ・書くのは、2つの指標の定義から言えることと、その組み合わせが起きる仕組みだけ（町の事情の推測はしない）
     ・公会計の指標は全国（都道府県は都道府県）の中央値と比べ、差が10%以内なら「全国並み」として、その場合の文を出す
     ・財政側の「軽め・重め」などは、画面の判定（カードの色・目安）と同じ基準 */
  var KK_DEBT_NOTE = "※ここでの「借金など」には、国の交付税の代わりに借りる「臨時財政対策債」も含まれます";
  function crossInsight(code, cur, entry, isPref) {
    if (!cur || !entry || entry[code] == null) return "";
    var mm = KK_MEDIANS[code], med = mm ? (isPref ? mm.pref : mm.muni) : null;
    if (med == null || med === 0) return "";
    var v = entry[code], ratio = v / med;
    var kkHi = ratio > 1.1, kkLo = ratio < 0.9;
    var kkNear = !kkHi && !kkLo;   // 全国並み（差が10%以内）
    var than = isPref ? "他の都道府県より" : "全国より";
    var times = function(){ return ratio >= 1.5 ? (isPref ? "都道府県の中央値の" : "全国の") + "約" + (Math.round(ratio * 10) / 10) + "倍と" : than; };
    // 財政側の状態
    var uZero = (cur.u == null || cur.u <= 0), uHeavy = !uZero && futureBurdenHigh(cur.u, isPref);
    var uWord = uZero ? "実質ゼロ" : uHeavy ? "重め" : "軽め";
    if (code === "ka3") {
      var wari = Math.round(v / 10);
      if (kkNear) return uHeavy
        ? "施設の古さは全国並み（平均して耐用年数の約" + wari + "割）ですが、将来に残る負担は重めです。これから全国と同じように建て替えの時期を迎えるなかで、すでに借金などの負担を多く抱えている状態です。"
        : "施設の古さは全国並み（平均して耐用年数の約" + wari + "割）で、将来に残る負担は" + uWord + "です。全国と同じくらい古くなってきた施設を抱えながら、将来への負担は重くない状態です。";
      if (kkHi) return uHeavy
        ? "施設は" + than + "古く（平均して耐用年数の約" + wari + "割）、将来に残る負担もすでに重めです。これからの建て替えを借金でまかなうと、将来負担はさらに増えます。"
        : "将来に残る負担は" + uWord + "ですが、施設は" + than + "古くなっています（平均して耐用年数の約" + wari + "割）。建て替えの多くはまだこれからで、その費用を借金でまかなうと、将来負担はこれから増えていきます。";
      return uHeavy
        ? "施設は" + than + "新しい一方で、将来に残る負担は重めです。当面の建て替えの必要は小さいものの、借金などの返済が続きます。"
        : "施設は" + than + "新しく、将来に残る負担も" + uWord + "です。比較的新しい施設が、将来への重い負担としては残っていない状態です。";
    }
    if (code === "ka1") {
      if (kkNear) return uHeavy
        ? "住民1人あたりの資産は全国並みですが、将来に残る負担は重めです。資産の量が同じくらいの自治体と比べて、借金などの負担が大きい状態です。"
        : "住民1人あたりの資産は全国並みで、将来に残る負担は" + uWord + "です。持っている資産の量に見合わない、重い負担は残っていない状態です。";
      if (kkHi) return uHeavy
        ? "住民1人あたりの資産は" + times() + "多く、将来に残る負担も重めです。施設の維持・更新の費用と、借金などの返済の両方を、住民1人あたりで見ると多く抱えている状態です。"
        : "住民1人あたりの資産は" + times() + "多い一方、将来に残る負担は" + uWord + "です。多くの資産を、将来への重い負担を残さずに持てています。ただし、資産が多いほど、その維持・更新の費用は大きくなります。";
      return uHeavy
        ? "住民1人あたりの資産は" + than + "少ないのに、将来に残る負担は重めです。持っている資産に比べて、借金などの負担が大きい状態です。"
        : "住民1人あたりの資産は" + than + "少なく、将来に残る負担も" + uWord + "です。施設の維持・更新の費用も、借金などの返済も、住民1人あたりで見ると小さい状態です。";
    }
    if (code === "ka6") {
      var smallPop = !isPref && cur.pop != null && cur.pop < 10000 ? "人口が少ないと、1人あたりの費用は大きく出ます。" : "";
      if (kkNear) return uHeavy
        ? "住民1人あたりの行政サービスの費用は全国並みですが、将来に残る負担は重めです。将来負担の重さは、毎年のサービスの費用ではなく、これまでの借金などの残高によるものです。"
        : "住民1人あたりの行政サービスの費用は全国並みで、将来に残る負担は" + uWord + "です。標準的な費用で行政サービスを行いながら、将来への重い負担は残っていない状態です。";
      if (kkHi) return uHeavy
        ? "住民1人あたりの行政サービスの費用が" + times() + "多く、将来に残る負担も重めです。今の費用と、将来への負担の両方が大きい状態です。" + smallPop
        : "住民1人あたりの行政サービスの費用は" + times() + "多いですが、将来に残る負担は" + uWord + "です。費用の多さは、将来への借金などとしては残っていません。" + smallPop;
      return uHeavy
        ? "住民1人あたりの行政サービスの費用は" + than + "少ないのに、将来に残る負担は重めです。将来負担の重さは、毎年のサービスの費用ではなく、これまでの借金などの残高によるものです。"
        : "住民1人あたりの行政サービスの費用は" + than + "少なく、将来に残る負担も" + uWord + "です。毎年のサービスの費用も、将来への負担も、住民1人あたりで見ると小さい状態です。";
    }
    if (code === "ka7" && cur.d != null) {
      var dl = debtLevelLabel(cur.d, isPref);   // 軽め／標準的／やや重め／重め
      var dLight = (dl === "軽め" || dl === "標準的");
      if (kkNear) return dLight
        ? "住民1人あたりの負債は全国並みで、毎年の返済は" + (dl === "軽め" ? "軽い" : "標準的な") + "状態です。負債の量も、返済の重さも、全国と比べて特に目立つところはありません。"
        : "住民1人あたりの負債は全国並みですが、毎年の返済は" + dl + "です。負債の残高に比べて毎年の返済が大きいということで、返済期間が短い借金が多いと、こうなります。";
      if (kkHi) return dLight
        ? "住民1人あたりの負債は" + times() + "多いのに、毎年の返済は" + (dl === "軽め" ? "軽い" : "標準的な") + "状態です。負債の残高に比べて毎年の返済が" + (dl === "軽め" ? "小さい" : "大きくない") + "ということで、返済期間が長い借金や、返済の一部が国の交付税で補われる借金が多いと、こうなります。"
        : "住民1人あたりの負債が" + times() + "多く、毎年の返済も" + dl + "です。返済にあてるお金が多い分、ほかの事業に回せるお金は少なくなります。";
      return dLight
        ? "住民1人あたりの負債は" + than + "少なく、毎年の返済も" + (dl === "軽め" ? "軽い" : "標準的な") + "状態です。返済にあてるお金が少ない分、ほかの事業にお金を回しやすくなっています。"
        : "住民1人あたりの負債は" + than + "少ないのに、毎年の返済は" + dl + "です。負債の残高に比べて毎年の返済が大きいということで、返済期間が短い借金が多いと、こうなります。";
    }
    if (code === "ka4" && cur.sfs && cur.sfs > 0 && cur.r != null) {
      var rl = reserveLevelLabel(cur.r / cur.sfs * 100, isPref);   // 多め／標準的／やや少なめ／少なめ
      var rOk = (rl === "多め" || rl === "標準的");
      var rWord = rl === "多め" ? "多めに" : "標準的に";
      var out;
      if (kkNear) out = rOk
        ? "資産と負債のバランスは全国並みで、手元の貯金（急な出費への備え）も" + rWord + "あります。長い目で見ても、短い目で見ても、全国と比べて特に目立つ弱点はありません。"
        : "資産と負債のバランスは全国並みですが、手元の貯金（急な出費への備え）は" + rl + "です。長い目で見たバランスは標準的な一方、急な出費への備えは小さい状態です。";
      else if (kkLo) out = rOk
        ? "手元の貯金（急な出費への備え）は" + rWord + "ありますが、施設などの資産は、" + than + "借金などに頼ってつくった割合が大きい状態です。短い目で見た備えと、長い目で見た資産と負債のバランスは、分けて見る必要があります。"
        : "施設などの資産を" + than + "借金などに頼ってつくっていて、手元の貯金（急な出費への備え）も" + rl + "です。長い目で見ても、短い目で見ても、余裕が小さい状態です。";
      else out = rOk
        ? "資産の多くを借金などに頼らずまかなっていて、手元の貯金（急な出費への備え）も" + rWord + "あります。長い目で見た資産と負債のバランスも、急な出費への備えもある状態です。"
        : "資産は" + than + "借金などに頼らずまかなえていますが、手元の貯金（急な出費への備え）は" + rl + "です。長い目で見たバランスは良い一方、急な出費への備えは小さい状態です。";
      return out + "<div style='font-size:14px;color:#8a7a5a;margin-top:4px;'>" + KK_DEBT_NOTE + "</div>";
    }
    return "";
  }

  function buildFutureComboBox(code, kkVal, isPrefView, curObj, curNameStr, entry, reverseOrder, boxNumber) {
    if (kkVal == null) return "";   // 将来負担比率が「－」（負担なし）の団体も表示する（2026-09-30）
    var m = FUTURE_COMBO_META[code];
    var med = isPrefView ? KK_MEDIANS[code].pref : KK_MEDIANS[code].muni;
    var uHigh = futureBurdenHigh(curObj.u, isPrefView);
    var uLabel = futureLevelLabel(curObj.u, isPrefView);
    var r = buildFutureComboBody(code, kkVal, med, uHigh, entry, uLabel);
    var uValsArr = histArr(curObj, "u", "fiscal");
    var uTrendPhrase = withTrendMeaning("u", trendSincePhrase(uValsArr, DATA_YEAR.fiscal));
    // _r1＝平成30年度 … _r5＝令和4年度、主値＝令和5年度（2026-09-29：以前は _r5 が抜けていて、年が1つずれていた）
    var kkValsArr = histArr(entry, code, "kk");
    var kkTrendPhrase = entry ? withTrendMeaning(code, trendSincePhrase(kkValsArr, DATA_YEAR.kokaikei)) : null;
    var numMark = boxNumber ? ["①","②","③","④","⑤"][boxNumber-1] || "" : "";
    var heading = reverseOrder ? ("🔗 財政と比べてみると" + numMark) : ("🔗 公会計と比べてみると" + numMark);
    return kkCrossBox(heading,
      "将来負担比率", (curObj.u == null || curObj.u <= 0) ? "0%（負担なし）" : curObj.u+"%", uLabel,
      m.label, kkVal+m.unit, r.judge,
      crossInsight(code, curObj, entry, isPrefView),
      reverseOrder, uTrendPhrase, kkTrendPhrase);
  }
  function kkCrossBox(heading, zaiLabel, zaiVal, zaiJudge, kkLabel, kkVal, kkJudge, analysisText, reverse, zaiTrendPhrase, kkTrendPhrase) {
    var zaiCard = "<div style='flex:1;background:white;border-radius:10px;padding:10px 10px;text-align:center;display:flex;flex-direction:column;justify-content:center;'>" +
        "<div style='font-size:14px;color:#3a9970;font-weight:700;margin-bottom:3px;'>[財政] " + zaiLabel + "</div>" +
        "<div style='font-size:17px;font-weight:700;color:#2a2a3a;'>" + zaiVal + "</div>" +
        "<div style='font-size:14px;color:#666;'>" + zaiJudge + "</div>" +
      "</div>";
    var kkCard = "<div style='flex:1;background:white;border-radius:10px;padding:10px 10px;text-align:center;display:flex;flex-direction:column;justify-content:center;'>" +
        "<div style='font-size:14px;color:#c0623a;font-weight:700;margin-bottom:3px;'>[公会計] " + kkLabel + "</div>" +
        "<div style='font-size:17px;font-weight:700;color:#2a2a3a;'>" + kkVal + "</div>" +
        "<div style='font-size:14px;color:#666;'>" + kkJudge + "</div>" +
      "</div>";
    var xMark = "<div style='width:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#222;'>×</div>";
    var trendHtml = "";
    if (zaiTrendPhrase || kkTrendPhrase) {
      trendHtml = "<div style='margin-top:12px;padding-top:10px;border-top:1px dashed #6dcfad55;'>";
      if (zaiTrendPhrase) trendHtml += "<div style='font-size:15px;color:#3a5a4a;margin-bottom:4px;line-height:1.7;'>" + (zaiTrendPhrase.indexOf("増加")>-1?"📈":"📉") + " <strong>" + zaiLabel + "</strong>：" + zaiTrendPhrase + "</div>";
      if (kkTrendPhrase) trendHtml += "<div style='font-size:15px;color:#3a5a4a;line-height:1.7;'>" + (kkTrendPhrase.indexOf("増加")>-1?"📈":"📉") + " <strong>" + kkLabel + "</strong>：" + kkTrendPhrase + "</div>";
      trendHtml += "</div>";
    }
    var analysisHtml = analysisText ? (
      "<div style='background:#fdf8ec;border-radius:10px;padding:10px 12px;'>" +
        "<div style='font-size:16px;font-weight:700;color:#c08a1a;margin-bottom:4px;'>🔍 クロスチェックで分かること</div>" +
        "<div style='font-size:16px;color:#5a4a30;line-height:1.8;'>" + analysisText + "</div>" +
      "</div>"
    ) : "";
    return "<div style='background:#e8f7f0;border:1px solid #6dcfad55;border-radius:12px;padding:14px 16px;margin-top:10px;'>" +
      "<div style='font-size:16px;font-weight:700;color:#3a9970;margin-bottom:10px;'>" + heading + "</div>" +
      "<div style='display:flex;align-items:stretch;gap:0;margin-bottom:"+(analysisHtml?"10px":"0")+";'>" +
        (reverse ? (kkCard + xMark + zaiCard) : (zaiCard + xMark + kkCard)) +
      "</div>" +
      analysisHtml +
      trendHtml +
    "</div>";
  }
  // 公会計側のポップアップから見た、財政側とのクロスチェック（財政タブ側と同じロジックの逆方向）
  function kkReciprocalCross(code, entryV, isPref, entry) {
    if (!cur || entryV == null) return "";   // その年度の値が公表されていない自治体は比べない（2026-10-01）
    if (code === "ka4" && cur.sfs && cur.sfs > 0) {
      var ratioRec = cur.r / cur.sfs * 100;
      var rb = reserveBands(isPref);
      var ka4Med = isPref ? KK_MEDIANS.ka4.pref : KK_MEDIANS.ka4.muni;
      var rHighRec = ratioRec >= rb.hi;
      var ka4NearRec = Math.abs(entryV - ka4Med) <= ka4Med * 0.1;
      var ka4HighRec = entryV > ka4Med;
      var judgeRec, analysisRec;
      if (!rHighRec && !ka4HighRec) { judgeRec = reserveLevelLabel(ratioRec, isPref); analysisRec = ""; }
      else if (rHighRec && ka4HighRec) { judgeRec = reserveLevelLabel(ratioRec, isPref); analysisRec = ""; }
      else if (rHighRec && !ka4HighRec) { judgeRec = reserveLevelLabel(ratioRec, isPref); analysisRec = "貯金と長期的な財産形成は別物です。"; }
      else { judgeRec = reserveLevelLabel(ratioRec, isPref); analysisRec = "日々の備えと長期的な財産形成は別物です。"; }
      function ratioAtRec(sfx){ var rv=sfx?cur["r_r"+sfx]:cur.r; var sv=sfx?cur["sfs_r"+sfx]:cur.sfs; return (rv!=null&&sv)?rv/sv*100:null; }
      var rTrendPhrase = withTrendMeaning("r", trendSincePhrase((function(){ var a=[]; for (var k=1;k<DATA_YEAR.fiscal;k++) a.push(ratioAtRec(k)); a.push(ratioAtRec(null)); return a; })(), DATA_YEAR.fiscal, "%", 1));
      var ka4TrendPhrase = entry ? withTrendMeaning("ka4", trendSincePhrase(histArr(entry, "ka4", "kk"), DATA_YEAR.kokaikei, "%", 1)) : null;
      return kkCrossBox("🔗 財政と比べてみると", "財政調整基金残高", ratioRec.toFixed(1)+"%", judgeRec, "純資産比率", entryV+"%", (ka4NearRec?"全国の中央値とほぼ同水準":ka4HighRec?"全国の中央値より高め":"全国の中央値より低め"), crossInsight("ka4", cur, entry, isPref), true, rTrendPhrase, ka4TrendPhrase) + KK_CROSSCHECK_CAVEAT;
    }
    if (code === "ka7" && cur.d != null) {
      var ka7Med = isPref ? KK_MEDIANS.ka7.pref : KK_MEDIANS.ka7.muni;
      var dHighRec = cur.d >= 18;
      var ka7NearRec = Math.abs(entryV - ka7Med) <= ka7Med * 0.1;
      var ka7HighRec = entryV > ka7Med;
      var judgeD, analysisD2;
      if (!dHighRec && !ka7HighRec) { judgeD = debtLevelLabel(cur.d, isPref); analysisD2 = ""; }
      else if (dHighRec && ka7HighRec) { judgeD = "重め"; analysisD2 = ""; }
      else if (!dHighRec && ka7HighRec) {
        judgeD = debtLevelLabel(cur.d, isPref);
        var ka7TrendC = kkMetricTrend(entry, "ka7", entryV);
        analysisD2 = ka7TrendC === "declining" ? "着実に返済が進んでいる長期返済中、という可能性も考えられます。" : "新しい借入も続いており、返済はこれから本格化する可能性も考えられます。";
      }
      else {
        judgeD = "重め";
        var ka7TrendD = kkMetricTrend(entry, "ka7", entryV);
        analysisD2 = ka7TrendD === "declining" ? "短期集中で返済を終えつつある可能性も考えられます。" : "返済期間を短く設定している可能性も考えられます。";
      }
      var dTrendPhrase = withTrendMeaning("d", trendSincePhrase(histArr(cur, "d", "fiscal"), DATA_YEAR.fiscal, "%", 1));
      var ka7TrendPhrase = entry ? withTrendMeaning("ka7", trendSincePhrase(histArr(entry, "ka7", "kk"), DATA_YEAR.kokaikei, "万円", 1)) : null;
      return kkCrossBox("🔗 財政と比べてみると", "実質公債費比率", cur.d+"%", judgeD, "住民一人当たり負債額", entryV+"万円", (ka7NearRec?"全国の中央値とほぼ同水準":ka7HighRec?"全国の中央値より高め":"全国の中央値より低め"), crossInsight("ka7", cur, entry, isPref), true, dTrendPhrase, ka7TrendPhrase) + KK_CROSSCHECK_CAVEAT;
    }
    if (code === "ka3" || code === "ka1" || code === "ka6") {
      var boxHtmlRec = buildFutureComboBox(code, entryV, isPref, cur, curName, entry, true);
      return boxHtmlRec ? (boxHtmlRec + KK_CROSSCHECK_CAVEAT) : "";
    }
    return "";
  }
  var KK_ONELINE = {
    ka1: "自治体が持っている財産を、住民1人あたりに換算した指標",
    ka2: "1年間の収入に対して、どれだけの資産を持っているかを見る指標",
    ka3: "自治体の建物や施設がどれくらい古くなっているかを見る指標",
    ka4: "自治体の資産のうち、借金に頼らず自前でまかなえている割合を見る指標",
    ka5: "今の資産のうち、将来世代の負担でまかなわれている割合を見る指標",
    ka6: "自治体運営にかかる費用を、住民1人あたりに換算した指標",
    ka7: "自治体の借金を、住民1人あたりに換算した指標",
    ka8: "自治体の毎年のお金の出入りが黒字か赤字かを見る指標",
    ka9: "行政サービスの費用のうち、利用者が自分で負担している割合を見る指標"
  };
  var KK_META = {

    ka1: {icon:"💰", label:"住民一人当たり資産額", unit:"万円", group:true,
      desc:"自治体が持っている財産（資産）を、住民の数で割った金額です。\n\n## 🧮 資産に含まれるもの\n・庁舎・学校・公民館などの建物\n・道路・橋・公園などのインフラ\n・土地、基金（貯金）、現金など\n\n## 📏 見方\n・人口が少ない自治体ほど、1人あたりでは大きく出ます\n・資産が多いほど、将来その維持や建て替えにかかる費用も大きくなります\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka2: {icon:"📦", label:"歳入額対資産比率", unit:"年", group:false,
      desc:"持っている資産が、1年間の歳入（受け取ったお金）の何年分にあたるかを表す数字です。\n\n## 📏 見方\n・数字が大きいほど、収入に比べて多くの資産を持っています\n・資産が多いほど、その維持や建て替えにかかる費用も大きくなります\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka3: {icon:"🏚️", label:"有形固定資産減価償却率", unit:"%", group:false,
      desc:"道路や建物などが、耐用年数（使える年数）に対して、どれくらい古くなっているかを表す割合です。\n\n## 📏 見方\n・数字が大きいほど、施設が古くなっています\n・50%は、平均して耐用年数の半分が過ぎた状態です\n・建て替えや大規模な修繕をすると、数字は下がります\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka4: {icon:"🧾", label:"純資産比率", unit:"%", group:false,
      desc:"資産のうち、負債（借金など）に頼らずにまかなっている部分（純資産）の割合です。\n\n## 🧮 負債に含まれるもの\n・地方債（借金）※臨時財政対策債を含む\n・退職手当引当金（将来払う退職金の見込み）など\n\n## 📏 見方\n・数字が大きいほど、借金などに頼らずに資産を持っています\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka5: {icon:"🏦", label:"将来世代負担比率", unit:"%", group:false,
      desc:"資産のうち、これから返す地方債（借金）でまかなわれている部分の割合です。\n\n## 📏 見方\n・数字が大きいほど、これからの住民が返す割合が大きくなります\n・将来の住民も使う施設の費用を、世代で分け合うという考え方もあります\n・臨時財政対策債は含みません\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka6: {icon:"🧑‍💼", label:"住民一人当たり行政コスト", unit:"万円", group:true,
      desc:"自治体が1年間に行政サービスに使った費用（行政コスト）を、住民の数で割った金額です。\n\n## 🧮 行政コストに含まれるもの\n・人件費（職員の給与など）\n・物件費（施設の維持管理費・光熱費など）\n・扶助費（生活保護・児童手当などの給付）\n・減価償却費（建物や道路が古くなった分の目減り）\n・退職手当引当金繰入額（将来払う退職金の積み立て分）など\n\n## 📏 見方\n・人口が少ない自治体ほど、1人あたりでは大きく出ます\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka7: {icon:"💳", label:"住民一人当たり負債額", unit:"万円", group:true,
      desc:"自治体の負債（借金など）の合計を、住民の数で割った金額です。\n\n## 🧮 負債に含まれるもの\n・地方債（借金の残高）※臨時財政対策債を含む\n・退職手当引当金（将来払う退職金の見込み）\n・未払金など\n\n## 📏 見方\n・人口が少ない自治体ほど、1人あたりでは大きく出ます\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka8: {icon:"⚖️", label:"業務・投資活動収支", unit:"百万円", group:true,
      desc:"業務活動収支（毎年の行政活動のお金の出入り）と、投資活動収支（施設の整備や基金への積み立てなど）を合わせた収支です。\n\n## 📏 見方\n・プラス → その年の収入で、行政活動と投資をまかなえた\n・マイナス → 差を、借入金や前年度からの手元の資金で補った\n・投資活動には、基金（貯金）への積み立ても含まれます\n・学校の建て替えなど大きな投資をした年は、マイナスになりやすくなります\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka9: {icon:"🙋", label:"受益者負担比率", unit:"%", group:false,
      desc:"行政サービスにかかった費用のうち、利用する人が使用料や手数料として払っている割合です。\n\n## 📏 見方\n・数字が大きいほど、利用する人自身が費用を負担しています\n・残りは、税金や国からのお金などでまかなわれています\n・出典：総務省 統一的な基準による財務書類（{KY}）"}
  };
  var KK_ORDER = ["ka1","ka2","ka3","ka4","ka5","ka6","ka7","ka8","ka9"];

  function loadKokaikei(cb){
    // kokaikei.jsonは起動時に一括で先読み済みのため、ここでは待つだけでよい
    cb();
  }

  function kkFmt(v, unit){
    if (v == null) return "―";
    if (unit === "百万円") {
      var oku = v / 100;
      return (oku>=0?"+":"") + oku.toFixed(1) + "億円";
    }
    return v + unit;
  }

  var KK_GOOD_DIR = { ka3: -1, ka4: 1, ka5: -1 };
  var KK_BLUE = "#4a90d9";
  var KK_RED = "#e85050";
  var KK_NEUTRAL_VAL = "#a08be8";

  function kkCompareLine(code, nm, entry, isPref){
    var meta = KK_META[code];
    var val = entry[code];
    if (val == null || !meta) return "";
    var unit = meta.unit;
    var med, scaleWord, n;
    if (meta.group) {
      var grp = entry.grp;
      var bucket = isPref ? "pref" : "muni";
      var gm = KK && KK._groupMedians && KK._groupMedians[bucket] && grp ? KK._groupMedians[bucket][grp] : null;
      if (!gm || gm[code] == null) return "";
      med = gm[code];
      n = gm._n;
      if (n <= 1) {
        var valOnly = "<span style='color:" + KK_NEUTRAL_VAL + ";'>" + kkFmt(val, unit) + "</span>";
        return "<span style='color:#6a3de8;'>" + nm + "</span>は" + meta.label + "が" + valOnly + "です。財政規模が大きく、比較できる類似団体（" + grp + "）がありません。";
      }
      scaleWord = "類似団体（" + grp + "）" + n + (isPref ? "都道府県" : "自治体");
    } else {
      var mm = KK_MEDIANS[code];
      if (!mm) return "";
      med = isPref ? mm.pref : mm.muni;
      scaleWord = "全国" + (isPref ? "都道府県" : "市区町村");
    }
    var diff = val - med;
    var isSame = Math.abs(diff) <= Math.abs(med) * 0.05;
    var cmpWord = isSame ? "ほぼ同水準" : (diff > 0 ? "高め" : "低め");

    var dir = KK_GOOD_DIR[code];
    var valColor = null, cmpColor = null;
    if (code === "ka8") {
      // 業務・投資活動収支は符号そのもので判定（黒字=良い/赤字=悪い）
      valColor = val >= 0 ? KK_BLUE : KK_RED;
      cmpColor = valColor;
    } else if (dir) {
      if (!isSame) {
        var good = dir > 0 ? diff > 0 : diff < 0;
        valColor = good ? KK_BLUE : KK_RED;
        cmpColor = valColor;
      }
    } else {
      valColor = KK_NEUTRAL_VAL; // 良し悪しを判定できない指標は数値だけ中立色
    }

    var valHtml = valColor ? "<span style='color:" + valColor + ";'>" + kkFmt(val, unit) + "</span>" : kkFmt(val, unit);
    var cmpHtml = cmpColor ? "<span style='color:" + cmpColor + ";'>" + cmpWord + "です</span>" : cmpWord + "です";

    var line = "<span style='color:#6a3de8;'>" + nm + "</span>は" + meta.label + "が" + valHtml + "で、" + scaleWord + "の中央値（" + kkFmt(med, unit) + "）" + (isSame ? "と" : "より") + cmpHtml + "。";
    if (code === "ka8") {
      line += val >= 0 ? "（その年度は黒字）" : "（その年度は赤字）";
    }
    if (meta.group) {
      // 区分（grp）自体は総務省の公会計データファイルに同梱の公式「類似団体」区分をそのまま使用。
      // ただし中央値はアプリが算出したもので、総務省が直接公表した数値ではない。
      // また類似団体の所属数は総務省の資料・年度によって異なることがある
      // （区分は数年おきに見直されるため。例：財政指標系の資料は令和4年度区分、当データは令和5年度区分）。
      line += "<div style='font-size:14px;color:#999;margin-top:4px;'>※区分は総務省の類似団体区分（"+fillYears("{KY}")+"公会計データに同梱）を使用。中央値は当アプリで算出しています。区分の対象自治体数は総務省の資料・年度により異なる場合があります。</div>";
    }

    return line;
  }

  /* --- 公会計の詳細画面：推移・例え・意味（2026-09-30）---
     財政タブの「◯◯市の状況」と同じ考え方。書くのは指標の定義から言えることと、その町自身の推移だけ。
     （以前あった「人口が増えており積極的な投資による可能性」「大型の更新投資を行った可能性」などの推測はやめた） */
  function kkSituationExtra(code, entry, isPref) {
    var v = entry[code];
    if (v == null) return "";
    var arr = histArr(entry, code, "kk"), pts = [];
    for (var i = 0; i < arr.length; i++) pts.push({y: i, v: arr[i]});   // 0＝平成30年度
    var meta = KK_META[code], unit = meta.unit;
    var fmt = function(x){ return unit === "百万円" ? (Math.round(x / 10) / 10).toLocaleString() + "億円" : (Math.round(x * 10) / 10) + unit; };
    var opt = (code === "ka9") ? {tol:0.3, fmt:fmt} : (unit === "%") ? {tol:1, fmt:fmt} : {tol:0.03, rel:true, fmt:fmt};
    if (code === "ka8") opt = {tol:Math.max(Math.abs(v) * 0.1, 10), fmt:fmt};
    opt.label = meta.label;
    var trend = trendJP(pts, opt);
    var fact = null, mean = null;
    var wari = function(x){ return Math.round(x / 10); };
    // 2026-10-01：例え（100円とすると…）は出さない。数字の意味（定義どおりの事実）と「→」の一文だけ
    if (code === "ka1") mean = "持っている施設やインフラが多いほど、将来その維持や建て替えにかかる費用も大きくなります";
    if (code === "ka2") { fact = "持っている資産は、1年間の歳入の約" + (Math.round(v * 10) / 10) + "年分です"; mean = "収入に比べて資産が多いほど、その維持や建て替えにかかる費用も大きくなります"; }
    if (code === "ka3") { fact = "施設は平均して、耐用年数の約" + wari(v) + "割が過ぎています";
      mean = v >= 50 ? "施設全体として、建て替えや大規模な修繕の時期に近づいている状態です" : "施設全体としては、まだ耐用年数の半分に達していない状態です"; }
    if (code === "ka4") { fact = "残りの約" + (100 - Math.round(v)) + "%は負債（地方債や、将来払う退職手当など）です";
      mean = "負債は、これから返したり支払ったりしていく必要があります。" + KK_DEBT_NOTE; }
    if (code === "ka5") mean = "その返済は、これからの住民の税金などで行われます。将来の住民も使う施設の費用を、世代で分け合うという考え方もあります";
    if (code === "ka6") { mean = entry.ka9 != null ? "この費用のうち、利用する人が料金などで払っているのは約" + (Math.round(entry.ka9 * 10) / 10) + "%（受益者負担比率）で、残りは税金や国からのお金などでまかなわれています" : null; }
    if (code === "ka7") mean = "地方債の返済や、将来払う退職手当などで、主にこれからの税金などから支払われます";
    if (code === "ka8") mean = v < 0
      ? "その年度は、行政サービス・施設整備・基金への積み立てなどの支出が収入を上回り、差を借入金や手元の資金で補った状態です"
      : "その年度は、行政サービス・施設整備・基金への積み立てなどを、その年の収入でまかなえた状態です";
    if (code === "ka9") mean = "費用の残り約" + (Math.round((100 - v) * 10) / 10) + "%は、税金や国からのお金などでまかなわれている状態です";
    var S = "font-size:16px;color:#2a2a3a;line-height:1.8;";
    return (trend ? "<div style='" + S + "'>" + trend + "。</div>" : "") +
      (fact ? "<div style='" + S + "'>" + fact + "</div>" : "") +
      (mean ? "<div style='font-size:16px;font-weight:700;color:#3a2a6e;line-height:1.7;margin-top:8px;'>→ " + mean + "</div>" : "");
  }

  function kkOpenDetail(code, skipPush){
    if (!cur || !KK) return;
    var nm = curName;
    var entry = KK[nm];
    if (!entry) return;
    var isPref = (cur.p === nm);
    var meta = KK_META[code];
    if (!meta) return;
    if (!skipPush && document.getElementById("ovEl").classList.contains("hidden")) {
      if (history.state && history.state.mitchieView === "result") {
        history.replaceState(Object.assign({}, history.state, {scrollY: window.scrollY, activeTab: "kk"}), "", "#result");
      }
      history.pushState({mitchieView:"detail", key:code, kk:true, city:curName}, "", "#detail");
    }
    document.getElementById("shTitle").innerHTML = escapeHtml(meta.icon + " " + meta.label) + (KK_ONELINE[code] ? "<div style='font-size:15px;font-weight:400;color:#222;margin-top:4px;'>"+escapeHtml(KK_ONELINE[code])+"</div>" : "");
    var cmpLine = kkCompareLine(code, nm, entry, isPref);
    // 説明文（2026-10-01）：「## 見出し」は太字の見出し、「・」は小さめの補足。空行で区切る
    var descHtml = "<div style='border-top:1px dashed #d8d5e8;margin:22px 0;'></div><div style='font-size:16px;font-weight:700;color:#3a6ee8;margin-bottom:8px;'>" + escapeHtml(meta.label) + "とは？</div>" +
      fillYears(meta.desc).split("\n").map(function(line){
        if (line === "") return "<div style='height:10px;'></div>";
        if (line.indexOf("## ") === 0) return "<div style='font-size:16px;font-weight:700;color:#3a2a6e;margin:6px 0 4px;'>" + line.slice(3) + "</div>";
        if (line.charAt(0) === "・") return "<div style='font-size:15px;color:#5a5a70;line-height:1.7;padding-left:1em;text-indent:-1em;'>" + line + "</div>";
        return "<div style='font-size:16px;color:#2a2a3a;line-height:1.8;'>" + line + "</div>";
      }).join("");
    // その年度の値が総務省の公表資料にない自治体（2026-10-01：令和6年度の公会計で11自治体）
    if (entry[code] == null) cmpLine = "";
    var missingHtml = (entry[code] == null) ? "<div style='background:#8a8a9a14;border:1px solid #8a8a9a33;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:16px;color:#2a2a3a;line-height:1.7;'>" +
      "<div style='font-size:16px;font-weight:700;color:#3a2a6e;margin-bottom:6px;'>🏠 " + escapeHtml(nm) + "の状況</div>" +
      fillYears("{KY}") + "の値は、総務省の公表資料にありません。グラフには、公表されている年度の値を表示しています。</div>" : "";
    var cmpHtml = cmpLine ? ("<div style='background:#a08be814;border:1px solid #a08be840;border-radius:12px;padding:12px 14px;margin:0 0 14px;'>" +
      "<div style='font-size:16px;font-weight:700;color:#3a2a6e;margin-bottom:6px;'>🏠 " + escapeHtml(nm) + "の状況</div>" +
      "<div style='font-size:16px;color:#2a2a3a;line-height:1.8;'>" + cmpLine + "</div>" + kkSituationExtra(code, entry, isPref) + "</div>") : "";
    var ka8NoteHtml = (code === "ka8") ? "<div style='background:#a08be814;border:1px solid #a08be840;border-radius:12px;padding:12px 14px;margin-top:16px;font-size:15px;color:#5a4a80;line-height:1.7;'>自治体の通常の行政活動や公共施設などへの投資に、どれだけお金を使い、どれだけ収入があったかを見る指標です。総務省の「統一的な基準による財務書類」に基づいています。国の「プライマリーバランス」と似た考え方ですが、計算方法は異なります。</div>" : "";
    document.getElementById("shDesc").innerHTML = descHtml + ka8NoteHtml;
    var kkSpWrapEl = document.getElementById("spWrap");
    if (kkSpWrapEl) kkSpWrapEl.style.display = "";

    // 過去分（_r1, _r2, _r3…）が集まったので、他の財政指標と同じ形式で推移グラフを描く
    // _r1が一番古い年、番号が大きいほど新しい年（財政側と統一済み）
    var KK_CURRENT_YEAR = DATA_YEAR.kokaikei; // 最新の年度（データから自動で決まる。js/data.js の computeDataYears）
    // 履歴は _r1（最も古い年）から順に並び、番号がそのまま年を表す（主値＝KK_CURRENT_YEAR）。
    // 公式に値が無い年は空欄(null)のまま位置を保っているので、空欄は飛ばし、ラベルは各値の年から作る
    // （2026-09-29：以前は最初の空欄で止まり、最新から数えてラベルを付けていたため、空欄のある団体で年がずれた）
    var kkMaxR = 0;
    while (Object.prototype.hasOwnProperty.call(entry, code + "_r" + (kkMaxR + 1))) { kkMaxR++; }
    var kkVals = [], kkYrLabels = [], kkMissingYrs = [], kkMissingNums = [];
    for (var kri = 1; kri <= kkMaxR + 1; kri++) {
      var kkV = kri <= kkMaxR ? entry[code + "_r" + kri] : entry[code];
      var yrNum = KK_CURRENT_YEAR - (kkMaxR + 1 - kri);
      if (kkV == null) {
        // 公式データにこの年の値が無い（2026-09-30：グラフの下に注記を出すため記録する）
        kkMissingYrs.push(yrNum <= 0 ? ("平成" + (30 + yrNum) + "年度") : (yrNum === 1 ? "令和元年度" : ("令和" + yrNum + "年度")));
        kkMissingNums.push(yrNum);
        continue;
      }
      kkVals.push(kkV);
      kkYrLabels.push(yrNum <= 0 ? ("H" + (30 + yrNum)) : ("R" + yrNum));
    }
    var kkCovidNote = "";
    // 3年以上続けて無い場合は「平成30年度〜令和4年度」のようにまとめる
    var kkMissingContig = kkMissingNums.length >= 3 && kkMissingNums[kkMissingNums.length - 1] - kkMissingNums[0] === kkMissingNums.length - 1;
    var kkMissingText = kkMissingContig ? (kkMissingYrs[0] + "〜" + kkMissingYrs[kkMissingYrs.length - 1]) : kkMissingYrs.join("・");
    var kkMissingNote = kkMissingYrs.length ?
      ("<div style='font-size:14px;color:#7a7a90;line-height:1.6;margin-top:8px;'>ℹ️ " + kkMissingText +
       "は、総務省の公表データに" + escapeHtml(nm) + "の値が無いため、グラフに表示していません。</div>") : "";
    if (kkVals.length >= 2) {
      var kkPeakI = 0, kkTroughI = 0;
      for (var kpi=1; kpi<kkVals.length; kpi++){ if (kkVals[kpi]>kkVals[kkPeakI]) kkPeakI=kpi; if (kkVals[kpi]<kkVals[kkTroughI]) kkTroughI=kpi; }
      var kkLastI = kkVals.length-1;
      var kkCovidYrsSet = {"R2":1,"R3":1,"R4":1};
      // 資産系（ka1/ka3/ka4/ka5/ka7/ka9）はゆっくり動く指標のため対象外。
      // 行政コスト(ka6)・業務投資活動収支(ka8)・受益者負担比率(ka9)のみ、コロナ対応費が直接出やすいため対象にする。
      // 行政コスト(ka6)は「高い年」のみ対象（コロナ対応費で増えた場合のみ理屈が通るため）。
      // 業務投資活動収支(ka8)は方向を問わない収支への影響として両方向を対象にする。
      // 受益者負担比率(ka9)は「低い年」のみ対象（施設休館等で使用料収入が減った場合のみ理屈が通るため）。
      var kkCovidReasonsPeak = {
        ka6: "コロナ対応費が直接計上された影響が考えられます",
        ka8: "コロナ対応費の収支への影響が考えられます"
      };
      var kkCovidReasonsTrough = {
        ka8: "コロナ対応費の収支への影響が考えられます",
        ka9: "公共施設の休館・利用制限により使用料収入が減った影響が考えられます"
      };
      // 2026-09-30：コロナの時期と重なることを理由にした推測、最初と最後の2点だけで決めた推移は出さない
      // （推移は上の「📅」の欄で、途中の動きも見て書く）
      if (false && kkCovidReasonsPeak[code] && kkPeakI !== kkLastI && kkCovidYrsSet[kkYrLabels[kkPeakI]]) {
        kkCovidNote = "<div style='font-size:14px;color:#7a7a90;margin-top:6px;'>📅 "+kkYrLabels[kkPeakI]+"年度が最も高い年です。新型コロナウイルス対応の時期と重なり、"+kkCovidReasonsPeak[code]+"</div>";
      } else if (false && kkCovidReasonsTrough[code] && kkTroughI !== kkLastI && kkCovidYrsSet[kkYrLabels[kkTroughI]]) {
        kkCovidNote = "<div style='font-size:14px;color:#7a7a90;margin-top:6px;'>📅 "+kkYrLabels[kkTroughI]+"年度が最も低い年です。新型コロナウイルス対応の時期と重なり、"+kkCovidReasonsTrough[code]+"</div>";
      }
      var kkHasCross = (code==="ka4"||code==="ka7"||code==="ka3"||code==="ka1"||code==="ka6");
      var kkTd = true ? null : trendDescribe(kkVals[0], kkVals[kkVals.length-1], meta.unit, 1);
      if (kkTd && kkTd.tier !== "横ばい") {
        var kkTrendIcon = kkTd.dir === "増加" ? "📈" : "📉";
        kkCovidNote += "<div style='font-size:14px;color:#7a7a90;margin-top:6px;'>" + kkTrendIcon + " " + meta.label + "はこの" + kkVals.length + "年で" + kkTd.text + "しています。" + "</div>";
      }
      document.getElementById("shTop").innerHTML = missingHtml + cmpHtml + kkCovidNote + kkReciprocalCross(code, entry[code], isPref, entry);
      var kkC = kkColor(code, entry[code], entry, isPref);
      var kkCText = TEXT_COLOR_MAP[kkC] || kkC;
      var Wk=300, Hk=100, Pk=20, PtopK=26;
      var kkMn=Math.min.apply(null,kkVals), kkMx=Math.max.apply(null,kkVals), kkRng=(kkMx-kkMn)||1;
      function pxk(i){ return Pk+(i/(kkVals.length-1))*(Wk-Pk*2); }
      function pyk(v){ return Hk-Pk-((v-kkMn)/kkRng)*(Hk-PtopK-Pk); }
      var kkArea="M"+pxk(0)+","+pyk(kkVals[0]), kkLine="M"+pxk(0)+","+pyk(kkVals[0]);
      for (var ki=1; ki<kkVals.length; ki++){ kkArea+=" L"+pxk(ki)+","+pyk(kkVals[ki]); kkLine+=" L"+pxk(ki)+","+pyk(kkVals[ki]); }
      kkArea += " L"+pxk(kkVals.length-1)+","+Hk+" L"+pxk(0)+","+Hk+" Z";
      var kkDots = "";
      for (var kj=0; kj<kkVals.length; kj++){
        var kkLast = kj === kkVals.length-1;
        kkDots += "<circle cx='"+pxk(kj)+"' cy='"+pyk(kkVals[kj])+"' r='"+(kkLast?5:3)+"' fill='"+(kkLast?kkC:"white")+"' stroke='"+kkC+"' stroke-width='2'/>";
        var kkPrevV = kj>0 ? kkVals[kj-1] : null;
        var kkNextV = kj<kkVals.length-1 ? kkVals[kj+1] : null;
        var kkIsValley = (kkPrevV==null || kkVals[kj]<=kkPrevV) && (kkNextV==null || kkVals[kj]<=kkNextV) && (kkPrevV!=null || kkNextV!=null);
        var kkLbl = kkFmt(kkVals[kj], meta.unit);
        var kkAnchor = kj===0 ? "start" : "middle";
        if (kkLast && kkIsValley) kkDots += "<text x='"+pxk(kj)+"' y='"+(pyk(kkVals[kj])+19)+"' text-anchor='"+kkAnchor+"' font-size='12' fill='"+kkCText+"' font-weight='700'>"+kkLbl+"</text>";
        else if (kkLast) kkDots += "<text x='"+pxk(kj)+"' y='"+(pyk(kkVals[kj])-9)+"' text-anchor='"+kkAnchor+"' font-size='12' fill='"+kkCText+"' font-weight='700'>"+kkLbl+"</text>";
        else if (kkIsValley) kkDots += "<text x='"+pxk(kj)+"' y='"+(pyk(kkVals[kj])+16)+"' text-anchor='"+kkAnchor+"' font-size='9' fill='"+kkCText+"' opacity='0.9'>"+kkLbl+"</text>";
        else kkDots += "<text x='"+pxk(kj)+"' y='"+(pyk(kkVals[kj])-8)+"' text-anchor='"+kkAnchor+"' font-size='9' fill='"+kkCText+"' opacity='0.9'>"+kkLbl+"</text>";
      }
      var kkNoteText = "※総務省「統一的な基準による財務書類に関する情報」の指標一覧より";
      var kkSpSvg = document.getElementById("spSvg");
      kkSpSvg.setAttribute("viewBox","0 0 "+Wk+" "+Hk);
      kkSpSvg.style.height=Hk+"px";
      kkSpSvg.innerHTML = "<defs><linearGradient id='gKk' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='"+kkC+"' stop-opacity='0.2'/><stop offset='100%' stop-color='"+kkC+"' stop-opacity='0'/></linearGradient></defs><path d='"+kkArea+"' fill='url(#gKk)'/><path d='"+kkLine+"' fill='none' stroke='"+kkC+"' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>"+kkDots;
      var kkYrLabelsHtml = kkYrLabels.map(function(y,i){
        var pct = (Pk+(i/(kkYrLabels.length-1))*(Wk-Pk*2))/Wk*100;
        return "<span style='left:"+pct+"%;'>"+y+"</span>";
      }).join("");
      document.getElementById("spLabels").innerHTML = "<div style='position:relative;height:100%;'>"+kkYrLabelsHtml+"</div><div style='font-size:9px;color:#aaa;margin-top:6px;'>"+kkNoteText+"</div>";
      // グラフの枠のすぐ下（説明文の先頭）に、公式データが無い年の注記を出す
      if (kkMissingNote) document.getElementById("shDesc").insertAdjacentHTML("afterbegin", kkMissingNote.replace("margin-top:8px;", "margin:-4px 0 12px;"));
    } else {
      document.getElementById("shTop").innerHTML = missingHtml + cmpHtml + kkReciprocalCross(code, entry[code], isPref, entry) + kkMissingNote;
      document.getElementById("spSvg").innerHTML = "";
      document.getElementById("spSvg").style.height = "0px";
      document.getElementById("spLabels").innerHTML = "";
      if (kkSpWrapEl) kkSpWrapEl.style.display = "none";
    }
    document.getElementById("ovEl").classList.remove("hidden");
    var kkShEl = document.querySelector("#ovEl .sh");
    if (kkShEl) kkShEl.scrollTop = 0;
    setTimeout(function(){ var s = document.querySelector("#ovEl .sh"); if (s) s.scrollTop = 0; }, 50);
  }

  function kkColor(code, val, entry, isPref){
    var NEUTRAL = "#a08be8";
    if (val == null) return NEUTRAL;
    if (code === "ka3") {
      var m3 = isPref ? KK_MEDIANS.ka3.pref : KK_MEDIANS.ka3.muni;
      var r3 = m3 ? val / m3 : 1;
      return r3 < 0.768 ? "#6dcfad" : r3 < 0.999 ? "#7bb8e8" : r3 < 1.152 ? "#f0c46a" : "#f0876a";
    }
    if (code === "ka4") {
      // 純資産比率は高いほど良い指標。市区町村の目安(80/60/40)を中央値からの比率に換算し、都道府県はその比率を自分の中央値に当てはめる
      var m4 = isPref ? KK_MEDIANS.ka4.pref : KK_MEDIANS.ka4.muni;
      var r4 = m4 ? val / m4 : 1;
      return r4 >= 1.094 ? "#6dcfad" : r4 >= 0.821 ? "#7bb8e8" : r4 >= 0.547 ? "#f0c46a" : "#f0876a";
    }
    if (code === "ka5") {
      // 将来世代負担比率は低いほど良い指標。同様に市区町村の目安(10/30/60)を比率換算する
      var m5 = isPref ? KK_MEDIANS.ka5.pref : KK_MEDIANS.ka5.muni;
      var r5 = m5 ? val / m5 : 1;
      return r5 < 0.546 ? "#6dcfad" : r5 < 1.639 ? "#7bb8e8" : r5 < 3.279 ? "#f0c46a" : "#f0876a";
    }
    if (code === "ka8") {
      return val >= 0 ? "#6dcfad" : "#f0876a";
    }
    return NEUTRAL;
  }

  function kkBoxHtml(code, entry, isPref){
    var meta = KK_META[code];
    var v = entry[code];
    var color = kkColor(code, v, entry, isPref);
    return "<div class='stat kk-stat' data-kkcode='" + code + "' role='button' tabindex='0' style='background:" + color + "18;border-color:" + color + "44;'>" +
      "<div class='si'>" + meta.icon + "</div>" +
      "<div class='sl'>" + meta.label + "</div>" +
      "<div class='sv' style='color:" + color + ";'>" + kkFmt(v, meta.unit) + "</div>" +
      "<div class='su'>\u8a73\u7d30\u3092\u898b\u308b \u25b6</div>" +
      "</div>";
  }

  var KK_AXIS_COLORS = ["#f0876a", "#7bb8e8", "#6dcfad", "#f0c46a"];

  function kkRadarSvg(nm, entry, isPref, prefName){
    var n = KK_RADAR_AXES.length;
    var cx = 50, cy = 50, R = 42;
    var angleStep = (Math.PI * 2) / n;
    var startAngle = -Math.PI / 2;

    function pt(i, r){
      var a = startAngle + i * angleStep;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }

    var mineVals = [], medVals = [];
    KK_RADAR_AXES.forEach(function(axis){
      var raw = entry[axis.code];
      var med = kkRadarMedian(axis.code, entry, isPref);
      mineVals.push(raw != null ? kkRadarNorm(axis, raw, med) : null);
      if (axis.isSigned) {
        medVals.push(50);
      } else {
        medVals.push(med != null ? kkRadarNorm(axis, med, med) : null);
      }
    });

    function pathFor(vals){
      var d = "";
      for (var i = 0; i < n; i++){
        if (vals[i] == null) continue;
        var r = (vals[i] / 100) * R;
        var p = pt(i, r);
        d += (d ? "L" : "M") + p[0].toFixed(2) + "," + p[1].toFixed(2) + " ";
      }
      return d.trim() + " Z";
    }

    var grid = "";
    [0.25, 0.5, 0.75, 1].forEach(function(frac){
      var d = "";
      for (var i = 0; i <= n; i++){
        var p = pt(i % n, R * frac);
        d += (i === 0 ? "M" : "L") + p[0].toFixed(2) + "," + p[1].toFixed(2) + " ";
      }
      grid += "<path d='" + d + "' fill='none' stroke='#b8b5ae' stroke-width='0.4'/>";
    });
    for (var gi = 0; gi < n; gi++){
      var gp = pt(gi, R);
      grid += "<line x1='" + cx + "' y1='" + cy + "' x2='" + gp[0].toFixed(2) + "' y2='" + gp[1].toFixed(2) + "' stroke='#b8b5ae' stroke-width='0.4'/>";
    }

    var medPath = pathFor(medVals);
    var minePath = pathFor(mineVals);

    var dots = "", medDots = "";
    for (var di = 0; di < n; di++){
      if (mineVals[di] != null){
        var dr = (mineVals[di] / 100) * R;
        var dp = pt(di, dr);
        dots += "<circle cx='" + dp[0].toFixed(2) + "' cy='" + dp[1].toFixed(2) + "' r='2' fill='#2a78d6'/>";
      }
      if (medVals[di] != null){
        var mr = (medVals[di] / 100) * R;
        var mp = pt(di, mr);
        medDots += "<circle cx='" + mp[0].toFixed(2) + "' cy='" + mp[1].toFixed(2) + "' r='1.5' fill='#6b6862'/>";
      }
    }

    var svg = "<svg viewBox='0 0 100 100' style='display:block;width:100%;height:100%;'>" +
      grid +
      "<path d='" + medPath + "' fill='none' stroke='#6b6862' stroke-width='0.8' stroke-dasharray='1.6,1.6'/>" + medDots +
      "<path d='" + minePath + "' fill='#2a78d61f' stroke='#2a78d6' stroke-width='1.1'/>" + dots +
      "</svg>";

    function axisLabelHtml(idx){
      var axis = KK_RADAR_AXES[idx];
      return "<div class='kk-axis-lbl' data-kkcode='" + axis.code + "' role='button' tabindex='0' style='text-align:center;cursor:pointer;'>" +
        "<span class='hlbl' style='background:" + KK_AXIS_COLORS[idx] + "22;color:" + KK_AXIS_COLORS[idx] + ";white-space:nowrap;'>" + axis.friendly + "</span>" +
        "<div class='hmsg' style='margin-top:3px;'>" + KK_META[axis.code].label + "</div>" +
        "</div>";
    }
    // KK_RADAR_AXESの並び順: 0=上, 1=右, 2=下, 3=左
    var chartBox = "<div style='position:relative;width:clamp(70px,calc(100vw - 272px),260px);height:clamp(70px,calc(100vw - 272px),260px);margin:0 auto;'>" +
      "<div style='position:absolute;top:0;left:0;width:100%;height:100%;'>" + svg + "</div>" +
      "</div>";
    var legendRow = "<div style='text-align:right;margin-top:10px;'><span style='display:inline-block;text-align:left;font-size:10px;color:#6b6862;line-height:1.6;'>" +
      "<svg width='24' height='6' style='display:inline-block;vertical-align:middle;'><line x1='1' y1='3' x2='23' y2='3' stroke='#6b6862' stroke-width='2' stroke-dasharray='4,3'/></svg> 比較基準<br>（全国中央値、収支のみ類似団体中央値）</span>" +
      "</div>";
      "</div>";
    var vertexGrid = "<div style='display:grid;grid-template-columns:92px 1fr 92px;align-items:center;justify-items:center;gap:6px;max-width:460px;margin:0 auto;'>" +
      "<div></div><div>" + axisLabelHtml(0) + "</div><div></div>" +
      "<div>" + axisLabelHtml(3) + "</div>" + chartBox + "<div>" + axisLabelHtml(1) + "</div>" +
      "<div></div><div>" + axisLabelHtml(2) + "</div><div></div>" +
      "</div>";

    var head = "<div style='text-align:center;margin-bottom:16px;'>" +
      "<span style='font-family:\"Kaisei Tokumin\",serif;font-size:24px;color:#3a2a6e;'>" + nm + "</span>" +
      (isPref ? "" : "<div class='cpref' style='margin-top:2px;margin-bottom:14px;'>" + prefName + "</div>") +
      "</div>";

    return head + vertexGrid + legendRow;
  }

  var KK_RADAR_AXES = [
    {code:"ka3", friendly:"老朽化への強さ", invert:true},
    {code:"ka4", friendly:"資産の自立度", invert:false},
    {code:"ka5", friendly:"将来世代への配慮", invert:true},
    {code:"ka8", friendly:"収支の健全性", invert:false, isSigned:true}
  ];

  function kkRadarMedian(code, entry, isPref){
    var meta = KK_META[code];
    if (meta.group) {
      var grp = entry.grp;
      var bucket = isPref ? "pref" : "muni";
      var gm = KK && KK._groupMedians && KK._groupMedians[bucket] && grp ? KK._groupMedians[bucket][grp] : null;
      return gm ? gm[code] : null;
    }
    var mm = KK_MEDIANS[code];
    return mm ? (isPref ? mm.pref : mm.muni) : null;
  }

  function kkRadarNorm(axis, val, med){
    if (val == null) return null;
    if (axis.isSigned) {
      var scale = Math.max(Math.abs(med || 0) * 2, 100);
      var t = Math.max(-1, Math.min(1, val / scale));
      return 50 + t * 50;
    }
    var v = axis.invert ? (100 - val) : val;
    return Math.max(0, Math.min(100, v));
  }

  /* --- 公会計の「みっちーからのひとこと」（2026-09-30）---
     数字の上下はグラフとカードで見られるので、ここでは「それが何を意味するか」だけを書く。
     ・使うのは向き（良い・悪い）がはっきりした4指標（老朽化率・純資産比率・将来世代負担比率・業務・投資活動収支）と、
       財政タブの判定（カードの色と同じ基準）だけ。
     ・一文ずつ、指標の定義から必ず言えることだけを書く（自治体の事情の推測や、先の見通しは書かない）。
         純資産比率      ＝資産のうち、負債（借金＝地方債のほか退職手当引当金なども含む）でまかなっていない部分の割合
         将来世代負担比率 ＝資産のうち、将来返す借金（地方債）でまかなっている部分の割合
         有形固定資産減価償却率＝施設などが耐用年数のうちどれだけ過ぎたか（平均）
         業務・投資活動収支＝行政サービス（業務活動）と、施設整備・基金への積み立てなど（投資活動）を合わせた収支。
                           赤字の差額は、借入金（財務活動）や前年度からの手元の資金で補われる
     ・全国の中央値との差が5%以内は「全国並み」（詳細画面の「ほぼ同水準」と同じ基準）
     ・最後に、もとにした指標と年度（出典）を必ず書く */
  function kkAdviceHtml(nm, entry, d, isPref) {
    if (!entry) return "";
    function cmp(code) {
      var v = entry[code], mm = KK_MEDIANS[code];
      var med = mm ? (isPref ? mm.pref : mm.muni) : null;
      if (v == null || med == null || med === 0) return 0;
      if (v > med * 1.05) return 1;
      if (v < med * 0.95) return -1;
      return 0;
    }
    var a3 = cmp("ka3"), a4 = cmp("ka4"), a5 = cmp("ka5");
    var ka3 = entry.ka3, ka4 = entry.ka4, ka8 = entry.ka8;
    var than = isPref ? "他の都道府県より" : "全国より";
    var debtBig = (a4 < 0 || a5 > 0), debtSmall = (a4 > 0 || a5 < 0) && !debtBig;
    var dLight = d && d.d != null && d.d < 10;           // 財政タブ：実質公債費比率が緑（軽い）
    var dHeavy = d && d.d != null && d.d >= 18;          // 財政タブ：黄・オレンジ（重い）
    var xHeavy = d && d.x != null && d.x >= 95;          // 財政タブ：経常収支比率が黄・オレンジ
    var kkSrc = {}, finSrc = {};
    var bullets = [];

    // 借金などでまかなった資産の割合（純資産比率・将来世代負担比率）
    var debtLine = "";
    if (a4 < 0 && a5 > 0) debtLine = "資産のうち借金などでまかなった割合と、将来の住民が返済を受け持つ割合は、" + than + "大きめです";
    else if (a4 < 0 && a5 < 0) debtLine = "資産のうち借金などでまかなった割合は" + than + "大きめですが、将来の住民が返済を受け持つ地方債の割合は小さめです";
    else if (a4 < 0) debtLine = "資産のうち借金などでまかなった割合が、" + than + "大きめです";
    else if (a5 > 0) debtLine = "資産のうち、将来の住民が返済を受け持つ地方債でまかなった割合が、" + than + "大きめです";
    else if (a4 > 0 && ka4 >= 80) debtLine = "資産の" + Math.floor(ka4 / 10) + "割以上を、借金などに頼らずまかなっています";
    else if (a4 > 0 || a5 < 0) debtLine = "資産のうち借金などでまかなった割合" + (a5 < 0 ? "も、将来の住民が返済を受け持つ割合も" : "は") + "、" + than + "小さめです" +
      ((isPref && ka4 != null && ka4 < 50) ? "（都道府県は全体に負債の割合が大きく、" + nm + "も資産の半分以上は負債です）" : "");
    if (debtLine) { bullets.push({icon:"🏦", t:debtLine, p:1}); if (a4 !== 0) kkSrc["純資産比率"]=1; if (a5 !== 0) kkSrc["将来世代負担比率"]=1; }

    // 施設の古さ（有形固定資産減価償却率）
    if (a3 !== 0 && ka3 != null) {
      var wari = "約" + Math.round(ka3 / 10) + "割";
      bullets.push({icon:"🏚️", t: a3 > 0 ? "施設は平均して耐用年数の" + wari + "が過ぎていて、" + than + "古くなっています"
                                           : "施設は" + than + "新しめです（平均して耐用年数の" + wari + "が経過）", p:2});
      kkSrc["有形固定資産減価償却率"]=1;
    }

    // 財政タブとの組み合わせ（両方から言えることがはっきりある場合だけ）
    var finLine = null;
    // 並び順：借金の割合（1）→ それを受けた財政タブの一言（1.5）→ 施設の古さ（2）→ その年の収支（3）
    if (debtBig && dLight) finLine = {icon:"💳", t:"ただし、毎年の借金返済の重さ（実質公債費比率）は軽い水準です", p:1.5};
    else if (debtBig && dHeavy) finLine = {icon:"💳", t:"毎年の借金返済の重さ（実質公債費比率）も重い水準です", p:1.5};
    else if (debtSmall && xHeavy) finLine = {icon:"📊", t:"一方、毎年の収入の約" + Math.round(d.x) + "%が決まった支出に回っています（経常収支比率）", p:1.5};
    if (finLine) { bullets.push(finLine); finSrc[finLine.icon === "📊" ? "経常収支比率" : "実質公債費比率"]=1; }

    // その年の収支（業務・投資活動収支）
    if (ka8 != null) {
      bullets.push({icon:"⚖️", t: ka8 < 0
        ? fillYears("{KY}") + "は、行政サービス・施設整備・基金への積み立てなどの支出が収入を上回り、差を借入金や手元の資金で補いました"
        : fillYears("{KY}") + "は、行政サービス・施設整備・基金への積み立てなどを、その年の収入でまかなえています", p:3});
      kkSrc["業務・投資活動収支"]=1;
    }

    // 見出し（いちばん大事な「だから何？」）
    var head;
    // 見出しは、要点で実際に言っていることだけを使う（2026-09-30）
    var bigNoun = a4 < 0 ? "借金などでまかなった資産の割合" : "将来の住民が返済を受け持つ地方債の割合";
    var xTail = (d && d.x != null && d.x >= 98) ? "毎年のやりくりには余力がほとんどありません" : "毎年のやりくりには余裕が少ない状態です";
    if (a3 > 0 && debtBig) head = "古くなった施設の更新と、今ある借金などの返済の両方を抱えている状態です";
    else if (debtBig && dLight) head = bigNoun + "は大きめですが、毎年の返済は軽い状態です";
    else if (debtBig && dHeavy) head = bigNoun + "が大きく、毎年の返済も重い状態です";
    else if (debtBig) head = bigNoun + "が、" + than + "大きめの状態です";
    else if (debtSmall && xHeavy) head = "これまでの資産と負債のバランスは" + (isPref ? "都道府県の中では" : "") + "良いほうですが、" + xTail;
    else if (debtSmall && a3 > 0) head = "借金などへの頼り方は小さめですが、施設の老朽化は" + than + "進んでいます";
    else if (debtSmall && a4 > 0 && ka4 >= 50) head = a5 < 0 ? "資産の多くを借金などに頼らずまかなっていて、将来の住民に回る負担も小さめの状態です" : "資産の多くを借金などに頼らずまかなっている状態です";
    else if (debtSmall && a4 > 0) head = (isPref ? "都道府県の中では、" : "") + (a5 < 0 ? "借金などに頼った資産の割合が小さめで、将来の住民に回る負担も小さめの状態です" : "借金などに頼った資産の割合が小さめの状態です");
    else if (debtSmall) head = "将来の住民が返済を受け持つ地方債の割合が、" + than + "小さめの状態です";
    else if (a3 > 0) head = "施設全体として、建て替えや修繕の時期に" + than + "近づいている状態です";
    else if (a3 < 0) head = "施設は" + than + "新しめで、資産と負債のバランスは" + (isPref ? "他の都道府県" : "全国") + "並みの状態です";
    else head = "資産と負債のバランスや施設の古さは、" + (isPref ? "他の都道府県" : "全国") + "並みの状態です";

    bullets.sort(function(a, b){ return a.p - b.p; });
    // 見出しに関係する要点を優先して最大3つ（財政タブとの組み合わせは見出しの根拠なので必ず残す）
    var shown = bullets.slice(0, 3);
    // 出典は表示した要点に使った指標だけ
    kkSrc = {}; finSrc = {};
    shown.forEach(function(b){
      if (b.icon === "🏦") { if (a4 !== 0) kkSrc["純資産比率"]=1; if (a5 !== 0) kkSrc["将来世代負担比率"]=1; }
      if (b.icon === "🏚️") kkSrc["有形固定資産減価償却率"]=1;
      if (b.icon === "⚖️") kkSrc["業務・投資活動収支"]=1;
      if (b.icon === "💳") finSrc["実質公債費比率"]=1;
      if (b.icon === "📊") finSrc["経常収支比率"]=1;
    });
    var src = [];
    if (Object.keys(kkSrc).length) src.push(Object.keys(kkSrc).join("・") + "（総務省 公会計 " + fillYears("{KY}") + "）");
    if (Object.keys(finSrc).length) src.push(Object.keys(finSrc).join("・") + "（総務省 " + fillYears("{FY}") + "）");

    return "<div class='adv' style='margin-top:18px;'><strong>みっちーからのひとこと</strong>" +
      "<div style='font-weight:700;color:#3a2a6e;margin:6px 0 8px;line-height:1.6;'>" + head + "</div>" +
      shown.map(function(b){ return "<div style='display:flex;gap:6px;align-items:flex-start;margin-top:4px;line-height:1.6;'><span aria-hidden='true'>" + b.icon + "</span><span>" + b.t + "</span></div>"; }).join("") +
      (src.length ? "<div style='font-size:14px;color:#7a7a90;margin-top:10px;line-height:1.5;'>もとにした指標：" + src.join("、") + "</div>" : "") +
      "<div style='font-size:14px;color:#7a7a90;margin-top:4px;line-height:1.5;'>※公会計は、これまで積み上げてきた資産と負債のバランスを見る指標で、毎年のやりくり（財政タブ）とは見ているものが違います。</div>" +
      "</div>";
  }

  function kkRender(nm, d){
    var body = document.getElementById("kkContent");
    if (!body) return;
    var isPref = (d.p === nm);
    var entry = KK ? KK[nm] : null;
    if (!entry) {
      body.innerHTML = "<p style='text-align:center;color:#a090c8;padding:24px 0;'>\u3053\u306e\u81ea\u6cbb\u4f53\u306e\u516c\u4f1a\u8a08\u30c7\u30fc\u30bf\u306f\u672a\u516c\u8868\u3067\u3059\u3002</p>";
      return;
    }
    var html = "<div style='font-size:14px;color:#a08b64;text-align:center;margin:2px 0 12px;'>📊 公会計データ："+fillYears("{KY}")+"（総務省公表最新データ）</div>";
    html += kkRadarSvg(nm, entry, isPref, d.p);
    html += "<div class='tap-hint' style='margin-top:20px;'>\ud83d\udcca \u5404\u9805\u76ee\u3092\u30bf\u30c3\u30d7\u3059\u308b\u3068\u8aac\u660e\u304c\u8868\u793a\u3055\u308c\u307e\u3059</div><div class='grid'>";
    KK_ORDER.forEach(function(code){ html += kkBoxHtml(code, entry, isPref); });
    html += "</div>" + kkAdviceHtml(nm, entry, d, isPref);
    html += "<div class='src'>📋 総務省「統一的な基準による財務書類に関する情報」" + fillYears("{KY}") + "</div>";
    body.innerHTML = html;
    body.querySelectorAll(".kk-stat, .kk-axis-lbl").forEach(function(el){
      el.addEventListener("click", function(){ kkOpenDetail(this.getAttribute("data-kkcode")); });
    });
  }

  function fkShowFin(){
    var finTab = document.getElementById("finTabBtn");
    var kkTab = document.getElementById("kkTabBtn");
    var finBody = document.getElementById("finContent");
    var kkBody = document.getElementById("kkContent");
    if (!finTab || !kkTab || !finBody || !kkBody) return;
    finTab.classList.add("active", "fk-tab-fin-active");
    kkTab.classList.remove("active", "fk-tab-kk-active");
    finBody.classList.remove("hidden");
    kkBody.classList.add("hidden");
  }

  function fkShowKokaikei(nm, d){
    var finTab = document.getElementById("finTabBtn");
    var kkTab = document.getElementById("kkTabBtn");
    var finBody = document.getElementById("finContent");
    var kkBody = document.getElementById("kkContent");
    if (!finTab || !kkTab || !finBody || !kkBody) return;
    kkTab.classList.add("active", "fk-tab-kk-active");
    finTab.classList.remove("active", "fk-tab-fin-active");
    finBody.classList.add("hidden");
    kkBody.classList.remove("hidden");
    loadKokaikei(function(){ kkRender(nm, d); });
  }

  function fkInitTabs(nm, d){
    var finTab = document.getElementById("finTabBtn");
    var kkTab = document.getElementById("kkTabBtn");
    if (!finTab || !kkTab) return;
    var wantKk = !!(history.state && history.state.activeTab === "kk");
    if (wantKk) { fkShowKokaikei(nm, d); } else { fkShowFin(); }
    finTab.onclick = function(){
      fkShowFin();
      if (history.state && history.state.mitchieView === "result" && history.state.activeTab !== "fin") {
        history.pushState(Object.assign({}, history.state, {activeTab: "fin"}), "", "#result");
      }
    };
    kkTab.onclick = function(){
      fkShowKokaikei(nm, d);
      if (history.state && history.state.mitchieView === "result" && history.state.activeTab !== "kk") {
        history.pushState(Object.assign({}, history.state, {activeTab: "kk"}), "", "#result");
      }
    };
  }


/* --- アクセシビリティ: role="button" をキーボードでも押せるようにする --- */
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
  var el = e.target;
  if (!el || !el.getAttribute || el.getAttribute("role") !== "button") return;
  e.preventDefault();
  el.click();
});

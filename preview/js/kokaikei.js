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
    r:   {"増加":"貯金を着実に積み増している状態です。", "減少":"貯金を取り崩している状態です。今後の水準に注意が必要です。"},
    ka3: {"増加":"施設の更新・改修のタイミングが近づいている可能性があります。", "減少":"施設の更新・改修が進んでいる可能性があります。"},
    ka4: {"増加":"借入に頼らず資産を築けている状態が続いています。", "減少":"借入への依存度が高まる方向で推移しています。"},
    ka1: {"増加":"このペースでの推移が続くかどうか、今後の数字にも注目です。", "減少":"このペースでの推移が続くかどうか、今後の数字にも注目です。"},
    ka6: {"増加":"このペースでの推移が続くかどうか、今後の数字にも注目です。", "減少":"このペースでの推移が続くかどうか、今後の数字にも注目です。"},
    ka7: {"増加":"このペースでの推移が続くかどうか、今後の数字にも注目です。", "減少":"このペースでの推移が続くかどうか、今後の数字にも注目です。"}
  };
  function withTrendMeaning(metricKey, phrase) {
    if (!phrase) return phrase;
    var dir = phrase.indexOf("増加")>-1 ? "増加" : "減少";
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
  function trendDescribe(oldVal, newVal, unit, decimals) {
    if (oldVal == null || newVal == null) return null;
    decimals = decimals == null ? 1 : decimals;
    var diff = newVal - oldVal;
    var pct = oldVal !== 0 ? Math.abs(diff) / Math.abs(oldVal) : 0;
    var dir = diff > 0 ? "増加" : diff < 0 ? "減少" : "横ばい";
    var tier;
    if (pct < 0.03) tier = "横ばい";
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
    "<div style='font-size:13px;color:#6b5b80;line-height:1.7;'>起債計画や基金の使い方によって、この2つの指標の動き方は自治体ごとに大きく異なります。この街の場合の具体的な背景は、市の実施計画や財政状況資料集で確認できます。</div>" +
    "<div style='font-size:11px;color:#999;margin-top:6px;'>※「軽め」「重め」「高め」「低め」は総務省の公式区分ではなく、当アプリが分かりやすさのために設けた独自の目安です。</div>" +
    "</div>";
  // 将来負担比率×(老朽化率/資産額/行政コスト)の判定ロジックを1箇所にまとめる（財政タブ・公会計タブ両方から呼ばれる）
  var FUTURE_COMBO_META = {
    ka3: {label:"有形固定資産減価償却率", fullLabel:"有形固定資産減価償却率（老朽化率）", unit:"%", nearNoun:"老朽化率"},
    ka1: {label:"住民一人当たり資産額", fullLabel:"住民一人当たり資産額", unit:"万円", nearNoun:"資産額"},
    ka6: {label:"住民一人当たり行政コスト", fullLabel:"住民一人当たり行政コスト", unit:"万円", nearNoun:"行政コスト"}
  };
  function buildFutureComboBody(code, kkVal, med, uHigh, entry) {
    var m = FUTURE_COMBO_META[code];
    var near = Math.abs(kkVal - med) <= med * 0.1;
    var high = kkVal > med;
    var judge, fact, analysis;
    if (near) {
      judge = "中央値とほぼ同水準";
      fact = "<strong style='color:#c0623a;'>[公会計]</strong>" + m.label + "は中央値とほぼ同水準です。<strong style='color:#3a9970;'>[財政]</strong>将来への借金は" + (uHigh?"重め":"軽め") + "です。";
      analysis = "この" + (uHigh?"重さ":"軽さ") + "は" + m.nearNoun + "以外の要因によるものと考えられます。";
      return {judge:judge, analysis:analysis};
    }
    if (code === "ka3") {
      if (!uHigh && !high) { judge="中央値より低め"; fact="<strong style='color:#3a9970;'>[財政]</strong>将来への借金・<strong style='color:#c0623a;'>[公会計]</strong>施設の老朽化、どちらの面から見ても軽い状態です。"; analysis=""; }
      else if (uHigh && high) { judge="中央値より高め"; fact="<strong style='color:#3a9970;'>[財政]</strong>将来への借金・<strong style='color:#c0623a;'>[公会計]</strong>施設の老朽化、どちらの面から見ても重い状態です。"; analysis="老朽化した施設の更新をこれから借金で行うと、将来負担がさらに増える可能性があります。"; }
      else if (!uHigh && high) {
        judge = "中央値より高め";
        fact = "<strong style='color:#3a9970;'>[財政]</strong>将来への借金は軽めですが、<strong style='color:#c0623a;'>[公会計]</strong>施設の老朽化は進んでいます。";
        var ka1Trend = kkMetricTrend(entry, "ka1", entry ? entry.ka1 : null);
        analysis = ka1Trend === "growing"
          ? "②既存施設を活用しながら、新しい整備も進めている可能性も考えられます。"
          : "①必要な投資が行われず、老朽化対策が先送りにされている可能性も考えられます。";
      }
      else { judge="中央値より低め"; fact="<strong style='color:#3a9970;'>[財政]</strong>将来への借金は重めですが、<strong style='color:#c0623a;'>[公会計]</strong>施設の老朽化は進んでいません。"; analysis="借金をしてでも施設の更新・整備を積極的に進めている可能性があります。"; }
    } else if (code === "ka1") {
      if (!uHigh && high) { judge="中央値より高め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>資産規模は大きめですが、<strong style='color:#3a9970;'>[財政]</strong>将来への借金は軽めです。"; analysis="借金に頼らず資産を築けています。"; }
      else if (uHigh && high) { judge="中央値より高め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>資産規模・<strong style='color:#3a9970;'>[財政]</strong>将来への借金、どちらも大きめです。"; analysis="大型の資産整備を借金でまかなってきた可能性があります。"; }
      else if (uHigh && !high) { judge="中央値より低め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>資産規模は控えめですが、<strong style='color:#3a9970;'>[財政]</strong>将来への借金は重めです。"; analysis="資産形成に見合わない借金を抱えている可能性があります。"; }
      else { judge="中央値より低め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>資産規模・<strong style='color:#3a9970;'>[財政]</strong>将来への借金、どちらも小さめです。"; analysis="資産の規模と将来世代への負担のバランスは取れている状態です。"; }
    } else {
      if (!uHigh && !high) { judge="中央値より低め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>行政コスト・<strong style='color:#3a9970;'>[財政]</strong>将来への借金、どちらも軽めです。"; analysis="コンパクトな運営と言えます。"; }
      else if (uHigh && high) { judge="中央値より高め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>行政コスト・<strong style='color:#3a9970;'>[財政]</strong>将来への借金、どちらも重めです。"; analysis="サービス水準を維持するための借金が将来負担として残っている可能性があります。"; }
      else if (!uHigh && high) { judge="中央値より高め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>行政コストは高めですが、<strong style='color:#3a9970;'>[財政]</strong>将来への借金は軽めです。"; analysis="手厚いサービスを借金に頼らず提供できています。"; }
      else { judge="中央値より低め"; fact="<strong style='color:#c0623a;'>[公会計]</strong>行政コストは抑えめですが、<strong style='color:#3a9970;'>[財政]</strong>将来への借金は重めです。"; analysis="過去の投資の返済が今の身軽さと引き換えになっている可能性があります。"; }
    }
    return {judge:judge, analysis:analysis};
  }
  function buildFutureComboBox(code, kkVal, isPrefView, curObj, curNameStr, entry, reverseOrder, boxNumber) {
    if (kkVal == null || curObj.u == null) return "";
    var m = FUTURE_COMBO_META[code];
    var med = isPrefView ? KK_MEDIANS[code].pref : KK_MEDIANS[code].muni;
    var uHigh = futureBurdenHigh(curObj.u, isPrefView);
    var r = buildFutureComboBody(code, kkVal, med, uHigh, entry);
    var uValsArr = [curObj.u_r1, curObj.u_r2, curObj.u_r3, curObj.u_r4, curObj.u_r5, curObj.u];
    var uTrendPhrase = withTrendMeaning("u", trendSincePhrase(uValsArr, 6));
    var kkValsArr = entry ? [entry[code+"_r1"], entry[code+"_r2"], entry[code+"_r3"], entry[code+"_r4"], entry[code]] : [];
    var kkTrendPhrase = entry ? withTrendMeaning(code, trendSincePhrase(kkValsArr, 5)) : null;
    var numMark = boxNumber ? ["①","②","③","④","⑤"][boxNumber-1] || "" : "";
    var heading = reverseOrder ? ("🔗 財政と比べてみると" + numMark) : ("🔗 公会計と比べてみると" + numMark);
    return kkCrossBox(heading,
      "将来負担比率", curObj.u+"%", uHigh?"重め":"軽め",
      m.label, kkVal+m.unit, r.judge,
      r.analysis,
      reverseOrder, uTrendPhrase, kkTrendPhrase);
  }
  function kkCrossBox(heading, zaiLabel, zaiVal, zaiJudge, kkLabel, kkVal, kkJudge, analysisText, reverse, zaiTrendPhrase, kkTrendPhrase) {
    var zaiCard = "<div style='flex:1;background:white;border-radius:10px;padding:10px 10px;text-align:center;display:flex;flex-direction:column;justify-content:center;'>" +
        "<div style='font-size:12px;color:#3a9970;font-weight:700;margin-bottom:3px;'>[財政] " + zaiLabel + "</div>" +
        "<div style='font-size:17px;font-weight:700;color:#2a2a3a;'>" + zaiVal + "</div>" +
        "<div style='font-size:12px;color:#777;'>" + zaiJudge + "</div>" +
      "</div>";
    var kkCard = "<div style='flex:1;background:white;border-radius:10px;padding:10px 10px;text-align:center;display:flex;flex-direction:column;justify-content:center;'>" +
        "<div style='font-size:12px;color:#c0623a;font-weight:700;margin-bottom:3px;'>[公会計] " + kkLabel + "</div>" +
        "<div style='font-size:17px;font-weight:700;color:#2a2a3a;'>" + kkVal + "</div>" +
        "<div style='font-size:12px;color:#777;'>" + kkJudge + "</div>" +
      "</div>";
    var xMark = "<div style='width:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#222;'>×</div>";
    var trendHtml = "";
    if (zaiTrendPhrase || kkTrendPhrase) {
      trendHtml = "<div style='margin-top:12px;padding-top:10px;border-top:1px dashed #6dcfad55;'>";
      if (zaiTrendPhrase) trendHtml += "<div style='font-size:14px;color:#3a5a4a;margin-bottom:4px;'>" + (zaiTrendPhrase.indexOf("増加")>-1?"📈":"📉") + " <strong>" + zaiLabel + "</strong>：" + zaiTrendPhrase + "</div>";
      if (kkTrendPhrase) trendHtml += "<div style='font-size:14px;color:#3a5a4a;'>" + (kkTrendPhrase.indexOf("増加")>-1?"📈":"📉") + " <strong>" + kkLabel + "</strong>：" + kkTrendPhrase + "</div>";
      trendHtml += "</div>";
    }
    var analysisHtml = analysisText ? (
      "<div style='background:#fdf8ec;border-radius:10px;padding:10px 12px;'>" +
        "<div style='font-size:13px;font-weight:700;color:#c08a1a;margin-bottom:4px;'>💡 ここから考えられること</div>" +
        "<div style='font-size:14px;color:#5a4a30;line-height:1.7;'>" + analysisText + "</div>" +
      "</div>"
    ) : "";
    return "<div style='background:#e8f7f0;border:1px solid #6dcfad55;border-radius:12px;padding:14px 16px;margin-top:10px;'>" +
      "<div style='font-size:15px;font-weight:700;color:#3a9970;margin-bottom:10px;'>" + heading + "</div>" +
      "<div style='display:flex;align-items:stretch;gap:0;margin-bottom:"+(analysisHtml?"10px":"0")+";'>" +
        (reverse ? (kkCard + xMark + zaiCard) : (zaiCard + xMark + kkCard)) +
      "</div>" +
      analysisHtml +
      trendHtml +
    "</div>";
  }
  // 公会計側のポップアップから見た、財政側とのクロスチェック（財政タブ側と同じロジックの逆方向）
  function kkReciprocalCross(code, entryV, isPref, entry) {
    if (!cur) return "";
    if (code === "ka4" && cur.sfs && cur.sfs > 0) {
      var ratioRec = cur.r / cur.sfs * 100;
      var rb = reserveBands(isPref);
      var ka4Med = isPref ? KK_MEDIANS.ka4.pref : KK_MEDIANS.ka4.muni;
      var rHighRec = ratioRec >= rb.hi;
      var ka4NearRec = Math.abs(entryV - ka4Med) <= ka4Med * 0.1;
      var ka4HighRec = entryV > ka4Med;
      if (ka4NearRec) return "";
      var judgeRec, analysisRec;
      if (!rHighRec && !ka4HighRec) { judgeRec = "やや少なめ"; analysisRec = ""; }
      else if (rHighRec && ka4HighRec) { judgeRec = "多め"; analysisRec = ""; }
      else if (rHighRec && !ka4HighRec) { judgeRec = "多め"; analysisRec = "貯金と長期的な財産形成は別物です。"; }
      else { judgeRec = "やや少なめ"; analysisRec = "日々の備えと長期的な財産形成は別物です。"; }
      function ratioAtRec(sfx){ var rv=sfx?cur["r_r"+sfx]:cur.r; var sv=sfx?cur["sfs_r"+sfx]:cur.sfs; return (rv!=null&&sv)?rv/sv*100:null; }
      var rTrendPhrase = withTrendMeaning("r", trendSincePhrase([ratioAtRec(1),ratioAtRec(2),ratioAtRec(3),ratioAtRec(4),ratioAtRec(5),ratioAtRec(null)], 6, "%", 1));
      var ka4TrendPhrase = entry ? withTrendMeaning("ka4", trendSincePhrase([entry.ka4_r1,entry.ka4_r2,entry.ka4_r3,entry.ka4_r4,entry.ka4_r5,entry.ka4], 5, "%", 1)) : null;
      return kkCrossBox("🔗 財政と比べてみると", "財政調整基金残高", ratioRec.toFixed(1)+"%", judgeRec, "純資産比率", entryV+"%", ka4HighRec?"中央値より高め":"中央値より低め", analysisRec, true, rTrendPhrase, ka4TrendPhrase) + KK_CROSSCHECK_CAVEAT;
    }
    if (code === "ka7" && cur.d != null) {
      var ka7Med = isPref ? KK_MEDIANS.ka7.pref : KK_MEDIANS.ka7.muni;
      var dHighRec = cur.d >= 18;
      var ka7NearRec = Math.abs(entryV - ka7Med) <= ka7Med * 0.1;
      var ka7HighRec = entryV > ka7Med;
      if (ka7NearRec) return "";
      var judgeD, analysisD2;
      if (!dHighRec && !ka7HighRec) { judgeD = "軽め"; analysisD2 = ""; }
      else if (dHighRec && ka7HighRec) { judgeD = "重め"; analysisD2 = ""; }
      else if (!dHighRec && ka7HighRec) {
        judgeD = "軽め";
        var ka7TrendC = kkMetricTrend(entry, "ka7", entryV);
        analysisD2 = ka7TrendC === "declining" ? "着実に返済が進んでいる長期返済中、という可能性も考えられます。" : "新しい借入も続いており、返済はこれから本格化する可能性も考えられます。";
      }
      else {
        judgeD = "重め";
        var ka7TrendD = kkMetricTrend(entry, "ka7", entryV);
        analysisD2 = ka7TrendD === "declining" ? "短期集中で返済を終えつつある可能性も考えられます。" : "返済期間を短く設定している可能性も考えられます。";
      }
      var dTrendPhrase = withTrendMeaning("d", trendSincePhrase([cur.d_r1,cur.d_r2,cur.d_r3,cur.d_r4,cur.d_r5,cur.d], 6, "%", 1));
      var ka7TrendPhrase = entry ? withTrendMeaning("ka7", trendSincePhrase([entry.ka7_r1,entry.ka7_r2,entry.ka7_r3,entry.ka7_r4,entry.ka7_r5,entry.ka7], 5, "万円", 1)) : null;
      return kkCrossBox("🔗 財政と比べてみると", "実質公債費比率", cur.d+"%", judgeD, "住民一人当たり負債額", entryV+"万円", ka7HighRec?"中央値より高め":"中央値より低め", analysisD2, true, dTrendPhrase, ka7TrendPhrase) + KK_CROSSCHECK_CAVEAT;
    }
    if ((code === "ka3" || code === "ka1" || code === "ka6") && cur.u != null) {
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
      desc:"【何を指すか】\n・自治体が持っている財産を、住民の数で割った金額。町の財産を住民みんなで分けたら一人いくら、というイメージです。\n\n【含まれるもの】\n庁舎・学校・道路などの公共施設・インフラ資産などが含まれます。\n\n📈多い理由\n・大規模な公共施設・インフラを多く保有している\n・人口が少なく、一人当たりに換算すると大きくなる\n\n📉少ない理由\n・資産の減価償却や除却が進み、帳簿上の資産額が小さくなっている\n・計画的に資産をスリム化した"},
    ka2: {icon:"📦", label:"歳入額対資産比率", unit:"年", group:false,
      desc:"【何を指すか】\n・今持っている財産が、1年分の収入の何年分にあたるか。数字が大きいほど、財産をたくさん蓄えていることになります\n\n📈高い理由\n・インフラ等の資産を多く抱えている\n\n📉低い理由\n・資産規模に対して歳入が大きい\n・資産そのものが少ない"},
    ka3: {icon:"🏚️", label:"有形固定資産減価償却率", unit:"%", group:false,
      desc:"【何を指すか】\n・道路や建物がどれくらい古くなっているかを表す割合。数字が大きいほど、そろそろ建て替えや修理が必要な時期に近づいています\n\n📈高い理由\n・施設の更新・改修が追いついていない\n・昭和期に整備した施設が多い\n\n📉低い理由\n・近年、建て替え・新設が進んでいる\n・大型投資で一気に新設・更新したため、逆に将来の借金負担は増えている可能性もあります"},
    ka4: {icon:"🧾", label:"純資産比率", unit:"%", group:false,
      desc:"【何を指すか】\n・町の財産のうち、借金ではなく自分たちのお金でまかなっている部分の割合。数字が大きいほど、借金に頼らず財産を築いてきたことになります\n\n📈高い理由\n・借入に頼らず資産形成してきた\n\n📉低い理由\n・地方債などの借入に依存して資産を形成している\n・人口増加や産業誘致を狙って、あえて積極的に投資している場合もあります"},
    ka5: {icon:"🏦", label:"将来世代負担比率", unit:"%", group:false,
      desc:"【何を指すか】\n・今ある財産のうち、まだ返し終わっていない借金でまかなわれている部分の割合。数字が大きいほど、これからの世代が返済を負担することになります\n\n📈高い理由\n・大型事業を借金でまかなってきた\n・将来世代も使う施設のため、意図的に将来世代にも負担してもらう方針（世代間の公平性）という考え方もあります\n\n📉低い理由\n・借金に頼らず整備してきた\n・資産の規模自体が小さい"},
    ka6: {icon:"🧑‍💼", label:"住民一人当たり行政コスト", unit:"万円", group:true,
      desc:"【何を指すか】\n・町が住民サービスのために1年間に使った費用を、住民の数で割った金額。将来払う退職金の積立分なども含めた、本当の意味でのコストです\n\n【含まれるもの】\n👔人件費（職員給与など）\n※「職員」とは、市役所・区役所・出張所などで働く地方公務員のことです（学校の先生や消防士なども含まれます）。民間企業の社員ではなく、その自治体に雇われている人たちです。\n🏢物件費（維持管理費・光熱費など）\n👨‍👩‍👧扶助費（生活保護・児童手当などの給付）\n📉減価償却費（建物や道路が古くなった分の目減り）\n💼退職手当引当金繰入額など（将来払う退職金の積立分）\n※「退職金」とは、職員たちが退職するときに、自治体から支払われるお金（退職手当）のことです。\n\n📈高い理由\n・高齢化で扶助費が多い\n・施設保有が多く減価償却費がかさむ\n・人口が少なく一人当たりに換算すると大きくなる\n\n📉低い理由\n・人口が多く一人当たりに薄まる\n・行財政改革でコスト削減している"},
    ka7: {icon:"💳", label:"住民一人当たり負債額", unit:"万円", group:true,
      desc:"【何を指すか】\n・町の借金の合計を、住民の数で割った金額。町の借金を住民みんなで分けたら一人いくら、というイメージです\n\n【含まれるもの】\n📜地方債（借金の残高）\n💼退職手当引当金（将来払う退職金の積立不足分）\n🧾未払金など\n\n📈高い理由\n・借入や引当金が多い\n・人口が少なく一人当たりに換算すると大きくなる\n\n📉低い理由\n・借入を抑制してきた\n・人口が多く一人当たりに薄まる"},
    ka8: {icon:"⚖️", label:"業務・投資活動収支", unit:"百万円", group:true,
      desc:"【何を指すか】\n・自治体の「業務活動」と「投資活動」を合わせた収支を表す指標です。プラスなら、通常の行政活動や公共施設などへの投資に必要な収支が黒字、マイナスなら赤字になっています。\n\n📈プラスが大きい理由\n・税収等に対して支出を抑えている\n・必要な投資を先送りしている可能性もあります\n\n📉マイナスの理由\n・大型投資を行った年度だった（学校の建て替えなど、計画的な投資であれば悪いことではありません）\n・収入が支出に追いついていない"},
    ka9: {icon:"🙋", label:"受益者負担比率", unit:"%", group:false,
      desc:"【何を指すか】\n・行政サービスにかかった費用のうち、利用者が使用料や手数料として直接払っている割合。数字が大きいほど、利用者自身が費用を負担していることになります\n\n📈高い理由\n・受益者負担の原則を重視した料金設定\n\n📉低い理由\n・サービスの多くを税金でまかなっている"}
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

    var line = "<span style='color:#6a3de8;'>" + nm + "</span>は" + meta.label + "が" + valHtml + "で、" + scaleWord + "の中央値（" + kkFmt(med, unit) + "）と" + (isSame ? "" : "より") + cmpHtml + "。";
    if (code === "ka8") {
      line += val >= 0 ? "（黒字基調）" : "（赤字基調）";
    }
    if (meta.group) {
      // 区分（grp）自体は総務省の公会計データファイルに同梱の公式「類似団体」区分をそのまま使用。
      // ただし中央値はアプリが算出したもので、総務省が直接公表した数値ではない。
      // また類似団体の所属数は総務省の資料・年度によって異なることがある
      // （区分は数年おきに見直されるため。例：財政指標系の資料は令和4年度区分、当データは令和5年度区分）。
      line += "<div style='font-size:11px;color:#999;margin-top:4px;'>※区分は総務省の類似団体区分（令和5年度公会計データに同梱）を使用。中央値は当アプリで算出しています。区分の対象自治体数は総務省の資料・年度により異なる場合があります。</div>";
    }

    // 財政データの裏付けがある場合、断定しすぎない一言を追加
    if (!isSame && cur) {
      if ((code === "ka4" || code === "ka5") && cur.g != null && cur.g > 0) {
        var goodDirMatch = code === "ka4" ? diff < 0 : diff > 0;
        if (goodDirMatch) {
          line += "<br><br>" + nm + "は人口が増加傾向にあり、" +
            (code === "ka4" ? "積極的な投資による可能性もあります。" : "将来世代への投資という側面もあると考えられます。");
        }
      }
      if ((code === "ka3" || code === "ka8") && cur.eo != null && cur.eo_r1 != null && cur.eo_r1 > 0) {
        var eoGrowth = (cur.eo - cur.eo_r1) / cur.eo_r1;
        var expandMatch = code === "ka3" ? diff < 0 : val < 0;
        if (eoGrowth > 0.05 && expandMatch) {
          line += "<br><br>" + nm + "は歳出が前年より増えており、" +
            (code === "ka3" ? "大型の更新投資を行った可能性があります。" : "計画的な大型投資を行った年度の可能性があります。");
        }
      }
    }

    return line;
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
    var descHtml = meta.desc
      .replace(/【([^】]+)】/g, "<strong style='color:#6a3de8;'>$1</strong>")
      .replace(/。/g, "。\n")
      .replace(/\n{2,}/g, "\n\n")
      .replace(/\n/g, "<br>");
    var cmpHtml = cmpLine ? ("<div style='background:#a08be814;border:1px solid #a08be840;border-radius:12px;padding:12px 14px;font-weight:700;color:#3a2a6e;margin:0 0 14px;'>" + cmpLine + "</div>") : "";
    var ka8NoteHtml = (code === "ka8") ? "<div style='background:#a08be814;border:1px solid #a08be840;border-radius:12px;padding:12px 14px;margin-top:16px;font-size:13px;color:#5a4a80;line-height:1.7;'>自治体の通常の行政活動や公共施設などへの投資に、どれだけお金を使い、どれだけ収入があったかを見る指標です。総務省の「統一的な基準による財務書類」に基づいています。国の「プライマリーバランス」と似た考え方ですが、計算方法は異なります。</div>" : "";
    document.getElementById("shDesc").innerHTML = descHtml + ka8NoteHtml;
    var kkSpWrapEl = document.getElementById("spWrap");
    if (kkSpWrapEl) kkSpWrapEl.style.display = "";

    // 過去分（_r1, _r2, _r3…）が集まったので、他の財政指標と同じ形式で推移グラフを描く
    // _r1が一番古い年、番号が大きいほど新しい年（財政側と統一済み）
    var KK_CURRENT_YEAR = 5; // 令和5年度（総務省の最新公表年度。次回データ更新時に見直す）
    var kkMaxR = 1;
    while (entry[code + "_r" + kkMaxR] != null) { kkMaxR++; }
    kkMaxR--;
    var kkVals = [];
    for (var kri = 1; kri <= kkMaxR; kri++) { kkVals.push(entry[code + "_r" + kri]); }
    kkVals.push(entry[code]);
    var kkCovidNote = "";
    if (kkVals.length >= 2 && kkVals.every(function(v){ return v != null; })) {
      var kkYrLabels = [];
      for (var yi = kkVals.length - 1; yi >= 0; yi--) {
        var yrNum = KK_CURRENT_YEAR - yi;
        kkYrLabels.push(yrNum <= 0 ? ("H" + (30 + yrNum)) : ("R" + yrNum));
      }
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
      if (kkCovidReasonsPeak[code] && kkPeakI !== kkLastI && kkCovidYrsSet[kkYrLabels[kkPeakI]]) {
        kkCovidNote = "<div style='font-size:14px;color:#7a7a90;margin-top:6px;'>📅 "+kkYrLabels[kkPeakI]+"年度が最も高い年です。新型コロナウイルス対応の時期と重なり、"+kkCovidReasonsPeak[code]+"</div>";
      } else if (kkCovidReasonsTrough[code] && kkTroughI !== kkLastI && kkCovidYrsSet[kkYrLabels[kkTroughI]]) {
        kkCovidNote = "<div style='font-size:14px;color:#7a7a90;margin-top:6px;'>📅 "+kkYrLabels[kkTroughI]+"年度が最も低い年です。新型コロナウイルス対応の時期と重なり、"+kkCovidReasonsTrough[code]+"</div>";
      }
      var kkHasCross = (code==="ka4"||code==="ka7"||code==="ka3"||code==="ka1"||code==="ka6");
      var kkTd = kkHasCross ? null : trendDescribe(kkVals[0], kkVals[kkVals.length-1], meta.unit, 1);
      if (kkTd && kkTd.tier !== "横ばい") {
        var kkTrendIcon = kkTd.dir === "増加" ? "📈" : "📉";
        kkCovidNote += "<div style='font-size:14px;color:#7a7a90;margin-top:6px;'>" + kkTrendIcon + " " + meta.label + "はこの" + kkVals.length + "年で" + kkTd.text + "しています。" + "</div>";
      }
      document.getElementById("shTop").innerHTML = cmpHtml + kkCovidNote + kkReciprocalCross(code, entry[code], isPref, entry);
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
    } else {
      document.getElementById("shTop").innerHTML = cmpHtml + kkReciprocalCross(code, entry[code], isPref, entry);
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

  function kkRender(nm, d){
    var body = document.getElementById("kkContent");
    if (!body) return;
    var isPref = (d.p === nm);
    var entry = KK ? KK[nm] : null;
    if (!entry) {
      body.innerHTML = "<p style='text-align:center;color:#a090c8;padding:24px 0;'>\u3053\u306e\u81ea\u6cbb\u4f53\u306e\u516c\u4f1a\u8a08\u30c7\u30fc\u30bf\u306f\u672a\u516c\u8868\u3067\u3059\u3002</p>";
      return;
    }
    var html = "<div style='font-size:12px;color:#a08b64;text-align:center;margin:2px 0 12px;'>📊 公会計データ：令和5年度（総務省公表最新データ）</div>";
    html += kkRadarSvg(nm, entry, isPref, d.p);
    html += "<div class='tap-hint' style='margin-top:20px;'>\ud83d\udcca \u5404\u9805\u76ee\u3092\u30bf\u30c3\u30d7\u3059\u308b\u3068\u8aac\u660e\u304c\u8868\u793a\u3055\u308c\u307e\u3059</div><div class='grid'>";
    KK_ORDER.forEach(function(code){ html += kkBoxHtml(code, entry, isPref); });
    html += "</div><div class='src'>\ud83d\udccb \u7dcf\u52d9\u7701\u300c\u7d71\u4e00\u7684\u306a\u57fa\u6e96\u306b\u3088\u308b\u8ca1\u52d9\u66f8\u985e\u306b\u95a2\u3059\u308b\u8abf\u300d\u4ee4\u548c5\u5e74\u5ea6</div>";
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

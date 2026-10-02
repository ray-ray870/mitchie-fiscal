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
  var TEXT_COLOR_MAP = {"#6dcfad":"#1f7a5c","#7bb8e8":"#2a5a9a","#f0c46a":"#96690a","#f0876a":"#a8502e","#d0505a":"#a02030","#a08be8":"#5a3fa0"};
  /* --- 「比べてみると」の枠に出す、相手の指標の推移（2026-10-02 作り直し）---
     「◯◯の状況」と同じ仕組み（js/data.js の trendJP）で文を作る。
     以前は別の仕組みで作っていて、同じ画面の「状況」が「ほぼ変わりませんでした」なのに、
     枠の中では「増加。〜の方向で推移」と出るなど、食い違うことがあった。
     また、値の無い年を0として比べていたため、始まりの年や向きを間違えることがあった。
     ・その画面の指標の推移は「状況」に書いてあるので、枠には相手の指標の推移だけを出す
     ・最後の動きの向きに合わせて、意味の一文（TREND_MEANING）を添える。横ばいのときは添えない */
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
  function trendWithMeaning(metricKey, text) {
    if (!text) return null;
    var head = text.split("（")[0];
    if (/横ばい|変わりません/.test(head)) return {icon: "➡️", text: text};
    var up = head.lastIndexOf("増") > head.lastIndexOf("減");
    var m = TREND_MEANING[metricKey];
    return {icon: up ? "📈" : "📉", text: text + (m ? "。" + m[up ? "増加" : "減少"] : "")};
  }
  // 公会計の指標の推移の文。label を渡すと「◯◯は、」で始まる
  function kkTrendText(entry, code, label) {
    if (!entry || entry[code] == null) return "";
    var arr = histArr(entry, code, "kk"), pts = [];
    for (var i = 0; i < arr.length; i++) pts.push({y: i, v: arr[i]});   // 0＝平成30年度
    var unit = KK_META[code].unit;
    var fmt = function(x){ return unit === "百万円" ? (x !== 0 && Math.abs(x) < 100 ? (x < 0 ? "-" : "") + (Math.abs(x) * 100).toLocaleString() + "万円" : fmtOku(x / 100)) : (Math.round(x * 10) / 10) + unit; };
    var opt = (code === "ka9") ? {tol:0.3, fmt:fmt} : (unit === "%") ? {tol:1, fmt:fmt} : {tol:0.03, rel:true, fmt:fmt};
    if (code === "ka8") opt = {tol:Math.max(Math.abs(entry[code]) * 0.1, 10), fmt:fmt};
    opt.label = label;
    return trendJP(pts, opt);
  }
  // 財政の指標の推移の文（「◯◯の状況」と同じ幅で「横ばい」を判定する）
  function finTrendText(e, field) {
    var pct1 = function(v){ return (Math.round(v * 10) / 10).toFixed(1) + "%"; };
    if (field === "u") {
      var t = situationTrend(e, "u", {tol:2, fmt:pct1}, true);
      return (t && t.indexOf("0.0%〜0.0%") >= 0) ? "" : t;   // ずっと実質ゼロなら出さない
    }
    if (field === "d") return situationTrend(e, "d", {tol:0.3, fmt:pct1});
    if (field === "r") return situationTrend(e, "r", {tol:0.05, rel:true, times:true, fmt:function(v){ return fmtOku(v); }});
    return "";
  }
  // 公会計の値が、全国（都道府県は都道府県）の中央値と比べてどうか。差が10%以内は「ほぼ同水準」
  function kkMedianJudge(kkVal, med) {
    return Math.abs(kkVal - med) <= med * 0.1 ? "全国の中央値とほぼ同水準" : kkVal > med ? "全国の中央値より高め" : "全国の中央値より低め";
  }

  // 人口の少ない市区町村（pop が maxPop 未満）の中央値（万円）。「人口が少ないと1人あたりが大きく出る」の裏づけの数字
  function smallPopMed(getter, maxPop) {
    var arr = [];
    Object.keys(DB).forEach(function(k){ var e = DB[k]; if (e.__pref || e.pop == null || e.pop >= maxPop) return; var v = getter(k); if (typeof v === "number" && !isNaN(v)) arr.push(v); });
    arr.sort(function(a, b){ return a - b; });
    if (!arr.length) return "－";
    var m = Math.floor(arr.length / 2), med = arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
    return med.toFixed(1);
  }
  var KK_CROSSCHECK_CAVEAT = "<div style='background:rgba(160,139,232,0.08);border-radius:10px;padding:12px 14px;margin-top:10px;'>" +
    "<div style='font-size:15px;color:#6b5b80;line-height:1.7;'>起債計画や基金の使い方によって、この2つの指標の動き方は自治体ごとに大きく異なります。この自治体の具体的な背景は、自治体の実施計画や財政状況資料集で確認できます。</div>" +
    "<div style='font-size:14px;color:#888;margin-top:6px;line-height:1.6;'>※「軽め」「重め」「高め」「低め」は総務省の公式区分ではなく、当アプリが分かりやすさのために設けた独自の目安です。</div>" +
    "</div>";
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
        ? "施設の古さは全国並み（平均して耐用年数の約" + wari + "割）ですが、将来に残る負担は重めです。すでに借金などの負担を多く抱えている状態です。"
        : "施設の古さは全国並み（平均して耐用年数の約" + wari + "割）で、将来に残る負担は" + uWord + "です。全国と同じくらい古くなってきた施設を抱えながら、将来への負担は重くない状態です。";
      if (kkHi) return uHeavy
        ? "施設は" + than + "古く（平均して耐用年数の約" + wari + "割）、将来に残る負担もすでに重めです。これからの建て替えを借金でまかなうと、将来負担はさらに増えます。"
        : "将来に残る負担は" + uWord + "ですが、施設は" + than + "古くなっています（平均して耐用年数の約" + wari + "割）。耐用年数に近い施設が多く、建て替えの費用を借金でまかなうと、将来負担は増えていきます。";
      return uHeavy
        ? "施設は" + than + "新しい一方で、将来に残る負担は重めです。耐用年数まで余裕のある施設が多い一方、借金などの返済が続きます。"
        : "施設は" + than + "新しく、将来に残る負担も" + uWord + "です。比較的新しい施設が、将来への重い負担としては残っていない状態です。";
    }
    if (code === "ka1") {
      if (kkNear) return uHeavy
        ? "住民1人あたりの資産は全国並みですが、将来に残る負担は重めです。資産の量が同じくらいの自治体と比べて、借金などの負担が大きい状態です。"
        : "住民1人あたりの資産は全国並みで、将来に残る負担は" + uWord + "です。持っている資産の量に見合わない、重い負担は残っていない状態です。";
      if (kkHi) return uHeavy
        ? "住民1人あたりの資産は" + times() + "多く、将来に残る負担も重めです。施設の維持・更新の費用と、借金などの返済の両方を、住民1人あたりで見ると多く抱えている状態です。"
        : "住民1人あたりの資産は" + times() + "多い一方、将来に残る負担は" + uWord + "です。多くの資産を持っていますが、将来への重い負担は残っていません。ただし、資産が多いほど、その維持・更新の費用は大きくなります。";
      return uHeavy
        ? "住民1人あたりの資産は" + than + "少ないのに、将来に残る負担は重めです。持っている資産に比べて、借金などの負担が大きい状態です。"
        : "住民1人あたりの資産は" + than + "少なく、将来に残る負担も" + uWord + "です。施設の維持・更新の費用も、借金などの返済も、住民1人あたりで見ると小さい状態です。";
    }
    if (code === "ka6") {
      var smallPop = !isPref && cur.pop != null && cur.pop < 10000 ? "人口が少ないと、1人あたりの費用は大きく出ます（人口1万人未満の自治体の中央値は" + smallPopMed(function(k){ return KK[k] && KK[k].ka6; }, 10000) + "万円、全国は" + KK_MEDIANS.ka6.muni.toFixed(1) + "万円）。" : "";
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
        : "住民1人あたりの負債は全国並みですが、毎年の返済は" + dl + "です。負債の残高に比べて毎年の返済が大きいということです。一般に、返済期間が短い借金が多いと、こうなります。";
      if (kkHi) return dLight
        ? "住民1人あたりの負債は" + times() + "多いのに、毎年の返済は" + (dl === "軽め" ? "軽い" : "標準的な") + "状態です。負債の残高に比べて毎年の返済が" + (dl === "軽め" ? "小さい" : "大きくない") + "ということです。一般に、返済期間が長い借金や、返済の一部が国の交付税で補われる借金が多いと、こうなります。"
        : "住民1人あたりの負債が" + times() + "多く、毎年の返済も" + dl + "です。返済にあてるお金が多い分、ほかの事業に回せるお金は少なくなります。";
      return dLight
        ? "住民1人あたりの負債は" + than + "少なく、毎年の返済も" + (dl === "軽め" ? "軽い" : "標準的な") + "状態です。返済にあてるお金が少ない分、ほかの事業にお金を回しやすくなっています。"
        : "住民1人あたりの負債は" + than + "少ないのに、毎年の返済は" + dl + "です。負債の残高に比べて毎年の返済が大きいということです。一般に、返済期間が短い借金が多いと、こうなります。";
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

  // 将来負担比率 ×（老朽化率・資産額・行政コスト）の枠。財政タブ・公会計タブの両方から呼ばれる
  function buildFutureComboBox(code, kkVal, isPrefView, curObj, entry, reverseOrder, boxNumber) {
    if (kkVal == null) return "";   // 将来負担比率が「－」（負担なし）の団体も表示する（2026-09-30）
    var m = KK_META[code];
    var med = isPrefView ? KK_MEDIANS[code].pref : KK_MEDIANS[code].muni;
    var numMark = boxNumber ? ["①","②","③","④","⑤"][boxNumber-1] || "" : "";
    var heading = reverseOrder ? ("🔗 財政と比べてみると" + numMark) : ("🔗 公会計と比べてみると" + numMark);
    return kkCrossBox(heading,
      "将来負担比率", (curObj.u == null || curObj.u <= 0) ? "0%（負担なし）" : curObj.u+"%", futureLevelLabel(curObj.u, isPrefView),
      m.label, kkVal+m.unit, kkMedianJudge(kkVal, med),
      crossInsight(code, curObj, entry, isPrefView),
      reverseOrder,
      reverseOrder ? "将来負担比率" : m.label,
      reverseOrder ? trendWithMeaning("u", finTrendText(curObj, "u")) : trendWithMeaning(code, kkTrendText(entry, code, "")));
  }
  // trendLabel・trend：相手の指標の名前と、その推移（trendWithMeaning の結果）
  function kkCrossBox(heading, zaiLabel, zaiVal, zaiJudge, kkLabel, kkVal, kkJudge, analysisText, reverse, trendLabel, trend) {
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
    var trendHtml = trend ? "<div style='margin-top:12px;padding-top:10px;border-top:1px dashed #6dcfad55;'>" +
      "<div style='font-size:15px;color:#3a5a4a;line-height:1.7;'>" + trend.icon + " <strong>" + trendLabel + "</strong>：" + trend.text + "</div></div>" : "";
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
      return kkCrossBox("🔗 財政と比べてみると", "財政調整基金残高", ratioRec.toFixed(1)+"%", reserveLevelLabel(ratioRec, isPref),
        "純資産比率", entryV+"%", kkMedianJudge(entryV, isPref ? KK_MEDIANS.ka4.pref : KK_MEDIANS.ka4.muni),
        crossInsight("ka4", cur, entry, isPref), true, "財政調整基金残高", trendWithMeaning("r", finTrendText(cur, "r"))) + KK_CROSSCHECK_CAVEAT;
    }
    if (code === "ka7" && cur.d != null) {
      return kkCrossBox("🔗 財政と比べてみると", "実質公債費比率", cur.d+"%", debtLevelLabel(cur.d, isPref),
        "住民一人当たり負債額", entryV+"万円", kkMedianJudge(entryV, isPref ? KK_MEDIANS.ka7.pref : KK_MEDIANS.ka7.muni),
        crossInsight("ka7", cur, entry, isPref), true, "実質公債費比率", trendWithMeaning("d", finTrendText(cur, "d"))) + KK_CROSSCHECK_CAVEAT;
    }
    if (code === "ka3" || code === "ka1" || code === "ka6") {
      var boxHtmlRec = buildFutureComboBox(code, entryV, isPref, cur, entry, true);
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
      desc:"行政サービスにかかった費用から、使用料などの収入を差し引いた額（純行政コスト）を、住民の数で割った金額です。\n\n## 🧮 費用に含まれるもの\n・人件費（職員の給与など）\n・物件費（施設の維持管理費・光熱費など）\n・扶助費（生活保護・児童手当などの給付）\n・減価償却費（建物や道路が古くなった分の目減り）\n・退職手当引当金繰入額（将来払う退職金の積み立て分）など\n\n## 📏 見方\n・人口が少ない自治体ほど、1人あたりでは大きく出ます\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka7: {icon:"💳", label:"住民一人当たり負債額", unit:"万円", group:true,
      desc:"自治体の負債（借金など）の合計を、住民の数で割った金額です。\n\n## 🧮 負債に含まれるもの\n・地方債（借金の残高）※臨時財政対策債を含む\n・退職手当引当金（将来払う退職金の見込み）\n・未払金など\n\n## 📏 見方\n・人口が少ない自治体ほど、1人あたりでは大きく出ます\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka8: {icon:"⚖️", label:"業務・投資活動収支", unit:"百万円", group:true,
      desc:"業務活動収支（毎年の行政活動のお金の出入り）と、投資活動収支（施設の整備など）を合わせた収支です。\n\n## 📏 見方\n・プラス → その年の収入で、行政活動と投資をまかなえた\n・マイナス → 差を、借入金や前年度からの手元の資金で補った\n・貯金（基金）への積み立てと取り崩し、借金の利息の支払いは除いて計算します\n・学校の建て替えなど大きな投資をした年は、マイナスになりやすくなります\n・出典：総務省 統一的な基準による財務書類（{KY}）"},
    ka9: {icon:"🙋", label:"受益者負担比率", unit:"%", group:false,
      desc:"行政サービスにかかった費用のうち、利用する人が使用料や手数料として払っている割合です。\n\n## 📏 見方\n・数字が大きいほど、利用する人自身が費用を負担しています\n・残りは、税金や国からのお金などでまかなわれています\n・出典：総務省 統一的な基準による財務書類（{KY}）"}
  };
  var KK_ORDER = ["ka1","ka2","ka3","ka4","ka5","ka6","ka7","ka8","ka9"];

  function kkFmt(v, unit){
    if (v == null) return "―";
    if (unit === "百万円") {
      // 1億円未満は「-0.0億円」にならないよう、万円で出す（2026-10-01）
      if (v !== 0 && Math.abs(v) < 100) return (v > 0 ? "+" : "-") + (Math.abs(v) * 100).toLocaleString() + "万円";
      var oku = v / 100;
      return (oku>=0?"+":"") + fmtOku(oku);
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
  function kkSituationExtra(code, entry) {
    var v = entry[code];
    if (v == null) return "";
    var meta = KK_META[code];
    var trend = kkTrendText(entry, code, meta.label);
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
      ? "その年度は、行政サービス・施設整備などの支出が収入を上回り、差を借入金や手元の資金で補った状態です"
      : "その年度は、行政サービス・施設整備などを、その年の収入でまかなえた状態です";
    if (code === "ka9") mean = "費用の残り約" + (Math.round((100 - v) * 10) / 10) + "%は、税金や国からのお金などでまかなわれている状態です";
    var S = "font-size:16px;color:#2a2a3a;line-height:1.8;";
    return (trend ? "<div style='" + S + "'>" + trend + "。</div>" : "") +
      (fact ? "<div style='" + S + "'>" + fact + "</div>" : "") +
      (mean ? "<div style='font-size:16px;font-weight:700;color:#3a2a6e;line-height:1.7;margin-top:8px;'>→ " + mean + "</div>" : "");
  }

  function kkOpenDetail(code, skipPush){
    if (typeof hkRestoreChart === "function") hkRestoreChart();   // グラフを元の位置へ戻す（2026-10-02）
    setChartLegend("", false);
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
      "<div style='font-size:16px;color:#2a2a3a;line-height:1.8;'>" + cmpLine + "</div>" + kkSituationExtra(code, entry) + (typeof mitchieHitokoto === "function" ? mitchieHitokoto(code, nm, isPref) + HK_CHART_SLOT : "") + "</div>") : "";   // みっちーのひと言（2026-10-02）：状況のすぐ下
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
    // 3年以上続けて無い場合は「平成30年度〜令和4年度」のようにまとめる
    var kkMissingContig = kkMissingNums.length >= 3 && kkMissingNums[kkMissingNums.length - 1] - kkMissingNums[0] === kkMissingNums.length - 1;
    var kkMissingText = kkMissingContig ? (kkMissingYrs[0] + "〜" + kkMissingYrs[kkMissingYrs.length - 1]) : kkMissingYrs.join("・");
    var kkMissingNote = kkMissingYrs.length ?
      ("<div style='font-size:14px;color:#7a7a90;line-height:1.6;margin-top:8px;'>ℹ️ " + kkMissingText +
       "は、総務省の公表データに" + escapeHtml(nm) + "の値が無いため、グラフに表示していません。</div>") : "";
    if (kkVals.length >= 2) {
      document.getElementById("shTop").innerHTML = missingHtml + cmpHtml + kkReciprocalCross(code, entry[code], isPref, entry); if (typeof hkPlaceChart === "function") hkPlaceChart();
      var kkC = kkColor(code, entry[code], entry, isPref);
      var kkCText = TEXT_COLOR_MAP[kkC] || kkC;
      var Wk=300, Hk=100, Pk=20, PtopK=26;
      // 全国の中央値（その年度ごと）。_r1＝平成30年度…、主値＝最新年度（2026-10-01）
      var kkMedVals = kkYrLabels.map(function(lbl){
        var yy = chartYearOf(lbl); if (yy == null) return null;
        var arr = [];
        Object.keys(KK).forEach(function(n){
          if (n.charAt(0) === "_" || !DB[n] || (DB[n].p === n) !== isPref) return;
          var v = yy === KK_CURRENT_YEAR ? KK[n][code] : KK[n][code + "_r" + (yy + 1)];
          if (typeof v === "number") arr.push(v);
        });
        arr.sort(function(a, b){ return a - b; });
        return arr.length ? (arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2) : null;
      });
      var kkMedValid = kkMedVals.filter(function(v){ return v != null; });
      var kkScale = kkVals.concat(kkMedValid);
      var kkMn=Math.min.apply(null,kkScale), kkMx=Math.max.apply(null,kkScale), kkRng=(kkMx-kkMn)||1;
      function pxk(i){ return Pk+(i/(kkVals.length-1))*(Wk-Pk*2); }
      function pyk(v){ return Hk-Pk-((v-kkMn)/kkRng)*(Hk-PtopK-Pk); }
      var kkLine="M"+pxk(0)+","+pyk(kkVals[0]);
      for (var ki=1; ki<kkVals.length; ki++){ kkLine+=" L"+pxk(ki)+","+pyk(kkVals[ki]); }
      var kkDots = "";
      for (var kj=0; kj<kkVals.length; kj++){
        var kkLast = kj === kkVals.length-1;
        kkDots += "<circle cx='"+pxk(kj)+"' cy='"+pyk(kkVals[kj])+"' r='"+(kkLast?5:3)+"' fill='"+(kkLast?kkC:"white")+"' stroke='"+kkC+"' stroke-width='2'/>";
        var kkPrevV = kj>0 ? kkVals[kj-1] : null;
        var kkNextV = kj<kkVals.length-1 ? kkVals[kj+1] : null;
        var kkIsValley = (kkPrevV==null || kkVals[kj]<=kkPrevV) && (kkNextV==null || kkVals[kj]<=kkNextV) && (kkPrevV!=null || kkNextV!=null);
        // 単位（万円・億円の「円」）は最新の値だけに付ける（全部に付けると、隣の数字と重なって読めないため）
        var kkLbl = kkFmt(kkVals[kj], meta.unit);
        if (!kkLast) kkLbl = meta.unit === "万円" ? String(kkVals[kj]) : meta.unit === "百万円" ? kkLbl.replace(/円$/, "") : kkLbl;
        var kkAnchor = "middle";
        if (kkLast && kkIsValley) kkDots += "<text x='"+pxk(kj)+"' y='"+(pyk(kkVals[kj])+19)+"' text-anchor='"+kkAnchor+"' font-size='12' fill='"+kkCText+"' font-weight='700'>"+kkLbl+"</text>";
        else if (kkLast) kkDots += "<text x='"+pxk(kj)+"' y='"+(pyk(kkVals[kj])-9)+"' text-anchor='"+kkAnchor+"' font-size='12' fill='"+kkCText+"' font-weight='700'>"+kkLbl+"</text>";
        else if (kkIsValley) kkDots += "<text x='"+pxk(kj)+"' y='"+(pyk(kkVals[kj])+16)+"' text-anchor='"+kkAnchor+"' font-size='9' fill='"+kkCText+"' opacity='0.9'>"+kkLbl+"</text>";
        else kkDots += "<text x='"+pxk(kj)+"' y='"+(pyk(kkVals[kj])-8)+"' text-anchor='"+kkAnchor+"' font-size='9' fill='"+kkCText+"' opacity='0.9'>"+kkLbl+"</text>";
      }
      var kkNoteText = "※総務省「統一的な基準による財務書類に関する情報」の指標一覧より";
      var kkSpSvg = document.getElementById("spSvg");
      kkSpSvg.setAttribute("viewBox","0 0 "+Wk+" "+Hk);
      kkSpSvg.style.height=Hk+"px";
      var kkCovid = covidBandSvg(kkYrLabels, pxk, Wk, 4, Hk, false);
      var kkMedHtml = "";
      if (kkMedValid.length >= 2) {
        var kkML = "";
        kkMedVals.forEach(function(v, i){ if (v == null) return; kkML += (kkML ? " L" : "M") + pxk(i) + "," + pyk(v); });
        kkMedHtml = "<path d='" + kkML + "' fill='none' stroke='#9a96a8' stroke-width='1.5' stroke-dasharray='4,3'/>";
      }
      setChartLegend(kkMedHtml ? (isPref ? "全国の都道府県の中央値" : "全国の市区町村の中央値") : "", !!kkCovid);
      kkSpSvg.innerHTML = kkCovid + kkMedHtml + "<path d='"+kkLine+"' fill='none' stroke='"+kkC+"' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>"+kkDots;
      var kkYrLabelsHtml = kkYrLabels.map(function(y,i){
        var pct = (Pk+(i/(kkYrLabels.length-1))*(Wk-Pk*2))/Wk*100;
        return "<span style='left:"+pct+"%;'>"+y+"</span>";
      }).join("");
      document.getElementById("spLabels").innerHTML = "<div style='position:relative;height:100%;'>"+kkYrLabelsHtml+"</div><div style='font-size:9px;color:#aaa;margin-top:6px;'>"+kkNoteText+"</div>";
      // グラフの枠のすぐ下（説明文の先頭）に、公式データが無い年の注記を出す
      if (kkMissingNote) document.getElementById("shDesc").insertAdjacentHTML("afterbegin", kkMissingNote.replace("margin-top:8px;", "margin:-4px 0 12px;"));
    } else {
      document.getElementById("shTop").innerHTML = missingHtml + cmpHtml + kkReciprocalCross(code, entry[code], isPref, entry) + kkMissingNote; if (typeof hkPlaceChart === "function") hkPlaceChart();
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
      "<svg width='24' height='6' style='display:inline-block;vertical-align:middle;'><line x1='1' y1='3' x2='23' y2='3' stroke='#6b6862' stroke-width='2' stroke-dasharray='4,3'/></svg> 比較基準<br>（全国の中央値。収支は±0の線）</span>" +
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
         業務・投資活動収支＝行政サービス（業務活動）と、施設整備など（投資活動）を合わせた収支。
                           基金への積み立て・取り崩しと、借金の利息の支払いは除いて計算する（総務省の指標の定義）。
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
    if (debtLine) bullets.push({icon:"🏦", t:debtLine, p:1});

    // 施設の古さ（有形固定資産減価償却率）
    if (a3 !== 0 && ka3 != null) {
      var wari = "約" + Math.round(ka3 / 10) + "割";
      bullets.push({icon:"🏚️", t: a3 > 0 ? "施設は平均して耐用年数の" + wari + "が過ぎていて、" + than + "古くなっています"
                                           : "施設は" + than + "新しめです（平均して耐用年数の" + wari + "が経過）", p:2});
    }

    // 財政タブとの組み合わせ（両方から言えることがはっきりある場合だけ）
    var finLine = null;
    // 並び順：借金の割合（1）→ それを受けた財政タブの一言（1.5）→ 施設の古さ（2）→ その年の収支（3）
    if (debtBig && dLight) finLine = {icon:"💳", t:"ただし、毎年の借金返済の重さ（実質公債費比率）は軽い水準です", p:1.5};
    else if (debtBig && dHeavy) finLine = {icon:"💳", t:"毎年の借金返済の重さ（実質公債費比率）も重い水準です", p:1.5};
    else if (debtSmall && xHeavy) finLine = {icon:"📊", t:"一方、毎年の収入の約" + Math.round(d.x) + "%が決まった支出に回っています（経常収支比率）", p:1.5};
    if (finLine) bullets.push(finLine);

    // その年の収支（業務・投資活動収支）
    if (ka8 != null) {
      bullets.push({icon:"⚖️", t: ka8 < 0
        ? fillYears("{KY}") + "は、行政サービス・施設整備などの支出が収入を上回り、差を借入金や手元の資金で補いました"
        : fillYears("{KY}") + "は、行政サービス・施設整備などを、その年の収入でまかなえています", p:3});
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
    var kkSrc = {}, finSrc = {};
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
    kkRender(nm, d);   // kokaikei.json は起動時に読み込み済み
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

  /* --- 項目の詳細画面の「みっちーチェック」（2026-10-02。旧「みっちーのひと言」）---
     2つの指標を合わせて初めて言えることを、①事実 ②だから ③そうなると の3行で伝える。
     ルール：
       ・その画面の指標の「高め・低め」は繰り返さない（相手の指標の話から始める）
       ・数字は出さない（どちらも画面にあるため）
       ・②③は指標の仕組みから言えることだけ（街ごとの事情の推測は書かない）
       ・条件に当てはまらない自治体には出さない
     比べ方は各画面と同じ：財政の指標＝似ている自治体（無ければ全国）の中央値、
     施設の古さ＝全国の中央値、住民一人当たり資産額＝類似団体の中央値 */
  function hkCmp(name, isPref, getter, statKey, tol) {
    var v = getter(name);
    if (v == null || isNaN(v)) return null;
    var pi = peerInfo(name, isPref), med = null;
    if (pi) med = peerMedian(peerVals(pi, getter));
    if (med == null) {
      if (statKey && DATA_STATS[statKey]) med = DATA_STATS[statKey][isPref ? "pref" : "muni"];
      else {
        var all = Object.keys(DB).filter(function(k){ return !!DB[k].__pref === !!isPref; }).map(getter).filter(function(x){ return typeof x === "number" && !isNaN(x); });
        med = peerMedian(all);
      }
    }
    if (med == null) return null;
    return peerCmp(v, med, typeof tol === "function" ? tol(med) : tol);
  }
  function hkStates(name, isPref) {
    var kk = (typeof KK !== "undefined" && KK && KK[name]) ? KK[name] : null;
    var s = {};
    s.x = hkCmp(name, isPref, function(k){ return DB[k].x; }, "x", 1);
    s.f = hkCmp(name, isPref, function(k){ return DB[k].f; }, "f", 0.01);
    s.d = hkCmp(name, isPref, function(k){ return DB[k].d; }, "d", 0.3);
    // 将来負担比率：「－」（実質ゼロ）の自治体も0として数える（将来負担比率の画面と同じ比べ方。
    // 2026-10-02：以前は実質ゼロの自治体を除いて比べていたため、画面どうしで「多め」「少なめ」が食い違うことがあった）。
    // 比べる相手の半数以上が実質ゼロのときは、中央値は0。自分が実質ゼロのときは出さない
    s.u = (DB[name].u == null || DB[name].u <= 0) ? null
        : hkCmp(name, isPref, function(k){ var e = DB[k]; return (e.u == null || e.u <= 0) ? 0 : e.u; }, null, 2);
    s.r = hkCmp(name, isPref, function(k){ var e = DB[k]; return (e.sfs && e.sfs > 0 && e.r != null) ? e.r / e.sfs * 100 : null; }, null, function(m){ return m * 0.05; });
    // 実質公債費比率がカードで緑（10%未満＝返済の負担が軽い）かどうか
    s.dLight = DB[name].d != null && colorD(DB[name].d) === "#6dcfad";
    /* 「多め・少なめ」などと言ってよいか（2026-10-02）：
       似ている自治体と比べた結果が、トップ画面のカードの色（国の基準や目安から見た水準）と逆のときは言わない。
       例：貯金が似ている自治体より少なめでも、カードが緑（厚めに備えている）なら「貯金も少なめだね→借金をすることになる」とは言えない */
    var e0 = DB[name], G = "#6dcfad", B = "#7bb8e8";
    var cR = (e0.sfs && e0.sfs > 0 && e0.r != null) ? colorR(e0.r / e0.sfs * 100, isPref) : null;
    var cX = e0.x != null ? colorX(e0.x) : null, cF = e0.f != null ? colorF(e0.f) : null;
    s.rLo = s.r === "lo" && cR !== G;                 // 貯金が少なめ（カードが緑でない）
    s.rHi = s.r === "hi" && (cR === G || cR === B);   // 貯金が多め（カードが緑・青）
    s.xHi = s.x === "hi" && cX !== G;                 // 決まって出ていくお金の割合が高め（緑でない）
    s.xLo = s.x === "lo" && (cX === G || cX === B);   // 低め＝余裕が多め（緑・青）
    s.fLo = s.f === "lo" && cF !== G;                 // 税収などでまかなえる割合が低め（緑でない）
    s.fHi = s.f === "hi" && (cF === G || cF === B);   // 高め（緑・青）
    s.ka3 = null; s.ka3x = null; s.ka1 = null; s.ka8neg = false; s.ka8pos = false;
    if (kk) {
      var b = isPref ? "pref" : "muni";
      if (kk.ka3 != null && KK_MEDIANS.ka3) { var m3 = KK_MEDIANS.ka3[b]; s.ka3 = Math.abs(kk.ka3 - m3) <= m3 * 0.05 ? "same" : kk.ka3 > m3 ? "hi" : "lo"; }
      // 将来負担比率の画面は、同じ画面の「公会計と比べてみると」と判定をそろえる（全国の中央値との差が10%以内は「全国並み」）
      if (kk.ka3 != null && KK_MEDIANS.ka3) { var q3 = kk.ka3 / KK_MEDIANS.ka3[b]; s.ka3x = q3 > 1.1 ? "hi" : q3 < 0.9 ? "lo" : "same"; }
      var gm = KK._groupMedians && KK._groupMedians[b] && kk.grp ? KK._groupMedians[b][kk.grp] : null;
      if (kk.ka1 != null && gm && gm.ka1 != null && gm._n > 1) s.ka1 = Math.abs(kk.ka1 - gm.ka1) <= Math.abs(gm.ka1) * 0.05 ? "same" : kk.ka1 > gm.ka1 ? "hi" : "lo";
      s.ka8neg = kk.ka8 != null && kk.ka8 < 0;
      s.ka8pos = kk.ka8 != null && kk.ka8 >= 0;   // 画面の「（その年度は黒字）」と同じ判定
    }
    return s;
  }
  // [①事実, ②だから, ③そうなると（つなぎの言葉つき）]
  function hkLines(key, s) {
    var R = "貯金（財政調整基金）", U = "これから返す分（将来負担比率）", A3 = "（有形固定資産減価償却率）", A1 = "（住民一人当たり資産額）";
    var X = "毎年決まって出ていくお金の割合（経常収支比率）", F = "税収などでまかなえる割合（財政力指数）";
    // ②③の文は、同じ組み合わせなら、どの画面でも同じ文を使う
    var T_SHORT = ["急にお金が必要になったら、ほかの予算を回すか、借金をすることになるよ。", ["そうなると", "予定していたサービスや工事が先送りになったり、将来の返済が増えたりするんだ。"]];
    var T_SAVE  = ["急な出費は貯金から出せるよ。", ["でも", "使った分だけ貯金は減るから、毎年の決まった支払いには使い続けられないんだ。"]];
    var T_ROOM  = ["急な出費は、新しいことに回せるお金の中から出すことになるよ。", ["そうなると", "その年は、新しいことを始めにくくなるんだ。"]];
    var T_BOTH  = ["急な出費があっても、新しいことに回せるお金と貯金の両方から出せるよ。", ["でも", "どちらも使えば減るし、決まった支払いが増えると、新しいことに回せるお金は少なくなるんだ。"]];
    var T_GRANT = ["国の交付金の額が変わると、街の予算がそのまま動きやすいよ。", ["そうなると", "交付金が減った年は、サービスや工事を見直すことになるんだ。"]];
    var T_GSAVE = ["国の交付金が減った年は、貯金で差を埋められるよ。", ["でも", "貯金は使えば減るから、ずっとは埋め続けられないんだ。"]];
    var T_TAX   = ["税収が減った年は、ほかの予算を回すか、借金をすることになるよ。", ["そうなると", "予定していたサービスや工事が先送りになったり、将来の返済が増えたりするんだ。"]];
    var T_TSAVE = ["税収が減った年は、貯金で差を埋められるよ。", ["でも", "貯金は使えば減るから、ずっとは埋め続けられないんだ。"]];
    var L = function(first, t){ return [first, t[0], t[1]]; };
    if (key === "flex") {
      if (s.xHi && s.rLo) return L(R + "も少なめだね", T_SHORT);
      if (s.xHi && s.rHi) return L(R + "は多めだね", T_SAVE);
      if (s.xLo && s.rLo) return L(R + "は少なめだね", T_ROOM);
      if (s.xLo && s.rHi) return L(R + "も多めだね", T_BOTH);
    }
    if (key === "fiscalPower") {
      if (s.fLo && s.rLo) return L(R + "も少なめだね", T_GRANT);
      if (s.fLo && s.rHi) return L(R + "は多めだね", T_GSAVE);
      if (s.fHi && s.rLo) return L(R + "は少なめだね", T_TAX);
      if (s.fHi && s.rHi) return L(R + "も多めだね", T_TSAVE);
    }
    // 財政調整基金の画面：経常収支比率との組み合わせを先に、無ければ財政力指数との組み合わせ
    if (key === "reserve") {
      if (s.rLo && s.xHi) return L(X + "も高めだね", T_SHORT);
      if (s.rHi && s.xHi) return L(X + "は高めだね", T_SAVE);
      if (s.rLo && s.xLo) return L(X + "は低めだね", T_ROOM);
      if (s.rHi && s.xLo) return L(X + "は低めだね", T_BOTH);
      if (s.rLo && s.fLo) return L(F + "も低めだね", T_GRANT);
      if (s.rHi && s.fLo) return L(F + "は低めだね", T_GSAVE);
      if (s.rLo && s.fHi) return L(F + "は高めだね", T_TAX);
      if (s.rHi && s.fHi) return L(F + "も高めだね", T_TSAVE);
    }
    if (key === "debt") {
      // 「返済に回る分が大きい状態」と言えるのは、返済の負担が軽い（カードが緑）とは言えないときだけ
      // （2026-10-02：似ている自治体より高めでも、10%未満なら同じ画面の「状況」は「余裕があります」なので出さない）
      if (s.d === "hi" && s.u === "hi" && !s.dLight) return [U + "も多めだね", "収入のうち返済に回る分が大きい状態が、この先も続くよ。", ["そうなると", "新しいサービスや施設に回せるお金が少ない年が続くんだ。"]];
      if (s.d === "hi" && s.u === "lo") return [U + "は少なめだね", "新しく借りなければ、返済に回る分は小さくなっていくよ。", ["そうなると", "その分をほかのことに使えるようになるんだ。"]];
      // 返済が似ている自治体より低め、または返済の負担が軽い（カードが緑）のに、これから返す分は多め
      if ((s.d === "lo" || s.dLight) && s.u === "hi") return [U + "は多めだね", "この先、返済などに回すお金が必要になるよ。", ["そうなると", "今ほかに使えているお金が、その分減るんだ。"]];
    }
    if (key === "future") {
      if (s.u === "hi" && s.ka3x === "hi") return ["施設も古め" + A3 + "だね", "建て替えるなら、今ある借金などに上乗せすることになるよ。", ["そうなると", "毎年の返済が増えて、子育てや道路などに使えるお金がその分減るんだ。"]];
      if (s.u === "hi" && s.ka3x === "lo") return ["施設は新しめ" + A3 + "だね", "建て替えのお金は当面かかりにくいけど、返済は続くよ。", ["その間は", "収入の一部が返済に回り続けるんだ。"]];
      if (s.u === "hi" && s.ka3x === "same") return ["施設の古さは全国並み" + A3 + "だね", "建て替えや修理のお金は、これからかかるよ。", ["そうなると", "今ある借金などに上乗せするか、ほかの予算を回すことになるんだ。"]];
      if (s.u === "lo" && s.ka3x === "lo") return ["施設も新しめ" + A3 + "だね", "建て替えのお金は当面かかりにくいよ。", ["その間は", "建て替えのための借金を増やさずにすむんだ。"]];
      if (s.u === "lo" && s.ka3x === "hi") return ["施設は古め" + A3 + "だね", "建て替えや修理のお金がこれからかかるよ。", ["そうなると", "新しく借りるか、ほかの予算を回すか、施設を減らすかを選ぶことになるんだ。"]];
    }
    var A3F = "施設も古め" + A3 + "だね";
    var T_REBUILD = ["全部を建て替えると、たくさんのお金がかかるよ。", ["そうなると", "どの施設を残して、どれをまとめるか・やめるかを決めることになるんだ。街の「公共施設等総合管理計画」に書いてあるよ。"]];
    if (key === "ka3" && s.ka3 === "hi") {
      if (s.ka1 === "hi") return L("持っている施設やインフラも多め" + A1 + "だね", T_REBUILD);
      if (s.ka1 === "lo") return ["持っている施設やインフラは少なめ" + A1 + "だね", "建て替えが必要になる数は、多く持つ街より少ないよ。", ["それでも", "古くなった分の修理や建て替えのお金はかかるんだ。"]];
    }
    if (key === "ka3" && s.ka3 === "lo") {
      if (s.ka1 === "hi") return ["持っている施設やインフラは多め" + A1 + "だね", "建て替えは当面少なくても、毎年の手入れのお金は多くかかるよ。", ["そうなると", "年がたてば古くなって、建て替えのお金が多くかかるんだ。"]];
      if (s.ka1 === "lo") return ["持っている施設やインフラは少なめ" + A1 + "だね", "建て替えや手入れのお金は、多く持つ街より少ないよ。", ["それでも", "年がたてば古くなって、建て替えのお金はかかるんだ。"]];
    }
    // 住民一人当たり資産額の画面：施設の古さ（全国の中央値と比べる）との組み合わせ
    if (key === "ka1") {
      if (s.ka1 === "hi" && s.ka3 === "hi") return L(A3F, T_REBUILD);
      if (s.ka1 === "hi" && s.ka3 === "lo") return ["施設は新しめ" + A3 + "だね", "建て替えのお金は当面かかりにくいよ。", ["でも", "持っている数が多い分、毎年の手入れのお金は多くかかるんだ。"]];
      if (s.ka1 === "lo" && s.ka3 === "hi") return ["施設は古め" + A3 + "だね", "建て替えや修理のお金がこれからかかるよ。", ["それでも", "建て替えが必要になる数は、多く持つ街より少ないんだ。"]];
      if (s.ka1 === "lo" && s.ka3 === "lo") return ["施設も新しめ" + A3 + "だね", "建て替えのお金は当面かかりにくいよ。", ["それに", "持っている数も少ないから、毎年の手入れのお金も少なめなんだ。"]];
    }
    // 業務・投資活動収支の画面：貯金との組み合わせ
    if (key === "ka8") {
      if (s.ka8neg && s.rLo) return [R + "も少なめだね", "足りない分は借金で埋めることになりやすいよ。", ["そうなると", "将来の返済が増えるんだ。"]];
      if (s.ka8neg && s.rHi) return [R + "は多めだね", "足りない分は、貯金から出すこともできるよ。", ["でも", "使った分だけ貯金は減るから、赤字が続くと出し続けられないんだ。"]];
      if (s.ka8pos && s.rHi) return [R + "も多めだね", "急な出費があっても、借金に頼らずに出しやすいよ。", ["でも", "大きな工事をした年は赤字になることもあるから、毎年黒字とは限らないんだ。"]];
    }
    return null;
  }
  function mitchieHitokoto(key, name, isPref) {
    try {
      if (!name || !DB[name]) return "";
      var L = hkLines(key, hkStates(name, isPref));
      if (!L) return "";
      var img = (typeof IMGS !== "undefined" && IMGS.top) ? "<img src='data:image/png;base64," + IMGS.top + "' alt='みっちー' style='width:52px;height:52px;object-fit:contain;flex-shrink:0;margin-top:2px;'>" : "";
      var K = "font-weight:700;color:#6a3de8;";
      var P = "font-size:16px;color:#2a2a3a;line-height:1.75;";
      return "<div style='display:flex;align-items:flex-start;gap:8px;margin:14px 0 4px;'>" + img +
        "<div style='position:relative;flex:1;background:#fff;border:2px solid #cdbff5;border-radius:16px;padding:12px 14px;'>" +
          "<div style='position:absolute;left:-9px;top:20px;width:14px;height:14px;background:#fff;border-left:2px solid #cdbff5;border-bottom:2px solid #cdbff5;transform:rotate(45deg);'></div>" +
          "<div style='font-size:14px;font-weight:700;color:#6a3de8;margin-bottom:4px;'>みっちーチェック🕵️</div>" +
          "<div style='" + P + "font-weight:700;'>" + L[0] + "</div>" +
          "<div style='" + P + "margin-top:6px;'><span style='" + K + "'>だから、</span>" + L[1] + "</div>" +
          "<div style='" + P + "margin-top:6px;'><span style='" + K + "'>" + L[2][0] + "、</span>" + L[2][1] + "</div>" +
          "<div style='font-size:13px;color:#7a7a90;line-height:1.6;margin-top:8px;'>※ほかの自治体と比べた結果（総務省データ）と、指標の意味から言えることです</div>" +
        "</div></div>";
    } catch (e) { return ""; }
  }
  /* --- 推移グラフの位置（2026-10-02）---
     「◯◯の状況」（とみっちーチェック）のすぐ下に、推移グラフを移す。
     グラフの枠（#spWrap）は1つだけなので、画面を開くたびに元の位置（#shTop と #shDesc の間）へ戻してから、
     状況の下に置いた目印（#hkChartSlot）の場所へ移す。目印が無い画面では元の位置のまま。 */
  var HK_CHART_SLOT = "<div id='hkChartSlot'></div>";
  function hkRestoreChart() {
    var w = document.getElementById("spWrap"), d = document.getElementById("shDesc");
    if (w && d && d.parentNode && w.nextElementSibling !== d) { w.style.marginTop = ""; d.parentNode.insertBefore(w, d); }
  }
  function hkPlaceChart() {
    var w = document.getElementById("spWrap"), s = document.getElementById("hkChartSlot");
    if (!w || !s || w.style.display === "none") return;
    w.style.marginTop = "14px";
    s.parentNode.insertBefore(w, s);
  }

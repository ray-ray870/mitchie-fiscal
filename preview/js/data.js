  // 画像データは images.js で定義

  document.getElementById("topImg").src = "data:image/png;base64," + IMGS.top;
  document.getElementById("loadImg").src = "data:image/png;base64," + IMGS.top;

  var cur = null;
  var curName = "";
  var HISTORY_KEY = "mitchieSearchHistory";

  if ("scrollRestoration" in history) { history.scrollRestoration = "manual"; }
  var DB = null;
  var KANA_INDEX = null;

  // ===== データの年（年号）=====
  // 年号はアプリに直接書かず、読み込んだデータの履歴の数から自動で決める（2026-09-30）。
  // 3月の年次更新で新しい年のデータが入れば、画面の「令和◯年度」も自動で新しい年になる。
  //   財政（fiscal）   … f_r1（令和元年度）から並ぶ履歴の数＋1＝最新の年度
  //   人口（population）… pop_r1（令和元年）から並ぶ履歴の数＋1＝最新の年（1月1日時点）
  //   公会計（kokaikei）… ka1_r1（平成30年度）から並ぶ履歴の数＝最新の年度
  // 下の数字は、データを読み込むまでの仮の値。
  var DATA_YEAR = {fiscal: 6, population: 8, kokaikei: 5};
  function reiwaText(n) { return n <= 0 ? ("平成" + (30 + n) + "年") : (n === 1 ? "令和元年" : ("令和" + n + "年")); }
  // ===== 全国の中央値・最大値 =====
  // 説明文に出てくる中央値なども、読み込んだデータから計算する（2026-09-30。以前は数字を直接書いていた）。
  // 下の数字は、データを読み込むまでの仮の値。
  var DATA_STATS = {
    f: {muni: 0.44, pref: 0.47}, x: {muni: 91.5, pref: 93.8}, u: {muni: 35.5, pref: 159.7},
    rr: {muni: 24.8, pref: 6.4}, edu: {muni: 10.5, pref: 18.9}, ch: {muni: 118.4, pref: 87.9},
    chMax: {muni: 974.1, pref: 0}
  };
  function medianOf(vals) {
    var s = vals.filter(function(v){ return v != null && !isNaN(v); }).sort(function(a,b){ return a - b; });
    if (!s.length) return null;
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function computeDataStats() {
    var get = {
      f: function(e){ return e.f; }, x: function(e){ return e.x; },
      u: function(e){ return (e.u == null || e.u === "-" || e.u === "－") ? null : e.u; },
      rr: function(e){ return (e.sfs && e.sfs > 0 && e.r != null) ? e.r / e.sfs * 100 : null; },
      edu: function(e){ return e.edu; }, ch: function(e){ return e.ch; }
    };
    Object.keys(get).forEach(function(key){
      ["muni", "pref"].forEach(function(b){
        var vals = Object.keys(DB).filter(function(n){ return (DB[n].p === n) === (b === "pref"); })
                                  .map(function(n){ return get[key](DB[n]); });
        var m = medianOf(vals);
        if (m != null) DATA_STATS[key][b] = m;
      });
    });
    var chMax = 0;
    Object.keys(DB).forEach(function(n){ if (DB[n].p !== n && DB[n].ch > chMax) chMax = DB[n].ch; });
    if (chMax) DATA_STATS.chMax.muni = chMax;
    // 公会計の全国中央値（js/kokaikei.js の KK_MEDIANS）も最新のデータで置き換える
    if (typeof KK_MEDIANS === "object" && KK) {
      Object.keys(KK_MEDIANS).forEach(function(code){
        ["muni", "pref"].forEach(function(b){
          var vals = Object.keys(KK).filter(function(n){ return n.charAt(0) !== "_" && DB[n] && ((DB[n].p === n) === (b === "pref")); })
                                    .map(function(n){ return KK[n][code]; });
          var m = medianOf(vals);
          if (m != null) KK_MEDIANS[code][b] = Math.round(m * 10) / 10;
        });
      });
    }
  }
  // 文章中の {FY}（財政の年度）{PY}（人口の年）{KY}（公会計の年度）を実際の年号に、
  // {MED:項目:muni|pref:小数の桁数} を全国の中央値に、{MAX:ch:0} を最大値に置き換える
  function fillYears(s) {
    return String(s).replace(/\{FY\}/g, reiwaText(DATA_YEAR.fiscal) + "度")
                    .replace(/\{PY\}/g, reiwaText(DATA_YEAR.population))
                    .replace(/\{KY\}/g, reiwaText(DATA_YEAR.kokaikei) + "度")
                    .replace(/\{MED:(\w+):(muni|pref):(\d)\}/g, function(m0, k, b, d){
                      var v = DATA_STATS[k] && DATA_STATS[k][b];
                      return v == null ? "－" : v.toFixed(+d);
                    })
                    .replace(/\{MAX:ch:(\d)\}/g, function(m0, d){ return DATA_STATS.chMax.muni.toFixed(+d); });
  }
  function countHistSlots(e, prefix) {
    var n = 0;
    while (e && Object.prototype.hasOwnProperty.call(e, prefix + "_r" + (n + 1))) n++;
    return n;
  }
  function computeDataYears() {
    var f = 0, p = 0, k = 0;
    Object.keys(DB || {}).forEach(function(n){
      f = Math.max(f, countHistSlots(DB[n], "f"));
      p = Math.max(p, countHistSlots(DB[n], "pop"));
    });
    Object.keys(KK || {}).forEach(function(n){
      if (n.charAt(0) !== "_") k = Math.max(k, countHistSlots(KK[n], "ka1"));
    });
    if (f) DATA_YEAR.fiscal = f + 1;
    if (p) DATA_YEAR.population = p + 1;
    if (k) DATA_YEAR.kokaikei = k;
    // 画面に直接書いてある年号（トップページのフッターなど）も書き換える
    document.querySelectorAll("[data-year]").forEach(function(el){
      el.textContent = fillYears(el.getAttribute("data-year"));
    });
  }

  var dataFiles = [
    "data-hokkaido-tohoku.json",
    "data-kanto.json",
    "data-chubu.json",
    "data-kinki.json",
    "data-chugoku-shikoku.json",
    "data-kyushu.json"
  ];
  Promise.all(dataFiles.map(function(f){ return fetch(f).then(function(r){ return r.json(); }); }).concat([
    fetch("kokaikei.json").then(function(r){ return r.json(); }).catch(function(){ return {}; }),
    fetch("kana-index.json").then(function(r){ return r.json(); }).catch(function(){ return {}; })
  ]))
    .then(function(results){
      KANA_INDEX = results.pop();
      KK = results.pop();
      DB = {};
      results.forEach(function(data){ Object.assign(DB, data); });
      Object.keys(DB).forEach(function(k){ if (DB[k] && DB[k].p === k) DB[k].__pref = true; });
      computeDataYears();
      computeDataStats();
      var cnt = Object.keys(DB).length;
      window.mitchieMunicipalityCount = cnt;
      var el2 = document.getElementById("municipality-count2");
      if (el2) el2.textContent = cnt.toLocaleString();
      console.log("データ読み込み完了: " + cnt + "自治体");
      try {
        var params = new URLSearchParams(window.location.search);
        var cityParam = params.get("city");
        if (cityParam) {
          var found = find(cityParam);
          if (found && !found.ambiguous) {
            document.getElementById("cityInput").value = found.k;
            history.replaceState({mitchieView:"result", city:found.k}, "", "#result");
            render(found, true);
          }
        }
      } catch (e) { /* URLSearchParams未対応やパラメータ異常時は通常表示のまま */ }
    })
    .catch(function(e){
      console.error("データ読み込み失敗", e);
    });

  var ALIAS = {
    "東京":"東京都","大阪":"大阪市","名古屋":"名古屋市","横浜":"横浜市",
    "川崎":"川崎市","神戸":"神戸市","京都":"京都市","福岡":"福岡市",
    "広島":"広島市","仙台":"仙台市","千葉":"千葉市","熊本":"熊本市",
    "北九州":"北九州市","静岡":"静岡市","浜松":"浜松市","新潟":"新潟市",
    "堺":"堺市","姶良":"姶良市","霧島":"霧島市","鹿児島":"鹿児島市",
    "夕張":"夕張市","旭川":"旭川市","函館":"函館市","豊田":"豊田市",
    "四条畷":"四條畷市","四条畷市":"四條畷市","しじょうなわて":"四條畷市","四條畷":"四條畷市",
    "富山県朝日町":"朝日町（富山）","富山朝日町":"朝日町（富山）",
    "青森南部町":"南部町（青森）","山梨南部町":"南部町（山梨）","鳥取南部町":"南部町（鳥取）",
    "秋田美郷町":"美郷町（秋田）","島根美郷町":"美郷町（島根）","宮崎美郷町":"美郷町（宮崎）",
    "朝日町":"朝日町（山形）","山形朝日町":"朝日町（山形）","三重朝日町":"朝日町","三重県朝日町":"朝日町",
    "山形川西町":"川西町（山形）","奈良川西町":"川西町（奈良）",
    "山形小国町":"小国町（山形）","熊本小国町":"小国町（熊本）",
    "福島昭和村":"昭和村（福島）","群馬昭和村":"昭和村（群馬）",
    "北海道日高町":"日高町（北海道）","和歌山日高町":"日高町（和歌山）",
    "北海道松前町":"松前町（北海道）","愛媛松前町":"松前町（愛媛）",
    "北海道森町":"森町（北海道）","静岡森町":"森町（静岡）",
    "北海道清水町":"清水町（北海道）","静岡清水町":"清水町（静岡）",
    "北海道池田町":"池田町（北海道）","岐阜池田町":"池田町（岐阜）",
    "宮城川崎町":"川崎町（宮城）","福岡川崎町":"川崎町（福岡）",
    "宮城美里町":"美里町（宮城）","埼玉美里町":"美里町（埼玉）","熊本美里町":"美里町（熊本）",
    "東京府中":"府中市（東京）","広島府中":"府中市（広島）",
    "群馬南牧村":"南牧村（群馬）","長野南牧村":"南牧村（長野）",
    "群馬高山村":"高山村（群馬）","長野高山村":"高山村（長野）",
    "群馬明和町":"明和町（群馬）","三重明和町":"明和町（三重）",
    "愛知美浜町":"美浜町（愛知）","和歌山美浜町":"美浜町（和歌山）",
    "長野川上村":"川上村（長野）","奈良川上村":"川上村（奈良）",
    "長野高森町":"高森町（長野）","熊本高森町":"高森町（熊本）",
    "弥富市":"弥富市（愛知）","愛知弥富":"弥富市（愛知）",
    "和歌山広川町":"広川町（和歌山）","福岡広川町":"広川町（福岡）",
    "滋賀日野町":"日野町（滋賀）","鳥取日野町":"日野町（鳥取）"
  };


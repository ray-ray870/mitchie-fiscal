  // 画像データは images.js で定義

  document.getElementById("topImg").src = "data:image/png;base64," + IMGS.top;
  document.getElementById("loadImg").src = "data:image/png;base64," + IMGS.top;

  var cur = null;
  var curName = "";
  var HISTORY_KEY = "mitchieSearchHistory";

  if ("scrollRestoration" in history) { history.scrollRestoration = "manual"; }
  var DB = null;
  var KANA_INDEX = null;
  // 国の基準を超えた自治体について、財政状況資料集に自治体自身が書いた説明（shiryou.json）
  var SHIRYOU = {};

  // ===== データの年（年号）=====
  // 年号はアプリに直接書かず、読み込んだデータの履歴の数から自動で決める（2026-09-30）。
  // 3月の年次更新で新しい年のデータが入れば、画面の「令和◯年度」も自動で新しい年になる。
  //   財政（fiscal）   … f_r1（令和元年度）から並ぶ履歴の数＋1＝最新の年度
  //   人口（population）… pop_r1（令和元年）から並ぶ履歴の数＋1＝最新の年（1月1日時点）
  //   公会計（kokaikei）… ka1_r1（平成30年度）から並ぶ履歴の数＝最新の年度
  // 下の数字は、データを読み込むまでの仮の値。
  var DATA_YEAR = {fiscal: 6, population: 8, kokaikei: 5};
  // 政令指定都市（20市）。将来負担比率の早期健全化基準は、都道府県と同じ400%（市町村は350%）
  // 出典：総務省「早期健全化基準と財政再生基準」（https://www.soumu.go.jp/iken/zaisei/kenzenka/index3.html）（2026-10-01）
  var SEIREI_CITIES = {"札幌市":"北海道","仙台市":"宮城県","さいたま市":"埼玉県","千葉市":"千葉県","横浜市":"神奈川県",
    "川崎市":"神奈川県","相模原市":"神奈川県","新潟市":"新潟県","静岡市":"静岡県","浜松市":"静岡県","名古屋市":"愛知県",
    "京都市":"京都府","大阪市":"大阪府","堺市":"大阪府","神戸市":"兵庫県","岡山市":"岡山県","広島市":"広島県",
    "北九州市":"福岡県","福岡市":"福岡県","熊本市":"熊本県"};
  function uLimitOf(d, isPref) { return (isPref || (d && d.__seirei)) ? 400 : 350; }
  function reiwaText(n) { return n <= 0 ? ("平成" + (30 + n) + "年") : (n === 1 ? "令和元年" : ("令和" + n + "年")); }
  // ===== 全国の中央値・最大値 =====
  // 説明文に出てくる中央値なども、読み込んだデータから計算する（2026-09-30。以前は数字を直接書いていた）。
  // 下の数字は、データを読み込むまでの仮の値。
  /* --- 推移を、途中の動きも見て一文にする（2026-09-30）---
     以前は「最初の年と最新の年」の2点だけを比べていたため、最初の年だけ飛び抜けていると
     「大きく減少」と出てしまっていた（例：姶良市の教育費比率。令和元年度だけ11.6%で、その後は6〜8%台）。
     pts：[{y:年の番号, v:値}]（古い順。0以下の年は平成30年度など）
     opt：tol（これ以下の変化は「横ばい」とみなす差）, rel（割合で判定するとき true）, fmt（値の表示関数）, times（「約◯倍」を添える）
     返すのは「令和◯年度から増えています（A→B）」のような文。3年分以上ないときは空文字 */
  function trendJP(pts, opt) {
    pts = (pts || []).filter(function(p){ return p.v != null && !isNaN(p.v); });
    if (pts.length < 3) return "";
    var fmt = opt.fmt || function(v){ return String(v); };
    var pre = opt.label ? opt.label + "は、" : "";
    var yl = function(y){ return reiwaText(y) + "度"; };
    var flat = function(a, b){ return opt.rel ? Math.abs(b - a) <= Math.abs(a) * opt.tol : Math.abs(b - a) <= opt.tol; };
    var small = function(a, b){ return opt.rel ? Math.abs(b - a) <= Math.abs(a) * opt.tol * 3 : Math.abs(b - a) <= opt.tol * 3; };
    var sg = [];
    for (var i = 1; i < pts.length; i++) sg.push(flat(pts[i-1].v, pts[i].v) ? 0 : (pts[i].v > pts[i-1].v ? 1 : -1));
    var first = pts[0], last = pts[pts.length - 1], n = sg.length;
    var mn = Math.min.apply(null, pts.map(function(p){ return p.v; })), mx = Math.max.apply(null, pts.map(function(p){ return p.v; }));
    var word = function(d){ return d > 0 ? "増え" : "減っ"; };
    // 増えたときは「約◯倍」、減ったときは「約◯割減」（2026-10-01：「約0.1倍」は分かりにくいため）
    var times = function(a, b){
      if (!opt.times || !(a > 0)) return "";
      if (b / a >= 1.15) return "、約" + (Math.round(b / a * 10) / 10) + "倍";
      if (b / a <= 0.87) return "、約" + Math.round((1 - b / a) * 10) + "割減";
      return "";
    };
    if (flat(mn, mx)) return pre + yl(first.y) + "から、ほぼ横ばいです（" + fmt(mn) + "〜" + fmt(mx) + "）";
    var lastDir = sg[n - 1];
    if (lastDir === 0) {
      return pre + yl(last.y) + "に、前の年度からほぼ変わりませんでした（" + fmt(pts[n - 1].v) + "→" + fmt(last.v) + "）";
    }
    var k = n - 1;
    while (k - 1 >= 0 && sg[k - 1] === lastDir) k--;
    var runStart = pts[k];
    if (k === 0) return pre + yl(first.y) + "から" + (lastDir > 0 ? "増え" : "減り") + "続けています（" + fmt(first.v) + "→" + fmt(last.v) + times(first.v, last.v) + "）";
    if (n - k >= 2) return pre + yl(runStart.y) + "から" + word(lastDir) + "ています（" + fmt(runStart.v) + "→" + fmt(last.v) + times(runStart.v, last.v) + "）";
    // 最新の1年だけ向きが変わった（または前の年度まで横ばいだった）
    var prevDir = sg[k - 1];
    var j = k - 1;
    while (j - 1 >= 0 && sg[j - 1] === prevDir) j--;
    var turn = yl(last.y) + (pre ? "に" : "は") + (small(pts[n - 1].v, last.v) ? "少し" : "") + (lastDir > 0 ? "増えました" : "減りました") + "（" + fmt(pts[n - 1].v) + "→" + fmt(last.v) + "）";
    if (prevDir !== 0 && k - j >= 2) return pre + yl(pts[j].y) + "から" + word(prevDir) + "てきましたが、" + turn;
    return pre + turn;
  }

  var DATA_STATS = {
    d: {muni: 7.6, pref: 11}, f: {muni: 0.44, pref: 0.47}, x: {muni: 91.5, pref: 93.8}, u: {muni: 35.5, pref: 159.7},
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
      f: function(e){ return e.f; }, x: function(e){ return e.x; }, d: function(e){ return e.d; },
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
        // 下位10%・上位10%の境目（「全国の中でも低いほう／高いほう」と言うときに使う）
        var s = vals.filter(function(v){ return v != null && !isNaN(v); }).sort(function(a,c){ return a - c; });
        if (s.length) {
          DATA_STATS[key][b + "P10"] = s[Math.floor(s.length * 0.1)];
          DATA_STATS[key][b + "P90"] = s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
        }
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
  // 履歴＋最新値の配列（古い順）。財政は _r1〜_r(最新年度-1)、公会計は _r1〜_r(最新年度)。
  // 以前は [x_r1…x_r5, x] と手で書いていて、3月に1年増えると最新の年が抜け、年のラベルもずれるところだった（2026-09-30）
  function histArr(e, prefix, kind) {
    if (!e) return [];
    var n = kind === "kk" ? DATA_YEAR.kokaikei : (DATA_YEAR.fiscal - 1);
    var a = [];
    for (var k = 1; k <= n; k++) a.push(e[prefix + "_r" + k]);
    a.push(e[prefix]);
    return a;
  }
  // 最新値の直前の count 年分の履歴（空欄は除く）。「過去平均」の計算に使う
  function recentHist(e, prefix, count) {
    var a = [];
    for (var k = DATA_YEAR.fiscal - count; k <= DATA_YEAR.fiscal - 1; k++) {
      if (k >= 1 && e[prefix + "_r" + k] != null) a.push(e[prefix + "_r" + k]);
    }
    return a;
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
    fetch("kana-index.json").then(function(r){ return r.json(); }).catch(function(){ return {}; }),
    fetch("shiryou.json").then(function(r){ return r.json(); }).catch(function(){ return {}; })
  ]))
    .then(function(results){
      SHIRYOU = results.pop() || {};
      KANA_INDEX = results.pop();
      KK = results.pop();
      DB = {};
      results.forEach(function(data){ Object.assign(DB, data); });
      Object.keys(DB).forEach(function(k){ if (DB[k] && DB[k].p === k) DB[k].__pref = true; });
      Object.keys(SEIREI_CITIES).forEach(function(k){ if (DB[k] && DB[k].p === SEIREI_CITIES[k]) DB[k].__seirei = true; });
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


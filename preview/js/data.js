// 画像データは images.js で定義

  document.getElementById("topImg").src = "data:image/png;base64," + IMGS.top;
  document.getElementById("loadImg").src = "data:image/png;base64," + IMGS.top;

  var cur = null;
  var curName = "";
  var HISTORY_KEY = "mitchieSearchHistory";

  if ("scrollRestoration" in history) { history.scrollRestoration = "manual"; }
  var DB = null;
  var KANA_INDEX = null;

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

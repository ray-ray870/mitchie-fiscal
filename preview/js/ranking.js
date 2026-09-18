  /* ===== 全国のみっちー ===== */
  var nkDistKeysStore = {};
  function nkDistHtmlFromKeys(keys, title, clickableId){
    var order = ["happy","normal","tired","sick","critical"];
    var counts = {happy:0,normal:0,tired:0,sick:0,critical:0};
    var total = 0;
    var reg = mmLoad();
    var mineStates = {};
    keys.forEach(function(k){
      var s = mmScoreOf(k);
      if (s == null) return;
      var st = healthState(s);
      counts[st]++;
      total++;
      if (reg && ((reg.city && reg.city === k) || (reg.pref && reg.pref === k))) mineStates[k] = st;
    });
    if (clickableId) nkDistKeysStore[clickableId] = keys;
    var html = "<p class='nk-section-title'>"+title+"</p>";
    if (clickableId) html += "<p style='font-size:13px;color:#777;margin:-2px 0 10px;'>※項目タップで該当自治体を表示します</p>";
    order.forEach(function(st){
      var lbl = HEALTH_LABELS[st];
      var c = counts[st];
      var pct = total ? Math.round(c/total*1000)/10 : 0;
      var rowCls = clickableId ? "nk-dist-row nk-dist-clickable" : "nk-dist-row";
      var dataAttrs = clickableId ? " data-zone='"+st+"' data-store='"+clickableId+"' role='button' tabindex='0'" : "";
      html += "<div class='"+rowCls+"'"+dataAttrs+">"+
        "<span class='nk-dist-label'>"+lbl[0]+"</span>"+
        "<div class='nk-dist-bar-bg'><div class='nk-dist-bar-fill' style='width:"+pct+"%;background:"+lbl[1]+";'></div></div>"+
        "<span class='nk-dist-count'>"+c.toLocaleString()+"件("+pct+"%)</span>"+
        "</div>";
    });
    var mineKeys = Object.keys(mineStates);
    if (mineKeys.length) {
      var lines = mineKeys.map(function(k){ return k+" &#8594; 「"+HEALTH_LABELS[mineStates[k]][0]+"」"; });
      html += "<div class='nk-mine-note'>&#128039; Myみっちー<br>"+lines.map(function(l){ return "&nbsp;&nbsp;"+l; }).join("<br>")+"</div>";
    }
    if (clickableId) html += "<div id='"+clickableId+"-drill'></div>";
    return html;
  }
  function nkZoneListHtml(clickableId, zoneKey, regionName){
    var keys = nkDistKeysStore[clickableId] || [];
    var fullList = keys.map(function(k){ return {k:k, v:mmScoreOf(k)}; })
      .filter(function(o){ return o.v != null; });
    fullList.sort(function(a,b){ return b.v - a.v; });
    var blockRankMap = {};
    fullList.forEach(function(o, i){ blockRankMap[o.k] = i + 1; });
    var list = fullList.filter(function(o){ return healthState(o.v) === zoneKey; });
    if (!list.length) return "<p style='font-size:14px;color:#777;text-align:center;padding:10px 0;'>該当する自治体はありません</p>";
    var reg = mmLoad();
    var mineSet = {};
    if (reg && reg.city) mineSet[reg.city] = true;
    if (reg && reg.pref) mineSet[reg.pref] = true;
    var lbl = HEALTH_LABELS[zoneKey];
    var html = "<p style='font-size:15px;font-weight:700;color:"+lbl[1]+";margin:10px 0 2px;'>「"+lbl[0]+"」の自治体（"+list.length+"件）</p>";
    if (regionName) html += "<p style='font-size:13px;color:#777;margin:0 0 10px;'>※"+regionName+"ブロック内での順位です</p>";
    for (var i=0; i<list.length; i++){
      html += nkPrefRow(list, i, mineSet, null, true, blockRankMap[list[i].k]);
    }
    return html;
  }
  function nkDistHtml(){
    if (!DB) return "";
    var muniKeys = Object.keys(DB).filter(function(k){ return !mmIsPrefKey(k); });
    return nkDistHtmlFromKeys(muniKeys, "全国の分布（市区町村）");
  }

  function nkPrefRow(list, idx, mineSet, natRank, showPref, rankOverride){
    var o = list[idx];
    var mine = !!mineSet[o.k];
    var zoneColor = prof(o.v).c;
    var natRankHtml = natRank ? "<div class='nk-pref-nat'>全国"+natRank+"位</div>" : "";
    var prefHtml = "";
    if (showPref && DB && DB[o.k] && DB[o.k].p && DB[o.k].p !== o.k) {
      prefHtml = "<div class='nk-pref-sub'>"+DB[o.k].p+"</div>";
    }
    var rankNum = rankOverride != null ? rankOverride : (idx+1);
    return "<div class='nk-pref-row"+(mine?" mine":"")+"'>"+
      "<span class='nk-pref-zone' style='background:"+zoneColor+";'></span>"+
      "<span class='nk-pref-rank'>"+rankNum+"位</span>"+
      "<span class='nk-pref-name' data-pref='"+o.k+"'>"+o.k+(mine?" <span class='nk-mine-chip'>Myみっちー</span>":"")+prefHtml+natRankHtml+"</span>"+
      "<span class='nk-pref-score'>"+o.v+"点</span>"+
      "</div>";
  }

  function nkPrefList(){
    if (!DB) return [];
    var prefs = Object.keys(DB).filter(function(k){ return mmIsPrefKey(k); });
    var list = prefs.map(function(k){ return {k:k, v:mmScoreOf(k)}; }).filter(function(o){ return o.v != null; });
    list.sort(function(a,b){ return b.v - a.v; });
    return list;
  }

  var NK_ZONE_LEGEND = "<div class='nk-zone-legend'>" +
    "<span><i style='background:#6dcfad;'></i>絶好調</span>" +
    "<span><i style='background:#7bb8e8;'></i>元気</span>" +
    "<span><i style='background:#f0c46a;'></i>ちょっとしんどい</span>" +
    "<span><i style='background:#f0876a;'></i>ぐったり</span>" +
    "<span><i style='background:#d0505a;'></i>ひんし</span>" +
    "</div>";

  var NK_REGIONS = [
    {name:"北海道", prefs:["北海道"]},
    {name:"東北", prefs:["青森県","岩手県","宮城県","秋田県","山形県","福島県"]},
    {name:"関東", prefs:["茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県"]},
    {name:"中部", prefs:["新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県"]},
    {name:"近畿", prefs:["三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県"]},
    {name:"中国", prefs:["鳥取県","島根県","岡山県","広島県","山口県"]},
    {name:"四国", prefs:["徳島県","香川県","愛媛県","高知県"]},
    {name:"九州", prefs:["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"]}
  ];

  function nkRegionBlocksHtml(){
    var list = nkPrefList();
    if (!list.length) return "";
    var html = "<div class='nk-divider'></div>";
    html += "<p class='nk-region-title'>地方ブロック別ランキング</p>";
    html += "<div class='nk-region-btns'>";
    NK_REGIONS.forEach(function(r, i){
      html += "<button class='nk-region-btn' data-region-idx='"+i+"'>"+r.name+"</button>";
    });
    html += "</div>";
    html += "<div id='nkRegionList'></div>";
    return html;
  }

  function nkMunisInRegion(region){
    if (!DB) return [];
    return Object.keys(DB).filter(function(k){
      var e = DB[k];
      if (!e || mmIsPrefKey(k)) return false;
      return region.prefs.indexOf(e.p) !== -1;
    });
  }
  function nkBlockRankHtml(regionIdx){
    var region = NK_REGIONS[regionIdx];
    var muniKeys = nkMunisInRegion(region);
    if (!muniKeys.length) return "<p style='font-size:13px;color:#999;text-align:center;padding:10px 0;'>データがありません</p>";
    var storeId = "nkBlock"+regionIdx;
    return nkDistHtmlFromKeys(muniKeys, region.name+"の分布（市区町村）", storeId);
  }

  function nkPrefRankHtml(){
    var list = nkPrefList();
    if (!list.length) return "";
    var reg = mmLoad();
    var mineSet = {};
    if (reg && reg.pref) mineSet[reg.pref] = true;
    var html = "<p class='nk-section-title'>47都道府県ランキング</p>";
    html += NK_ZONE_LEGEND;
    html += nkPrefRow(list, 0, mineSet);
    if (list.length > 1) html += nkPrefRow(list, 1, mineSet);
    if (list.length > 2) html += nkPrefRow(list, list.length - 1, mineSet);
    html += "<button class='nk-more-btn' id='nkMoreBtn'>47都道府県ぜんぶ見る &#9654;</button>";
    html += "<div class='hidden' id='nkFullList'></div>";
    return html;
  }

  function nkRenderCard(restoreRegion, restoreZone){
    var body = document.getElementById("nkBody");
    if (!body) return;
    if (!DB) { body.innerHTML = ""; return; }
    body.innerHTML = nkDistHtml() + "<div class='nk-divider'></div>" + nkPrefRankHtml() + nkRegionBlocksHtml();
    if (!body.dataset.prefClickBound) {
      body.dataset.prefClickBound = "1";
      body.addEventListener("click", function(e){
        var nameEl = e.target.closest(".nk-pref-name");
        if (nameEl) { nkGoToPref(nameEl.getAttribute("data-pref")); return; }
        var zoneEl = e.target.closest(".nk-dist-clickable");
        if (zoneEl) {
          var storeId = zoneEl.getAttribute("data-store");
          var zone = zoneEl.getAttribute("data-zone");
          openZone(zoneEl, storeId, zone);
        }
      });
    }
    var moreBtn = document.getElementById("nkMoreBtn");
    if (moreBtn) {
      moreBtn.addEventListener("click", function(){
        var full = document.getElementById("nkFullList");
        if (!full) return;
        if (full.classList.contains("hidden")) {
          var list = nkPrefList();
          var reg = mmLoad();
          var mineSet = {};
          if (reg && reg.pref) mineSet[reg.pref] = true;
          var html = "";
          for (var i=0;i<list.length;i++){ html += nkPrefRow(list, i, mineSet); }
          full.innerHTML = html;
          full.classList.remove("hidden");
          moreBtn.textContent = "たたむ";
        } else {
          full.classList.add("hidden");
          full.innerHTML = "";
          moreBtn.textContent = "47都道府県ぜんぶ見る ▶";
        }
      });
    }
    function openZone(zoneEl, storeId, zone, isRestore){
      var drill = document.getElementById(storeId+"-drill");
      if (!drill) return;
      var alreadyOpen = zoneEl.classList.contains("open");
      body.querySelectorAll(".nk-dist-clickable[data-store='"+storeId+"']").forEach(function(el){ el.classList.remove("open"); });
      if (alreadyOpen) {
        history.back();
      } else {
        zoneEl.classList.add("open");
        var regionName = storeId.indexOf("nkBlock") === 0 ? NK_REGIONS[parseInt(storeId.replace("nkBlock",""),10)].name : null;
        drill.innerHTML = nkZoneListHtml(storeId, zone, regionName);
        if (!isRestore) {
          history.pushState(Object.assign({}, history.state, {zone: zone}), "", "#nk");
        }
      }
    }
    var regionBtns = body.querySelectorAll(".nk-region-btn");
    var regionListEl = document.getElementById("nkRegionList");
    function closeRegion(){
      history.back();
    }
    function openRegion(idx, isRestore){
      var btn = body.querySelector(".nk-region-btn[data-region-idx='"+idx+"']");
      if (!btn) return;
      regionBtns.forEach(function(b){ b.classList.remove("active"); });
      btn.classList.add("active");
      regionListEl.innerHTML = "<button class='nk-region-close-btn' id='nkRegionCloseBtn'>&#10005; 閉じる</button>" + nkBlockRankHtml(idx);
      var closeBtn = document.getElementById("nkRegionCloseBtn");
      if (closeBtn) closeBtn.addEventListener("click", closeRegion);
      if (!isRestore) {
        history.pushState({mitchieView:"nk", region: idx}, "", "#nk");
      }
    }
    regionBtns.forEach(function(btn){
      btn.addEventListener("click", function(){
        var idx = parseInt(btn.getAttribute("data-region-idx"), 10);
        var alreadyActive = btn.classList.contains("active");
        if (alreadyActive) { closeRegion(); } else { openRegion(idx); }
      });
    });
    if (restoreRegion != null) {
      openRegion(restoreRegion, true);
      if (restoreZone) {
        var zoneEl2 = regionListEl.querySelector(".nk-dist-clickable[data-zone='"+restoreZone+"']");
        if (zoneEl2) { openZone(zoneEl2, zoneEl2.getAttribute("data-store"), restoreZone, true); }
      }
    }
  }

  function nkGoToPref(name){
    if (typeof nkCloseBox === "function") nkCloseBox();
    var input = document.getElementById("cityInput");
    if (!input) return;
    input.value = name;
    if (typeof hideSuggestions === "function") hideSuggestions();
    diagnose();
  }
  function nkOpenBox(skipPush, restoreRegion, restoreZone){
    var toggle = document.getElementById("nkToggleBtn");
    var box = document.getElementById("nkBox");
    if (!toggle||!box) return;
    mmCloseBox();
    toggle.classList.add("hidden");
    var mmToggle = document.getElementById("mmToggleBtn");
    if (mmToggle) mmToggle.classList.add("hidden");
    box.classList.remove("hidden");
    if (!skipPush) { history.pushState({mitchieView:"nk"}, "", "#nk"); }
    nkRenderCard(restoreRegion, restoreZone);
  }
  function nkCloseBox(){
    var toggle = document.getElementById("nkToggleBtn");
    var box = document.getElementById("nkBox");
    if (!toggle||!box) return;
    box.classList.add("hidden");
    toggle.classList.remove("hidden");
    var mmToggle = document.getElementById("mmToggleBtn");
    if (mmToggle) mmToggle.classList.remove("hidden");
  }

  (function mmInit(){
    var toggle = document.getElementById("mmToggleBtn");
    var closeBtn = document.getElementById("mmCloseBtn");
    if (toggle) toggle.addEventListener("click", mmOpenBox);
    if (closeBtn) closeBtn.addEventListener("click", mmCloseBox);
    var nkToggle = document.getElementById("nkToggleBtn");
    var nkClose = document.getElementById("nkCloseBtn");
    if (nkToggle) nkToggle.addEventListener("click", function(){ nkOpenBox(); });
    if (nkClose) nkClose.addEventListener("click", function(){
      nkCloseBox();
      // 地方ブロック・体調ゾーンまで深く進んでいても、✕は必ず全体を閉じる。
      // history.back()を1回呼ぶだけだと1階層しか戻らないため、閉じた状態を明示的に積み直す
      history.replaceState({}, "", location.pathname + location.search);
    });
    var icon = document.getElementById("mmIcon");
    if (icon && typeof IMGS!=="undefined" && IMGS.top) icon.src = "data:image/png;base64,"+IMGS.top;
    document.addEventListener("click", function(e){
      if (!e.target.closest || !e.target.closest(".mm-reg-row")) {
        var cs=document.getElementById("mmCitySuggest"); if (cs) cs.classList.add("hidden");
        var ps=document.getElementById("mmPrefSuggest"); if (ps) ps.classList.add("hidden");
      }
    });
  })();


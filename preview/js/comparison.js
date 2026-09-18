  var COMPARE_KEY = "mitchieCompareList";
  var COMPARE_MAX = 6;
  function getCompareList() {
    try {
      var raw = localStorage.getItem(COMPARE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveCompareList(list) {
    try { localStorage.setItem(COMPARE_KEY, JSON.stringify(list)); } catch(e) { /* localStorage unavailable */ }
  }

  function toggleCompare(name) {
    var list = getCompareList();
    var idx = list.indexOf(name);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      if (list.length >= COMPARE_MAX) return;
      list.push(name);
    }
    saveCompareList(list);
    renderCompareButton(name);
    updateCompareBar();
  }

  function renderCompareButton(name) {
    var wrap = document.getElementById("compareBtnWrap");
    if (!wrap) return;
    var list = getCompareList();
    var inList = list.indexOf(name) >= 0;
    var count = list.length;
    var atMax = count >= COMPARE_MAX && !inList;
    var btnClass = "compare-corner" + (inList ? " added" : "") + (atMax ? " disabled" : "");
    var btnLabel = inList ? "✓ 追加済み" : "🔖 比較する";
    var countLabel = count === 0 ? (COMPARE_MAX + "つまで") : (count + "/" + COMPARE_MAX);
    wrap.innerHTML =
      "<div class='" + btnClass + "' id='compareBtn' role='button' tabindex='0'>" + btnLabel + "</div>" +
      "<div class='compare-count" + (atMax ? " limit" : "") + "'>" + countLabel + "</div>";
    if (!atMax) {
      document.getElementById("compareBtn").addEventListener("click", function(){ toggleCompare(name); });
    }
  }

  function updateCompareBar() {
    var bar = document.getElementById("compareBar");
    if (!bar) return;
    var list = getCompareList();
    if (list.length === 0) {
      bar.classList.add("hidden");
      bar.onclick = null;
      return;
    }
    bar.classList.remove("hidden");
    var chips = list.map(function(n){ return "<div class='chip'>" + n.charAt(0) + "</div>"; }).join("");
    bar.innerHTML = "<div class='chips'>" + chips + "</div><span>比較リスト（" + list.length + "）見る ▶</span>";
    bar.onclick = function(){ openCompareModal(); };
  }

  function buildCompareRow(label, entries, valueFn, colorFn, fmt, higherBetter, metricKey) {
    var values = entries.map(valueFn);
    var bestI = 0, worstI = 0;
    for (var i=1;i<values.length;i++){
      if (higherBetter ? values[i]>values[bestI] : values[i]<values[bestI]) bestI=i;
      if (higherBetter ? values[i]<values[worstI] : values[i]>values[worstI]) worstI=i;
    }
    var multi = values.length > 1;
    var cells = values.map(function(v,i){
      var color = colorFn(v, entries[i]);
      var mark = multi && i===bestI ? "🏆 " : (multi && i===worstI && bestI!==worstI ? "😥 " : "");
      return "<td class='compare-cell-detail' data-city='"+entries[i].name+"' data-metric='"+metricKey+"' style='color:"+color+";font-weight:700;'>"+mark+fmt(v)+"</td>";
    }).join("");
    return "<tr><td>"+label+"</td>"+cells+"</tr>";
  }

  function buildCompareHtml(entries) {
    var compact = entries.length >= 3;
    var scoreFontSize = compact ? "13px" : "15px";
    var imgSize = compact ? "34px" : "38px";
    var labelFontSize = compact ? "10px" : "11px";
    var healthScores = entries.map(function(e){ return calcH(e.d.f,e.d.d,e.d.x,e.d.u,e.d.r,e.d.eo,e.d.__pref,e.d.sfs); });
    var bestHI=0, worstHI=0;
    for (var i=1;i<healthScores.length;i++){
      if (healthScores[i]>healthScores[bestHI]) bestHI=i;
      if (healthScores[i]<healthScores[worstHI]) worstHI=i;
    }
    var multi = entries.length > 1;
    var scoreCells = entries.map(function(e,i){
      var s = healthScores[i];
      var key = healthState(s);
      var lab = HEALTH_LABELS[key];
      var mark = multi && i===bestHI ? "🏆 " : (multi && i===worstHI && bestHI!==worstHI ? "😥 " : "");
      return "<td class='compare-cell-detail' data-city='"+e.name+"' data-metric='health' style='color:"+lab[1]+";font-weight:700;font-size:"+scoreFontSize+";'>"+mark+s+"<br><img src='data:image/png;base64,"+IMGS[key]+"' alt='\"+HEALTH_LABELS[key][0]+\"' style='width:"+imgSize+";height:"+imgSize+";object-fit:contain;margin-top:3px;'><br><span style='font-size:"+labelFontSize+";color:"+lab[1]+";font-weight:700;'>"+lab[0]+"</span></td>";
    }).join("");

    var headCells = entries.map(function(e){
      return "<th class='compare-head'><span class='compare-goto' data-city='"+e.name+"'>"+e.name+"</span><br><span style='font-weight:400;color:#8a8aa0;'>"+e.d.p+"</span><br><span class='compare-remove' data-name='"+e.name+"'>✕ 外す</span></th>";
    }).join("");

    var rows = "<tr><td>総合スコア</td>"+scoreCells+"</tr>";
    rows += buildCompareRow("財政力指数", entries, function(e){return e.d.f;},
      function(v){ return v>=1.0?"#6dcfad":v>=0.7?"#7bb8e8":v>=0.5?"#f0c46a":"#f0876a"; },
      function(v){ return v.toFixed(2); }, true, "fiscalPower");
    rows += buildCompareRow("実質公債費比率", entries, function(e){return e.d.d;},
      function(v){ return v<10?"#6dcfad":v<18?"#7bb8e8":v<25?"#f0c46a":"#f0876a"; },
      function(v){ return v.toFixed(1)+"%"; }, false, "debt");
    rows += buildCompareRow("経常収支比率", entries, function(e){return e.d.x;},
      function(v){ return v<88?"#6dcfad":v<95?"#7bb8e8":"#f0876a"; },
      function(v){ return v.toFixed(1)+"%"; }, false, "flex");
    rows += buildCompareRow("将来負担比率", entries, function(e){return e.d.u==null?0:e.d.u;},
      function(v,e){ return colorU(v, e && e.d && e.d.__pref); },
      function(v){ return (v<=0?"0":v.toFixed(0))+"%"; }, false, "future");
    rows += buildCompareRow("財政調整基金", entries, function(e){ return (e.d.sfs && e.d.sfs>0 && e.d.r!=null) ? (e.d.r/e.d.sfs*100) : 0; },
      function(v,e){ var rb = reserveBands(e && e.d && e.d.__pref); return v>=rb.hi?"#6dcfad":v>=rb.lo?"#f0c46a":"#f0876a"; },
      function(v){ return v.toFixed(1)+"%"; }, true, "reserve");
    rows += buildCompareRow("人口増減率", entries, function(e){return e.d.g;},
      function(v){ return v>=0?"#6dcfad":v>=-0.5?"#f0c46a":"#f0876a"; },
      function(v){ return (v>=0?"+":"")+v.toFixed(1)+"%"; }, true, "growth");

    return "<div class='compare-title'><span>📊 比較リスト（"+entries.length+"自治体）</span><span class='close' id='compareCloseBtn'>✕ 閉じる</span></div>" +
      "<div style='overflow-x:auto;'>" +
      "<table class='compare-table"+(compact?" compact":"")+"'><tr><th></th>"+headCells+"</tr>"+rows+"</table>" +
      "</div>" +
      "<div style='font-size:11px;color:#9a8ac0;margin-top:8px;'>🏆＝1位、😥＝最下位。数値の色はアプリ内の危険度カラーと同じ基準です。<br>💡 数値をタップすると詳細画面が開きます</div>";
  }

  function getCompareEntries() {
    var list = getCompareList();
    var entries = [];
    for (var i=0;i<list.length;i++) {
      var found = find(list[i]);
      if (found && !found.ambiguous) entries.push({name: found.k, d: found.d});
    }
    return entries;
  }

  function refreshCompareModal() {
    var entries = getCompareEntries();
    if (!entries.length) { history.back(); return; }
    document.getElementById("compareContent").innerHTML = buildCompareHtml(entries);
    bindCompareContentEvents();
  }

  function bindCompareContentEvents() {
    var closeBtn = document.getElementById("compareCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", function(){ history.back(); });
    document.querySelectorAll(".compare-goto").forEach(function(el){
      el.addEventListener("click", function(){
        jumpToCity(this.getAttribute("data-city"));
      });
    });
    document.querySelectorAll(".compare-cell-detail").forEach(function(el){
      el.addEventListener("click", function(){
        var target = this.getAttribute("data-city");
        var metric = this.getAttribute("data-metric");
        var found = find(target);
        if (found && !found.ambiguous) {
          cur = found.d;
          curName = found.k;
          openD(metric);
        }
      });
    });
    document.querySelectorAll(".compare-remove").forEach(function(el){
      el.addEventListener("click", function(){
        var name = this.getAttribute("data-name");
        var list = getCompareList().filter(function(n){ return n!==name; });
        saveCompareList(list);
        updateCompareBar();
        refreshCompareModal();
      });
    });
  }

  function openCompareModal(skipPush) {
    var entries = getCompareEntries();
    if (!entries.length) return;
    document.getElementById("compareContent").innerHTML = buildCompareHtml(entries);
    bindCompareContentEvents();
    document.getElementById("compareOv").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (!skipPush) { history.pushState({mitchieView:"compare"}, "", "#compare"); }
    if (typeof gtag === "function") {
      var names = entries.map(function(e){ return e.name; });
      var sorted = names.slice().sort();
      gtag('event', 'compare_cities', {
        city_list: names.join("・"),
        city_combo: sorted.join("・"),
        city_count: names.length
      });
    }
  }

  // ===== 診断結果 画像シェア機能 =====

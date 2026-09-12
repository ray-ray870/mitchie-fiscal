(function() {
  // 画像データは images.js で定義

  document.getElementById("topImg").src = "data:image/png;base64," + IMGS.top;
  document.getElementById("loadImg").src = "data:image/png;base64," + IMGS.top;

  var cur = null;
  var curName = "";
  var HISTORY_KEY = "mitchieSearchHistory";

  function getSearchHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function addToSearchHistory(name) {
    try {
      var list = getSearchHistory();
      list = list.filter(function(n){ return n !== name; });
      list.unshift(name);
      list = list.slice(0, 5);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      renderHistoryChips();
    } catch(e) { /* localStorage unavailable */ }
  }

  function renderHistoryChips() {
    var area = document.getElementById("historyArea");
    if (!area) return;
    var list = getSearchHistory();
    if (!list.length) { area.innerHTML = ""; return; }
    var chipsHtml = list.map(function(name){
      return "<span class='chip history-chip' data-city='"+name+"'>"+name+"</span>";
    }).join("");
    area.innerHTML =
      "<p style=\"font-size:13px;color:#a090c8;padding:0 4px;margin-bottom:9px;display:flex;align-items:center;gap:5px;\"><span style=\"display:inline-block;width:3px;height:12px;background:linear-gradient(#e8a08b,#d87070);border-radius:2px;\"></span>あなたの検索履歴</p>" +
      "<div class='chips'>" + chipsHtml + "</div>";
    area.querySelectorAll(".history-chip").forEach(function(el){
      el.addEventListener("click", function(){
        document.getElementById("cityInput").value = this.getAttribute("data-city");
        hideSuggestions();
        diagnose();
      });
    });
  }

  var COMPARE_KEY = "mitchieCompareList";
  var COMPARE_MAX = 5;
  var HEALTH_LABELS = {happy:["絶好調","#6dcfad"],normal:["元気","#7bb8e8"],tired:["ちょっとしんどい","#f0c46a"],sick:["ぐったり","#f0876a"],critical:["ひんし","#d0505a"]};

  function healthState(score) {
    if (score>=85) return "happy";
    if (score>=70) return "normal";
    if (score>=50) return "tired";
    if (score>=30) return "sick";
    return "critical";
  }

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
      var color = colorFn(v);
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
      function(v){ return v<=0?"#6dcfad":v<100?"#7bb8e8":v<350?"#f0876a":"#d0505a"; },
      function(v){ return (v<=0?"0":v.toFixed(0))+"%"; }, false, "future");
    rows += buildCompareRow("財政調整基金", entries, function(e){ return (e.d.eo && e.d.eo>0) ? (e.d.r/e.d.eo*100) : 0; },
      function(v){ return v>=10?"#6dcfad":v>=5?"#f0c46a":"#f0876a"; },
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
      if (found) entries.push({name: found.k, d: found.d});
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
        if (found) {
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
  var mitchieTitleImgDataURL = null;
  function buildGradientTitleImage() {
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    return ready.then(function(){
      var scale = 3;
      var w = 700, h = 110;
      var canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      var ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.textBaseline = "alphabetic";
      ctx.font = "900 54px 'Kaisei Tokumin', serif";
      var text = "みっちー財政カルテ";
      var textWidth = ctx.measureText(text).width;
      var sparkleGap = 10;
      ctx.font = "34px sans-serif";
      var sparkleWidth = ctx.measureText("✨").width;
      var totalWidth = textWidth + sparkleGap + sparkleWidth;
      var startX = (w - totalWidth) / 2;
      var baseY = 74;
      ctx.font = "900 54px 'Kaisei Tokumin', serif";
      var grad = ctx.createLinearGradient(startX, 0, startX + textWidth, 0);
      grad.addColorStop(0, "#6a3de8");
      grad.addColorStop(0.5, "#b060d8");
      grad.addColorStop(1, "#e060a8");
      ctx.fillStyle = grad;
      ctx.fillText(text, startX, baseY);
      ctx.font = "34px sans-serif";
      ctx.fillStyle = "#e060a8";
      ctx.fillText("✨", startX + textWidth + sparkleGap, baseY - 3);
      mitchieTitleImgDataURL = canvas.toDataURL("image/png");
      return mitchieTitleImgDataURL;
    });
  }
  buildGradientTitleImage();

  function jumpToCity(target) {
    var found = find(target);
    if (!found) return false;
    var ov = document.getElementById("ovEl");
    var cOv = document.getElementById("compareOv");
    if (ov) ov.classList.add("hidden");
    if (cOv) cOv.classList.add("hidden");
    document.body.style.overflow = "";
    document.getElementById("cityInput").value = target;
    history.pushState({mitchieView:"result", city:target}, "", "#result");
    render(found, true);
    return true;
  }

  function shareHealthState(score) {
    if (score>=85) return "happy";
    if (score>=70) return "normal";
    if (score>=50) return "tired";
    if (score>=30) return "sick";
    return "critical";
  }

  function shcIsPref(k){ return !!(DB && DB[k] && DB[k].p === k); }
  function shcScoreOf(k){ var e=DB&&DB[k]; if(!e) return null; var s=calcH(e.f,e.d,e.x,e.u,e.r,e.eo,shcIsPref(k),e.sfs); return isNaN(s)?null:s; }
  function shcRankIn(keys, targetKey){
    var list=[];
    keys.forEach(function(k){ var s=shcScoreOf(k); if(s==null) return; list.push({k:k,v:s}); });
    list.sort(function(a,b){ return b.v-a.v; });
    for(var i=0;i<list.length;i++){ if(list[i].k===targetKey) return {rank:i+1,total:list.length}; }
    return null;
  }
  function shcRankNationalCity(cityKey){
    if(!DB) return null;
    return shcRankIn(Object.keys(DB).filter(function(k){ return !shcIsPref(k); }), cityKey);
  }
  function shcRankInPref(cityKey, prefName){
    if(!DB) return null;
    return shcRankIn(Object.keys(DB).filter(function(k){ return !shcIsPref(k) && DB[k].p===prefName; }), cityKey);
  }
  function shcRankPrefNational(prefKey){
    if(!DB) return null;
    return shcRankIn(Object.keys(DB).filter(function(k){ return shcIsPref(k); }), prefKey);
  }

  function shareRankBoxHtml(cityName, d){
    var isPref = (d.p === cityName);
    var html = "<div class='sc-rank-box'>";
    if (!isPref) {
      var nat = shcRankNationalCity(cityName);
      if (nat) html += "<div class='sc-rank-line'>全国 "+nat.rank.toLocaleString()+"位</div><div class='sc-rank-sub'>/ "+nat.total.toLocaleString()+"自治体</div>";
      var prefRank = shcRankInPref(cityName, d.p);
      if (prefRank) html += "<div class='sc-rank-line'>"+d.p+"内 "+prefRank.rank.toLocaleString()+"位</div><div class='sc-rank-sub'>/ "+prefRank.total.toLocaleString()+"市町村</div>";
    } else {
      var pn = shcRankPrefNational(cityName);
      if (pn) html += "<div class='sc-rank-line'>全国 "+pn.rank+"位</div><div class='sc-rank-sub'>/ "+pn.total+"都道府県</div>";
    }
    html += "</div>";
    return html;
  }

  function buildShareCardHTML(cityName, d, h, pr) {
    var state = shareHealthState(h);
    var STATE_LABELS = {happy:["絶好調",pr.c],normal:["元気",pr.c],tired:["ちょっとしんどい",pr.c],sick:["ぐったり",pr.c],critical:["ひんし",pr.c]};
    var fc = colorF(d.f);
    var dc = d.d<10?"#6dcfad":d.d<18?"#7bb8e8":d.d<25?"#f0c46a":"#f0876a";
    var xc = colorX(d.x);
    var uc = colorU(d.u, d.p === curName);
    var rc = colorR((d.sfs && d.sfs > 0) ? d.r / d.sfs * 100 : null, d.p === curName);
    var gc = d.g>=0?"#6dcfad":d.g>=-0.5?"#f0c46a":"#f0876a";

    var bars = [
      {label:"財政力指数", disp:d.f.toFixed(2), pct:Math.min(d.f/1.2*100,100), color:fc},
      {label:"実質公債費比率", disp:d.d.toFixed(1)+"%", pct:Math.max(100-(d.d/25*100),0), color:dc},
      {label:"経常収支比率", disp:d.x.toFixed(1)+"%", pct:Math.max(100-((d.x-70)/30*100),0), color:xc},
      {label:"将来負担比率", disp:(d.u<=0?"0":d.u.toFixed(0))+"%", pct:d.u<=0?100:Math.max(100-(d.u/200*100),0), color:uc},
      {label:"財政調整基金", disp:d.r.toFixed(1)+"億円", pct:d.eo? Math.min((d.r/d.eo*100)/15*100,100) : 50, color:rc},
      {label:"人口増減率", disp:(d.g>=0?"+":"")+d.g.toFixed(1)+"%", pct:Math.max(Math.min(50+d.g*20,100),0), color:gc}
    ];
    var barsHtml = bars.map(function(b){
      return "<div class='sc-bar-row'><div class='sc-bar-label'><span>"+b.label+"</span><span style='font-weight:700;color:"+b.color+";'>"+b.disp+"</span></div>" +
        "<div class='sc-bar-track'><div class='sc-bar-fill' style='width:"+b.pct+"%;background:"+b.color+";'></div></div></div>";
    }).join("");

    var summary = advice(cityName, d);
    var stateLabel = STATE_LABELS[state][0];

    return (
      "<div class='share-card'>" +
      "<div class='sc-brand'><img src='"+(mitchieTitleImgDataURL||"")+"' style='height:68px;'></div>" +
      "<div class='sc-city'>"+cityName+"</div>" +
      "<div class='sc-pref'>"+d.p+"</div>" +
      "<div class='sc-top'>" +
        "<div class='sc-top-left'>" +
          "<img src='data:image/png;base64,"+IMGS[pr.img]+"' alt='\"+pr.l+\"' style='width:190px;height:190px;object-fit:contain;'>" +
          "<div class='sc-score-sub'>総合財政健全度スコア</div>" +
          "<div class='sc-score' style='color:"+pr.c+";'>"+h+"<span style='font-size:30px;'>/100</span></div>" +
          "<div class='sc-state-label' style='color:"+pr.c+";'>"+stateLabel+"</div>" +
          shareRankBoxHtml(cityName, d) +
        "</div>" +
        "<div class='sc-top-right'>"+barsHtml+"</div>" +
      "</div>" +
      "<div class='sc-comment-wrap'>" +
        "<div class='sc-comment-title'>💬 みっちーからの一言</div>" +
        "<div class='sc-summary'>"+summary+"</div>" +
      "</div>" +
      "<div class='sc-footer'>ray-ray870.github.io/mitchie-fiscal</div>" +
      "</div>"
    );
  }

  function generateShareImageBlob(cityName, d, h, pr) {
    var titleReady = mitchieTitleImgDataURL ? Promise.resolve(mitchieTitleImgDataURL) : buildGradientTitleImage();
    return titleReady.then(function(){
      var host = document.getElementById("shareCardHost");
      host.innerHTML = buildShareCardHTML(cityName, d, h, pr);
      var target = host.querySelector(".share-card");
      return new Promise(function(resolve, reject){
        setTimeout(function(){
          html2canvas(target, {backgroundColor: null, scale: 1}).then(function(canvas){
            canvas.toBlob(function(blob){
              if (blob) { resolve(blob); } else { reject(new Error("blob作成失敗")); }
            }, "image/png");
          }).catch(reject);
        }, 50);
      });
    });
  }

  function showShareToast(html, icon) {
    var toast = document.getElementById("shareToast");
    if (!toast) return;
    toast.innerHTML = "<span style='font-size:22px;display:block;margin-bottom:4px;'>"+icon+"</span>"+html;
    toast.classList.remove("hidden");
    requestAnimationFrame(function(){ toast.classList.add("show"); });
    setTimeout(function(){
      toast.classList.remove("show");
      setTimeout(function(){ toast.classList.add("hidden"); }, 300);
    }, 2200);
  }

  var pendingShareData = null;

  function isLineInAppBrowser() {
    return /Line\//i.test(navigator.userAgent);
  }

  function shareResultImage(cityName, d, h, pr) {
    pendingShareData = {cityName:cityName, d:d, h:h, pr:pr};
    var warn = document.getElementById("inAppBrowserWarn");
    if (warn) {
      if (isLineInAppBrowser()) { warn.classList.remove("hidden"); }
      else { warn.classList.add("hidden"); }
    }
    document.getElementById("shareChoiceOv").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeShareChoiceModal() {
    document.getElementById("shareChoiceOv").classList.add("hidden");
    document.body.style.overflow = "";
  }

  function confirmShareToX() {
    var data = pendingShareData;
    closeShareChoiceModal();
    if (!data) return;
    var btn = document.getElementById("shareImgBtn");
    if (btn && btn.disabled) return;
    var origHTML = btn ? btn.innerHTML : "";
    if (btn) { btn.textContent = "画像を作成中…"; btn.disabled = true; }
    generateShareImageBlob(data.cityName, data.d, data.h, data.pr).then(function(blob){
      if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
      var shareText = data.cityName+"の財政健全度をみっちー財政カルテで診断したよ🐧\n#みっちー財政カルテ\n結果を詳しく見る↓";
      var shareUrl = "https://ray-ray870.github.io/mitchie-fiscal/?city="+encodeURIComponent(data.cityName);
      if (typeof gtag === "function") {
        gtag('event', 'share_image_click', { city_name: data.cityName, share_target: "x" });
      }
      var copyPromise;
      if (navigator.clipboard && window.ClipboardItem) {
        copyPromise = navigator.clipboard.write([new ClipboardItem({"image/png": blob})]).then(function(){ return true; }).catch(function(){ return false; });
      } else {
        copyPromise = Promise.resolve(false);
      }
      copyPromise.then(function(copied){
        if (copied) {
          showShareToast("<span style='font-size:14px;'>画像がコピーされました！</span><br><span style='font-size:19px;font-weight:700;color:#ffd76a;'>※本文に画像を貼り付けてください。</span>", "📋");
        } else {
          var link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "mitchie-"+data.cityName+".png";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showShareToast("画像を保存しました！<br>Xの投稿欄から選んで添付してね", "💾");
        }
        setTimeout(function(){
          window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(shareText)+"&url="+encodeURIComponent(shareUrl), "_blank");
        }, 1200);
      });
    }).catch(function(){
      if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
      alert("画像の作成に失敗しました。もう一度お試しください。");
    });
  }

  function confirmShareToOther() {
    var data = pendingShareData;
    closeShareChoiceModal();
    if (!data) return;
    var btn = document.getElementById("shareImgBtn");
    if (btn && btn.disabled) return;
    var origHTML = btn ? btn.innerHTML : "";
    if (btn) { btn.textContent = "画像を作成中…"; btn.disabled = true; }
    generateShareImageBlob(data.cityName, data.d, data.h, data.pr).then(function(blob){
      if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
      var shareText = data.cityName+"の財政健全度をみっちー財政カルテで診断したよ🐧\n#みっちー財政カルテ\n結果を詳しく見る↓";
      var shareUrl = "https://ray-ray870.github.io/mitchie-fiscal/?city="+encodeURIComponent(data.cityName);
      var fullText = shareText + "\n" + shareUrl;
      if (typeof gtag === "function") {
        gtag('event', 'share_image_click', { city_name: data.cityName, share_target: "other" });
      }
      var copyPromise = (navigator.clipboard && navigator.clipboard.writeText) ?
        navigator.clipboard.writeText(fullText).then(function(){ return true; }).catch(function(){ return false; }) :
        Promise.resolve(false);
      copyPromise.then(function(copied){
        if (copied) {
          showShareToast("本文+URLをクリップボードにコピーしました！<br>トーク(本文)を長押しして貼り付けてね", "📋");
        }
        setTimeout(function(){
          var file = new File([blob], "mitchie-"+data.cityName+".png", {type: "image/png"});
          if (navigator.canShare && navigator.canShare({files:[file]})) {
            navigator.share({files:[file], title:"みっちー財政カルテ", text: shareText, url: shareUrl}).catch(function(){});
          } else {
            var link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "mitchie-"+data.cityName+".png";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            if (!copied) { alert("画像を保存しました！共有したいアプリを開いて、保存した画像を選んで投稿してください📸"); }
          }
        }, copied ? 1200 : 0);
      });
    }).catch(function(){
      if (btn) { btn.innerHTML = origHTML; btn.disabled = false; }
      alert("画像の作成に失敗しました。もう一度お試しください。");
    });
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

  /* --- 基金が十分かどうかの共通判定 ---
     他の指標の総合コメントでも使う。基金カードの緑ラインと同じ基準なので、
     カードの色と文章が食い違わない。 */
  function reserveIsAmple(e, isPref) {
    if (!e || !e.sfs || e.sfs <= 0 || e.r == null) return false;
    return (e.r / e.sfs * 100) >= reserveBands(isPref).hi;
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

  if ("scrollRestoration" in history) { history.scrollRestoration = "manual"; }
  var DB = null;

  var dataFiles = [
    "data-hokkaido-tohoku.json",
    "data-kanto.json",
    "data-chubu.json",
    "data-kinki.json",
    "data-chugoku-shikoku.json",
    "data-kyushu.json"
  ];
  Promise.all(dataFiles.map(function(f){ return fetch(f).then(function(r){ return r.json(); }); }))
    .then(function(results){
      DB = {};
      results.forEach(function(data){ Object.assign(DB, data); });
      Object.keys(DB).forEach(function(k){ if (DB[k] && DB[k].p === k) DB[k].__pref = true; });
      var cnt = Object.keys(DB).length;
      window.mitchieMunicipalityCount = cnt;
      var el2 = document.getElementById("municipality-count2");
      if (el2) el2.textContent = cnt;
      console.log("データ読み込み完了: " + cnt + "自治体");
      try {
        var params = new URLSearchParams(window.location.search);
        var cityParam = params.get("city");
        if (cityParam) {
          var found = find(cityParam);
          if (found) {
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
    "南部町":"南部町（青森）","青森南部町":"南部町（青森）","山梨南部町":"南部町（山梨）","鳥取南部町":"南部町（鳥取）",
    "美郷町":"美郷町（秋田）","秋田美郷町":"美郷町（秋田）","島根美郷町":"美郷町（島根）","宮崎美郷町":"美郷町（宮崎）",
    "朝日町":"朝日町（山形）","山形朝日町":"朝日町（山形）","三重朝日町":"朝日町","三重県朝日町":"朝日町",
    "川西町":"川西町（山形）","山形川西町":"川西町（山形）","奈良川西町":"川西町（奈良）",
    "小国町":"小国町（山形）","山形小国町":"小国町（山形）","熊本小国町":"小国町（熊本）",
    "昭和村":"昭和村（福島）","福島昭和村":"昭和村（福島）","群馬昭和村":"昭和村（群馬）",
    "日高町":"日高町（北海道）","北海道日高町":"日高町（北海道）","和歌山日高町":"日高町（和歌山）",
    "松前町":"松前町（北海道）","北海道松前町":"松前町（北海道）","愛媛松前町":"松前町（愛媛）",
    "森町":"森町（北海道）","北海道森町":"森町（北海道）","静岡森町":"森町（静岡）",
    "清水町":"清水町（北海道）","北海道清水町":"清水町（北海道）","静岡清水町":"清水町（静岡）",
    "池田町":"池田町（北海道）","北海道池田町":"池田町（北海道）","岐阜池田町":"池田町（岐阜）",
    "川崎町":"川崎町（宮城）","宮城川崎町":"川崎町（宮城）","福岡川崎町":"川崎町（福岡）",
    "美里町":"美里町（宮城）","宮城美里町":"美里町（宮城）","埼玉美里町":"美里町（埼玉）","熊本美里町":"美里町（熊本）",
    "府中市":"府中市（東京）","東京府中":"府中市（東京）","広島府中":"府中市（広島）",
    "南牧村":"南牧村（群馬）","群馬南牧村":"南牧村（群馬）","長野南牧村":"南牧村（長野）",
    "高山村":"高山村（群馬）","群馬高山村":"高山村（群馬）","長野高山村":"高山村（長野）",
    "明和町":"明和町（群馬）","群馬明和町":"明和町（群馬）","三重明和町":"明和町（三重）",
    "美浜町":"美浜町（愛知）","愛知美浜町":"美浜町（愛知）","和歌山美浜町":"美浜町（和歌山）",
    "川上村":"川上村（長野）","長野川上村":"川上村（長野）","奈良川上村":"川上村（奈良）",
    "高森町":"高森町（長野）","長野高森町":"高森町（長野）","熊本高森町":"高森町（熊本）",
    "弥富市":"弥富市（愛知）","愛知弥富":"弥富市（愛知）",
    "広川町":"広川町（和歌山）","和歌山広川町":"広川町（和歌山）","福岡広川町":"広川町（福岡）",
    "日野町":"日野町（滋賀）","滋賀日野町":"日野町（滋賀）","鳥取日野町":"日野町（鳥取）"
  };

  function find(q) {
    q = q.trim();
    if (!q) return null;
    if (DB[q]) return {k:q, d:DB[q]};
    if (ALIAS[q] && DB[ALIAS[q]]) return {k:ALIAS[q], d:DB[ALIAS[q]]};
    var keys = Object.keys(DB);
    for (var i=0; i<keys.length; i++) {
      if (keys[i].indexOf(q)>=0 || q.indexOf(keys[i])>=0) return {k:keys[i], d:DB[keys[i]]};
    }
    return null;
  }

  function advice(name, d) {
    var h = calcH(d.f,d.d,d.x,d.u,d.r,d.eo,d.__pref,d.sfs);
    var r = d.r!=null ? d.r.toFixed(1) : "－";
    var g = d.g!=null ? (d.g>=0?"+":"")+d.g.toFixed(1) : "－";
    if (d.d>25) return name+"は実質公債費比率が"+d.d+"%と非常に重く財政再建が急務です🚨 ただし財政調整基金が"+r+"億円あり、返済が進めば将来的な改善も期待できます";
    if (d.f>=1.0) return name+"は財政力指数"+d.f.toFixed(2)+"の優良団体です⭐ 国に頼らない財政運営ができています。ただし人口増減率"+g+"%の動向に注目です";
    if (h>=80) return name+"の財政は総合的に健全です💙 財政力指数"+d.f.toFixed(2)+"・経常収支比率"+d.x.toFixed(1)+"%ともに良好で、住民サービスへのさらなる投資が期待されます";
    if (d.x>95) return name+"の財政はかなりしんどい状態です😔 収入の"+d.x.toFixed(1)+"%が固定費に消えています。一方で財政調整基金は"+r+"億円あり、行財政改革の努力に期待です🐧";
    if (d.g<-1.0) return name+"は人口減少率"+g+"%と深刻で税収への長期的影響が懸念されます😔 ただし財政調整基金"+r+"億円を抱えており、財政の底力は残っています🐧";
    if (h<50) return name+"の財政は厳しい状況です😔 財政力指数"+d.f.toFixed(2)+"と自主財源が乏しく、国からの交付税に依存しています。財政調整基金"+r+"億円の活用と歳出改革が課題です";
    return name+"の財政は全国平均的な水準です🐧 財政力指数"+d.f.toFixed(2)+"で大きな問題はありませんが、将来の人口減少・社会保障費増大への備えが重要です";
  }

  function prof(s) {
    if (s>=85) return {l:"絶好調みっちー",c:"#6dcfad",bg:"#d4f0e8",e:"⭐",m:"財政は非常に健全です。貯蓄も潤沢で投資余力も十分あります。",img:"happy"};
    if (s>=70) return {l:"元気なみっちー",c:"#7bb8e8",bg:"#e8f4fd",e:"💙",m:"財政はおおむね安定しています。引き続き堅実な運営が続けられています。",img:"normal"};
    if (s>=50) return {l:"ちょっとしんどいみっちー",c:"#f0c46a",bg:"#fdf5d4",e:"⚠️",m:"財政にやや課題があります。借入比率が高めで改善が必要な状態です。",img:"tired"};
    if (s>=30) return {l:"ぐったりみっちー",c:"#f0876a",bg:"#fde8e0",e:"🆘",m:"財政状況はかなり厳しい状態です。構造的な改革が急務です。",img:"sick"};
    return {l:"ひんし状態みっちー",c:"#d0505a",bg:"#ffe0e4",e:"🚨",m:"財政は非常に厳しい状態です。複数の指標が全国でも下位の水準にあります。",img:"critical"};
  }

  /* --- タイトルからホームに戻る ---
     自治体を開いているときだけ動く。履歴に積むので、
     端末の戻るボタンで元の自治体に帰れる。 */
  function goHome() {
    var re = document.getElementById("resEl");
    if (!re || re.classList.contains("hidden")) return;  // すでにホームなら何もしない

    var ov = document.getElementById("ovEl");
    if (ov && !ov.classList.contains("hidden")) ov.classList.add("hidden");
    var cOv = document.getElementById("compareOv");
    if (cOv && !cOv.classList.contains("hidden")) cOv.classList.add("hidden");
    document.body.style.overflow = "";

    history.pushState({mitchieView: "home"}, "", "#home");

    re.classList.add("hidden");
    var ma = document.getElementById("mitchieArea");
    if (ma) ma.classList.remove("hidden");
    var ci = document.getElementById("cityInput");
    if (ci) ci.value = "";
    hideSuggestions();
    window.scrollTo(0, 0);
  }

  function diagnose() {
    var q = document.getElementById("cityInput").value;
    if (!q.trim()) return;
    if (!DB) { alert("データを読み込み中です。少し待ってからもう一度お試しください。"); return; }
    var ld = document.getElementById("loadEl");
    var re = document.getElementById("resEl");
    var ma = document.getElementById("mitchieArea");
    re.classList.add("hidden");
    ld.classList.remove("hidden");
    if (ma) ma.classList.add("hidden");
    setTimeout(function() {
      ld.classList.add("hidden");
      var found = find(q);
      if (!found) {
        re.innerHTML = "<div class='err'>😢 「"+q+"」のデータが見つかりません。<br>例：姶良市、東京都、夕張市</div>";
        if (typeof gtag === "function") {
          gtag('event', 'search_not_found', { search_term: q });
        }
      } else {
        render(found);
      }
      re.classList.remove("hidden");
    }, 500);
  }

  function stars(h) {
    var n = h>=85?5:h>=70?4:h>=50?3:h>=30?2:1;
    var s = "";
    for(var i=0;i<5;i++) s += i<n?"★":"☆";
    return s;
  }

  function fiscalStatusBadge(d, isPref) {
    var dd = d.d, uu = (d.u!=null && d.u!=="-" && d.u!=="－") ? d.u : null;
    var jr = (d.jr!=null && d.jr!=="-" && d.jr!=="－") ? d.jr : null;
    var rjr = (d.rjr!=null && d.rjr!=="-" && d.rjr!=="－") ? d.rjr : null;
    var early = isPref ? {jr:3.75, rjr:8.75, d:25, u:400} : {jr:15, rjr:20, d:25, u:350};
    var recon = isPref ? {jr:5, rjr:15, d:35} : {jr:20, rjr:30, d:35};
    var isRecon = (jr!=null && jr>=recon.jr) || (rjr!=null && rjr>=recon.rjr) || (dd!=null && dd>=recon.d);
    var isEarly = !isRecon && ((jr!=null && jr>=early.jr) || (rjr!=null && rjr>=early.rjr) || (dd!=null && dd>=early.d) || (uu!=null && uu>=early.u));
    var isBond = dd!=null && dd>=18;
    var yrLabel = "令和6年度決算時点";
    var chips = "";
    if (isRecon) {
      chips += "<span style='display:inline-block;background:#e8506018;color:#c23b3b;border:1px solid #e8506055;border-radius:14px;padding:4px 12px;margin:3px 6px 3px 0;font-size:12px;font-weight:700;white-space:nowrap;'>🚨 財政再生団体</span>";
    } else if (isEarly) {
      chips += "<span style='display:inline-block;background:#f0a86018;color:#c07a1f;border:1px solid #f0a86055;border-radius:14px;padding:4px 12px;margin:3px 6px 3px 0;font-size:12px;font-weight:700;white-space:nowrap;'>⚠️ 早期健全化団体</span>";
    }
    if (isBond) {
      chips += "<span style='display:inline-block;background:#8b7ae818;color:#6b5b95;border:1px solid #8b7ae855;border-radius:14px;padding:4px 12px;margin:3px 6px 3px 0;font-size:12px;font-weight:700;white-space:nowrap;'>📋 起債許可団体</span>";
    }
    if (!chips) return "";
    return "<div id='fiscalBadgeWrap' style='margin-top:6px;cursor:pointer;width:100%;'>" +
      "<div style='display:flex;flex-wrap:nowrap;justify-content:center;overflow-x:auto;'>"+chips+"</div>" +
      "<div style='font-size:11px;color:#999;margin-top:3px;text-align:center;'>（"+yrLabel+"）</div>" +
      "</div>";
  }

  function render(found, skipHistory, keepScroll) {
    cur = found.d;
    var nm = found.k;
    curName = nm;
    var d = found.d;
    if (!skipHistory) {
      history.pushState({mitchieView:"result", city:nm}, "", "#result");
      addToSearchHistory(nm);
      if (typeof gtag === "function") {
        gtag('event', 'search_city', { city_name: nm });
      }
    }
    var h = calcH(d.f,d.d,d.x,d.u,d.r,d.eo,d.__pref,d.sfs);
    var pr = prof(h);
    var fc = colorF(d.f);
    var dc = d.d<10?"#6dcfad":d.d<18?"#7bb8e8":d.d<25?"#f0c46a":"#f0876a";
    var xc = colorX(d.x);
    var uc = colorU(d.u, d.p === curName);
    var rc = colorR((d.sfs && d.sfs > 0) ? d.r / d.sfs * 100 : null, d.p === curName);
    var gc = d.g>=0?"#6dcfad":d.g>=-0.5?"#f0c46a":"#f0876a";
    var ul = d.u<=0?"負担なし":d.u>=999?"再建中":d.u.toFixed(1)+"%";
    var chc = "#a08be8";  /* 良し悪しを判定できない指標のため中立色 */
    var chl = d.ch!=null ? d.ch.toFixed(1)+"万円" : "－";
    var educ = "#a08be8";  /* 良し悪しを判定できない指標のため中立色 */
    var edul = d.edu!=null ? d.edu.toFixed(1)+"%" : "－";
    var eoc = d.eog>=0?"#6dcfad":d.eog>=-0.5?"#f0c46a":"#f0876a";
    var eic = d.eig>=0?"#6dcfad":d.eig>=-0.5?"#f0c46a":"#f0876a";
    var eol = d.eo ? d.eo.toLocaleString()+"億円" : "－";
    var eil = d.ei ? d.ei.toLocaleString()+"億円" : "－";
    var eogs = d.eog!=null ? (d.eog>=0?"+":"")+d.eog.toFixed(1)+"%" : "";
    var eigs = d.eig!=null ? (d.eig>=0?"+":"")+d.eig.toFixed(1)+"%" : "";
    var el = document.getElementById("resEl");
    el.innerHTML =
      "<div class='fk-tabs'><button id='finTabBtn' class='fk-tab' role='button' tabindex='0'>財政</button><button id='kkTabBtn' class='fk-tab' role='button' tabindex='0'>公会計</button></div>" +
      "<div class='card' id='finContent'>" +
      "<div class='compare-corner-wrap' id='compareBtnWrap'></div>" +
      "<h2 class='sr-only'>診断結果</h2><div class='hero'>" +
        "<div class='ava'>" +
          "<img src='data:image/png;base64," + IMGS[pr.img] + "' alt='" + pr.l + "'>" +
          "<div class='badge' style='color:"+pr.c+";border-color:"+pr.c+";'>"+pr.e+"</div>" +
        "</div>" +
        "<div>" +
          "<div class='cname'>"+nm+"</div>" +
          "<div class='cpref'>"+d.p+"</div>" +
          "<div class='hlbl' style='background:"+pr.bg+";color:"+pr.c+";'>"+pr.l+"</div>" +
          "<div class='stars'>"+stars(h)+"</div>" +
          fiscalStatusBadge(d, nm===d.p) +
          "<div class='hmsg'>"+pr.m+"</div>" +
        "</div>" +
      "</div>" +
      "<h2 class='sr-only'>健康度スコア</h2>" + noteHtml(d, h, d.p === nm) + "<div class='meter' id='m0' role='button' tabindex='0' style='border:3px solid "+pr.c+";background:"+pr.c+"10;'><div class='mt'><span>総合財政健全度スコア（参考値）</span></div>" +
        "<div class='mb'><div id='hbar' class='mf' style='width:0%;background:"+pr.c+";'></div></div>" +
        "<div class='mv'><span style='color:"+pr.c+";font-weight:700;'>"+h+" / 100</span><span class='mt-tap'>タップでスコアの似た自治体と詳細を見る▶</span></div>" +
      "</div>" +
      "<div class='meter' id='m1' role='button' tabindex='0'><div class='mt'><span>実質公債費比率</span><span class='mt-tap'>タップで詳細 ▶</span></div>" +
        "<div class='mb'><div id='dbar' class='mf' style='width:0%;background:"+dc+";'></div></div>" +
        "<div class='mv'><span>0%</span><span style='color:"+dc+";font-weight:700;'>"+d.d+"%</span><span>35%+</span></div>" +
      "</div>" +
      "<div class='tap-hint'>📊 各項目をタップすると説明とグラフが表示されます</div>" +
      "<h2 class='sr-only'>財政指標の一覧</h2><div class='grid'>" +
        "<div class='stat' id='s0' role='button' tabindex='0' style='background:"+fc+"18;border-color:"+fc+"44;'><div class='si'>💪</div><div class='sl'>財政力指数</div><div class='sv' style='color:"+fc+";'>"+d.f.toFixed(2)+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s1' role='button' tabindex='0' style='background:"+xc+"18;border-color:"+xc+"44;'><div class='si'>📊</div><div class='sl'>経常収支比率</div><div class='sv' style='color:"+xc+";'>"+d.x.toFixed(1)+"%</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s2' role='button' tabindex='0' style='background:"+uc+"18;border-color:"+uc+"44;'><div class='si'>🏦</div><div class='sl'>将来負担比率</div><div class='sv' style='color:"+uc+";'>"+ul+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s3' role='button' tabindex='0' style='background:"+rc+"18;border-color:"+rc+"44;'><div class='si'>🐧</div><div class='sl'>財政調整基金</div><div class='sv' style='color:"+rc+";'>"+d.r+"億円</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s4' role='button' tabindex='0' style='background:"+gc+"18;border-color:"+gc+"44;'><div class='si'>👥</div><div class='sl'>人口増減率</div><div class='sv' style='color:"+gc+";'>"+(d.g>=0?"+":"")+d.g.toFixed(1)+"%</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s5' role='button' tabindex='0' style='background:#7bb8e818;border-color:#7bb8e844;'><div class='si'>💹</div><div class='sl'>歳出／歳入</div><div class='sv' style='font-size:14px;line-height:1.7;'><span style='color:"+eoc+";display:block;'>💸 歳出 "+eol+" <small style='font-size:13px;'>"+eogs+"</small></span><span style='color:"+eic+";display:block;'>💰 歳入 "+eil+" <small style='font-size:13px;'>"+eigs+"</small></span></div></div>" +
        "<div class='stat' id='s6' role='button' tabindex='0' style='background:"+educ+"18;border-color:"+educ+"44;'><div class='si'>📚</div><div class='sl'>教育費一般財源比率</div><div class='sv' style='color:"+educ+";'>"+edul+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s7' role='button' tabindex='0' style='background:"+chc+"18;border-color:"+chc+"44;'><div class='si'>👧</div><div class='sl'>子ども1人当たり投資額</div><div class='sv' style='color:"+chc+";'>"+chl+"</div><div class='su'>詳細を見る ▶</div></div>" +
      "</div>" +
      "<div class='adv'><strong>みっちーからのひとこと</strong><br>"+advice(nm,d)+"</div>" +
      "<div style='text-align:center;margin:16px 0 4px;'><button id='shareImgBtn' style='background:linear-gradient(135deg,#a08be8,#e060a8);color:white;border:none;border-radius:50px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(140,80,220,0.3);display:inline-flex;align-items:center;gap:8px;'>結果を共有する<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='18' cy='5' r='3'></circle><circle cx='6' cy='12' r='3'></circle><circle cx='18' cy='19' r='3'></circle><line x1='8.59' y1='13.51' x2='15.42' y2='17.49'></line><line x1='15.41' y1='6.51' x2='8.59' y2='10.49'></line></svg></button></div>" +
      "<div class='src'>📋 総務省「地方財政状況調査関係資料」令和6年度 | <a href='https://www.soumu.go.jp/iken/jokyo_chousa_shiryo.html' target='_blank'>総務省公式</a></div>" +
      "</div>" +
      "<div class='card hidden' id='kkContent'></div>";
    el.classList.remove("hidden");
    fkInitTabs(nm, d);
    renderCompareButton(nm);
    updateCompareBar();
    if (!keepScroll) { window.scrollTo(0, 0); }
    setTimeout(function(){
      document.getElementById("hbar").style.width = h+"%";
      document.getElementById("dbar").style.width = Math.min(d.d/35*100,100)+"%";
    }, 100);
    document.getElementById("m0").addEventListener("click", function(){ openD("health"); });
    var fbEl = document.getElementById("fiscalBadgeWrap");
    if (fbEl) fbEl.addEventListener("click", function(){ openD("fiscalStatus"); });
    document.getElementById("m1").addEventListener("click", function(){ openD("debt"); });
    document.getElementById("s0").addEventListener("click", function(){ openD("fiscalPower"); });
    document.getElementById("s1").addEventListener("click", function(){ openD("flex"); });
    document.getElementById("s2").addEventListener("click", function(){ openD("future"); });
    document.getElementById("s3").addEventListener("click", function(){ openD("reserve"); });
    document.getElementById("s4").addEventListener("click", function(){ openD("growth"); });
    document.getElementById("s5").addEventListener("click", function(){ openD("budget"); });
    document.getElementById("s6").addEventListener("click", function(){ openD("education"); });
    document.getElementById("s7").addEventListener("click", function(){ openD("childInvest"); });
    var shareImgBtn = document.getElementById("shareImgBtn");
    if (shareImgBtn) shareImgBtn.addEventListener("click", function(){ shareResultImage(nm, d, h, pr); });
  }

  var META = {
    health:{icon:"🏥",label:"総合財政健全度スコア",desc:"総務省の公式データから財政力・借金返済・固定費・将来負担・貯金の5指標を用いて算出した、本アプリ独自の参考スコアです（0〜100点）。公式の格付けではありません。\n\n都道府県は高校・国道・河川など大規模な資産を抱えるため、将来負担比率や経常収支比率の水準が市区町村より構造的に高くなります。そのため都道府県には専用の基準を用いており、市区町村の点数とは直接比較できません。\n\n目安\n85点以上 → 絶好調\n70点以上 → 元気\n50点以上 → ちょっとしんどい\n30点以上 → ぐったり\n30点未満 → ひんし状態\n\nスコアの上に出る帯について\n⚠️「ただし、〜は高い水準です」\n総合スコアは高めでも、その指標だけが弱い場合に出ます。たとえば税収などの体力はあるものの、毎年の支出が固まっていて、新しい取り組みに回せるお金は少ない、という状態です。\n\n💡「〜は健全な水準です」\n総合スコアは低めでも、その指標は明確に良い場合に出ます。全体としては厳しくても、その部分の管理はできている、という意味です。\n\nスコアは5つの指標をまとめた参考値です。1つの数字だけで判断せず、各指標もあわせて見てください。",unit:"pt",hib:true},
    debt:{icon:"💳",label:"実質公債費比率",desc:"一般会計等が負担する実質的な公債費の標準財政規模に対する比率。25%以上で早期健全化基準、35%以上で財政再生基準となります。出典：総務省令和6年度\n\n目安\n10%未満 → 健全\n18%超 → 注意\n25%以上 → 早期健全化基準\n35%以上 → 財政再生基準\n\n📈 高くなる理由\n① 過去の大型公共事業・施設建設で地方債を多く発行した\n② 合併特例債など特別な借入が多い\nなど。\n\n📉 低くなる理由\n① 堅実な財政運営で借入を抑制してきた\n② 財政力が高く税収が豊富なため借入が少ない\nなど。",unit:"%",hib:false},
    fiscalPower:{icon:"💪",label:"財政力指数",desc:"基準財政収入額を基準財政需要額で割った値。1.0以上の団体には地方交付税が交付されません（不交付団体）。出典：総務省令和6年度\n\n目安\n🟢 0.70以上 → 税収基盤が強い\n🔵 0.45〜0.70 → 標準的（中央値は市区町村0.44／都道府県0.47）\n🟡 0.25〜0.45 → 交付税への依存が大きい\n🟠 0.25未満 → 税収基盤が特に弱い\n\nなお1.0以上は不交付団体（地方交付税が交付されない団体）です。\n\nこの数値が低いことは、それ自体では財政危機を意味しません。税収が少ない分は地方交付税で補われる仕組みになっているためです。人口が少ない地域や産業基盤の小さい地域では、低い値が出るのが通常です。\n\n📈 高くなる理由\n① 企業・工場が多く法人税・固定資産税が豊富\n② 人口が多く個人住民税が充実している\nなど。\n\n📉 低くなる理由\n① 産業が乏しく税収基盤が弱い\n② 人口減少・高齢化で税収が低下している\nなど。",unit:"",hib:true},
    flex:{icon:"📊",label:"経常収支比率",desc:"毎年度の経常的収入のうち人件費・扶助費・公債費など経常的経費に充当された割合。低いほど財政に弾力性があります。出典：総務省令和6年度\n\n目安\nかつて「75〜80%が望ましい」とされてきましたが、これは法令上の基準ではなく慣例的な目安です。社会保障費の増加により全国的に上昇し、2003年度以降は全国平均が90%を超え続けています。\n\n🟢 90%未満 → 全国の中では余裕があるほう\n🔵 90〜95% → 標準的な水準（市区町村の中央値91.5%／都道府県93.8%）\n🟡 95〜98% → 新しい取り組みに回せるお金が少ない\n🟠 98%以上 → 余力がほぼない（全体の約9%）\n\nこの数字だけで良し悪しは判断できません。実質公債費比率や財政力指数と合わせて見てください。\n\n📈 高くなる理由\n① 人件費・社会保障費など固定的な支出が大きい\n② 過去の借金返済（公債費）が重い\nなど。\n\n📉 低くなる理由\n① 税収が豊富で財政に余裕がある\n② 行財政改革で人件費・固定費を削減した\nなど。",unit:"%",hib:false},
    future:{icon:"🏦",label:"将来負担比率",desc:"一般会計等が将来負担すべき実質的な負債総額の標準財政規模に対する比率。350%以上で早期健全化基準。出典：総務省令和6年度\n\n目安（市区町村）\n🟢 負担なし・0%\n🔵 60%未満 → 軽い\n🟡 60〜100% → 一定の負担あり\n🟠 100%以上 → 要注意\n\n目安（都道府県）\n🟢 100%未満\n🔵 100〜160% → 標準的（47都道府県の中央値は159.7%）\n🟡 160〜250% → やや重い\n🟠 250%以上 → 重い\n\n都道府県は高校・国道・河川など大規模な資産を抱えるため、市区町村より水準が高くなります。そのため色の基準を分けています。\n\nなお350%以上は法令上の早期健全化基準です（市区町村は350%、都道府県は400%）。\n\n📈 高くなる理由\n① 過去の借入が多く残債が大きい\n② 公営企業・第三セクターの債務も含まれる\nなど。\n\n📉 低くなる理由\n① 借入を抑制し着実に返済してきた\n② 財政調整基金など充当可能財源が多い\nなど。",unit:"%",hib:false},
    reserve:{icon:"🐧",label:"財政調整基金残高",desc:"年度間の財源不足に備えて積み立てている自治体の貯金です。残高が多いほど不測の事態への備えがあります。出典：総務省基金残高等一覧令和6年度（概算）\n\n目安（標準財政規模に対する割合）\n標準財政規模とは、自治体が使い道を決められるお金（一般財源）の標準的な総額です。財政調整基金の水準は、実務でもこの割合で語られます。\n\n市区町村（中央値24.8%）\n🟢 20%以上 → 一般に適正とされる上限に到達\n🔵 10〜20% → 一般に適正とされる範囲\n🟡 5〜10% → やや少なめ\n🟠 5%未満 → 少ないほう\n\n都道府県（中央値6.4%）\n🟢 10%以上 → 都道府県としては多いほう\n🔵 5〜10% → 総務省調査で最も多い水準\n🟡 2.5〜5% → やや少なめ\n🟠 2.5%未満 → 少ないほう\n\n適正水準に法令上の基準はありません。総務省が平成29年に行った調査では、積立の考え方を「標準財政規模の一定割合」と答えた団体の水準は、都道府県で5%前後、市町村で5〜20%が多いという結果でした。都道府県と市区町村では水準が大きく違うため、基準を分けています。\n\n多いほど良いとは限りません。積立の原資は住民が納めた税金であり、貯め込みすぎは「使うべきところに使えていない」という見方もできます。\n\n📈 多い理由\n① 税収が安定し積立を続けてきた\n② 原発立地など特別な収入がある\nなど。\n\n📉 少ない理由\n① 財政難で取り崩しが続いている\n② 大規模災害・事業で緊急支出があった\nなど。",unit:"億円",hib:true},
    growth:{icon:"👥",label:"人口増減率",desc:"住民基本台帳に基づく前年比人口増減率。人口減少は税収低下や社会保障費増加につながります。出典：総務省令和7年\n\n目安\n0%以上 → 人口増加\n-0.5%以上 → 緩やかな減少\n-1%以下 → 深刻な人口減少\n\n📈 増加の理由\n① 子育て支援・住環境が充実した新興住宅地\n② 企業誘致・雇用創出が成功している\nなど。\n\n📉 減少の理由\n① 若者が都市部へ流出している\n② 少子高齢化が急速に進んでいる\nなど。",unit:"%",hib:true},
    budget:{icon:"💹",label:"歳出／歳入",desc:"一般会計の歳出・歳入総額（億円）。自治体の予算規模を示します。歳出は人件費・扶助費・公債費・投資的経費などの総支出、歳入は地方税・地方交付税・国庫支出金・地方債などの総収入です。出典：総務省令和6年度地方財政状況調査\n\n目安\n歳入＞歳出 → 黒字基調\n歳入＝歳出 → 収支均衡\n歳入＜歳出 → 赤字基調（要注意）",unit:"億円",hib:true},
    education:{icon:"📚",label:"教育費一般財源比率",desc:"歳出総額に占める教育費の割合です（総務省令和6年度データ）。\n\n目安\n中央値は市区町村10.5%、都道府県18.9%です。都道府県は高校・特別支援学校を持つため、市区町村より構造的に高くなります。\n\n⚠️ この数字には良し悪しがありません。そのため色分けをしていません。\n高いのは教育を重視しているからとも、学校施設の老朽化対応や小規模校の維持で費用がかさんでいるからとも読めます。低いのは子どもの人口が多くて相対的に下がっている場合もあります。他の指標と合わせてご覧ください。\n\n📈 比率が高くなる理由\n① 学校施設の老朽化対応（校舎・体育館の改修・建替え）\n② 少子化でも学校を統廃合できず固定費がかかる\n③ 教育・子育てを重点政策と位置づけ積極的に投資している\n④ 過疎地・離島で小規模校を存続させている\nなど。\n\n📉 比率が低くなる理由\n① 子ども人口が多く相対的に比率が下がる\n② 子育て・教育より、他の政策を優先する政策判断のため。（他の政策→インフラ・高齢者福祉などが考えられる）\nなど。",unit:"%",hib:false},
    childInvest:{icon:"👧",label:"子ども1人当たり投資額",desc:"教育費と児童福祉費の合計を18歳未満人口で割った値です（総務省令和6年度データ）。\n\n目安\n中央値は市区町村118.4万円、都道府県87.9万円です。\n\n⚠️ この数字には良し悪しがありません。そのため色分けをしていません。\n18歳未満の人数で割った値なので、子どもが少ない自治体ほど大きく出ます。全国で最も高いのは974万円ですが、これは投資が手厚いのではなく、分母となる子どもの数が極端に少ないためです。逆に子育て世代が多い新興住宅地では、分母が大きくなるため低く出ます。\n\n金額の大小ではなく、同じ規模の自治体との比較や、経年の変化を見るほうが実態をつかめます。\n\n📉 数値が低い理由\n① 子育て世代が多く子ども人口が多い新興住宅地（分母が大きい）\n② 財政が厳しく教育・子育てへの支出が少ない\n③ 子育て・教育より、他の政策を優先する政策判断のため。（他の政策→インフラ・高齢者福祉などが考えられる）\nなど。\n\n📈 数値が高い理由\n① 過疎地で子ども数が極少なため1人当たりコストが膨らむ\n② 教育・子育てを重点政策と位置づけ積極的に投資している\nなど。",unit:"万円",hib:true},
    fiscalStatus:{icon:"📋",label:"起債許可団体・早期健全化団体・財政再生団体とは",desc:"",htmlDesc:
      "財政状況を示す3つの区分です。実は2つの別々の制度に基づいています。<br>" +
      "・起債許可団体 → 地方財政法（地方債協議・許可制度）<br>" +
      "・早期健全化団体／財政再生団体 → 地方公共団体の財政の健全化に関する法律（財政健全化法）<br><br>" +
      "いずれも令和6年度決算に基づく判定です。<br><br>" +
      "<span style='display:inline-block;background:#8b7ae818;color:#6b5b95;border:1px solid #8b7ae844;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>📋 起債許可団体</span><br>" +
      "実質公債費比率が18%以上になると、地方債（借金）を新しく発行する際に総務大臣・知事の許可が必要になります。<br>" +
      "現在該当：<span class='peer-chip' data-city='北海道' style='display:inline-block;background:#8b7ae814;border:1px solid #8b7ae840;border-radius:12px;padding:2px 9px;font-size:12px;margin:2px 3px 0 0;cursor:pointer;'>北海道</span><span class='peer-chip' data-city='新潟県' style='display:inline-block;background:#8b7ae814;border:1px solid #8b7ae840;border-radius:12px;padding:2px 9px;font-size:12px;margin:2px 3px 0 0;cursor:pointer;'>新潟県</span><span class='peer-chip' data-city='夕張市' style='display:inline-block;background:#8b7ae814;border:1px solid #8b7ae840;border-radius:12px;padding:2px 9px;font-size:12px;margin:2px 3px 0 0;cursor:pointer;'>夕張市</span><br><br>" +
      "<span style='display:inline-block;background:#f0a86018;color:#c07a1f;border:1px solid #f0a86044;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>⚠️ 早期健全化団体</span><br>" +
      "実質赤字比率（都道府県3.75% / 市町村11.25〜15%）・連結実質赤字比率（都道府県8.75% / 市町村16.25〜20%）・実質公債費比率（25%）・将来負担比率（都道府県400% / 市町村350%）のいずれか1つでも基準を超えると、自主的な改善計画（財政健全化計画）を作ることが義務付けられます。<br>" +
      "現在該当：該当団体はありません<br><br>" +
      "<span style='display:inline-block;background:#e8506018;color:#c23b3b;border:1px solid #e8506044;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>🚨 財政再生団体</span><br>" +
      "実質赤字比率（都道府県5% / 市町村20%）・連結実質赤字比率（都道府県15% / 市町村30%）・実質公債費比率（35%）のいずれか1つでも基準を超えると、国の関与のもとで確実な再生に取り組む「財政再生計画」の策定が義務付けられます（将来負担比率にはこの基準はありません）。<br>" +
      "現在該当：<span class='peer-chip' data-city='夕張市' style='display:inline-block;background:#e8506014;border:1px solid #e8506040;border-radius:12px;padding:2px 9px;font-size:12px;margin:2px 3px 0 0;cursor:pointer;'>夕張市</span>",
    unit:"",hib:false}
  };

  function openD(key, skipPush) {
    if (!cur) return;
    var m = META[key];
    if (!m) return;
    if (typeof gtag === "function") {
      gtag('event', 'view_metric_detail', { metric_key: key });
    }
    if (!skipPush && document.getElementById("ovEl").classList.contains("hidden")) {
      if (history.state && history.state.mitchieView === "result") {
        history.replaceState(Object.assign({}, history.state, {scrollY: window.scrollY}), "", "#result");
      }
      history.pushState({mitchieView:"detail", key:key}, "", "#detail");
    }
    var shEl = document.querySelector(".sh");
    if (shEl) shEl.scrollTop = 0;
    if (key === "fiscalStatus") {
      document.getElementById("shTitle").textContent = m.icon+" "+m.label;
      document.getElementById("shDesc").innerHTML = m.htmlDesc || chipifyHeaders(m.desc).replace(/\n/g,"<br>");
      document.getElementById("spSvg").innerHTML = "";
      document.getElementById("spSvg").style.height = "0px";
      document.getElementById("spLabels").innerHTML = "";
      document.getElementById("ovEl").classList.remove("hidden");
      document.querySelectorAll(".peer-chip").forEach(function(chip){
        chip.addEventListener("click", function(){
          jumpToCity(this.getAttribute("data-city"));
        });
      });
      return;
    }
    var val = key==="health"?calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs):key==="fiscalPower"?cur.f:key==="debt"?cur.d:key==="flex"?cur.x:key==="future"?cur.u:key==="reserve"?cur.r:key==="budget"?(cur.eo||0):key==="education"?(cur.edu||0):key==="childInvest"?(cur.ch||0):cur.g;
    var seed = (Math.abs(val*137) + key.charCodeAt(0)*31) % 100;
    var MAX_HIST = 7; // 過去最大7年分＋最新=8ポイントまで
    function countHist(prefix, startIdx) {
      var n = 0;
      for (var i = startIdx; i < startIdx + MAX_HIST; i++) {
        if (Object.prototype.hasOwnProperty.call(cur, prefix + "_r" + i)) n++;
        else break;
      }
      return n;
    }
    var histCountFiscal = countHist("f", 1);
    var growthStartIdx = 1;
    var histCountGrowth = (key==="reserve"||key==="education"||key==="childInvest") ? countHist(key==="education"?"edu":key==="childInvest"?"ch":"r", growthStartIdx) : countHist("g", 2);
    var vals = [];
    var yrs;
    // f・x・d・health・reserve・education・childInvestは令和元年始まりの実績データ、growthのみ令和2年始まりの実績値
    var hasHistory = (key==="fiscalPower"||key==="debt"||key==="flex"||key==="health"||key==="future") && histCountFiscal > 0;
    var hasGrowthHistory = (key==="growth"||key==="reserve"||key==="education"||key==="childInvest") && histCountGrowth > 0;
    if (hasHistory) {
      var N = histCountFiscal;
      var getVal = function(i) {
        var suffix = "_r" + i;
        if (key==="fiscalPower") return cur["f"+suffix];
        if (key==="debt") return cur["d"+suffix];
        if (key==="flex") return cur["x"+suffix];
        if (key==="future") return cur["u"+suffix];
        if (key==="health") {
          var f=cur["f"+suffix], d=cur["d"+suffix], x=cur["x"+suffix];
          return (f!=null&&d!=null&&x!=null)?calcH(f,d,x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs):null;
        }
        return null;
      };
      var mainVal = key==="fiscalPower"?cur.f:key==="debt"?cur.d:key==="flex"?cur.x:key==="future"?cur.u:key==="health"?calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs):null;
      var lastFiscalHist = N>0 ? getVal(N) : null;
      var fiscalIsDup = (mainVal!=null && lastFiscalHist!=null && Math.abs(mainVal-lastFiscalHist) < 0.05);
      if (fiscalIsDup) { N = N - 1; }
      var histDecimals = key==="fiscalPower" ? 2 : 1;
      for (var hi=1; hi<=N; hi++) {
        var v2 = getVal(hi);
        vals.push(v2!=null ? parseFloat(parseFloat(v2).toFixed(histDecimals)) : null);
      }
      vals.push(mainVal!=null ? parseFloat(parseFloat(mainVal).toFixed(histDecimals)) : null);
      yrs = ["R1","R2","R3","R4","R5","R6","R7"].slice(0,N).concat(["R"+(N+1)+"（最新）"]);
    } else if (hasGrowthHistory) {
      var N2 = histCountGrowth;
      var fieldPrefix = key==="growth"?"g":key==="reserve"?"r":key==="education"?"edu":"ch";
      var decimals = key==="growth" ? 2 : 1;
      var gMain = key==="growth"?cur.g:key==="reserve"?cur.r:key==="education"?cur.edu:cur.ch;
      var lastGrowthHist = N2>0 ? cur[fieldPrefix+"_r"+(growthStartIdx-1+N2)] : null;
      var growthIsDup = (gMain!=null && lastGrowthHist!=null && Math.abs(gMain-lastGrowthHist) < 0.05);
      if (growthIsDup) { N2 = N2 - 1; }
      for (var gi=growthStartIdx; gi<growthStartIdx+N2; gi++) {
        var v3 = cur[fieldPrefix+"_r"+gi];
        vals.push(v3!=null ? parseFloat(parseFloat(v3).toFixed(decimals)) : null);
      }
      vals.push(gMain!=null ? parseFloat(gMain.toFixed(decimals)) : null);
      var growthYrLabels = growthStartIdx===1 ? ["R1","R2","R3","R4","R5","R6","R7"] : ["R2","R3","R4","R5","R6","R7","R8"];
      yrs = growthYrLabels.slice(0,N2).concat(["R"+(N2+growthStartIdx)+"（最新）"]);
    } else {
      // 推計（従来ロジック）
      yrs = ["R1","R2","R3","R4","R5（最新）"];
      var v = val * (0.88 + (seed%20)/100);
      for (var i=0; i<5; i++) { v = v + Math.sin(i*2.1+seed*0.1)*Math.abs(val)*0.08; vals.push(parseFloat(v.toFixed(1))); }
      vals.push(val);
    }
    var reserveRatio = (cur && cur.sfs && cur.sfs > 0) ? (cur.r / cur.sfs * 100) : null;
    var budgetColor = (cur && cur.eo!=null && cur.ei!=null) ? (cur.ei>=cur.eo?"#6dcfad":cur.ei>=cur.eo*0.99?"#7bb8e8":"#f0876a") : "#7bb8e8";
    // 各色分けは「詳細画面の一言」(descHtml)の判定ロジックと基準を統一しています
    var cmap = {
      health: val>=85?"#6dcfad":val>=70?"#7bb8e8":val>=50?"#f0c46a":val>=30?"#f0876a":"#d0505a",
      debt: val<10?"#6dcfad":val<18?"#7bb8e8":val<25?"#f0c46a":"#f0876a",
      fiscalPower: val>=1.0?"#6dcfad":val>=0.7?"#7bb8e8":val>=0.5?"#f0c46a":"#f0876a",
      flex: val<88?"#6dcfad":val<95?"#7bb8e8":"#f0876a",
      future: val<=0?"#6dcfad":val<100?"#7bb8e8":val<350?"#f0876a":"#d0505a",
      reserve: colorR(reserveRatio, isPrefView),
      growth: val>=0?"#6dcfad":val>=-0.5?"#f0c46a":"#f0876a",
      budget: budgetColor,
      education: "#a08be8",
      childInvest: "#a08be8"
    };
    var c = cmap[key]||"#a08be8";
    document.getElementById("shTitle").textContent = m.icon+" "+m.label;

    // ランキング（自治体は同一都道府県内、都道府県は全国47都道府県内）
    var rankHtml = "";
    var rankableKeys = {fiscalPower:1,debt:1,flex:1,future:1,reserve:1,growth:1,education:1,childInvest:1,health:1};
    var isPrefView = cur && curName === cur.p;
    if (rankableKeys[key] && cur && DB) {
      var lowerBetter = (key==="debt"||key==="flex"||key==="future");
      var getRankVal = function(e){
        if (key==="health") return (e.f!=null&&e.d!=null&&e.x!=null)?calcH(e.f,e.d,e.x,e.u,e.r,e.eo,e.__pref,e.sfs):null;
        if (key==="fiscalPower") return e.f;
        if (key==="debt") return e.d;
        if (key==="flex") return e.x;
        if (key==="future") return e.u==null?0:e.u;
        if (key==="reserve") return e.r;
        if (key==="growth") return e.g;
        if (key==="education") return e.edu;
        if (key==="childInvest") return e.ch;
        return null;
      };
      var list = [];
      Object.keys(DB).forEach(function(k2){
        var e = DB[k2];
        if (isPrefView) {
          if (k2 !== e.p) return; // 都道府県の行だけ対象
        } else {
          if (e.p !== cur.p) return;
          if (k2 === e.p) return; // 都道府県自身の行は除外
        }
        var v2 = getRankVal(e);
        if (v2==null || isNaN(v2)) return;
        list.push({k:k2, v:v2});
      });
      if (list.length) {
        list.sort(function(a,b){ return lowerBetter ? a.v-b.v : b.v-a.v; });
        var myRank = null;
        for (var ri=0; ri<list.length; ri++){ if (list[ri].k===curName){ myRank=ri+1; break; } }
        if (myRank) {
          var pct = myRank / list.length;
          var rankColor = pct<=0.2 ? "#6dcfad" : pct<=0.5 ? "#7bb8e8" : pct<=0.8 ? "#f0c46a" : "#f0876a";
          var rankLabel = isPrefView ? ("🏆 全国 "+list.length+"都道府県中 <span style='font-size:17px;'>"+myRank+"位</span>") : ("🏆 "+cur.p+"内 "+list.length+"自治体中 <span style='font-size:17px;'>"+myRank+"位</span>");
          rankHtml = "<div style='display:inline-flex;align-items:center;gap:6px;background:"+rankColor+"18;border:1.5px solid "+rankColor+"44;border-radius:12px;padding:6px 14px;margin:6px 0 12px;font-size:14px;font-weight:700;color:"+rankColor+";'>"+rankLabel+"</div><br>";
        }
      }
    }

    // 総合健全度スコアが近い自治体（自治体は同一都道府県内、都道府県は全国）
    var peersHtml = "";
    var curTypeLabel = "";
    if (key === "health" && cur && DB) {
      var myScore = calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs);
      var peerType = function(e){
        var fLv = e.f>=1.0 ? "財政力高め" : e.f>=0.6 ? "財政力標準" : "財政力低め";
        var uLv = (e.u==null||e.u<=0) ? "借金なし" : e.u<100 ? "借金少なめ" : "借金重め";
        return fLv+"・"+uLv;
      };
      var peerList = [];
      Object.keys(DB).forEach(function(k3){
        if (k3 === curName) return;
        var e = DB[k3];
        if (isPrefView) {
          if (k3 !== e.p) return; // 都道府県の行だけ対象
        } else {
          if (e.p !== cur.p) return;
          if (k3 === e.p) return; // 都道府県自身は除外
        }
        if (e.f==null||e.d==null||e.x==null) return;
        var s = calcH(e.f,e.d,e.x,e.u,e.r,e.eo,e.__pref,e.sfs);
        peerList.push({k:k3, s:s, diff:Math.abs(s-myScore), type:peerType(e)});
      });
      var typeNums = {};
      var nextNum = 1;
      var circled = ["A","B","C","D","E","F","G","H","I"];
      var myType = peerType(cur);
      typeNums[myType] = nextNum++; // 自分自身のタイプを①として先に確保
      if (peerList.length) {
        peerList.sort(function(a,b){ return a.diff-b.diff; });
        var top5 = peerList.slice(0,5);
        var chips = top5.map(function(p){
          if (!(p.type in typeNums)) { typeNums[p.type] = nextNum++; }
          var num = circled[(typeNums[p.type]-1) % circled.length];
          return "<div class='peer-chip' data-city='"+p.k+"' style='display:inline-block;background:white;border:1.5px solid #a08be844;border-radius:12px;padding:7px 12px;margin:3px;cursor:pointer;vertical-align:top;'>" +
            "<div style='font-size:13px;font-weight:700;color:#6050a8;'>"+p.k+" "+p.s+"点</div>" +
            "<div style='font-size:11px;color:#9080b0;margin-top:2px;'><strong style='color:#6a3de8;'>"+num+"</strong> "+p.type+"</div>" +
            "</div>";
        }).join("");
        var peersLabel = isPrefView ? "🐧 全国でスコアが近い都道府県" : ("🐧 "+cur.p+"内でスコアが近い自治体");
        peersHtml = "<div style='background:rgba(232,160,150,0.1);border:1.5px solid rgba(232,160,150,0.3);border-radius:10px;padding:10px 12px;'>" +
          "<div style='font-size:13px;color:#c07050;font-weight:700;margin-bottom:6px;'>"+peersLabel+"</div>" +
          "<div style='font-size:13px;color:#7050a0;background:rgba(160,139,232,0.12);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-weight:600;'>※同じ点数でも内訳の組み合わせが違うと、<strong style='color:#6a3de8;'>A〜I</strong>の9タイプに分かれます</div>" +
          "<div>"+chips+"</div></div>";
      }
      var myNum = circled[(typeNums[myType]-1) % circled.length];
      curTypeLabel = "<strong style='color:#6a3de8;'>"+myNum+"</strong> "+myType;
    }

    var PREF_MUNI_REASONS = {
      fiscalPower: {prefHigh:null, prefLow:null, muniHigh:"発電所など特定の大規模施設の立地に税収が大きく左右されやすい", muniLow:null},
      debt: {prefHigh:"道路・河川・港湾など広域インフラ整備の借入負担が中心", prefLow:null, muniHigh:"学校・ごみ処理施設・上下水道など、住民に身近な施設整備の借入が中心", muniLow:"施設更新を計画的に平準化している自治体は、数値が安定しやすい"},
      flex: {prefHigh:"公立小中学校教員給与の都道府県負担分が、人件費の割合を押し上げやすい", prefLow:null, muniHigh:"保育・介護・生活保護など、住民向けの扶助費の割合が大きい", muniLow:"高齢化率が低く扶助費の負担が軽い自治体は、数値が改善しやすい"},
      future: {prefHigh:"道路や病院など大きな工事を担当することが多く、負担が積み上がりやすい", prefLow:null, muniHigh:"学校・公民館など身近な施設の建替えが中心で、人口規模が小さいと影響が出やすい", muniLow:"施設の統廃合・更新の平準化が進む自治体は、比較的低く抑えられる"},
      reserve: {prefHigh:"予算規模が大きい分、基金の絶対額も大きくなりやすい", prefLow:"大型事業に基金を計画的に充当してきた都道府県は、残高が少なめになりやすい", muniHigh:"人口規模が小さい自治体ほど、標準財政規模に対する基金の比率が高く出やすい", muniLow:null},
      growth: {prefHigh:"都市部への人口集中が起きやすい", prefLow:"多くの市区町村の減少傾向が積み重なり、県全体でも緩やかな減少になりやすい", muniHigh:null, muniLow:"人口が少ない自治体ほど、少数の転出だけでも減少率が大きく振れやすい"},
      education: {prefHigh:"公立高校・特別支援学校の運営費や教員人件費（都道府県負担分）が中心", prefLow:"高校再編や広域連携が進んだ都道府県は、比較的抑えられやすい", muniHigh:"小中学校では単年度の校舎建設で数値が大きく変動しやすい", muniLow:"学校施設の更新を先送りしている自治体は、数値が低く出やすい"},
      childInvest: {prefHigh:"高校・特別支援学校など、より広域的な教育インフラのコストが反映される", prefLow:"広域的な教育インフラの整備が一巡した都道府県は、数値が落ち着きやすい", muniHigh:"保育所・児童館など、より身近な子育て支援サービスのコストが中心", muniLow:null}
    };
    var PREF_MUNI_SIMPLE = {
      budget: {pref:"市区町村への補助金・交付金など、広域的な財政移転を含む", muni:"ごみ収集・消防・上下水道など、住民に直結する行政サービスが中心"}
    };
    var pmrTagHtml = function(){
      return isPrefView ? "<span style='background:#f0876a18;color:#f0876a;border:1px solid #f0876a44;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:700;'>都道府県</span>" : "<span style='background:#7bb8e818;color:#7bb8e8;border:1px solid #7bb8e844;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:700;'>市区町村</span>";
    };
    var descSrc = m.desc;
    if (PREF_MUNI_REASONS[key] && cur) {
      var pmr = PREF_MUNI_REASONS[key];
      var highText = isPrefView ? pmr.prefHigh : pmr.muniHigh;
      var lowText = isPrefView ? pmr.prefLow : pmr.muniLow;
      var tag = pmrTagHtml();
      var highIdx = descSrc.indexOf("📈");
      var lowIdx = descSrc.indexOf("📉");
      if (highIdx >= 0 && lowIdx >= 0 && (highText || lowText)) {
        var firstIdx = Math.min(highIdx, lowIdx);
        var secondIdx = Math.max(highIdx, lowIdx);
        var beforeFirst = descSrc.slice(0, firstIdx);
        var firstSection = descSrc.slice(firstIdx, secondIdx);
        var secondSection = descSrc.slice(secondIdx);
        var firstText = firstIdx === highIdx ? highText : lowText;
        var secondText = secondIdx === highIdx ? highText : lowText;
        if (firstText) firstSection = firstSection.replace(/など。/, tag+" "+firstText+"\nなど。");
        if (secondText) secondSection = secondSection.replace(/など。/, tag+" "+secondText+"\nなど。");
        descSrc = beforeFirst + firstSection + secondSection;
      }
    }
    function chipifyHeaders(text) {
      text = text.replace(/目安[^\n]*/g, function(m){
        return "<span style='display:inline-block;background:#8b7ae818;color:#6b5b95;border:1px solid #8b7ae844;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>"+m+"</span>";
      });
      text = text.replace(/📈[^\n]*/g, function(m){
        return "<span style='display:inline-block;background:#f0876a18;color:#d9784f;border:1px solid #f0876a44;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>"+m+"</span>";
      });
      text = text.replace(/📉[^\n]*/g, function(m){
        return "<span style='display:inline-block;background:#5b9bd518;color:#4a86c8;border:1px solid #5b9bd544;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>"+m+"</span>";
      });
      return text;
    }
    var descHtml = rankHtml + chipifyHeaders(descSrc).replace(/\n/g,"<br>");
    if (PREF_MUNI_SIMPLE[key] && cur) {
      var pms = PREF_MUNI_SIMPLE[key];
      var pmsText = isPrefView ? pms.pref : pms.muni;
      descHtml += "<br>"+pmrTagHtml()+" "+pmsText;
    }
    if (key === "reserve" && cur && cur.sfs && cur.sfs > 0) {
      var ratio = cur.r / cur.sfs * 100;
      var rb = reserveBands(isPrefView);
      var judge = ratio >= rb.hi ? "多いほう" : ratio >= rb.mid ? "標準的な水準" : ratio >= rb.lo ? "やや少なめ" : "少ないほう";
      var judgeColor = colorR(ratio, isPrefView);
      descHtml += "<br><br><strong style='color:"+judgeColor+";'>"+curName+"の財政調整基金は標準財政規模の"+ratio.toFixed(1)+"%で、"+judge+"です。</strong>";
      var rHist = [cur.r_r2, cur.r_r3, cur.r_r4, cur.r_r5].filter(function(v){ return v!=null; });
      if (rHist.length >= 2) {
        var rAvg = rHist.reduce(function(a,b){return a+b;},0) / rHist.length;
        var rRatio = rAvg > 0 ? cur.r / rAvg : 1;
        if (rRatio >= 1.5) {
          descHtml += "<br><span style='color:#2a8a6a;font-size:15px;'>\u{1F4C8} "+curName+"の財政調整基金は過去平均（"+rAvg.toFixed(1)+"億円）より大きく増えています。国からの臨時交付金や、大型事業の先送りによる積立増加の可能性があります。</span>";
        } else if (rRatio <= 0.5) {
          descHtml += "<br><span style='color:#c04030;font-size:15px;'>\u{1F4C9} "+curName+"の財政調整基金は過去平均（"+rAvg.toFixed(1)+"億円）より大きく減っています。災害対応や大型事業への取り崩しがあった可能性があります。</span>";
        }
      }
      if (ratio < rb.lo && cur.x > 95) descHtml += "<br><span style='color:#c04030;font-size:16px;'>\u26A0\uFE0F 貯金が少なめ＋固定費も重い→緊急時に回せるお金が限られやすい状態です</span>";
      else if (ratio < rb.lo && cur.u > 100) descHtml += "<br><span style='color:#c04030;font-size:16px;'>\u26A0\uFE0F 貯金が少なめ＋将来への借金も重い→今の備えと将来の返済の両方に課題があります</span>";
      else if (ratio < rb.lo && cur.f < 0.5) descHtml += "<br><span style='color:#c04030;font-size:16px;'>\u26A0\uFE0F 貯金が少なめ＋自力収入も乏しい→大きな支出があったときの余力が限られます</span>";
      else if (ratio < rb.lo) descHtml += "<br><span style='color:#c04030;font-size:16px;'>\u26A0\uFE0F 緊急時に備える積立が課題になりやすい水準です</span>";
      else if (ratio < rb.mid && cur.x > 95) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>\u26A0\uFE0F 貯金はやや少なめ＋固定費も重い→固定費の削減と積立増加が同時に課題です</span>";
      else if (ratio < rb.mid) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>\u26A0\uFE0F もう少し積み増せると緊急時の備えとして安心できる水準です</span>";
      else if (ratio >= rb.hi && cur.u <= 0) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>\u2728 貯金が多め＋将来への借金もない→備えも負債もバランスの良い状態です</span>";
      else if (ratio >= rb.hi && cur.x < 88) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>\u2728 貯金が多め＋固定費も軽い→財政に余裕があり、危機対応力の高い状態です</span>";
      else if (ratio >= rb.hi && cur.d > 25) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>\u26A0\uFE0F ※歳出が極端に削減された自治体（財政再生団体など）は、この比率が高く見える場合があります。<br>"+curName+"は実質公債費比率が"+cur.d+"%と非常に高く、この基金の多くは借金返済や不測の事態への積立です。財政状況は深刻です。</span>";
      else if (ratio >= rb.hi) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>\u2728 いざというときの「自治体の貯金」として機能しやすい水準です</span>";
    }
    
if (key === "growth" && cur && cur.pop) {
      var popStr = cur.pop.toLocaleString();
      var gSign = cur.g >= 0 ? "+" : "";
      var popColor = cur.g >= 0 ? "#6dcfad" : cur.g >= -0.5 ? "#f0c46a" : "#f0876a";
      descHtml += "<br><br><strong style='color:"+popColor+";'>"+curName+"の人口は"+popStr+"人（令和7年1月1日時点）。前年比"+gSign+cur.g+"%です。</strong>";
      if (cur.pop < 3000) {
        descHtml += "<br><span style='color:#b8860b;font-size:15px;'>⚠️ "+curName+"は人口が少ない（"+popStr+"人）ため、少数の転入・転出だけでも増減率が大きく振れやすい点にご注意ください。</span>";
      }
      if (cur.g >= 0 && cur.f >= 0.7) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 人口が増えている＋財政力も安定→人が集まることで税収も増え、好循環が生まれやすい状態です</span>";
      else if (cur.g >= 0 && cur.ch >= 100) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 人口が増えている＋子どもへの投資も手厚い→子育て環境の充実が若い世代を引き寄せている可能性があります</span>";
      else if (cur.g >= 0) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 人口が増加中→住民が増えれば税収も増え、財政の安定にもつながります。この流れを維持したいところです</span>";
      else if (cur.g < -1.0 && cur.x > 95) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 人口が急減している＋固定費が重い→税収が減るのに支出が固定化、財政悪化が加速しやすい危険な組み合わせです</span>";
      else if (cur.g < -1.0 && cur.f < 0.5) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 人口が急減している＋財政力も弱い→人口減少が税収減を招き、財政がじわじわ悪化するリスクが高い状態です</span>";
      else if (cur.g < -0.5) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 人口の減少が続いている→住民1人あたりの行政コストが上がり、財政を圧迫しやすくなります。定住促進策が急務です</span>";
      else descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 人口はやや減少傾向→緩やかな減少でも長期的には財政に影響します。子育て支援・移住促進が重要です</span>";
    }
    // 各項目の判定メッセージ
    if (key === "health" && cur) {
      var h2 = calcH(cur.f, cur.d, cur.x, cur.u, cur.r, cur.eo, cur.__pref, cur.sfs);
      var hj = h2>=85?"絶好調な状態":h2>=70?"おおむね安定した状態":h2>=50?"やや課題がある状態":h2>=30?"かなり厳しい状態":"非常に危機的な状態";
      var hc = h2>=85?"#6dcfad":h2>=70?"#7bb8e8":h2>=50?"#f0c46a":h2>=30?"#f0876a":"#d0505a";
      descHtml += "<div style='background:rgba(232,160,150,0.1);border:1.5px solid rgba(232,160,150,0.3);border-radius:10px;padding:10px 12px;margin-top:10px;'><strong style='color:"+hc+";'>"+curName+"の総合スコアは"+h2+"点で、"+hj+"です。</strong>" + (curTypeLabel ? " <span style='color:#8070c0;font-size:12px;'>（"+curTypeLabel+"）</span>" : "") + "</div>";
      var bd_sf = Math.min(cur.f/1.2*25, 25);
      var bd_sd = Math.max((25-Math.min(cur.d,25))/25*20, 0);
      var bd_sx = Math.min(Math.max((100-cur.x)/15*20, 0), 20);
      var bd_su = (!cur.u || cur.u <= 0) ? 20 : Math.max((200-Math.min(cur.u,200))/200*20, 0);
      var bd_full = isPrefView ? 10 : 20;
      var bd_sr = (cur.sfs && cur.sfs > 0 && cur.r != null) ? Math.min((cur.r/cur.sfs*100)/bd_full*15, 15) : 7.5;
      var bdColor = function(score, max){ return (score/max) >= 0.5 ? "#1a7a5a" : "#c02020"; };
      descHtml += "<div class='bd-toggle' onclick=\"var c=document.getElementById('bdContent');var a=document.getElementById('bdArrow');var isOpen=c.style.maxHeight&&c.style.maxHeight!=='0px';c.style.maxHeight=isOpen?'0px':'280px';a.classList.toggle('open');\" style='display:flex;justify-content:space-between;align-items:center;cursor:pointer;margin-top:10px;background:rgba(160,139,232,0.08);border-radius:10px;padding:10px 12px;font-size:12px;color:#6a3de8;font-weight:700;'>" +
        "<span>📊 内訳を見る</span><span id='bdArrow' style='transition:transform 0.2s;'>▼</span></div>" +
        "<div id='bdContent' style='max-height:0;overflow:hidden;transition:max-height 0.25s ease;font-size:12px;color:#5a5a7a;line-height:1.9;'>" +
        "<div style='padding-top:8px;'>" +
        "財政力指数 <strong style='color:"+bdColor(bd_sf,25)+";'>"+bd_sf.toFixed(1)+"点</strong>／25点満点<br>" +
        "実質公債費比率 <strong style='color:"+bdColor(bd_sd,20)+";'>"+bd_sd.toFixed(1)+"点</strong>／20点満点<br>" +
        "経常収支比率 <strong style='color:"+bdColor(bd_sx,20)+";'>"+bd_sx.toFixed(1)+"点</strong>／20点満点<br>" +
        "将来負担比率 <strong style='color:"+bdColor(bd_su,20)+";'>"+bd_su.toFixed(1)+"点</strong>／20点満点<br>" +
        "財政調整基金 <strong style='color:"+bdColor(bd_sr,15)+";'>"+bd_sr.toFixed(1)+"点</strong>／15点満点" +
        "</div></div>" +
        "<div style='border-top:2px dashed rgba(160,139,232,0.3);margin:14px 0 12px;'></div>";
      if (peersHtml) {
        descHtml += "<div class='bd-toggle' onclick=\"var c=document.getElementById('peerContent');var a=document.getElementById('peerArrow');var isOpen=c.style.maxHeight&&c.style.maxHeight!=='0px';c.style.maxHeight=isOpen?'0px':'600px';a.classList.toggle('open');\" style='display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:rgba(232,160,150,0.12);border-radius:10px;padding:10px 12px;font-size:12px;color:#c07050;font-weight:700;'>" +
          "<span>🐧 スコアが近い自治体を見る</span><span id='peerArrow' style='transition:transform 0.2s;'>▼</span></div>" +
          "<div id='peerContent' style='max-height:0;overflow:hidden;transition:max-height 0.3s ease;'>" +
          "<div style='padding-top:10px;'>" + peersHtml + "</div></div>";
      }
    }
    if (key === "debt" && cur) {
      var dj = cur.d<10?"健全な水準":cur.d<18?"注意が必要な水準":cur.d<25?"要改善の水準":"早期健全化基準を超えています";
      var dc2 = cur.d<10?"#6dcfad":cur.d<18?"#7bb8e8":cur.d<25?"#f0c46a":"#f0876a";
      descHtml += "<br><br><strong style='color:"+dc2+";'>"+curName+"の実質公債費比率は"+cur.d+"%で、"+dj+"。</strong>";
      if (cur.d > 18 && cur.f < 0.5) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 借金返済が重い＋自力収入が乏しい→返済で手一杯なのに稼ぐ力もない、最も厳しい二重苦です</span>";
      else if (cur.d > 18 && cur.x > 95) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 借金返済が重い＋固定費も硬直化→お金の出口がふさがれており、新しい政策に回せる余地がほぼありません</span>";
      else if (cur.d > 18) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 借金返済の負担が大きい→収入の多くが返済に消えており、住民サービスへの影響が出やすい状態です</span>";
      else if (cur.d < 10 && cur.f >= 0.7 && cur.x < 88) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 借金返済が軽い＋自力収入も豊か＋固定費も適正→返済の心配がなく政策投資もできる、理想的な状態です</span>";
      else if (cur.d < 10 && cur.f >= 0.7) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 借金返済が軽い＋自力収入も豊か→返済の心配がなく、新しい政策にも積極的に投資できる状態です</span>";
      else if (cur.d < 10 && reserveIsAmple(cur, isPrefView)) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 借金返済が軽い＋貯金も十分（標準財政規模比で多め）→いざというときの備えもあり、とても健全な財政です</span>";
      else if (cur.d < 10 && cur.x > 95) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 借金返済は軽いが固定費が重い→返済の心配はないものの、人件費・社会保障費が財政を圧迫しています</span>";
      else if (cur.d < 10) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 借金返済の負担が軽く、財政に余裕があります。この水準を維持できると理想的です</span>";
      else if (cur.d < 18 && cur.x > 95) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 返済負担は標準的だが固定費が重い→借金は普通でも固定費に圧迫されており、政策の自由度が低い状態です</span>";
      else if (cur.d < 18 && cur.f >= 0.7) descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 返済負担は標準的＋自力収入も安定→大きな心配はありませんが、借入残高の推移は引き続き注視を</span>";
      else descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 返済負担がやや重め＋自力収入が少ない→交付税頼みになりやすく、国の制度変更の影響を受けやすい状態です</span>";
    }
    if (key === "fiscalPower" && cur) {
      var fj = cur.f>=1.0?"不交付団体（財政力豊か）":cur.f>=0.7?"比較的安定した財政力":cur.f>=0.5?"やや交付税依存":"交付税依存度が高い状態";
      var fc2 = cur.f>=1.0?"#6dcfad":cur.f>=0.7?"#7bb8e8":cur.f>=0.5?"#f0c46a":"#f0876a";
      descHtml += "<br><br><strong style='color:"+fc2+";'>"+curName+"の財政力指数は"+cur.f.toFixed(2)+"で、"+fj+"です。</strong>";
      if (cur.f < 0.5 && cur.x > 95) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 自力収入が乏しい＋固定費が重い→稼げないのにお金が出ていく一方、最も身動きが取りにくい状態です</span>";
      else if (cur.f < 0.5 && cur.u > 100) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 自力収入が乏しい＋将来への借金も重い→今も苦しく将来も重荷を背負っており、構造的な改革が必要です</span>";
      else if (cur.f < 0.5) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 自力で稼ぐ力が弱い→国からの交付税に大きく依存しており、国の財政事情に左右されやすい状態です</span>";
      else if (cur.f >= 1.0 && cur.x < 88) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 自力収入が豊か＋固定費も軽い→収入も支出もバランス良く、政策の自由度が高い理想的な財政です</span>";
      else if (cur.f >= 1.0 && reserveIsAmple(cur, isPrefView)) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 自力収入が豊か＋貯金も十分（標準財政規模比で多め）→財政力があり備えもある、とても安定した状態です</span>";
      else if (cur.f >= 1.0 && cur.x > 95) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 自力収入は豊かだが固定費が重い→稼ぐ力はあるのに固定費に消えており、政策投資の余地が限られています</span>";
      else if (cur.f >= 1.0) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 国からの交付税に頼らず自立した財政→住民サービスを自分たちの収入でまかなえる、強い自治体です</span>";
      else if (cur.f >= 0.7 && cur.x < 95) descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 財政力は安定＋固定費も許容範囲→大きな問題はなく、引き続きこの水準の維持が目標です</span>";
      else descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 交付税依存が高め→自主財源を増やす取り組み（企業誘致・定住促進など）が長期的な課題です</span>";
    }
    if (key === "flex" && cur) {
      var xj = cur.x<88?"財政に弾力性がある状態":cur.x<95?"標準的な水準":"硬直化した状態";
      var xc2 = cur.x<88?"#6dcfad":cur.x<95?"#7bb8e8":"#f0876a";
      descHtml += "<br><br><strong style='color:"+xc2+";'>"+curName+"の経常収支比率は"+cur.x.toFixed(1)+"%で、"+xj+"です。</strong>";
      if (cur.x >= 100) {
        descHtml += "<br><span style='color:#a02030;font-size:15px;'>🚨 "+curName+"は経常収支比率が100%を超えているため、経常的な収入だけでは経常的な支出をまかないきれていない状態です。</span>";
      }
      if (cur.x > 95 && cur.f < 0.5) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 固定費が重い＋自力収入も乏しい→収入が少ないのに出費が固定化、新しいことに一切お金を使えない状態です</span>";
      else if (cur.x > 95 && cur.r < 10) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 固定費が重い＋貯金も少ない→日常の支出でギリギリで、いざというときの備えもない、じわじわ危ない状態です</span>";
      else if (cur.x > 95 && cur.u > 100) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 固定費が重い＋将来への借金も多い→今の家計も苦しく将来の返済も重い、二重の重荷を抱えています</span>";
      else if (cur.x > 95) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 固定費が重く硬直化→人件費・社会保障費・借金返済が収入の大半を占め、政策の自由度が低い状態です</span>";
      else if (cur.x < 88 && cur.r > 20) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 固定費が軽い＋貯金も十分→支出に余裕があり備えもある、財政運営の理想的な姿です</span>";
      else if (cur.x < 88 && cur.f >= 1.0) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 固定費が軽い＋自力収入も豊か→稼いでいて使い方も健全、新しい政策に積極投資できる状態です</span>";
      else if (cur.x < 88) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 固定費が適正で財政に弾力性がある→急な支出や新しい施策にも対応しやすい、健全な状態です</span>";
      else if (cur.x < 95 && cur.f >= 0.7) descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 固定費は標準的＋財政力も安定→大きな問題はありませんが、固定費が増えすぎないよう注視が必要です</span>";
      else descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 固定費は標準的な水準→大きな問題はありませんが、95%を超えると硬直化します。推移を注視しましょう</span>";
    }
    if (key === "future" && cur) {
      var ul2 = cur.u<=0?"将来負担なし":cur.u<100?"一定の負担あり（注意水準）":cur.u<350?"要注意の水準":"早期健全化基準を超えています";
      var uc2 = cur.u<=0?"#6dcfad":cur.u<100?"#7bb8e8":cur.u<350?"#f0876a":"#d0505a";
      var uv = cur.u<=0?"0%":cur.u>=999?"再建中":cur.u.toFixed(1)+"%";
      descHtml += "<br><br><strong style='color:"+uc2+";'>"+curName+"の将来負担比率は"+uv+"で、"+ul2+"です。</strong>";
      if (cur.u > 100 && cur.r < 10) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 将来への借金が重い＋貯金も少ない→今も苦しく将来も重荷、借金まみれで備えもない綱渡りの状態です</span>";
      else if (cur.u > 100 && cur.x > 95) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 将来への借金が重い＋毎年の固定費も重い→過去の借金に縛られながら今も出費が固定化、構造改革が急務です</span>";
      else if (cur.u > 100 && cur.f < 0.5) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 将来への借金が重い＋自力収入も乏しい→借金を返す力が弱く、長期的に財政が悪化するリスクがあります</span>";
      else if (cur.u > 100) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 将来世代への借金が重い→今の住民が使ったお金を将来世代が返す構図で、世代間の公平性が問われます</span>";
      else if (cur.u <= 0 && reserveIsAmple(cur, isPrefView)) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 将来への借金がない＋貯金も十分（標準財政規模比で多め）→将来世代に負担を残さず、備えもある。財政の優等生です</span>";
      else if (cur.u <= 0 && cur.f >= 1.0) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 将来への借金がない＋自力収入も豊か→借金ゼロで稼ぐ力もある、非常に健全な財政状態です</span>";
      else if (cur.u <= 0) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 将来世代への負担がない→過去の借金を着実に返し終えており、次世代に重荷を残さない健全な状態です</span>";
      else if (cur.u < 100 && reserveIsAmple(cur, isPrefView)) descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 将来への負担は一定あるが貯金（標準財政規模比で多め）で備えもある→心配しすぎる必要はないが、借入残高の推移は要注視です</span>";
      else if (cur.u < 100 && cur.x > 95) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 将来への借金がやや重い＋固定費も重い→返済余力が乏しく、借入残高の削減が急務です</span>";
      else descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 将来への借金がやや重め→公共施設の維持費・更新費も増える中、新規借入の抑制が課題です</span>";
    }
    if (key === "education" && cur && cur.edu!=null) {
      var eduMed = isPrefView ? 18.9 : 10.5;
      var eduUnit = isPrefView ? "47都道府県" : "全国の市区町村";
      var ej = cur.edu >= eduMed ? "中央値より高めです" : "中央値より低めです";
      descHtml += "<br><br><strong style='color:#a08be8;'>"+curName+"の教育費比率は"+cur.edu.toFixed(1)+"%で、"+eduUnit+"の"+ej+"（中央値"+eduMed+"%）。</strong>";
      descHtml += "<br><span style='color:#6b5b95;font-size:14px;'>\u2139\uFE0F この数字は高い・低いが、そのまま良い・悪いを意味しません。高いのは教育を重視している場合もあれば、学校施設の老朽化対応や小規模校の維持で費用がかさんでいる場合もあります。都道府県は高校を持つため、市区町村より高く出ます。</span>";
      var eduCaveatFired = false;
      var eduHist = [cur.edu_r2, cur.edu_r3, cur.edu_r4, cur.edu_r5].filter(function(v){ return v!=null; });
      if (eduHist.length >= 2) {
        var eduAvg = eduHist.reduce(function(a,b){return a+b;},0) / eduHist.length;
        var eduRatio = eduAvg > 0 ? cur.edu / eduAvg : 1;
        if (eduRatio <= 0.7) {
          descHtml += "<br><span style='color:#3070b8;font-size:15px;'>📉 "+curName+"の教育費比率は過去平均（"+eduAvg.toFixed(1)+"%）より大きく下がっています。学校施設整備の完了、または災害復旧費など他の歳出が増えたことで相対的に比率が下がった可能性があります。</span>";
          eduCaveatFired = true;
        } else if (eduRatio >= 1.3) {
          descHtml += "<br><span style='color:#b8860b;font-size:15px;'>📈 "+curName+"の教育費比率は過去平均（"+eduAvg.toFixed(1)+"%）より大きく上がっています。学校施設整備などの大型事業、または他の歳出が減ったことで相対的に比率が上がった可能性があります。</span>";
          eduCaveatFired = true;
        }
      }
      if (cur.edu >= 10 && cur.ch != null && cur.ch >= 100) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 教育費が多い＋子ども1人あたりの投資も手厚い→お金も手間もかけて子どもを育てる姿勢が数字に表れています</span>";
      else if (cur.edu >= 10 && cur.x > 95) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 教育には力を入れているが固定費も重い→苦しい財政の中でも教育を優先している姿勢は評価できますが、持続可能性に注意が必要です</span>";
      else if (cur.edu >= 10 && cur.f < 0.5) descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 財政力は弱いが教育には力を入れている→苦しい中でも未来への投資を優先している姿勢が見えます</span>";
      else if (cur.edu >= 10 && !eduCaveatFired) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 教育への支出が手厚い→子どもの学びへの投資は将来の地域力につながる、前向きな財政です</span>";
      else if (cur.edu < 6 && cur.x > 95) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 教育費が少ない＋固定費が重い→固定費に圧迫されて教育への投資が削られている可能性があります</span>";
      else if (cur.edu < 6 && !eduCaveatFired) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 教育への支出が少なめ→財政的制約がある可能性がありますが、子どもへの投資は将来の税収にも影響します</span>";
      else if (!eduCaveatFired) descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 教育費は標準的な水準→引き続き子どもへの投資の量と質を確認していきましょう</span>";
    }
    if (key === "childInvest" && cur && cur.ch!=null) {
      var chMed = isPrefView ? 87.9 : 118.4;
      var chUnit = isPrefView ? "47都道府県" : "全国の市区町村";
      var cj2 = cur.ch >= chMed ? "中央値より高めです" : "中央値より低めです";
      descHtml += "<br><br><strong style='color:#a08be8;'>"+curName+"の子ども1人当たり投資額は"+cur.ch.toFixed(1)+"万円で、"+chUnit+"の"+cj2+"（中央値"+chMed+"万円）。</strong>";
      descHtml += "<br><span style='color:#6b5b95;font-size:14px;'>\u2139\uFE0F この数字は高い・低いが、そのまま良い・悪いを意味しません。子どもの人数で割った値なので、子どもが少ない自治体ほど大きく出ます。全国で最も高いのは974万円ですが、これは手厚いのではなく分母が小さいためです。</span>";
      var chCaveatFired = false;
      if (cur.pop && cur.pop < 3000 && cur.ch > 250) {
        descHtml += "<br><span style='color:#b8860b;font-size:15px;'>⚠️ "+curName+"は人口が少ない（"+cur.pop.toLocaleString()+"人）ため、子どもの人数自体が少なく、1人当たりで計算すると数値が実態以上に大きくなります。</span>";
        chCaveatFired = true;
      }
      var chHist = [cur.ch_r2, cur.ch_r3, cur.ch_r4, cur.ch_r5].filter(function(v){ return v!=null; });
      if (chHist.length >= 2) {
        var chAvg = chHist.reduce(function(a,b){return a+b;},0) / chHist.length;
        var chRatio = chAvg > 0 ? cur.ch / chAvg : 1;
        if (chRatio <= 0.7) {
          descHtml += "<br><span style='color:#3070b8;font-size:15px;'>📉 "+curName+"の投資額は過去平均（"+chAvg.toFixed(1)+"万円）より大きく下がっています。学校施設整備の完了、または他の要因（人口変動など）が影響している可能性があります。</span>";
          chCaveatFired = true;
        } else if (chRatio >= 1.3) {
          descHtml += "<br><span style='color:#b8860b;font-size:15px;'>📈 "+curName+"の投資額は過去平均（"+chAvg.toFixed(1)+"万円）より大きく上がっています。学校施設整備などの大型事業、または人口変動が影響している可能性があります。</span>";
          chCaveatFired = true;
        }
      }
      if (cur.ch >= 120 && cur.edu >= 10) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 子ども1人への投資が手厚い＋教育費比率も高い→量も割合も子どもに手をかけている、子育て支援に本気な自治体です</span>";
      else if (cur.ch >= 120 && cur.g >= 0) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 子どもへの投資が手厚い＋人口も増えている→子育て環境の充実が人口流入につながっている好循環です</span>";
      else if (cur.ch >= 120 && !chCaveatFired) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 子ども1人あたりへの投資が手厚い→将来の地域を担う子どもへの投資は、長期的に見て最も大切な支出です</span>";
      else if (cur.ch < 70 && cur.x > 95) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 子どもへの投資が少ない＋固定費が重い→固定費に圧迫されて将来世代への投資が削られている構図です</span>";
      else if (cur.ch < 70 && cur.g < -0.5) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 子どもへの投資が少ない＋人口も減少中→投資不足が子育て世代の流出を招いている可能性があります</span>";
      else if (cur.ch < 70 && !chCaveatFired) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 子どもへの投資が少なめ→保育・教育・医療費補助などの充実が、将来の定住促進にもつながります</span>";
      else if (!chCaveatFired) descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 子どもへの投資は標準的→近隣自治体と比較しながら、子育て世代に選ばれる地域づくりを目指したいところです</span>";
    }
    if (key === "budget" && cur && cur.eo && cur.ei) {
      var bj = cur.ei>=cur.eo?"黒字基調です":cur.ei>=cur.eo*0.99?"ほぼ均衡しています":"赤字基調です";
      var bc2 = cur.ei>=cur.eo?"#6dcfad":cur.ei>=cur.eo*0.99?"#7bb8e8":"#f0876a";
      descHtml += "<br><br><strong style='color:"+bc2+";'>"+curName+"の歳出は"+cur.eo.toLocaleString()+"億円、歳入は"+cur.ei.toLocaleString()+"億円で、"+bj+"。</strong>";
      var eoHist = [cur.eo_r1, cur.eo_r2, cur.eo_r3, cur.eo_r4].filter(function(v){ return v!=null; });
      if (eoHist.length >= 2) {
        var eoAvg = eoHist.reduce(function(a,b){return a+b;},0) / eoHist.length;
        var eoRatio = eoAvg > 0 ? cur.eo / eoAvg : 1;
        if (eoRatio >= 1.3) {
          descHtml += "<br><span style='color:#b8860b;font-size:15px;'>📈 "+curName+"の歳出は過去平均（"+eoAvg.toFixed(1)+"億円）より大きく増えています。災害復旧や大型施設整備など、一時的な要因が影響している可能性があります。</span>";
        } else if (eoRatio <= 0.7) {
          descHtml += "<br><span style='color:#3070b8;font-size:15px;'>📉 "+curName+"の歳出は過去平均（"+eoAvg.toFixed(1)+"億円）より大きく減っています。前年度の大型事業や特別な支出が終了した可能性があります。</span>";
        }
      }
      if (cur.ei < cur.eo && cur.x > 95) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 収支が赤字＋固定費も重い→支出が収入を超えているのに固定費が大半を占め、改善の余地がほぼない最も厳しい状態です</span>";
      else if (cur.ei < cur.eo && cur.r < 10) descHtml += "<br><span style='color:#a02030;font-size:16px;'>🚨 収支が赤字＋貯金も少ない→赤字を補う備えもなく、財政の持続可能性に黄信号です</span>";
      else if (cur.ei < cur.eo && cur.u > 100) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 収支が赤字＋将来への借金も重い→今も赤字で将来の返済も重く、収支改善が急務です</span>";
      else if (cur.ei < cur.eo) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 収入より支出が多い→財政調整基金や借入で補っている可能性があります。収支のバランス改善が課題です</span>";
      else if (cur.ei >= cur.eo && cur.x > 95) descHtml += "<br><span style='color:#c04030;font-size:16px;'>⚠️ 収支は均衡しているが固定費が大半を占めている→数字上は黒字でも人件費・返済・社会保障で身動きが取れない硬直した状態です</span>";
      else if (cur.ei >= cur.eo && cur.x > 88) descHtml += "<br><span style='color:#b8860b;font-size:16px;'>⚠️ 収支は均衡しているが固定費がやや重め→収支は安定しているものの、新しい政策への投資余地は限られています</span>";
      else if (cur.ei >= cur.eo && cur.f >= 1.0) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 収支が黒字＋財政力も高い＋固定費も適正→自力で稼ぎ支出も健全、最も理想的な財政運営です</span>";
      else if (cur.ei >= cur.eo && cur.r > 20) descHtml += "<br><span style='color:#2a8a6a;font-size:16px;'>✨ 収支が黒字＋貯金も十分＋固定費も適正→稼いでいて備えもある、とても安定した財政運営です</span>";
      else descHtml += "<br><span style='color:#3070b8;font-size:16px;'>📋 収支は均衡＋固定費も標準的→大きな問題はありませんが、社会保障費の増加など将来の支出増に備えた積立が重要です</span>";
    }
    document.getElementById("shDesc").innerHTML = descHtml;
    var shElAfter = document.querySelector(".sh");
    if (shElAfter) shElAfter.scrollTop = 0;
    setTimeout(function(){ var s = document.querySelector(".sh"); if (s) s.scrollTop = 0; }, 50);
    document.querySelectorAll(".peer-chip").forEach(function(chip){
      chip.addEventListener("click", function(){
        jumpToCity(this.getAttribute("data-city"));
      });
    });
    var yrsLabelHtml = yrs.map(function(y,i){
      var pct = yrs.length>1 ? (20+(i/(yrs.length-1))*(300-40))/300*100 : 50;
      var yDisp = y.replace("（最新）", "");
      return "<span style='left:"+pct+"%;text-align:center;'>"+yDisp+"</span>";
    }).join("");
    document.getElementById("spLabels").innerHTML = yrsLabelHtml;
    if (key === "budget") {
      // 歳出・歳入 2本線グラフ
      var eoVal = cur.eo || 0, eiVal = cur.ei || 0;
      var budgetHistCount = countHist("eo", 1);
      var eoVals = [], eiVals = [];
      var budgetYrs;
      if (budgetHistCount > 0) {
        for (var bi=1; bi<=budgetHistCount; bi++) {
          eoVals.push(cur["eo_r"+bi] != null ? cur["eo_r"+bi] : null);
          eiVals.push(cur["ei_r"+bi] != null ? cur["ei_r"+bi] : null);
        }
        eoVals.push(eoVal); eiVals.push(eiVal);
        budgetYrs = ["R1","R2","R3","R4","R5","R6","R7"].slice(0,budgetHistCount).concat(["R"+(budgetHistCount+1)+"（最新）"]);
      } else {
        var eoSeed = (Math.abs(eoVal*137) + 31) % 100;
        var eiSeed = (Math.abs(eiVal*137) + 61) % 100;
        var ev = eoVal * (0.88 + (eoSeed%20)/100);
        var iv = eiVal * (0.88 + (eiSeed%20)/100);
        for (var i=0; i<5; i++) {
          ev = ev + Math.sin(i*2.1+eoSeed*0.1)*Math.abs(eoVal)*0.08;
          iv = iv + Math.sin(i*2.1+eiSeed*0.1)*Math.abs(eiVal)*0.08;
          eoVals.push(parseFloat(ev.toFixed(0)));
          eiVals.push(parseFloat(iv.toFixed(0)));
        }
        eoVals.push(eoVal); eiVals.push(eiVal);
        budgetYrs = ["R1","R2","R3","R4","R5（最新）"];
      }
      document.getElementById("spLabels").innerHTML = budgetYrs.map(function(y,i){
        var pct = budgetYrs.length>1 ? (14+(i/(budgetYrs.length-1))*(300-28))/300*100 : 50;
        var yDisp = y.replace("（最新）", "");
        return "<span style='left:"+pct+"%;text-align:center;'>"+yDisp+"</span>";
      }).join("");
      var allV = eoVals.concat(eiVals).filter(function(v){ return v!=null; });
      var W=300,H=100,P=14;
      var mn2=Math.min.apply(null,allV), mx2=Math.max.apply(null,allV);
      var rng2 = Math.max(mx2-mn2, mx2*0.15) || 1;
      mn2 = mn2 - rng2*0.1; mx2 = mx2 + rng2*0.1; rng2 = mx2 - mn2;
      var Ptop2=22, Pbottom2=26;
      function px2(i){return P+(i/(eoVals.length-1))*(W-P*2);}
      function py2(v){return H-Pbottom2-((v-mn2)/rng2)*(H-Ptop2-Pbottom2);}
      function mkLine(arr){ var l=null; for(var j=0;j<arr.length;j++){ if(arr[j]==null) continue; l = l===null ? ("M"+px2(j)+","+py2(arr[j])) : (l+" L"+px2(j)+","+py2(arr[j])); } return l||""; }
      function fmtB(v){ return v>=10000 ? Math.round(v/100)/10+"千億" : v+"億"; }
      var eoLine=mkLine(eoVals), eiLine=mkLine(eiVals);
      var svgH = H+20;
      var dots2="";
      var maxIdx2 = Math.max(eoVals.length, eiVals.length);
      for(var k=0;k<maxIdx2;k++){
        var isLast = k===maxIdx2-1;
        var eoV = eoVals[k], eiV = eiVals[k];
        var eoOnTop = (eoV!=null && eiV!=null) ? (eoV >= eiV) : true;
        if (eoV != null) {
          dots2+="<circle cx='"+px2(k)+"' cy='"+py2(eoV)+"' r='"+(isLast?5:3)+"' fill='"+(isLast?"#a08be8":"white")+"' stroke='#a08be8' stroke-width='2'/>";
          if (eoOnTop) {
            if(isLast) dots2+="<text x='"+px2(k)+"' y='"+(py2(eoV)-8)+"' text-anchor='middle' font-size='10' fill='#a08be8' font-weight='700'>"+fmtB(eoV)+"</text>";
            else dots2+="<text x='"+px2(k)+"' y='"+(py2(eoV)-7)+"' text-anchor='middle' font-size='8' fill='#a08be8' opacity='0.75'>"+fmtB(eoV)+"</text>";
          } else {
            if(isLast) dots2+="<text x='"+px2(k)+"' y='"+(py2(eoV)+18)+"' text-anchor='middle' font-size='10' fill='#a08be8' font-weight='700'>"+fmtB(eoV)+"</text>";
            else dots2+="<text x='"+px2(k)+"' y='"+(py2(eoV)+15)+"' text-anchor='middle' font-size='8' fill='#a08be8' opacity='0.75'>"+fmtB(eoV)+"</text>";
          }
        }
        if (eiV != null) {
          dots2+="<circle cx='"+px2(k)+"' cy='"+py2(eiV)+"' r='"+(isLast?5:3)+"' fill='"+(isLast?"#7bb8e8":"white")+"' stroke='#7bb8e8' stroke-width='2'/>";
          if (!eoOnTop) {
            if(isLast) dots2+="<text x='"+(px2(k)-2)+"' y='"+(py2(eiV)-8)+"' text-anchor='middle' font-size='10' fill='#7bb8e8' font-weight='700'>"+fmtB(eiV)+"</text>";
            else dots2+="<text x='"+(px2(k)-2)+"' y='"+(py2(eiV)-7)+"' text-anchor='middle' font-size='8' fill='#7bb8e8' opacity='0.75'>"+fmtB(eiV)+"</text>";
          } else {
            if(isLast) dots2+="<text x='"+(px2(k)-2)+"' y='"+(py2(eiV)+18)+"' text-anchor='middle' font-size='10' fill='#7bb8e8' font-weight='700'>"+fmtB(eiV)+"</text>";
            else dots2+="<text x='"+(px2(k)-2)+"' y='"+(py2(eiV)+15)+"' text-anchor='middle' font-size='8' fill='#7bb8e8' opacity='0.75'>"+fmtB(eiV)+"</text>";
          }
        }
      }
      // 凡例
      var budgetNote = budgetHistCount>0 ? ("※令和元〜"+(budgetHistCount+1)+"年の実績値") : "※元〜4年は参考値（推計）";
      var legend="<text x='"+P+"' y='"+(svgH-2)+"' font-size='10' fill='#a08be8'>■ 歳出</text><text x='"+(P+50)+"' y='"+(svgH-2)+"' font-size='10' fill='#7bb8e8'>■ 歳入</text><text x='"+P+"' y='"+(svgH+9)+"' font-size='8' fill='#aaa'>"+budgetNote+"</text>";
      var spSvg = document.getElementById("spSvg");
      spSvg.setAttribute("viewBox","0 0 "+W+" "+(svgH+10));
      spSvg.style.height=(svgH+10)+"px";
      spSvg.innerHTML =
        "<path d='"+eoLine+"' fill='none' stroke='#a08be8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>" +
        "<path d='"+eiLine+"' fill='none' stroke='#7bb8e8' stroke-width='2' stroke-dasharray='4,3' stroke-linecap='round' stroke-linejoin='round'/>" +
        dots2 + legend;
    } else {
    var validVals = vals.filter(function(v){ return v!=null; });
    var mn=Math.min.apply(null,validVals), mx=Math.max.apply(null,validVals), rng=mx-mn||1;
    var W=300,H=100,P=20,Ptop=26;
    function px(i){return P+(i/(vals.length-1))*(W-P*2);}
    function py(v){return H-P-((v-mn)/rng)*(H-Ptop-P);}
    var area="", line="", dots="";
    var firstValid = true;
    for(var j=0;j<vals.length;j++){
      if(vals[j]==null) continue;
      if(firstValid){ area="M"+px(j)+","+py(vals[j]); line="M"+px(j)+","+py(vals[j]); firstValid=false; }
      else { area+=" L"+px(j)+","+py(vals[j]); line+=" L"+px(j)+","+py(vals[j]); }
    }
    var lastIdx=vals.length-1;
    area+=" L"+px(lastIdx)+","+H+" L"+px(0)+","+H+" Z";
    for(var k=0;k<vals.length;k++){
      if(vals[k]==null) continue;
      var last=k===vals.length-1;
      dots+="<circle cx='"+px(k)+"' cy='"+py(vals[k])+"' r='"+(last?5:3)+"' fill='"+(last?c:"white")+"' stroke='"+c+"' stroke-width='2'/>";
      var dispVal = (m.unit==="億円" && vals[k]>=10000) ? Math.round(vals[k]/100)/10+"千億" : vals[k]+(m.unit==="%"?"%":m.unit==="億円"?"億":"");
      var prevV = k>0 ? vals[k-1] : null;
      var nextV = k<vals.length-1 ? vals[k+1] : null;
      var isValley = (prevV==null || vals[k] <= prevV) && (nextV==null || vals[k] <= nextV) && (prevV!=null || nextV!=null);
      if(last && isValley) dots+="<text x='"+px(k)+"' y='"+(py(vals[k])+19)+"' text-anchor='middle' font-size='12' fill='"+c+"' font-weight='700'>"+dispVal+"</text>";
      else if(last) dots+="<text x='"+px(k)+"' y='"+(py(vals[k])-9)+"' text-anchor='middle' font-size='12' fill='"+c+"' font-weight='700'>"+dispVal+"</text>";
      else if(isValley) dots+="<text x='"+px(k)+"' y='"+(py(vals[k])+16)+"' text-anchor='middle' font-size='9' fill='"+c+"' opacity='0.75'>"+dispVal+"</text>";
      else dots+="<text x='"+px(k)+"' y='"+(py(vals[k])-8)+"' text-anchor='middle' font-size='9' fill='"+c+"' opacity='0.75'>"+dispVal+"</text>";
    }
    var noteText = hasHistory ? ("※令和元〜"+(N+1)+"年の実績値") : hasGrowthHistory ? (key==="growth" ? ("※令和"+(growthStartIdx===1?"元":growthStartIdx)+"〜"+(N2+growthStartIdx)+"年の実績値（市・都道府県）") : ("※令和"+(growthStartIdx===1?"元":growthStartIdx)+"〜"+(N2+growthStartIdx)+"年の実績値")) : key==="growth" ? "※元〜4年は参考値（推計）※町村はデータなし" : "※元〜4年は参考値（推計）";
    var noteColor = (hasHistory||hasGrowthHistory) ? "#6dcfad" : "#aaa";
    var spSvgEl = document.getElementById("spSvg");
    spSvgEl.setAttribute("viewBox","0 0 "+W+" "+(H+10));
    spSvgEl.style.height=(H+10)+"px";
    spSvgEl.innerHTML = "<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='"+c+"' stop-opacity='0.2'/><stop offset='100%' stop-color='"+c+"' stop-opacity='0'/></linearGradient></defs><text x='"+P+"' y='10' font-size='10' fill='"+noteColor+"'>"+noteText+"</text><path d='"+area+"' fill='url(#g)'/><path d='"+line+"' fill='none' stroke='"+c+"' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>"+dots;
    }
    document.getElementById("ovEl").classList.remove("hidden");
    document.body.style.overflow="hidden";
  }

  function updateSuggestions(q) {
    var box = document.getElementById("suggestBox");
    q = q.trim();
    if (!DB || !q) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    var keys = Object.keys(DB);
    var starts = [], contains = [];
    for (var i=0; i<keys.length; i++) {
      var k = keys[i];
      if (k.indexOf(q) === 0) starts.push(k);
      else if (k.indexOf(q) >= 0) contains.push(k);
    }
    var list = starts.concat(contains).slice(0, 8);
    if (!list.length) {
      box.innerHTML = "<div class='suggest-empty'>😢 一致する自治体が見つかりません</div>";
      box.classList.remove("hidden");
      return;
    }
    box.innerHTML = list.map(function(k){
      var pref = (DB[k] && DB[k].p) ? DB[k].p : "";
      return "<div class='suggest-item' data-city='" + k + "'><span>" + k + "</span>" + (pref ? "<span class='pref'>" + pref + "</span>" : "") + "</div>";
    }).join("");
    box.classList.remove("hidden");
  }

  function hideSuggestions() {
    document.getElementById("suggestBox").classList.add("hidden");
  }

  document.getElementById("cityInput").addEventListener("input", function(){ updateSuggestions(this.value); });
  document.getElementById("cityInput").addEventListener("focus", function(){ updateSuggestions(this.value); });
  document.getElementById("suggestBox").addEventListener("click", function(e){
    var item = e.target.closest(".suggest-item");
    if (!item || !item.getAttribute("data-city")) return;
    document.getElementById("cityInput").value = item.getAttribute("data-city");
    hideSuggestions();
    diagnose();
  });
  document.addEventListener("click", function(e){
    if (!e.target.closest(".search-wrap")) hideSuggestions();
  });

  document.getElementById("searchBtn").addEventListener("click", function(){ hideSuggestions(); diagnose(); });
  document.getElementById("cityInput").addEventListener("keydown", function(e){ if(e.key==="Enter"){ hideSuggestions(); diagnose(); } });
  document.getElementById("closeBtn").addEventListener("click", function(){ history.back(); });
  document.getElementById("ovEl").addEventListener("click", function(e){ if(e.target===this){ history.back(); }});
  document.getElementById("compareOv").addEventListener("click", function(e){ if(e.target===this){ history.back(); }});
  document.getElementById("shareToXBtn").addEventListener("click", confirmShareToX);
  document.getElementById("shareToOtherBtn").addEventListener("click", confirmShareToOther);
  document.getElementById("shareCancelBtn").addEventListener("click", closeShareChoiceModal);
  document.getElementById("shareChoiceOv").addEventListener("click", function(e){ if(e.target===this){ closeShareChoiceModal(); }});

  window.addEventListener("popstate", function(e){
    var ov = document.getElementById("ovEl");
    var st = e.state;
    if (!ov.classList.contains("hidden")) {
      ov.classList.add("hidden");
    }
    var cOv = document.getElementById("compareOv");
    if (st && st.mitchieView === "compare") {
      // 比較モーダルはそのまま維持(詳細だけ閉じる)
      return;
    }
    if (cOv && !cOv.classList.contains("hidden")) {
      cOv.classList.add("hidden");
    }
    document.body.style.overflow = "";
    var re = document.getElementById("resEl");
    var ma = document.getElementById("mitchieArea");
    if (st && st.mitchieView === "result" && st.city) {
      var found = find(st.city);
      if (found) {
        if (re) re.classList.remove("hidden");
        if (ma) ma.classList.add("hidden");
        document.getElementById("cityInput").value = st.city;
        var hasSavedScroll = typeof st.scrollY === "number";
        render(found, true, hasSavedScroll);
        if (hasSavedScroll) { window.scrollTo(0, st.scrollY); }
        return;
      }
    }
    if (st && st.mitchieView === "detail") {
      // 詳細モーダルの状態に戻った場合は、同じ詳細パネルを再度開く
      if (st.kk) { kkOpenDetail(st.key, true); }
      else if (st.key) { openD(st.key, true); }
      return;
    }
    // ホーム（検索）画面まで戻る
    if (re && !re.classList.contains("hidden")) {
      re.classList.add("hidden");
      if (ma) ma.classList.remove("hidden");
      var ci = document.getElementById("cityInput");
      if (ci) ci.value = "";
      window.scrollTo(0, 0);
    }
  });
  var homeTitleEl = document.getElementById("homeTitle");
  if (homeTitleEl) homeTitleEl.addEventListener("click", goHome);
  document.querySelectorAll(".chip").forEach(function(el){ el.addEventListener("click", function(){ document.getElementById("cityInput").value=this.getAttribute("data-city"); hideSuggestions(); diagnose(); }); });
  renderHistoryChips();
  window.scrollTo(0, 0);

/* ===== 公会計機能 ===== */
  var KK = null;
  var KK_MEDIANS = {
    ka2: {muni: 3.3, pref: 2.2},
    ka3: {muni: 65.1, pref: 63},
    ka4: {muni: 73.1, pref: 20.7},
    ka5: {muni: 18.3, pref: 58.4},
    ka9: {muni: 3.9, pref: 4.1}
  };
  var KK_META = {
    ka1: {icon:"💰", label:"住民一人当たり資産額", unit:"万円", group:true,
      desc:"【何を指すか】\n・自治体が持っている財産（建物や道路、貯金など）を、住民の数で割った金額。町の財産を住民みんなで分けたら一人いくら、というイメージです\n\n【含まれるもの】\n🏢庁舎・学校（建物などの事業用資産）\n🛣️道路・橋梁（インフラ資産）\n🚰水道設備（インフラ資産）\n🏦基金・預金（投資・流動資産）など…\n\n📈多い理由\n・大規模な公共施設・インフラを多く保有している\n・人口が少なく、一人当たりに換算すると大きくなる\n\n📉少ない理由\n・資産の老朽化・除却が進み評価額が下がっている\n・計画的に資産をスリム化した"},
    ka2: {icon:"📦", label:"歳入額対資産比率", unit:"年", group:false,
      desc:"【何を指すか】\n・今持っている財産が、1年分の収入の何年分にあたるか。数字が大きいほど、財産をたくさん蓄えていることになります\n\n📈高い理由\n・インフラ等の資産を多く抱えている\n\n📉低い理由\n・資産規模に対して歳入が大きい\n・資産そのものが少ない"},
    ka3: {icon:"🏚️", label:"有形固定資産減価償却率", unit:"%", group:false,
      desc:"【何を指すか】\n・道路や建物がどれくらい古くなっているかを表す割合。数字が大きいほど、そろそろ建て替えや修理が必要な時期に近づいています\n\n📈高い理由\n・施設の更新・改修が追いついていない\n・昭和期に整備した施設が多い\n\n📉低い理由\n・近年、建て替え・新設が進んでいる"},
    ka4: {icon:"🧾", label:"純資産比率", unit:"%", group:false,
      desc:"【何を指すか】\n・町の財産のうち、借金ではなく自分たちのお金でまかなっている部分の割合。数字が大きいほど、借金に頼らず財産を築いてきたことになります\n\n📈高い理由\n・借入に頼らず資産形成してきた\n\n📉低い理由\n・地方債などの借入に依存して資産を形成している"},
    ka5: {icon:"🏦", label:"将来世代負担比率", unit:"%", group:false,
      desc:"【何を指すか】\n・今ある財産のうち、まだ返し終わっていない借金でまかなわれている部分の割合。数字が大きいほど、これからの世代が返済を負担することになります\n\n📈高い理由\n・大型事業を借金でまかなってきた\n\n📉低い理由\n・借金に頼らず整備してきた\n・資産の規模自体が小さい"},
    ka6: {icon:"🧑‍💼", label:"住民一人当たり行政コスト", unit:"万円", group:true,
      desc:"【何を指すか】\n・町が住民サービスのために1年間に使った費用を、住民の数で割った金額。将来払う退職金の積立分なども含めた、本当の意味でのコストです\n\n【含まれるもの】\n👔人件費（職員給与など）\n🏢物件費（維持管理費・光熱費など）\n👨‍👩‍👧扶助費（生活保護・児童手当などの給付）\n📉減価償却費（建物や道路が古くなった分の目減り）\n💼退職手当引当金繰入額など（将来払う退職金の積立分）\n\n📈高い理由\n・高齢化で扶助費が多い\n・施設保有が多く減価償却費がかさむ\n・人口が少なく一人当たりに換算すると大きくなる\n\n📉低い理由\n・人口が多く一人当たりに薄まる\n・行財政改革でコスト削減している"},
    ka7: {icon:"💳", label:"住民一人当たり負債額", unit:"万円", group:true,
      desc:"【何を指すか】\n・町の借金の合計を、住民の数で割った金額。町の借金を住民みんなで分けたら一人いくら、というイメージです\n\n【含まれるもの】\n📜地方債（借金の残高）\n💼退職手当引当金（将来払う退職金の積立不足分）\n🧾未払金など\n\n📈高い理由\n・借入や引当金が多い\n・人口が少なく一人当たりに換算すると大きくなる\n\n📉低い理由\n・借入を抑制してきた\n・人口が多く一人当たりに薄まる"},
    ka8: {icon:"⚖️", label:"業務・投資活動収支", unit:"百万円", group:true,
      desc:"【何を指すか】\n・1年間の活動でお金がどれだけ余った（または足りなかった）かを表す数字。プラスなら、その年に必要なお金をきちんと賄えていたことになります\n\n📈プラスが大きい理由\n・税収等に対して支出を抑えている\n\n📉マイナスの理由\n・大型投資を行った年度だった\n・収入が支出に追いついていない"},
    ka9: {icon:"🙋", label:"受益者負担比率", unit:"%", group:false,
      desc:"【何を指すか】\n・行政サービスにかかった費用のうち、利用者が使用料や手数料として直接払っている割合。数字が大きいほど、利用者自身が費用を負担していることになります\n\n📈高い理由\n・受益者負担の原則を重視した料金設定\n\n📉低い理由\n・サービスの多くを税金でまかなっている"}
  };
  var KK_ORDER = ["ka1","ka2","ka3","ka4","ka5","ka6","ka7","ka8","ka9"];

  function loadKokaikei(cb){
    if (KK) { cb(); return; }
    fetch("kokaikei.json").then(function(r){ return r.json(); }).then(function(data){
      KK = data;
      cb();
    }).catch(function(){ KK = {}; cb(); });
  }

  function kkFmt(v, unit){
    if (v == null) return "―";
    if (unit === "\u767e\u4e07\u5186") return (v>=0?"+":"") + v.toLocaleString() + unit;
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
        return "<span style='color:#6a3de8;'>" + nm + "</span>は" + meta.label + "が" + valOnly + "です。財政規模が大きく、比較できる同じ規模の" + (isPref ? "都道府県" : "都市") + "がありません。";
      }
      scaleWord = (isPref ? "同じ規模の都道府県" : "同じ規模の都市") + n + "件";
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
      history.pushState({mitchieView:"detail", key:code, kk:true}, "", "#detail");
    }
    document.getElementById("shTitle").textContent = meta.icon + " " + meta.label;
    var cmpLine = kkCompareLine(code, nm, entry, isPref);
    var descHtml = meta.desc
      .replace(/【([^】]+)】/g, "<strong style='color:#6a3de8;'>$1</strong>")
      .replace(/。/g, "。\n")
      .replace(/\n{2,}/g, "\n\n")
      .replace(/\n/g, "<br>");
    var html = (cmpLine ? "<div style='background:#a08be814;border:1px solid #a08be840;border-radius:12px;padding:12px 14px;font-weight:700;color:#3a2a6e;margin:0 0 14px;'>" + cmpLine + "</div>" : "")
      + descHtml;
    document.getElementById("shDesc").innerHTML = html;
    document.getElementById("spSvg").innerHTML = "";
    document.getElementById("spSvg").style.height = "0px";
    document.getElementById("spLabels").innerHTML = "";
    document.getElementById("ovEl").classList.remove("hidden");
  }

  function kkColor(code, val, entry, isPref){
    var NEUTRAL = "#a08be8";
    if (val == null) return NEUTRAL;
    if (code === "ka3") {
      return val < 50 ? "#6dcfad" : val < 65 ? "#7bb8e8" : val < 75 ? "#f0c46a" : "#f0876a";
    }
    if (code === "ka4") {
      return val >= 80 ? "#6dcfad" : val >= 60 ? "#7bb8e8" : val >= 40 ? "#f0c46a" : "#f0876a";
    }
    if (code === "ka5") {
      return val < 10 ? "#6dcfad" : val < 30 ? "#7bb8e8" : val < 60 ? "#f0c46a" : "#f0876a";
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

  function kkRadarSvg(nm, entry, isPref){
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
      return "<div style='text-align:center;'>" +
        "<span class='hlbl' style='background:" + KK_AXIS_COLORS[idx] + "22;color:" + KK_AXIS_COLORS[idx] + ";white-space:nowrap;'>" + axis.friendly + "</span>" +
        "<div class='hmsg' style='margin-top:3px;'>" + KK_META[axis.code].label + "</div>" +
        "</div>";
    }
    // KK_RADAR_AXESの並び順: 0=上, 1=右, 2=下, 3=左
    var chartBox = "<div style='position:relative;width:clamp(70px,calc(100vw - 272px),260px);height:clamp(70px,calc(100vw - 272px),260px);margin:0 auto;'>" +
      "<div style='position:absolute;top:0;left:0;width:100%;height:100%;'>" + svg + "</div>" +
      "<div style='position:absolute;right:0;bottom:0;display:flex;align-items:center;gap:3px;font-size:10px;color:#6b6862;'>" +
      "<span style='display:inline-block;width:10px;height:0;border-top:2px dashed #6b6862;'></span>全国中央値" +
      "</div></div>";
    var vertexGrid = "<div style='display:grid;grid-template-columns:92px 1fr 92px;align-items:center;justify-items:center;gap:6px;'>" +
      "<div></div><div>" + axisLabelHtml(0) + "</div><div></div>" +
      "<div>" + axisLabelHtml(3) + "</div>" + chartBox + "<div>" + axisLabelHtml(1) + "</div>" +
      "<div></div><div>" + axisLabelHtml(2) + "</div><div></div>" +
      "</div>";

    var head = "<div style='text-align:center;margin-bottom:16px;'>" +
      "<span style='font-family:\"Kaisei Tokumin\",serif;font-size:24px;color:#3a2a6e;'>" + nm + "</span>" +
      "</div>";

    return head + vertexGrid;
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
    var html = kkRadarSvg(nm, entry, isPref);
    html += "<div class='tap-hint' style='margin-top:20px;'>\ud83d\udcca \u5404\u9805\u76ee\u3092\u30bf\u30c3\u30d7\u3059\u308b\u3068\u8aac\u660e\u304c\u8868\u793a\u3055\u308c\u307e\u3059</div><div class='grid'>";
    KK_ORDER.forEach(function(code){ html += kkBoxHtml(code, entry, isPref); });
    html += "</div><div class='src'>\ud83d\udccb \u7dcf\u52d9\u7701\u300c\u7d71\u4e00\u7684\u306a\u57fa\u6e96\u306b\u3088\u308b\u8ca1\u52d9\u66f8\u985e\u306b\u95a2\u3059\u308b\u8abf\u300d\u4ee4\u548c5\u5e74\u5ea6</div>";
    body.innerHTML = html;
    body.querySelectorAll(".kk-stat").forEach(function(el){
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

})();

function shareX() {
  var cnt = window.mitchieMunicipalityCount || 1786;
  var text = "みっちー財政カルテ🐧\n全国" + cnt.toLocaleString() + "自治体の財政をチェックできます！\n#みっちー財政カルテ";
  var url = "https://ray-ray870.github.io/mitchie-fiscal/?v=2";
  if (typeof gtag === "function") {
    gtag('event', 'share_click', { share_method: 'X' });
  }
  window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url), "_blank");
}

function shareLine() {
  var cnt = window.mitchieMunicipalityCount || 1786;
  var text = "みっちー財政カルテ🐧\n全国" + cnt.toLocaleString() + "自治体の財政をチェックできます！\n#みっちー財政カルテ";
  if (typeof gtag === "function") {
    gtag('event', 'share_click', { share_method: 'LINE' });
  }
  window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent("https://ray-ray870.github.io/mitchie-fiscal/") + "&text=" + encodeURIComponent(text), "_blank");
}

/* --- アクセシビリティ: role="button" をキーボードでも押せるようにする --- */
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
  var el = e.target;
  if (!el || !el.getAttribute || el.getAttribute("role") !== "button") return;
  e.preventDefault();
  el.click();
});

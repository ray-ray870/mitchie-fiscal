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
    if (!found || found.ambiguous) return false;
    var ov = document.getElementById("ovEl");
    var cOv = document.getElementById("compareOv");
    if (ov) ov.classList.add("hidden");
    if (cOv) cOv.classList.add("hidden");
    document.body.style.overflow = "";
    document.getElementById("cityInput").value = target;
    // ホーム画面（検索前の画面）が表示されたまま結果画面と重ならないよう、念のため非表示にする
    var maJ = document.getElementById("mitchieArea");
    if (maJ) maJ.classList.add("hidden");
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

  function shareRankBoxHtml(cityName, d){
    var isPref = (d.p === cityName);
    var html = "<div class='sc-rank-box'>";
    if (!isPref) {
      var nat = mmRankNationalCity(cityName);
      if (nat) html += "<div class='sc-rank-line'>全国 "+nat.rank.toLocaleString()+"位</div><div class='sc-rank-sub'>/ "+nat.total.toLocaleString()+"自治体</div>";
      var prefRank = mmRankInPref(cityName, d.p);
      if (prefRank) html += "<div class='sc-rank-line'>"+d.p+"内 "+prefRank.rank.toLocaleString()+"位</div><div class='sc-rank-sub'>/ "+prefRank.total.toLocaleString()+"市町村</div>";
    } else {
      var pn = mmRankPrefNational(cityName);
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

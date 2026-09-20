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

  // 検索キーワードなど、ユーザーが入力した文字列をそのままHTMLに挿入すると
  // <script>タグなどを埋め込まれるリスク（XSS）があるため、必ずエスケープしてから使う
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function furuGoToCity(name) {
    var ov = document.getElementById("ovEl");
    if (ov) ov.classList.add("hidden");
    var input = document.getElementById("cityInput");
    if (!input) return;
    input.value = name;
    if (typeof hideSuggestions === "function") hideSuggestions();
    diagnose();
  }
  // ふるさと納税ランキングBOXの開閉状態。自治体をまたいで戻る/開き直しても
  // 直前の開閉状態を保つため、DOMではなくこの変数で覚えておく。
  var furuRankOpen = false;
  function furuToggleRank() {
    furuRankOpen = !furuRankOpen;
    var b = document.getElementById("furuRankBox");
    var t = document.getElementById("furuRankBtnLabel");
    if (!b || !t) return;
    b.style.display = furuRankOpen ? "block" : "none";
    t.innerHTML = furuRankOpen ? "🏆 全国ランキングTOP10 ▲" : "🏆 全国ランキングTOP10 ▶";
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
      if (found && found.ambiguous) {
        var candHtml = found.candidates.map(function(k){
          var pref = (DB[k] && DB[k].p) ? DB[k].p : "";
          return "<div class='suggest-item' style='cursor:pointer;padding:8px 12px;border:1px solid #ddd;border-radius:8px;margin:4px 0;' onclick=\"document.getElementById('cityInput').value='"+k.replace(/'/g,"\\'")+"';diagnose();\"><span>"+k+"</span>"+(pref?" <span class='pref' style='color:#888;font-size:12px;'>"+pref+"</span>":"")+"</div>";
        }).join("");
        re.innerHTML = "<div class='err'>「"+escapeHtml(q)+"」という名前の自治体が複数あります。どちらか選んでください：</div>" + candHtml;
        re.classList.remove("hidden");
        return;
      }
      if (!found) {
        re.innerHTML = "<div class='err'>😢 「"+escapeHtml(q)+"」のデータが見つかりません。<br>例：姶良市、東京都、夕張市</div>";
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
    var fuc = (d.fu!=null && d.fk!=null) ? (d.fu > d.fk ? "#6dcfad" : (d.fk > d.fu ? "#f0876a" : "#a0a0a0")) : "#a0a0a0";
    var eoc = d.eog!=null ? (d.eog>=0?"#6dcfad":d.eog>=-0.5?"#f0c46a":"#f0876a") : "#a0a0a0";
    var eic = d.eig!=null ? (d.eig>=0?"#6dcfad":d.eig>=-0.5?"#f0c46a":"#f0876a") : "#a0a0a0";
    var eol = d.eo ? d.eo.toLocaleString()+"億円" : "－";
    var eil = d.ei ? d.ei.toLocaleString()+"億円" : "－";
    var eogs = d.eog!=null ? (d.eog>=0?"+":"")+d.eog.toFixed(1)+"%" : "";
    var eigs = d.eig!=null ? (d.eig>=0?"+":"")+d.eig.toFixed(1)+"%" : "";
    var el = document.getElementById("resEl");
    el.innerHTML =
      "<div class='fk-tabs'><button id='finTabBtn' class='fk-tab' role='button' tabindex='0'>財政</button><button id='kkTabBtn' class='fk-tab' role='button' tabindex='0'>公会計</button></div>" +
      "<div class='card' id='finContent' style='border-left:5px solid #6dcfad;'>" +
      "<div class='corner-row'><div class='compare-corner-wrap' id='compareBtnWrap'></div><div id='mmCompareBtnWrap'></div></div>" +
      "<h2 class='sr-only'>診断結果</h2><div class='hero'>" +
        "<div class='ava'>" +
          "<img src='data:image/png;base64," + IMGS[pr.img] + "' alt='" + pr.l + "'>" +
          "<div class='badge' style='color:"+pr.c+";border-color:"+pr.c+";'>"+pr.e+"</div>" +
        "</div>" +
        "<div>" +
          "<div class='cname'>"+(mmIsMine(nm)?"\ud83d\udc27 ":"")+nm+"</div>" +
          "<div class='cpref'>"+d.p+"</div>" +
          "<div class='hlbl' style='background:"+pr.bg+";color:"+pr.c+";'>"+pr.l+"</div>" +
          "<div class='stars'>"+stars(h)+"</div>" +
          fiscalStatusBadge(d, nm===d.p) +
          "<div class='hmsg'>"+pr.m+"</div>" +
        "</div>" +
      "</div>" +
      "<h2 class='sr-only'>健康度スコア</h2>" + noteHtml(d, h, d.p === nm) + "<div class='meter' id='m0' role='button' tabindex='0' style='border:3px solid "+pr.c+";background:"+pr.c+"10;'><div class='mt'><span>財政健全度スコア</span><span style='color:"+pr.c+";font-weight:700;'>"+h+"点</span></div>" +
        mmScoreBoxRanks(nm, d) +
        "<div class='mt-tap' style='text-align:center;margin-top:6px;'>タップで<span style='color:"+pr.c+";font-weight:700;'>"+nm+"</span>と似た自治体と詳細を見る▶</div>" +
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
        "<div class='stat' id='s3' role='button' tabindex='0' style='background:"+rc+"18;border-color:"+rc+"44;'><div class='si'>🐧</div><div class='sl'>財政調整基金</div><div class='sv' style='color:"+rc+";'>"+((d.sfs && d.sfs>0)?(d.r/d.sfs*100).toFixed(1)+"%":d.r+"億円")+"</div><div style='font-size:12px;color:#8a8a9a;margin-top:2px;'>("+d.r+"億円)</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s4' role='button' tabindex='0' style='background:"+gc+"18;border-color:"+gc+"44;'><div class='si'>👥</div><div class='sl'>人口増減率</div><div class='sv' style='color:"+gc+";'>"+(d.g>=0?"+":"")+d.g.toFixed(1)+"%</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s5' role='button' tabindex='0' style='background:#7bb8e818;border-color:#7bb8e844;'><div class='si'>💹</div><div class='sl'>歳出／歳入</div><div class='sv' style='font-size:14px;line-height:1.7;'><span style='color:"+eoc+";display:block;'>💸 歳出 "+eol+" <small style='font-size:13px;'>"+eogs+"</small></span><span style='color:"+eic+";display:block;'>💰 歳入 "+eil+" <small style='font-size:13px;'>"+eigs+"</small></span></div></div>" +
        "<div class='stat' id='s6' role='button' tabindex='0' style='background:"+educ+"18;border-color:"+educ+"44;'><div class='si'>📚</div><div class='sl'>教育費一般財源比率</div><div class='sv' style='color:"+educ+";'>"+edul+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s7' role='button' tabindex='0' style='background:"+chc+"18;border-color:"+chc+"44;'><div class='si'>👧</div><div class='sl'>子ども1人当たり投資額</div><div class='sv' style='color:"+chc+";'>"+chl+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s8' role='button' tabindex='0' style='background:"+fuc+"18;border-color:"+fuc+"44;'><div class='si'>🎁</div><div class='sl'>ふるさと納税</div><div class='sv' style='font-size:14px;line-height:1.7;'><span style='color:#6dcfad;display:block;'>🎁 受入額 "+(d.fu!=null?fmtManOku(d.fu):"—")+"</span><span style='color:#f0876a;display:block;'>📤 住民税控除額 "+(d.fk!=null?fmtManOku(d.fk):"—")+"</span></div></div>" +
      "</div>" +
      "<div class='adv'><strong>みっちーからのひとこと</strong><br>"+advice(nm,d)+"</div>" +
      "<div style='text-align:center;margin:16px 0 4px;'><button id='shareImgBtn' style='background:linear-gradient(135deg,#a08be8,#e060a8);color:white;border:none;border-radius:50px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(140,80,220,0.3);display:inline-flex;align-items:center;gap:8px;'>結果を共有する<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='18' cy='5' r='3'></circle><circle cx='6' cy='12' r='3'></circle><circle cx='18' cy='19' r='3'></circle><line x1='8.59' y1='13.51' x2='15.42' y2='17.49'></line><line x1='15.41' y1='6.51' x2='8.59' y2='10.49'></line></svg></button></div>" +
      "<div class='src'>📋 総務省「地方財政状況調査関係資料」令和6年度 | <a href='https://www.soumu.go.jp/iken/jokyo_chousa_shiryo.html' target='_blank'>総務省公式</a></div>" +
      "</div>" +
      "<div class='card hidden' id='kkContent' style='border-left:5px solid #f0c46a;'></div>";
    el.classList.remove("hidden");
    fkInitTabs(nm, d);
    renderCompareButton(nm);
    mmRenderCompareBtn(nm);
    updateCompareBar();
    if (!keepScroll) { window.scrollTo(0, 0); }
    setTimeout(function(){
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
    var s8el = document.getElementById("s8");
    if (s8el) s8el.addEventListener("click", function(){ openD("furusato"); });
    var shareImgBtn = document.getElementById("shareImgBtn");
    if (shareImgBtn) shareImgBtn.addEventListener("click", function(){ shareResultImage(nm, d, h, pr); });
  }

  // 万円の数値を「X億Y,YYY万円」形式にフォーマット
  function fmtManOku(v) {
    if (v == null) return "—";
    var oku = Math.floor(v / 10000);
    var man = Math.round(v - oku * 10000);
    if (oku > 0) return man > 0 ? (oku + "億" + man.toLocaleString() + "万円") : (oku + "億円");
    return Math.round(v).toLocaleString() + "万円";
  }

  var META_ONELINE = {
    fiscalPower: "自治体がどれだけ自前の税収でやりくりできているかを見る指標",
    debt: "自治体が借金返済にどれくらい財源を使っているかを見る指標",
    flex: "毎年入るお金のうち、固定費でどれだけ使われているかを見る指標",
    future: "自治体が将来支払うべき借金の重さを見る指標",
    reserve: "自治体の「もしもの時のための貯金」がどれくらいあるかを見る指標",
    growth: "自治体の人口がどれくらい増えている・減っているかを見る指標",
    education: "自治体の支出のうち、教育にどれだけ使われているかを見る指標",
    childInvest: "子ども1人あたりにどれくらいお金をかけているかを見る指標",
    budget: "自治体が1年間に使ったお金と入ってきたお金を見る指標"
  };
  var META = {
    health:{icon:"🏥",label:"総合財政健全度スコア",desc:"総務省の公式データから財政力・借金返済・固定費・将来負担・貯金の5指標を用いて算出した、本アプリ独自の参考スコアです（0〜100点）。公式の格付けではありません。\n\n都道府県は高校・国道・河川など大規模な資産を抱えるため、将来負担比率や経常収支比率の水準が市区町村より構造的に高くなります。そのため都道府県には専用の基準を用いており、市区町村の点数とは直接比較できません。\n\n目安\n85点以上 → 絶好調\n70点以上 → 元気\n50点以上 → ちょっとしんどい\n30点以上 → ぐったり\n30点未満 → ひんし状態\n\nスコアの上に出る帯について\n⚠️「ただし、〜は高い水準です」\n総合スコアは高めでも、その指標だけが弱い場合に出ます。たとえば税収などの体力はあるものの、毎年の支出が固まっていて、新しい取り組みに回せるお金は少ない、という状態です。\n\n💡「〜は健全な水準です」\n総合スコアは低めでも、その指標は明確に良い場合に出ます。全体としては厳しくても、その部分の管理はできている、という意味です。\n\nスコアは5つの指標をまとめた参考値です。1つの数字だけで判断せず、各指標もあわせて見てください。",unit:"pt"},
    debt:{icon:"💳",label:"実質公債費比率",desc:"一般会計等が負担する実質的な公債費の標準財政規模に対する比率。25%以上で早期健全化基準、35%以上で財政再生基準となります。出典：総務省令和6年度\n\n目安\n10%未満 → 健全\n18%超 → 注意\n25%以上 → 早期健全化基準\n35%以上 → 財政再生基準\n\n📈 高くなる理由\n① 過去の大型公共事業・施設建設で地方債を多く発行した\n② 合併特例債など特別な借入が多い\nなど。\n\n📉 低くなる理由\n① 堅実な財政運営で借入を抑制してきた\n② 財政力が高く税収が豊富なため借入が少ない\nなど。",unit:"%"},
    fiscalPower:{icon:"💪",label:"財政力指数",desc:"基準財政収入額を基準財政需要額で割った値。1.0以上の団体には地方交付税が交付されません（不交付団体）。出典：総務省令和6年度\n\n目安\n🟢 0.70以上 → 税収基盤が強い\n🔵 0.45〜0.70 → 標準的（中央値は市区町村0.44／都道府県0.47）\n🟡 0.25〜0.45 → 交付税への依存が大きい\n🟠 0.25未満 → 税収基盤が特に弱い\n\nこの数値が低いことは、それ自体では財政危機を意味しません。税収が少ない分は地方交付税で補われる仕組みになっているためです。人口が少ない地域や産業基盤の小さい地域では、低い値が出るのが通常です。\n\n📈 高くなる理由\n① 企業・工場が多く法人税・固定資産税が豊富\n② 人口が多く個人住民税が充実している\nなど。\n\n📉 低くなる理由\n① 産業が乏しく税収基盤が弱い\n② 人口減少・高齢化で税収が低下している\nなど。",unit:""},
    flex:{icon:"📊",label:"経常収支比率",desc:"毎年度の経常的収入のうち人件費・扶助費・公債費など経常的経費に充当された割合。低いほど財政に弾力性があります。出典：総務省令和6年度\n\n目安\nかつて「75〜80%が望ましい」とされてきましたが、これは法令上の基準ではなく慣例的な目安です。社会保障費の増加により全国的に上昇し、2003年度以降は全国平均が90%を超え続けています。\n\n🟢 90%未満 → 全国の中では余裕があるほう\n🔵 90〜95% → 標準的な水準（市区町村の中央値91.5%／都道府県93.8%）\n🟡 95〜98% → 新しい取り組みに回せるお金が少ない\n🟠 98%以上 → 余力がほぼない（全体の約9%）\n\nこの数字だけで良し悪しは判断できません。実質公債費比率や財政力指数と合わせて見てください。\n\n📈 高くなる理由\n① 人件費・社会保障費など固定的な支出が大きい\n② 過去の借金返済（公債費）が重い\nなど。\n\n📉 低くなる理由\n① 税収が豊富で財政に余裕がある\n② 行財政改革で人件費・固定費を削減した\nなど。",unit:"%"},
    future:{icon:"🏦",label:"将来負担比率",desc:"一般会計等が将来負担すべき実質的な負債総額の標準財政規模に対する比率。350%以上で早期健全化基準。出典：総務省令和6年度\n\n目安（市区町村）\n🟢 負担なし・0%\n🔵 60%未満 → 軽い\n🟡 60〜100% → 一定の負担あり\n🟠 100%以上 → 要注意\n\n目安（都道府県）\n🟢 100%未満\n🔵 100〜160% → 標準的（47都道府県の中央値は159.7%）\n🟡 160〜250% → やや重い\n🟠 250%以上 → 重い\n\n都道府県は高校・国道・河川など大規模な資産を抱えるため、市区町村より水準が高くなります。そのため色の基準を分けています。\n\nなお350%以上は法令上の早期健全化基準です（市区町村は350%、都道府県は400%）。\n\n📈 高くなる理由\n① 過去の借入が多く残債が大きい\n② 公営企業・第三セクターの債務も含まれる\nなど。\n\n📉 低くなる理由\n① 借入を抑制し着実に返済してきた\n② 財政調整基金など充当可能財源が多い\nなど。",unit:"%"},
    reserve:{icon:"🐧",label:"財政調整基金残高",desc:"年度間の財源不足に備えて積み立てている自治体の貯金です。残高が多いほど不測の事態への備えがあります。出典：総務省基金残高等一覧令和6年度（概算）\n\n目安（標準財政規模に対する割合）\n標準財政規模とは、自治体が使い道を決められるお金（一般財源）の標準的な総額です。財政調整基金の水準は、実務でもこの割合で語られます。\n\n市区町村（中央値24.8%）\n🟢 20%以上 → 一般に適正とされる上限に到達\n🔵 10〜20% → 一般に適正とされる範囲\n🟡 5〜10% → やや少なめ\n🟠 5%未満 → 少ないほう\n\n都道府県（中央値6.4%）\n🟢 10%以上 → 都道府県としては多いほう\n🔵 5〜10% → 総務省調査で最も多い水準\n🟡 2.5〜5% → やや少なめ\n🟠 2.5%未満 → 少ないほう\n\n適正水準に法令上の基準はありません。総務省が平成29年に行った調査では、積立の考え方を「標準財政規模の一定割合」と答えた団体の水準は、都道府県で5%前後、市町村で5〜20%が多いという結果でした。都道府県と市区町村では水準が大きく違うため、基準を分けています。\n\n多いほど良いとは限りません。積立の原資は住民が納めた税金であり、貯め込みすぎは「使うべきところに使えていない」という見方もできます。\n\n📈 多い理由\n① 税収が安定し積立を続けてきた\n② 原発立地など特別な収入がある\nなど。\n\n📉 少ない理由\n① 財政難で取り崩しが続いている\n② 大規模災害・事業で緊急支出があった\nなど。",unit:"億円"},
    growth:{icon:"👥",label:"人口増減率",desc:"住民基本台帳に基づく前年比人口増減率。人口減少は税収低下や社会保障費増加につながります。出典：総務省令和7年\n\n目安\n0%以上 → 人口増加\n-0.5%以上 → 緩やかな減少\n-1%以下 → 深刻な人口減少\n\n📈 増加の理由\n① 子育て支援・住環境が充実した新興住宅地\n② 企業誘致・雇用創出が成功している\nなど。\n\n📉 減少の理由\n① 若者が都市部へ流出している\n② 少子高齢化が急速に進んでいる\nなど。",unit:"%"},
    budget:{icon:"💹",label:"歳出／歳入",desc:"一般会計の歳出・歳入総額（億円）。自治体の予算規模を示します。歳出は人件費・扶助費・公債費・投資的経費などの総支出、歳入は地方税・地方交付税・国庫支出金・地方債などの総収入です。出典：総務省令和6年度地方財政状況調査\n\n目安\n歳入＞歳出 → 黒字基調\n歳入＝歳出 → 収支均衡\n歳入＜歳出 → 赤字基調（要注意）",unit:"億円"},
    education:{icon:"📚",label:"教育費一般財源比率",desc:"歳出総額に占める教育費の割合です（総務省令和6年度データ）。\n\n目安\n中央値は市区町村10.5%、都道府県18.9%です。都道府県は高校・特別支援学校を持つため、市区町村より構造的に高くなります。\n\n⚠️ この数字には良し悪しがありません。そのため色分けをしていません。\n高いのは教育を重視しているからとも、学校施設の老朽化対応や小規模校の維持で費用がかさんでいるからとも読めます。低いのは子どもの人口が多くて相対的に下がっている場合もあります。他の指標と合わせてご覧ください。\n\n📈 比率が高くなる理由\n① 学校施設の老朽化対応（校舎・体育館の改修・建替え）\n② 少子化でも学校を統廃合できず固定費がかかる\n③ 教育・子育てを重点政策と位置づけ積極的に投資している\n④ 過疎地・離島で小規模校を存続させている\nなど。\n\n📉 比率が低くなる理由\n① 子ども人口が多く相対的に比率が下がる\n② 子育て・教育より、他の政策を優先する政策判断のため。（他の政策→インフラ・高齢者福祉などが考えられる）\nなど。",unit:"%"},
    childInvest:{icon:"👧",label:"子ども1人当たり投資額",desc:"教育費と児童福祉費の合計を18歳未満人口で割った値です（総務省令和6年度データ）。\n\n目安\n中央値は市区町村118.4万円、都道府県87.9万円です。\n\n⚠️ この数字には良し悪しがありません。そのため色分けをしていません。\n18歳未満の人数で割った値なので、子どもが少ない自治体ほど大きく出ます。全国で最も高いのは974万円ですが、これは投資が手厚いのではなく、分母となる子どもの数が極端に少ないためです。逆に子育て世代が多い新興住宅地では、分母が大きくなるため低く出ます。\n\n金額の大小ではなく、同じ規模の自治体との比較や、経年の変化を見るほうが実態をつかめます。\n\n📉 数値が低い理由\n① 子育て世代が多く子ども人口が多い新興住宅地（分母が大きい）\n② 財政が厳しく教育・子育てへの支出が少ない\n③ 子育て・教育より、他の政策を優先する政策判断のため。（他の政策→インフラ・高齢者福祉などが考えられる）\nなど。\n\n📈 数値が高い理由\n① 過疎地で子ども数が極少なため1人当たりコストが膨らむ\n② 教育・子育てを重点政策と位置づけ積極的に投資している\nなど。",unit:"万円"},
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
    unit:""},
    furusato:{icon:"🎁",label:"ふるさと納税受入額",desc:"",htmlDesc:"",unit:"万円"}
  };

  function openD(key, skipPush) {
    if (!cur) return;
    var m = META[key];
    if (!m) return;
    var spWrapEl = document.getElementById("spWrap");
    if (spWrapEl) spWrapEl.style.display = "";
    if (typeof gtag === "function") {
      gtag('event', 'view_metric_detail', { metric_key: key });
    }
    if (!skipPush && document.getElementById("ovEl").classList.contains("hidden")) {
      if (history.state && history.state.mitchieView === "result") {
        history.replaceState(Object.assign({}, history.state, {scrollY: window.scrollY}), "", "#result");
      }
      history.pushState({mitchieView:"detail", key:key, city:curName}, "", "#detail");
    }
    var shEl = document.querySelector("#ovEl .sh");
    if (shEl) shEl.scrollTop = 0;
    if (key === "fiscalStatus") {
      document.getElementById("shTitle").textContent = m.icon+" "+m.label;
      document.getElementById("shTop").innerHTML = "";
      document.getElementById("shDesc").innerHTML = m.htmlDesc || chipifyHeaders(m.desc).replace(/\n/g,"<br>");
      document.getElementById("spSvg").innerHTML = "";
      document.getElementById("spSvg").style.height = "0px";
      document.getElementById("spLabels").innerHTML = "";
      if (spWrapEl) spWrapEl.style.display = "none";
      document.getElementById("ovEl").classList.remove("hidden");
      document.querySelectorAll(".peer-chip").forEach(function(chip){
        chip.addEventListener("click", function(){
          jumpToCity(this.getAttribute("data-city"));
        });
      });
      return;
    }
    if (key === "furusato") {
      document.getElementById("shTitle").textContent = m.icon+" "+m.label;
      var isPrefViewF = cur && curName === cur.p;

      var medalFor = function(rank, isNational) {
        if (rank === 1) return "🥇";
        if (rank === 2) return "🥈";
        if (rank === 3) return "🥉";
        if (isNational && rank <= 10) return "🎖️";
        return "";
      };

      var rankHtmlF = "";
      if (DB && cur) {
        if (isPrefViewF) {
          var prefListF = [];
          Object.keys(DB).forEach(function(k){ var e=DB[k]; if (k===e.p && e.fu!=null) prefListF.push({k:k,v:e.fu}); });
          prefListF.sort(function(a,b){ return b.v-a.v; });
          var myRankPF = null;
          for (var pfi2=0; pfi2<prefListF.length; pfi2++){ if (prefListF[pfi2].k===curName){ myRankPF=pfi2+1; break; } }
          if (myRankPF) {
            var medalPF = medalFor(myRankPF, true);
            rankHtmlF = "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:#6dcfad18;border:1.5px solid #6dcfad44;border-radius:12px;padding:6px 14px;margin:6px 0 18px;font-size:14px;font-weight:700;color:#2a8a6a;'>" +
              (medalPF?medalPF+" ":"") + "全国 <span style='font-size:17px;'>" + myRankPF + "位</span>/" + prefListF.length + "都道府県中</div>";
          }
        } else {
          var natListF = [], prefListF2 = [];
          Object.keys(DB).forEach(function(k){
            var e = DB[k];
            if (k === e.p) return;
            if (e.fu == null) return;
            natListF.push({k:k, v:e.fu});
            if (e.p === cur.p) prefListF2.push({k:k, v:e.fu});
          });
          natListF.sort(function(a,b){ return b.v-a.v; });
          prefListF2.sort(function(a,b){ return b.v-a.v; });
          var myRankNF=null, myRankPrefF=null;
          for (var ni2=0; ni2<natListF.length; ni2++){ if (natListF[ni2].k===curName){ myRankNF=ni2+1; break; } }
          for (var pfi3=0; pfi3<prefListF2.length; pfi3++){ if (prefListF2[pfi3].k===curName){ myRankPrefF=pfi3+1; break; } }
          var linesF = "";
          if (myRankNF) {
            var medalNF = medalFor(myRankNF, true);
            linesF += "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:#6dcfad18;border:1.5px solid #6dcfad44;border-radius:12px;padding:6px 14px;margin:0 0 6px;font-size:14px;font-weight:700;color:#2a8a6a;'>" + (medalNF?medalNF+" ":"") + "全国 <span style='font-size:17px;'>" + myRankNF + "位</span>/" + natListF.length + "自治体中</div>";
          }
          if (myRankPrefF) {
            var medalPF2 = medalFor(myRankPrefF, false);
            linesF += "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:#6dcfad18;border:1.5px solid #6dcfad44;border-radius:12px;padding:6px 14px;margin:0;font-size:14px;font-weight:700;color:#2a8a6a;'>" + (medalPF2?medalPF2+" ":"") + cur.p + "内 <span style='font-size:17px;'>" + myRankPrefF + "位</span>/" + prefListF2.length + "自治体中</div>";
          }
          rankHtmlF = linesF ? (linesF + "<div style='margin-bottom:10px;'></div>") : "";
        }
      }

      var fu = cur.fu || 0, fk = cur.fk || 0;
      var fuH = (cur.fuH && cur.fuH.length) ? cur.fuH : [fu];
      var fkH = (cur.fkH && cur.fkH.length) ? cur.fkH : [fk];

      var diff = fu - fk;
      var mainColor = diff > 0 ? "#2a8a6a" : (diff < 0 ? "#c04030" : "#5a5a7a");
      var mainTerm = diff > 0 ? "黒字" : (diff < 0 ? "赤字" : "均衡");
      var relText;
      if (fk <= 0 && fu > 0) relText = "住民税控除額がほとんど発生しておらず";
      else if (fu >= fk*2) relText = "受入額が住民税控除額を大きく上回っており";
      else if (fu > fk) relText = "受入額が住民税控除額を上回っており";
      else if (fk >= fu*2) relText = "住民税控除額が受入額を大きく上回っており";
      else if (fk > fu) relText = "住民税控除額が受入額を上回っており";
      else relText = "受入額と住民税控除額がほぼ同水準で";

      var topSummaryHtmlF = "<div style='background:"+mainColor+"14;border:1px solid "+mainColor+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;'>" +
        "<div style='background:rgba(255,255,255,0.6);border-radius:10px;padding:8px 10px;text-align:center;'><div style='font-size:12px;color:#5a5a7a;'>受入額</div><div style='font-size:17px;font-weight:700;color:#6dcfad;'>"+fmtManOku(fu)+"</div></div>" +
        "<div style='background:rgba(255,255,255,0.6);border-radius:10px;padding:8px 10px;text-align:center;'><div style='font-size:12px;color:#5a5a7a;'>住民税控除額</div><div style='font-size:17px;font-weight:700;color:#f0876a;'>"+fmtManOku(fk)+"</div></div>" +
        "</div>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+mainColor+";font-weight:700;'>"+curName+"</span>は、"+relText+"、ふるさと納税で<span style='color:"+mainColor+";font-weight:700;'>"+mainTerm+"</span>です。</div>";
      if (fuH.length >= 2 && fuH[0] > 0) {
        var yrLabelsShortF = ["H30","R1","R2","R3","R4","R5","R6","R7"].slice(0, fuH.length);
        var lastIdxF = fuH.length - 1;
        var ratioF = fuH[lastIdxF] / fuH[0];
        var peakIdxF = 0;
        for (var pki=1; pki<fuH.length; pki++){ if (fuH[pki] > fuH[peakIdxF]) peakIdxF = pki; }
        var maxFu = fuH[peakIdxF];
        var positiveFu = fuH.filter(function(v){ return v > 0; });
        var minFu = positiveFu.length ? Math.min.apply(null, positiveFu) : 0;
        var volatileFu = minFu > 0 && (maxFu / minFu >= 3);
        var afterPeakRatioF = maxFu > 0 ? fuH[lastIdxF] / maxFu : 1;
        var covidYearsF = {"R2":1,"R3":1,"R4":1};
        var covidNoteF = covidYearsF[yrLabelsShortF[peakIdxF]] ? "（新型コロナウイルス対応の時期と重なります）" : "";
        if (volatileFu && peakIdxF !== lastIdxF && afterPeakRatioF <= 0.6) {
          topSummaryHtmlF += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📊 "+yrLabelsShortF[peakIdxF]+"年度が最も多く"+fmtManOku(maxFu)+"でした"+covidNoteF+"。その後は減少しており、直近の"+yrLabelsShortF[lastIdxF]+"年度は"+fmtManOku(fuH[lastIdxF])+"です</div>";
        } else if (ratioF >= 1.5) {
          topSummaryHtmlF += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📈 "+yrLabelsShortF[0]+"年度から増えており、直近の"+yrLabelsShortF[lastIdxF]+"年度はおよそ"+ratioF.toFixed(1)+"倍の"+fmtManOku(fuH[lastIdxF])+"です</div>";
        } else if (ratioF <= 0.67) {
          topSummaryHtmlF += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📉 "+yrLabelsShortF[0]+"年度から下がってきており、直近の"+yrLabelsShortF[lastIdxF]+"年度はおよそ"+(1/ratioF).toFixed(1)+"分の1の"+fmtManOku(fuH[lastIdxF])+"です</div>";
        } else if (volatileFu) {
          topSummaryHtmlF += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📊 受入額は年によって変動が大きく、"+yrLabelsShortF[peakIdxF]+"年度が最も多い"+fmtManOku(maxFu)+"でした"+covidNoteF+"</div>";
        } else {
          topSummaryHtmlF += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>➡️ 受入額はこの8年で大きな変化はなく、横ばい傾向です</div>";
        }
      }
      topSummaryHtmlF += "<div style='font-size:11px;color:#9090a8;margin-top:8px;'>※受入額は返礼品等の経費を引く前の総額です</div>";
      topSummaryHtmlF += "</div>";

      // (shTopの設定はグラフ構築後にまとめて行う)

      // グラフ（受入額・住民税控除額をそれぞれ独立したグラフで表示）
      function fmtFuruShort(v){ return v>=10000 ? (Math.round(v/1000)/10)+"億" : Math.round(v)+"万"; }
      var yrLabelsF = ["H30","R1","R2","R3","R4","R5","R6","R7"].slice(0, fuH.length);

      function buildMiniChart(arr, lineColor, textColor, labelBg, gradId){
        var Wm=300, Hm=72, Pm=10;
        var mnM=Math.min.apply(null,arr), mxM=Math.max.apply(null,arr);
        var rngM = Math.max(mxM-mnM, mxM*0.15) || 1;
        mnM = mnM - rngM*0.15; mxM = mxM + rngM*0.15; rngM = mxM-mnM;
        var PtopM=14, PbottomM=22;
        var n = arr.length;
        function pxm(i){ return Pm+(i/(n-1))*(Wm-Pm*2); }
        function pym(v){ return Hm-PbottomM-((v-mnM)/rngM)*(Hm-PtopM-PbottomM); }
        var pts = [];
        for (var i=0;i<n;i++){ pts.push([pxm(i), pym(arr[i])]); }
        var lineStr = pts.map(function(p){ return p[0].toFixed(1)+","+p[1].toFixed(1); }).join(" L");
        var areaStr = "M"+lineStr+" L"+pts[n-1][0].toFixed(1)+","+(Hm-2)+" L"+pts[0][0].toFixed(1)+","+(Hm-2)+" Z";

        // 最新値のピル位置を先に計算（重なり判定に使うため）
        var lastX = pts[n-1][0], lastY = pts[n-1][1];
        var lastLabel = fmtFuruShort(arr[n-1])+"円";
        var boxW = 18 + lastLabel.length*8;
        var boxX = Math.min(Math.max(lastX-boxW/2, 2), Wm-boxW-2);
        var pillTop = 2, pillBottom = 20;

        var dots = "";
        var lastDot = "";
        for (var j=0;j<n;j++){
          var isLast = j===n-1;
          var circleStr = "<circle cx='"+pts[j][0].toFixed(1)+"' cy='"+pts[j][1].toFixed(1)+"' r='"+(isLast?4:2.5)+"' fill='"+(isLast?lineColor:"white")+"' stroke='"+lineColor+"' stroke-width='2'/>";
          if (isLast) {
            lastDot = circleStr;
          } else {
            dots += circleStr;
            // 周りより低い「谷」の点はラベルを下側に、それ以外は上側に置いて線をまたがないようにする
            var prevV = j>0 ? arr[j-1] : null;
            var nextV = j<n-1 ? arr[j+1] : null;
            var isValley = (prevV==null || arr[j] <= prevV) && (nextV==null || arr[j] <= nextV) && (prevV!=null || nextV!=null);
            var aboveY = pts[j][1]-6;
            var belowY = pts[j][1]+15;
            var overlapsPill = (pts[j][0] > boxX-10 && pts[j][0] < boxX+boxW+10) && (Math.min(aboveY,belowY) < pillBottom+6) && !isValley;
            var ly = (isValley || overlapsPill) ? belowY : aboveY;
            var isFirst = j===0;
            var anchorAttr = isFirst ? "start" : "middle";
            dots += "<text x='"+pts[j][0].toFixed(1)+"' y='"+ly.toFixed(1)+"' text-anchor='"+anchorAttr+"' font-size='9.5' font-weight='600' fill='"+textColor+"'>"+fmtFuruShort(arr[j])+"</text>";
          }
        }
        var svgInner = "<defs><linearGradient id='"+gradId+"' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='"+lineColor+"' stop-opacity='0.2'/><stop offset='100%' stop-color='"+lineColor+"' stop-opacity='0'/></linearGradient></defs>" +
          "<path d='"+areaStr+"' fill='url(#"+gradId+")' stroke='none'/>" +
          "<path d='M"+lineStr+"' fill='none' stroke='"+lineColor+"' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/>" +
          dots +
          "<rect x='"+boxX.toFixed(1)+"' y='"+pillTop+"' width='"+boxW+"' height='"+(pillBottom-pillTop)+"' rx='9' fill='white'/>" +
          "<text x='"+(boxX+boxW/2).toFixed(1)+"' y='15' text-anchor='middle' font-size='13' font-weight='700' fill='"+labelBg+"'>"+lastLabel+"</text>" +
          lastDot;
        // X軸ラベルはグラフ本体と同じ左右余白(Pm)を使って位置を揃える
        var xLabelsHtml = yrLabelsF.map(function(y,i){
          var xPix = pxm(i);
          var pct = (xPix / Wm) * 100;
          return "<span style='position:absolute;left:"+pct+"%;transform:translateX(-50%);'>"+y+"</span>";
        }).join("");
        return "<svg viewBox='0 0 "+Wm+" "+Hm+"' preserveAspectRatio='none' style='width:100%;height:"+Hm+"px;'>"+svgInner+"</svg>" +
          "<div style='position:relative;height:14px;font-size:9px;color:#9090a8;'>"+xLabelsHtml+"</div>";
      }

      var twoChartsHtml =
        "<div style='background:rgba(255,255,255,0.8);border-radius:12px;padding:10px 12px;margin-bottom:10px;'>" +
        "<div style='font-size:12px;font-weight:700;color:#2a8a6a;margin-bottom:2px;'>🎁 受入額の推移</div>" +
        buildMiniChart(fuH, "#6dcfad", "#3a8a6a", "#2a8a6a", "gFuruUke") +
        "</div>" +
        "<div style='background:rgba(255,255,255,0.8);border-radius:12px;padding:10px 12px;margin-bottom:14px;'>" +
        "<div style='font-size:12px;font-weight:700;color:#c05a30;margin-bottom:2px;'>💸 住民税控除額の推移</div>" +
        buildMiniChart(fkH, "#f0876a", "#b06a40", "#c05a30", "gFuruKojo") +
        "</div>" +
        "<div style='font-size:11px;color:#9090a8;text-align:center;margin-bottom:14px;'>※それぞれ別スケールで表示しています</div>";

      document.getElementById("shTop").innerHTML = rankHtmlF + topSummaryHtmlF + twoChartsHtml;
      document.getElementById("spSvg").innerHTML = "";
      document.getElementById("spSvg").style.height = "0px";
      document.getElementById("spLabels").innerHTML = "";
      var spWrapF = document.getElementById("spWrap");
      if (spWrapF) spWrapF.style.display = "none";

      var natTotalF = 0;
      var topFuList = [];
      if (DB) {
        Object.keys(DB).forEach(function(k){
          var e = DB[k];
          if (e.fu != null) {
            natTotalF += e.fu;
            topFuList.push({ name: k, pref: e.p, fu: e.fu });
          }
        });
        topFuList.sort(function(a,b){ return b.fu - a.fu; });
        topFuList = topFuList.slice(0, 10);
      }
      var natTotalOkuF = Math.round(natTotalF / 10000).toLocaleString();

      var RANK_MEDAL = ["#f0a93a", "#aab2c2", "#c98652"]; // 金・銀・銅
      var topFuRowsHtml = topFuList.map(function(row, i){
        var medalStyle = i < 3
          ? "background:linear-gradient(135deg,"+RANK_MEDAL[i]+"cc,"+RANK_MEDAL[i]+");color:#fff;"
          : "background:#cfcbe6;color:#fff;";
        var mmChip = (typeof mmIsMine === "function" && mmIsMine(row.name))
          ? "<span style='display:inline-block;background:#a08be822;color:#6a4dc0;border-radius:8px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:6px;white-space:nowrap;'>🐧 Myみっちー</span>"
          : "";
        return "<div role='button' tabindex='0' onclick=\"furuGoToCity('"+row.name.replace(/'/g,"\\'")+"')\" style='display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e6e3f2;border-radius:12px;padding:9px 12px;margin-bottom:6px;cursor:pointer;'>" +
          "<div style='width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;"+medalStyle+"'>"+(i+1)+"</div>" +
          "<div style='flex:1;min-width:0;'><div style='font-size:14px;font-weight:700;color:#2c2c3c;'>"+escapeHtml(row.name)+mmChip+"</div><div style='font-size:11px;color:#9a97b5;'>"+escapeHtml(row.pref||"")+"</div></div>" +
          "<div style='font-size:13px;font-weight:700;color:#2a8a6a;white-space:nowrap;'>"+fmtManOku(row.fu)+"</div>" +
        "</div>";
      }).join("");
      var furuRankBoxHtml = "<div id='furuRankBox' style='display:"+(furuRankOpen?"block":"none")+";margin-top:10px;'>" +
        "<div style='font-size:12px;color:#9090a8;margin-bottom:8px;'>受入額 TOP10（R7年度・総務省公表データ）</div>" +
        topFuRowsHtml +
      "</div>";

      var descHtmlF = "<div style='font-size:15px;color:#3a3a4a;line-height:1.8;margin-bottom:14px;'>" +
        "生まれ故郷や応援したい自治体に寄附をすると、返礼品がもらえ、翌年の住民税・所得税が控除される制度です。寄附する自治体は自由に選べます。" +
        "</div>" +
        "<div style='background:#eeecf8;border:1px solid #dcd8ee;border-radius:14px;padding:14px 16px;margin-bottom:16px;'>" +
        "<div style='font-size:15px;color:#3a3a4a;line-height:1.8;'><strong><span style='color:#3a6ee8;'>R7年度</span> 全国のふるさと納税受入額は約<span style='color:#3a6ee8;font-size:16px;'>" + natTotalOkuF + "億円</span>です。</strong></div>" +
        "<div style='text-align:center;margin-top:10px;'><button type='button' onclick=\"furuToggleRank()\" style='display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#f7b955,#f0876a);color:#fff;font-weight:700;font-size:13px;border:none;border-radius:999px;padding:9px 16px;box-shadow:0 3px 8px rgba(240,135,106,0.35);cursor:pointer;font-family:inherit;'><span id='furuRankBtnLabel'>"+(furuRankOpen?"🏆 全国ランキングTOP10 ▲":"🏆 全国ランキングTOP10 ▶")+"</span></button></div>" +
        furuRankBoxHtml +
        "</div>" +
        "<div style='font-size:15px;color:#3a3a4a;line-height:1.8;'>" +
        "ふるさと納税には、方向が逆の2つのお金の動きがあります。<br><br>" +
        "<span style='display:inline-block;background:#6dcfad18;color:#2a8a6a;border-radius:8px;padding:2px 8px;font-weight:700;font-size:13px;'>🎁 受入額</span><br>" +
        "全国の人がこの自治体に寄附した金額の合計（＝この自治体の収入）。返礼品や経費を引く前の総額です。<br><br>" +
        "<span style='display:inline-block;background:#f0876a18;color:#c05a30;border-radius:8px;padding:2px 8px;font-weight:700;font-size:13px;'>💸 住民税控除額</span><br>" +
        "逆に、この自治体に住む人が「他の自治体」に寄附したことで、この自治体に入るはずだった住民税が差し引かれた金額（＝この自治体にとっての減収）。<br><br>" +
        "<strong>受入額 − 住民税控除額</strong> がプラスなら「黒字」、マイナスなら「赤字」と見ることができます。" +
        "</div>" +
        "<div style='font-size:12px;color:#7a7a9a;margin-top:10px;text-align:right;'>📋 総務省「ふるさと納税に関する現況調査」| <a href='https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/080430_2_kojin.html' target='_blank'>総務省公式</a></div>";

      document.getElementById("shDesc").innerHTML = "<div style='border-top:1px dashed #d8d5e8;margin:22px 0;'></div><div style='font-size:16px;font-weight:700;color:#3a6ee8;margin-bottom:8px;'>ふるさと納税とは？</div>" + descHtmlF;

      document.getElementById("ovEl").classList.remove("hidden");
      return;
    }
    // 将来負担比率(u)は総務省の資料で「充当可能財源等が将来負担額を上回る（＝負担なし）」場合に
    // 数値ではなく「－」で公表されており、取り込み時にnullになっている。これは欠測ではなく
    // 実質0%（負担なし）を意味するため、以後この値を扱う箇所ではnullを0として扱う。
    var val = key==="health"?calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs):key==="fiscalPower"?cur.f:key==="debt"?cur.d:key==="flex"?cur.x:key==="future"?(cur.u==null?0:cur.u):key==="reserve"?cur.r:key==="budget"?(cur.eo||0):key==="education"?(cur.edu||0):key==="childInvest"?(cur.ch||0):cur.g;
    var seed = (Math.abs(val*137) + key.charCodeAt(0)*31) % 100;
    var MAX_HIST = 7; // 履歴探索の上限（実際のデータは最大5年分＋最新=6ポイント。将来の年数増加にも耐えられるよう余裕を持たせている）
    function countHist(prefix, startIdx) {
      var n = 0;
      for (var i = startIdx; i < startIdx + MAX_HIST; i++) {
        if (Object.prototype.hasOwnProperty.call(cur, prefix + "_r" + i)) n++;
        else break;
      }
      return n;
    }
    var histCountFiscal = countHist("f", 1);
    // growthのみ令和2年始まり（g_r1は存在しないため）。取得開始位置と件数カウントの起点を必ず揃えること
    var growthStartIdx = (key === "growth") ? 2 : 1;
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
        if (key==="future") { var uHistV = cur["u"+suffix]; return uHistV==null ? 0 : uHistV; }
        if (key==="health") {
          var f=cur["f"+suffix], d=cur["d"+suffix], x=cur["x"+suffix];
          return (f!=null&&d!=null&&x!=null)?calcH(f,d,x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs):null;
        }
        return null;
      };
      var mainVal = key==="fiscalPower"?cur.f:key==="debt"?cur.d:key==="flex"?cur.x:key==="future"?(cur.u==null?0:cur.u):key==="health"?calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs):null;
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
      for (var gi=growthStartIdx; gi<growthStartIdx+N2; gi++) {
        var v3 = cur[fieldPrefix+"_r"+gi];
        vals.push(v3!=null ? parseFloat(parseFloat(v3).toFixed(decimals)) : null);
      }
      vals.push(gMain!=null ? parseFloat(gMain.toFixed(decimals)) : null);
      var growthYrLabels = growthStartIdx===1 ? ["R1","R2","R3","R4","R5","R6","R7"] : ["R2","R3","R4","R5","R6","R7","R8"];
      yrs = growthYrLabels.slice(0,N2).concat(["R"+(N2+growthStartIdx)+"（最新）"]);
    } else {
      // 過去の実績データが1件も無い場合：以前はサインカーブで「それっぽい」架空の推移を
      // 描いていたが、実データではないので誤解を招く。架空データは作らず、
      // グラフ自体を「データなし」表示にする（下のnoRealHistoryフラグで分岐）。
      yrs = [];
    }
    var noRealHistory = (!hasHistory && !hasGrowthHistory);
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
    // グラフの線色は薄い色（黄・水色など）だと数値の文字が読みにくいため、文字専用に濃い色を用意する（TEXT_COLOR_MAPは共通定義）
    var cText = TEXT_COLOR_MAP[c] || c;
    document.getElementById("shTitle").innerHTML = escapeHtml(m.icon+" "+m.label) + (META_ONELINE[key] ? "<div style='font-size:15px;font-weight:400;color:#222;margin-top:4px;'>"+escapeHtml(META_ONELINE[key])+"</div>" : "");
    // ランキング（自治体は同一都道府県内、都道府県は全国47都道府県内）
    var rankHtml = "";
    var rankableKeys = {fiscalPower:1,debt:1,flex:1,future:1,reserve:1,health:1};
    var isPrefView = cur && curName === cur.p;
    if (rankableKeys[key] && cur && DB) {
      var lowerBetter = (key==="debt"||key==="flex"||key==="future");
      var getRankVal = function(e){
        if (key==="health") return (e.f!=null&&e.d!=null&&e.x!=null)?calcH(e.f,e.d,e.x,e.u,e.r,e.eo,e.__pref,e.sfs):null;
        if (key==="fiscalPower") return e.f;
        if (key==="debt") return e.d;
        if (key==="flex") return e.x;
        if (key==="future") return e.u==null?0:e.u;
        if (key==="reserve") return (e.sfs && e.sfs > 0) ? (e.r / e.sfs * 100) : null;
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
      var medalForGen = function(rank, isNational) {
        if (rank === 1) return "🥇";
        if (rank === 2) return "🥈";
        if (rank === 3) return "🥉";
        if (isNational && rank <= 10) return "🎖️";
        return "";
      };
      if (isPrefView) {
        if (list.length) {
          list.sort(function(a,b){ return lowerBetter ? a.v-b.v : b.v-a.v; });
          var myRank = null;
          for (var ri=0; ri<list.length; ri++){ if (list[ri].k===curName){ myRank=ri+1; break; } }
          if (myRank) {
            var pct = myRank / list.length;
            var rankColor = pct<=0.2 ? "#6dcfad" : pct<=0.5 ? "#7bb8e8" : pct<=0.8 ? "#f0c46a" : "#f0876a";
            var medalG = medalForGen(myRank, true);
            rankHtml = "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:"+rankColor+"18;border:1.5px solid "+rankColor+"44;border-radius:12px;padding:6px 14px;margin:6px 0 18px;font-size:14px;font-weight:700;color:"+rankColor+";'>"+(medalG?medalG+" ":"")+"全国 <span style='font-size:17px;'>"+myRank+"位</span>/"+list.length+"都道府県中</div>";
          }
        }
      } else {
        var natListG = [];
        Object.keys(DB).forEach(function(k3){
          var e3 = DB[k3];
          if (k3 === e3.p) return;
          var v3 = getRankVal(e3);
          if (v3==null || isNaN(v3)) return;
          natListG.push({k:k3, v:v3});
        });
        natListG.sort(function(a,b){ return lowerBetter ? a.v-b.v : b.v-a.v; });
        if (list.length) list.sort(function(a,b){ return lowerBetter ? a.v-b.v : b.v-a.v; });
        var myRankN=null, myRankP=null;
        for (var ni=0; ni<natListG.length; ni++){ if (natListG[ni].k===curName){ myRankN=ni+1; break; } }
        for (var pi2=0; pi2<list.length; pi2++){ if (list[pi2].k===curName){ myRankP=pi2+1; break; } }
        var linesG = "";
        if (myRankN) {
          var pctN = myRankN/natListG.length;
          var colorN = pctN<=0.2 ? "#6dcfad" : pctN<=0.5 ? "#7bb8e8" : pctN<=0.8 ? "#f0c46a" : "#f0876a";
          var medalGN = medalForGen(myRankN, true);
          linesG += "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:"+colorN+"18;border:1.5px solid "+colorN+"44;border-radius:12px;padding:6px 14px;margin:0 0 6px;font-size:14px;font-weight:700;color:"+colorN+";'>"+(medalGN?medalGN+" ":"")+"全国 <span style='font-size:17px;'>"+myRankN+"位</span>/"+natListG.length+"自治体中</div>";
        }
        if (myRankP) {
          var pctP = myRankP/list.length;
          var colorP = pctP<=0.2 ? "#6dcfad" : pctP<=0.5 ? "#7bb8e8" : pctP<=0.8 ? "#f0c46a" : "#f0876a";
          var medalGP = medalForGen(myRankP, false);
          linesG += "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:"+colorP+"18;border:1.5px solid "+colorP+"44;border-radius:12px;padding:6px 14px;margin:0;font-size:14px;font-weight:700;color:"+colorP+";'>"+(medalGP?medalGP+" ":"")+cur.p+"内 <span style='font-size:17px;'>"+myRankP+"位</span>/"+list.length+"自治体中</div>";
        }
        rankHtml = linesG ? (linesG + "<div style='margin-bottom:10px;'></div>") : "";
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
    var topSummaryHtml = "";
    var descHtml = chipifyHeaders(descSrc).replace(/\n/g,"<br>");
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
      topSummaryHtml += "<div style='background:"+judgeColor+"14;border:1px solid "+judgeColor+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+judgeColor+";font-weight:700;'>"+curName+"</span>の財政調整基金は標準財政規模の<span style='color:"+judgeColor+";font-weight:700;'>"+ratio.toFixed(1)+"%</span>で、"+judge+"です。</div>";
      var rHist = [cur.r_r2, cur.r_r3, cur.r_r4, cur.r_r5].filter(function(v){ return v!=null; });
      if (rHist.length >= 2) {
        var rAvg = rHist.reduce(function(a,b){return a+b;},0) / rHist.length;
        var rRatio = rAvg > 0 ? cur.r / rAvg : 1;
        if (rRatio >= 1.5) {
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u{1F4C8} "+curName+"の財政調整基金は過去平均（"+rAvg.toFixed(1)+"億円）より大きく増えています。国からの臨時交付金や、大型事業の先送りによる積立増加の可能性があります。</div>";
        } else if (rRatio <= 0.5) {
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u{1F4C9} "+curName+"の財政調整基金は過去平均（"+rAvg.toFixed(1)+"億円）より大きく減っています。災害対応や大型事業への取り崩しがあった可能性があります。</div>";
        }
      }
      if (ratio < rb.lo && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u26A0\uFE0F 貯金が少なめ＋固定費も重い→緊急時に回せるお金が限られやすい状態です</div>";
      else if (ratio < rb.lo && futureBurdenHigh(cur.u, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u26A0\uFE0F 貯金が少なめ＋将来への借金も重い→今の備えと将来の返済の両方に課題があります</div>";
      else if (ratio < rb.lo && cur.f < 0.5) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u26A0\uFE0F 貯金が少なめ＋自力収入も乏しい→大きな支出があったときの余力が限られます</div>";
      else if (ratio < rb.lo) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u26A0\uFE0F 緊急時に備える積立が課題になりやすい水準です</div>";
      else if (ratio < rb.mid && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u26A0\uFE0F 貯金はやや少なめ＋固定費も重い→固定費の削減と積立増加が同時に課題です</div>";
      else if (ratio < rb.mid) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u26A0\uFE0F もう少し積み増せると緊急時の備えとして安心できる水準です</div>";
      else if (ratio >= rb.hi && cur.u <= 0) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u2728 貯金が多め＋将来への借金もない→備えも負債もバランスの良い状態です</div>";
      else if (ratio >= rb.hi && cur.x < 88) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u2728 貯金が多め＋固定費も軽い→財政に余裕があり、危機対応力の高い状態です</div>";
      else if (ratio >= rb.hi && cur.d > 25) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u26A0\uFE0F ※歳出が極端に削減された自治体（財政再生団体など）は、この比率が高く見える場合があります。<br>"+curName+"は実質公債費比率が"+cur.d+"%と非常に高く、この基金の多くは借金返済や不測の事態への積立です。財政状況は深刻です。</div>";
      else if (ratio >= rb.hi) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u2728 いざというときの「自治体の貯金」として機能しやすい水準です</div>";
          topSummaryHtml += "</div>";
      if (KK && KK[curName] && KK[curName].ka4 != null) {
        var ka4v = KK[curName].ka4;
        var ka4Med = isPrefView ? KK_MEDIANS.ka4.pref : KK_MEDIANS.ka4.muni;
        var rHigh = ratio >= rb.hi;
        var ka4Near = Math.abs(ka4v - ka4Med) <= ka4Med * 0.1;
        var ka4High = ka4v > ka4Med;
        var analysisR, ka4Judge;
        if (!ka4Near) {
        if (!rHigh && !ka4High) {
          ka4Judge = "中央値より低め";
          analysisR = "";
        } else if (rHigh && ka4High) {
          ka4Judge = "中央値より高め";
          analysisR = "";
        } else if (rHigh && !ka4High) {
          ka4Judge = "中央値より低め";
          analysisR = "貯金と長期的な財産形成は別物です。";
        } else {
          ka4Judge = "中央値より高め";
          analysisR = "日々の備えと長期的な財産形成は別物です。";
        }
        topSummaryHtml += kkCrossBox("🔗 公会計と比べてみると",
          "財政調整基金残高", ratio.toFixed(1)+"%", rHigh?"多め":"やや少なめ",
          "純資産比率", ka4v+"%", ka4Judge,
          analysisR,
          false, (function(){ function ratioAt(sfx){ var rv=sfx?cur["r_r"+sfx]:cur.r; var sv=sfx?cur["sfs_r"+sfx]:cur.sfs; return (rv!=null&&sv)?rv/sv*100:null; } return withTrendMeaning("r", trendSincePhrase([ratioAt(1),ratioAt(2),ratioAt(3),ratioAt(4),ratioAt(5),ratioAt(null)], 6)); })(),
          (function(){ var e=KK[curName]; return withTrendMeaning("ka4", trendSincePhrase([e.ka4_r1,e.ka4_r2,e.ka4_r3,e.ka4_r4,e.ka4], 5)); })());
        topSummaryHtml += KK_CROSSCHECK_CAVEAT;
        }
      }
    }
if (key === "growth" && cur && cur.pop) {
      var popStr = cur.pop.toLocaleString();
      var gSign = cur.g >= 0 ? "+" : "";
      var popColor = cur.g >= 0 ? "#6dcfad" : cur.g >= -0.5 ? "#f0c46a" : "#f0876a";
      topSummaryHtml += "<div style='background:"+popColor+"14;border:1px solid "+popColor+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+popColor+";font-weight:700;'>"+curName+"</span>の人口は"+popStr+"人（令和7年1月1日時点）。前年比<span style='color:"+popColor+";font-weight:700;'>"+gSign+cur.g+"%</span>です。</div>";
      if (cur.pop < 3000) {
        topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ "+curName+"は人口が少ない（"+popStr+"人）ため、少数の転入・転出だけでも増減率が大きく振れやすい点にご注意ください。</div>";
      }
      if (cur.g >= 0 && cur.f >= 0.7) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 人口が増えている＋財政力も安定→人が集まることで税収も増え、好循環が生まれやすい状態です</div>";
      else if (cur.g >= 0 && cur.ch >= 100) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 人口が増えている＋子どもへの投資も手厚い→子育て環境の充実が若い世代を引き寄せている可能性があります</div>";
      else if (cur.g >= 0) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 人口が増加中→住民が増えれば税収も増え、財政の安定にもつながります。この流れを維持したいところです</div>";
      else if (cur.g < -1.0 && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 人口が急減している＋固定費が重い→税収が減るのに支出が固定化、財政悪化が加速しやすい危険な組み合わせです</div>";
      else if (cur.g < -1.0 && cur.f < 0.5) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 人口が急減している＋財政力も弱い→人口減少が税収減を招き、財政がじわじわ悪化するリスクが高い状態です</div>";
      else if (cur.g < -0.5) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 人口の減少が続いている→住民1人あたりの行政コストが上がり、財政を圧迫しやすくなります。定住促進策が急務です</div>";
      else topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 人口はやや減少傾向→緩やかな減少でも長期的には財政に影響します。子育て支援・移住促進が重要です</div>";
          topSummaryHtml += "</div>";
    }
    // 各項目の判定メッセージ
    if (key === "health" && cur) {
      var h2 = calcH(cur.f, cur.d, cur.x, cur.u, cur.r, cur.eo, cur.__pref, cur.sfs);
      var hj = h2>=85?"絶好調な状態":h2>=70?"おおむね安定した状態":h2>=50?"やや課題がある状態":h2>=30?"かなり厳しい状態":"非常に危機的な状態";
      var hc = h2>=85?"#6dcfad":h2>=70?"#7bb8e8":h2>=50?"#f0c46a":h2>=30?"#f0876a":"#d0505a";
      topSummaryHtml += "<div style='background:"+hc+"14;border:1px solid "+hc+"55;border-radius:12px;padding:12px 14px;'><div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+hc+";font-weight:700;'>"+curName+"</span>の総合スコアは<span style='color:"+hc+";font-weight:700;'>"+h2+"点</span>で、"+hj+"です。</div>" + (curTypeLabel ? "<div style='color:#8070c0;font-size:12px;margin-top:4px;'>（"+curTypeLabel+"）</div>" : "") + "</div>";
      var bd_sf = Math.min(cur.f/1.2*25, 25);
      var bd_sd = Math.max((25-Math.min(cur.d,25))/25*20, 0);
      var bd_sx = Math.min(Math.max((100-cur.x)/15*20, 0), 20);
      var bd_su = (!cur.u || cur.u <= 0) ? 20 : Math.max((200-Math.min(cur.u,200))/200*20, 0);
      var bd_full = isPrefView ? 10 : 20;
      var bd_sr = (cur.sfs && cur.sfs > 0 && cur.r != null) ? Math.min((cur.r/cur.sfs*100)/bd_full*15, 15) : 7.5;
      var bdColor = function(score, max){ return (score/max) >= 0.5 ? "#1a7a5a" : "#c02020"; };
      topSummaryHtml += "<div class='bd-toggle' onclick=\"var c=document.getElementById('bdContent');var a=document.getElementById('bdArrow');var isOpen=c.style.maxHeight&&c.style.maxHeight!=='0px';c.style.maxHeight=isOpen?'0px':'280px';a.classList.toggle('open');\" style='display:flex;justify-content:space-between;align-items:center;cursor:pointer;margin-top:10px;background:rgba(160,139,232,0.08);border-radius:10px;padding:10px 12px;font-size:12px;color:#6a3de8;font-weight:700;'>" +
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
        topSummaryHtml += "<div class='bd-toggle' onclick=\"var c=document.getElementById('peerContent');var a=document.getElementById('peerArrow');var isOpen=c.style.maxHeight&&c.style.maxHeight!=='0px';c.style.maxHeight=isOpen?'0px':'600px';a.classList.toggle('open');\" style='display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:rgba(232,160,150,0.12);border-radius:10px;padding:10px 12px;font-size:12px;color:#c07050;font-weight:700;'>" +
          "<span>🐧 スコアが近い自治体を見る</span><span id='peerArrow' style='transition:transform 0.2s;'>▼</span></div>" +
          "<div id='peerContent' style='max-height:0;overflow:hidden;transition:max-height 0.3s ease;'>" +
          "<div style='padding-top:10px;'>" + peersHtml + "</div></div>";
      }
    }
    if (key === "debt" && cur) {
      var dj = cur.d<10?"健全な水準":cur.d<18?"注意が必要な水準":cur.d<25?"要改善の水準":"早期健全化基準を超えています";
      var dc2 = cur.d<10?"#6dcfad":cur.d<18?"#7bb8e8":cur.d<25?"#f0c46a":"#f0876a";
      topSummaryHtml += "<div style='background:"+dc2+"14;border:1px solid "+dc2+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+dc2+";font-weight:700;'>"+curName+"</span>の実質公債費比率は<span style='color:"+dc2+";font-weight:700;'>"+cur.d+"%</span>で、"+dj+"。</div>";
      if (cur.d > 18 && cur.f < 0.5) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 借金返済が重い＋自力収入が乏しい→返済で手一杯なのに稼ぐ力もない、最も厳しい二重苦です</div>";
      else if (cur.d > 18 && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 借金返済が重い＋固定費も硬直化→お金の出口がふさがれており、新しい政策に回せる余地がほぼありません</div>";
      else if (cur.d > 18) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 借金返済の負担が大きい→収入の多くが返済に消えており、住民サービスへの影響が出やすい状態です</div>";
      else if (cur.d < 10 && cur.f >= 0.7 && cur.x < 88) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 借金返済が軽い＋自力収入も豊か＋固定費も適正→返済の心配がなく政策投資もできる、理想的な状態です</div>";
      else if (cur.d < 10 && cur.f >= 0.7) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 借金返済が軽い＋自力収入も豊か→返済の心配がなく、新しい政策にも積極的に投資できる状態です</div>";
      else if (cur.d < 10 && reserveIsAmple(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 借金返済が軽い＋貯金も十分（標準財政規模比で多め）→いざというときの備えもあり、とても健全な財政です</div>";
      else if (cur.d < 10 && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 借金返済は軽いが固定費が重い→返済の心配はないものの、人件費・社会保障費が財政を圧迫しています</div>";
      else if (cur.d < 10) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 借金返済の負担が軽く、財政に余裕があります。この水準を維持できると理想的です</div>";
      else if (cur.d < 18 && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 返済負担は標準的だが固定費が重い→借金は普通でも固定費に圧迫されており、政策の自由度が低い状態です</div>";
      else if (cur.d < 18 && cur.f >= 0.7) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📋 返済負担は標準的＋自力収入も安定→大きな心配はありませんが、借入残高の推移は引き続き注視を</div>";
      else topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 返済負担がやや重め＋自力収入が少ない→交付税頼みになりやすく、国の制度変更の影響を受けやすい状態です</div>";
          topSummaryHtml += "</div>";
      if (KK && KK[curName] && KK[curName].ka7 != null) {
        var ka7v = KK[curName].ka7;
        var ka7Med = isPrefView ? KK_MEDIANS.ka7.pref : KK_MEDIANS.ka7.muni;
        var dHigh = cur.d >= 18;
        var ka7Near = Math.abs(ka7v - ka7Med) <= ka7Med * 0.1;
        var ka7High = ka7v > ka7Med;
        var analysisD, ka7Judge;
        if (ka7Near) {
          ka7Judge = "中央値とほぼ同水準";
          analysisD = "この" + (dHigh?"重さ":"軽さ") + "は負債額以外の要因によるものと考えられます。";
        } else if (!dHigh && !ka7High) {
          ka7Judge = "中央値より低め";
          analysisD = "";
        } else if (dHigh && ka7High) {
          ka7Judge = "中央値より高め";
          analysisD = "";
        } else if (!dHigh && ka7High) {
          ka7Judge = "中央値より高め";
          var ka7TrendA = kkMetricTrend(KK[curName], "ka7", ka7v);
          analysisD = ka7TrendA === "declining" ? "着実に返済が進んでいる長期返済中、という可能性も考えられます。" : "新しい借入も続いており、返済はこれから本格化する可能性も考えられます。";
        } else {
          ka7Judge = "中央値より低め";
          var ka7TrendB = kkMetricTrend(KK[curName], "ka7", ka7v);
          analysisD = ka7TrendB === "declining" ? "短期集中で返済を終えつつある可能性も考えられます。" : "返済期間を短く設定している可能性も考えられます。";
        }
        var dTrendPhraseF = withTrendMeaning("d", trendSincePhrase([cur.d_r1,cur.d_r2,cur.d_r3,cur.d_r4,cur.d_r5,cur.d], 6));
        var ka7EntryF = KK[curName];
        var ka7TrendPhraseF = withTrendMeaning("ka7", trendSincePhrase([ka7EntryF.ka7_r1,ka7EntryF.ka7_r2,ka7EntryF.ka7_r3,ka7EntryF.ka7_r4,ka7EntryF.ka7], 5));
        topSummaryHtml += kkCrossBox("🔗 公会計と比べてみると",
          "実質公債費比率", cur.d+"%", dHigh?"重め":"軽め",
          "住民一人当たり負債額", ka7v+"万円", ka7Judge,
          analysisD,
          false, dTrendPhraseF, ka7TrendPhraseF);
        topSummaryHtml += KK_CROSSCHECK_CAVEAT;
      }
    }
    if (key === "fiscalPower" && cur) {
      var fj = cur.f>=1.0?"不交付団体（財政力豊か）":cur.f>=0.7?"比較的安定した財政力":cur.f>=0.5?"やや交付税依存":"交付税依存度が高い状態";
      var fc2 = cur.f>=1.0?"#6dcfad":cur.f>=0.7?"#7bb8e8":cur.f>=0.5?"#f0c46a":"#f0876a";
      topSummaryHtml += "<div style='background:"+fc2+"14;border:1px solid "+fc2+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+fc2+";font-weight:700;'>"+curName+"</span>の財政力指数は<span style='color:"+fc2+";font-weight:700;'>"+cur.f.toFixed(2)+"</span>で、"+fj+"です。</div>";
      if (cur.f < 0.5 && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 自力収入が乏しい＋固定費が重い→稼げないのにお金が出ていく一方、最も身動きが取りにくい状態です</div>";
      else if (cur.f < 0.5 && futureBurdenHigh(cur.u, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 自力収入が乏しい＋将来への借金も重い→今も苦しく将来も重荷を背負っており、構造的な改革が必要です</div>";
      else if (cur.f < 0.5) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 自力で稼ぐ力が弱い→国からの交付税に大きく依存しており、国の財政事情に左右されやすい状態です</div>";
      else if (cur.f >= 1.0 && cur.x < 88) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 自力収入が豊か＋固定費も軽い→収入も支出もバランス良く、政策の自由度が高い理想的な財政です</div>";
      else if (cur.f >= 1.0 && reserveIsAmple(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 自力収入が豊か＋貯金も十分（標準財政規模比で多め）→財政力があり備えもある、とても安定した状態です</div>";
      else if (cur.f >= 1.0 && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 自力収入は豊かだが固定費が重い→稼ぐ力はあるのに固定費に消えており、政策投資の余地が限られています</div>";
      else if (cur.f >= 1.0) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 国からの交付税に頼らず自立した財政→住民サービスを自分たちの収入でまかなえる、強い自治体です</div>";
      else if (cur.f >= 0.7 && cur.x < 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📋 財政力は安定＋固定費も許容範囲→大きな問題はなく、引き続きこの水準の維持が目標です</div>";
      else topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 交付税依存が高め→自主財源を増やす取り組み（企業誘致・定住促進など）が長期的な課題です</div>";
          topSummaryHtml += "</div>";
    }
    if (key === "flex" && cur) {
      var xj = cur.x<88?"財政に弾力性がある状態":cur.x<95?"標準的な水準":"硬直化した状態";
      var xc2 = cur.x<88?"#6dcfad":cur.x<95?"#7bb8e8":"#f0876a";
      topSummaryHtml += "<div style='background:"+xc2+"14;border:1px solid "+xc2+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+xc2+";font-weight:700;'>"+curName+"</span>の経常収支比率は<span style='color:"+xc2+";font-weight:700;'>"+cur.x.toFixed(1)+"%</span>で、"+xj+"です。</div>";
      if (cur.x >= 100) {
        topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 "+curName+"は経常収支比率が100%を超えているため、経常的な収入だけでは経常的な支出をまかないきれていない状態です。</div>";
      }
      if (cur.x > 95 && cur.f < 0.5) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 固定費が重い＋自力収入も乏しい→収入が少ないのに出費が固定化、新しいことに一切お金を使えない状態です</div>";
      else if (cur.x > 95 && reserveIsLow(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 固定費が重い＋貯金も少ない→日常の支出でギリギリで、いざというときの備えもない、じわじわ危ない状態です</div>";
      else if (cur.x > 95 && futureBurdenHigh(cur.u, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 固定費が重い＋将来への借金も多い→今の家計も苦しく将来の返済も重い、二重の重荷を抱えています</div>";
      else if (cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 固定費が重く硬直化→人件費・社会保障費・借金返済が収入の大半を占め、政策の自由度が低い状態です</div>";
      else if (cur.x < 88 && reserveIsAmple(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 固定費が軽い＋貯金も十分→支出に余裕があり備えもある、財政運営の理想的な姿です</div>";
      else if (cur.x < 88 && cur.f >= 1.0) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 固定費が軽い＋自力収入も豊か→稼いでいて使い方も健全、新しい政策に積極投資できる状態です</div>";
      else if (cur.x < 88) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 固定費が適正で財政に弾力性がある→急な支出や新しい施策にも対応しやすい、健全な状態です</div>";
      else if (cur.x < 95 && cur.f >= 0.7) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📋 固定費は標準的＋財政力も安定→大きな問題はありませんが、固定費が増えすぎないよう注視が必要です</div>";
      else topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📋 固定費は標準的な水準→大きな問題はありませんが、95%を超えると硬直化します。推移を注視しましょう</div>";
          topSummaryHtml += "</div>";
    }
    if (key === "future" && cur) {
      var ul2 = cur.u<=0?"将来負担なし":cur.u<100?"一定の負担あり（注意水準）":cur.u<350?"要注意の水準":"早期健全化基準を超えています";
      var uc2 = cur.u<=0?"#6dcfad":cur.u<100?"#7bb8e8":cur.u<350?"#f0876a":"#d0505a";
      var uv = cur.u<=0?"0%":cur.u>=999?"再建中":cur.u.toFixed(1)+"%";
      topSummaryHtml += "<div style='background:"+uc2+"14;border:1px solid "+uc2+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+uc2+";font-weight:700;'>"+curName+"</span>の将来負担比率は<span style='color:"+uc2+";font-weight:700;'>"+uv+"</span>で、"+ul2+"です。</div>";
      if (futureBurdenHigh(cur.u, isPrefView) && reserveIsLow(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 将来への借金が重い＋貯金も少ない→今も苦しく将来も重荷、借金まみれで備えもない綱渡りの状態です</div>";
      else if (futureBurdenHigh(cur.u, isPrefView) && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 将来への借金が重い＋毎年の固定費も重い→過去の借金に縛られながら今も出費が固定化、構造改革が急務です</div>";
      else if (futureBurdenHigh(cur.u, isPrefView) && cur.f < 0.5) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 将来への借金が重い＋自力収入も乏しい→借金を返す力が弱く、長期的に財政が悪化するリスクがあります</div>";
      else if (futureBurdenHigh(cur.u, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 将来世代への借金が重い→今の住民が使ったお金を将来世代が返す構図で、世代間の公平性が問われます</div>";
      else if (cur.u <= 0 && reserveIsAmple(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 将来への借金がない＋貯金も十分（標準財政規模比で多め）→将来世代に負担を残さず、備えもある。財政の優等生です</div>";
      else if (cur.u <= 0 && cur.f >= 1.0) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 将来への借金がない＋自力収入も豊か→借金ゼロで稼ぐ力もある、非常に健全な財政状態です</div>";
      else if (cur.u <= 0) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 将来世代への負担がない→過去の借金を着実に返し終えており、次世代に重荷を残さない健全な状態です</div>";
      else if (cur.u < 100 && reserveIsAmple(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📋 将来への負担は一定あるが貯金（標準財政規模比で多め）で備えもある→心配しすぎる必要はないが、借入残高の推移は要注視です</div>";
      else if (cur.u < 100 && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 将来への借金は軽めだが固定費が重い→今のところ借金は軽いものの、返済に回せる余力が乏しく、今後の借入増加に注意が必要です</div>";
      else topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 将来への借金がやや重め→公共施設の維持費・更新費も増える中、新規借入の抑制が課題です</div>";
          topSummaryHtml += "</div>";

      var kkCrossBoxShownF = false;
      var futureEntry = KK ? KK[curName] : null;
      var futureBoxCount = 0;
      ["ka3","ka1","ka6"].forEach(function(code){
        if (futureEntry && futureEntry[code] != null) {
          var boxHtml = buildFutureComboBox(code, futureEntry[code], isPrefView, cur, curName, futureEntry, false, futureBoxCount+1);
          if (boxHtml) { topSummaryHtml += boxHtml; kkCrossBoxShownF = true; futureBoxCount++; }
        }
      });
      if (kkCrossBoxShownF) { topSummaryHtml += KK_CROSSCHECK_CAVEAT; }
    }
    if (key === "education" && cur && cur.edu!=null) {
      var eduMed = isPrefView ? 18.9 : 10.5;
      var eduUnit = isPrefView ? "47都道府県" : "全国の市区町村";
      var ej = cur.edu >= eduMed ? "中央値より高めです" : "中央値より低めです";
      topSummaryHtml += "<div style='background:#a08be814;border:1px solid #a08be855;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:#a08be8;font-weight:700;'>"+curName+"</span>の教育費比率は<span style='color:#a08be8;font-weight:700;'>"+cur.edu.toFixed(1)+"%</span>で、"+eduUnit+"の"+ej+"（中央値"+eduMed+"%）。</div>";
      topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u2139\uFE0F この数字は高い・低いが、そのまま良い・悪いを意味しません。高いのは教育を重視している場合もあれば、学校施設の老朽化対応や小規模校の維持で費用がかさんでいる場合もあります。都道府県は高校を持つため、市区町村より高く出ます。</div>";
      var eduCaveatFired = false;
      var eduLowTh = isPrefView ? 11 : 6;
      var eduHist = [cur.edu_r2, cur.edu_r3, cur.edu_r4, cur.edu_r5].filter(function(v){ return v!=null; });
      if (eduHist.length >= 2) {
        var eduAvg = eduHist.reduce(function(a,b){return a+b;},0) / eduHist.length;
        var eduRatio = eduAvg > 0 ? cur.edu / eduAvg : 1;
        if (eduRatio <= 0.7) {
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📉 "+curName+"の教育費比率は過去平均（"+eduAvg.toFixed(1)+"%）より大きく下がっています。学校施設整備の完了、または災害復旧費など他の歳出が増えたことで相対的に比率が下がった可能性があります。</div>";
          eduCaveatFired = true;
        } else if (eduRatio >= 1.3) {
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📈 "+curName+"の教育費比率は過去平均（"+eduAvg.toFixed(1)+"%）より大きく上がっています。学校施設整備などの大型事業、または他の歳出が減ったことで相対的に比率が上がった可能性があります。</div>";
          eduCaveatFired = true;
        }
      }
      
      else if (cur.edu < eduLowTh && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 教育費が少ない＋固定費が重い→固定費に圧迫されて教育への投資が削られている可能性があります</div>";
      else if (cur.edu < eduLowTh && !eduCaveatFired) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 教育への支出が少なめ→財政的制約がある可能性がありますが、子どもへの投資は将来の税収にも影響します</div>";
      else if (!eduCaveatFired) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📋 教育費は標準的な水準→引き続き子どもへの投資の量と質を確認していきましょう</div>";
          topSummaryHtml += "</div>";
    }
    if (key === "childInvest" && cur && cur.ch!=null) {
      var chMed = isPrefView ? 87.9 : 118.4;
      var chUnit = isPrefView ? "47都道府県" : "全国の市区町村";
      var cj2 = cur.ch >= chMed ? "中央値より高めです" : "中央値より低めです";
      topSummaryHtml += "<div style='background:#a08be814;border:1px solid #a08be855;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:#a08be8;font-weight:700;'>"+curName+"</span>の子ども1人当たり投資額は<span style='color:#a08be8;font-weight:700;'>"+cur.ch.toFixed(1)+"万円</span>で、"+chUnit+"の"+cj2+"（中央値"+chMed+"万円）。</div>";
      topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>\u2139\uFE0F この数字は高い・低いが、そのまま良い・悪いを意味しません。子どもの人数で割った値なので、子どもが少ない自治体ほど大きく出ます。全国で最も高いのは974万円ですが、これは手厚いのではなく分母が小さいためです。</div>";
      var chCaveatFired = false;
      if (cur.pop && cur.pop < 3000 && cur.ch > 250) {
        topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ "+curName+"は人口が少ない（"+cur.pop.toLocaleString()+"人）ため、子どもの人数自体が少なく、1人当たりで計算すると数値が実態以上に大きくなります。</div>";
        chCaveatFired = true;
      }
      var chHist = [cur.ch_r2, cur.ch_r3, cur.ch_r4, cur.ch_r5].filter(function(v){ return v!=null; });
      if (chHist.length >= 2) {
        var chAvg = chHist.reduce(function(a,b){return a+b;},0) / chHist.length;
        var chRatio = chAvg > 0 ? cur.ch / chAvg : 1;
        if (chRatio <= 0.7) {
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📉 "+curName+"の投資額は過去平均（"+chAvg.toFixed(1)+"万円）より大きく下がっています。学校施設整備の完了、または他の要因（人口変動など）が影響している可能性があります。</div>";
          chCaveatFired = true;
        } else if (chRatio >= 1.3) {
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📈 "+curName+"の投資額は過去平均（"+chAvg.toFixed(1)+"万円）より大きく上がっています。学校施設整備などの大型事業、または人口変動が影響している可能性があります。</div>";
          chCaveatFired = true;
        }
      }
      var chLowTh = isPrefView ? 52 : 70;
      if (cur.ch < chLowTh && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 子どもへの投資が少ない＋固定費が重い→固定費に圧迫されて将来世代への投資が削られている構図です</div>";
      else if (cur.ch < chLowTh && cur.g < -0.5) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 子どもへの投資が少ない＋人口も減少中→投資不足が子育て世代の流出を招いている可能性があります</div>";
      else if (cur.ch < chLowTh && !chCaveatFired) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 子どもへの投資が少なめ→保育・教育・医療費補助などの充実が、将来の定住促進にもつながります</div>";
      else if (!chCaveatFired) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📋 子どもへの投資は標準的→近隣自治体と比較しながら、子育て世代に選ばれる地域づくりを目指したいところです</div>";
          topSummaryHtml += "</div>";
    }
    if (key === "budget" && cur && cur.eo && cur.ei) {
      var bj = cur.ei>=cur.eo?"黒字基調です":cur.ei>=cur.eo*0.99?"ほぼ均衡しています":"赤字基調です";
      var bc2 = cur.ei>=cur.eo?"#6dcfad":cur.ei>=cur.eo*0.99?"#7bb8e8":"#f0876a";
      topSummaryHtml += "<div style='background:"+bc2+"14;border:1px solid "+bc2+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+bc2+";font-weight:700;'>"+curName+"</span>の歳出は<span style='color:"+bc2+";font-weight:700;'>"+cur.eo.toLocaleString()+"億円</span>、歳入は<span style='color:"+bc2+";font-weight:700;'>"+cur.ei.toLocaleString()+"億円</span>で、"+bj+"。</div>";
      var budgetHistCountEarly = countHist("eo", 1);
      var eoHist = [];
      for (var ehi=1; ehi<=budgetHistCountEarly; ehi++){ if (cur["eo_r"+ehi]!=null) eoHist.push(cur["eo_r"+ehi]); }
      if (eoHist.length >= 2) {
        var eoAvg = eoHist.reduce(function(a,b){return a+b;},0) / eoHist.length;
        var eoRatio = eoAvg > 0 ? cur.eo / eoAvg : 1;
        if (eoRatio >= 1.3) {
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📈 "+curName+"の歳出は過去平均（"+eoAvg.toFixed(1)+"億円）より大きく増えています。災害復旧や大型施設整備など、一時的な要因が影響している可能性があります。</div>";
        } else if (eoRatio <= 0.7) {
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📉 "+curName+"の歳出は過去平均（"+eoAvg.toFixed(1)+"億円）より大きく減っています。前年度の大型事業や特別な支出が終了した可能性があります。</div>";
        }
      }
      if (cur.ei < cur.eo && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 収支が赤字＋固定費も重い→支出が収入を超えているのに固定費が大半を占め、改善の余地がほぼない最も厳しい状態です</div>";
      else if (cur.ei < cur.eo && reserveIsLow(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>🚨 収支が赤字＋貯金も少ない→赤字を補う備えもなく、財政の持続可能性に黄信号です</div>";
      else if (cur.ei < cur.eo && futureBurdenHigh(cur.u, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 収支が赤字＋将来への借金も重い→今も赤字で将来の返済も重く、収支改善が急務です</div>";
      else if (cur.ei < cur.eo) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 収入より支出が多い→財政調整基金や借入で補っている可能性があります。収支のバランス改善が課題です</div>";
      else if (cur.ei >= cur.eo && cur.x > 95) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 収支は均衡しているが固定費が大半を占めている→数字上は黒字でも人件費・返済・社会保障で身動きが取れない硬直した状態です</div>";
      else if (cur.ei >= cur.eo && cur.x > 88) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>⚠️ 収支は均衡しているが固定費がやや重め→収支は安定しているものの、新しい政策への投資余地は限られています</div>";
      else if (cur.ei >= cur.eo && cur.f >= 1.0) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 収支が黒字＋財政力も高い＋固定費も適正→自力で稼ぎ支出も健全、最も理想的な財政運営です</div>";
      else if (cur.ei >= cur.eo && reserveIsAmple(cur, isPrefView)) topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>✨ 収支が黒字＋貯金も十分＋固定費も適正→稼いでいて備えもある、とても安定した財政運営です</div>";
      else topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>📋 収支は均衡＋固定費も標準的→大きな問題はありませんが、社会保障費の増加など将来の支出増に備えた積立が重要です</div>";
          topSummaryHtml += "</div>";
    }
    // 過去の実績値と現在値を比べて、増減幅・度合いを一言添える（healthは合成値のため対象外。
    // future/debt/reserveはクロスチェックボックス内の「推移」欄で同じ情報を表示するため、ここでは省略する）
    if (key !== "health" && key !== "future" && key !== "debt" && key !== "reserve" && (hasHistory || hasGrowthHistory) && vals.length >= 2) {
      var validIdxT = [];
      for (var ti=0; ti<vals.length; ti++){ if (vals[ti]!=null) validIdxT.push(ti); }
      if (validIdxT.length >= 2) {
        var oldValT = vals[validIdxT[0]];
        var newValT = vals[validIdxT[validIdxT.length-1]];
        var tdMain = trendDescribe(oldValT, newValT, META[key].unit, key==="fiscalPower"?2:1);
        if (tdMain && tdMain.tier !== "横ばい") {
          var trendIcon = tdMain.dir === "増加" ? "📈" : "📉";
          topSummaryHtml += "<div style='font-size:13px;color:#5a5a7a;margin-top:6px;'>" + trendIcon + " " + META[key].label + "はこの" + validIdxT.length + "年で" + tdMain.text + "しています。" + "</div>";
        }
      }
    }
    // ピーク・底の年度が新型コロナウイルス対応期間（R2〜R4）と重なる場合は注記を添える
    // ※構造的・長期的な指標（財政力指数・実質公債費比率・経常収支比率・将来負担比率・総合健全度スコア）は
    //   コロナで短期的に動く理由が薄いため対象外。財政調整基金・人口増減率・教育費・子ども投資額のみ対象。
    // 経常収支比率(flex)は、R3年度に全国的な落ち込み（改善）が確認できたため、底のみ対象にする
    // （総務省公表値でも「令和3年度は前年度比5.7pt低下」と明記されており、地方交付税増加等の影響と考えられる）
    var covidReasonsPeak = {
      reserve: "コロナ対応の給付金などで積み増しがあった影響が考えられます",
      growth: "コロナ禍での転出入の変化の影響が考えられます"
    };
    var covidReasonsTrough = {
      reserve: "コロナ対応での取り崩しの影響が考えられます",
      growth: "コロナ禍での転出入の変化の影響が考えられます",
      flex: "地方交付税等の増加により、一時的に比率が改善した影響が考えられます"
    };
    var trendYrLabelsCovid = (covidReasonsPeak[key] || covidReasonsTrough[key]) ? (hasHistory ? yrs.map(function(y){ return y.replace("（最新）",""); }) : hasGrowthHistory ? growthYrLabels.slice(0, vals.length) : null) : null;
    if (trendYrLabelsCovid && vals.length >= 2) {
      var validIdxCovid = [];
      for (var vci=0; vci<vals.length; vci++){ if (vals[vci]!=null) validIdxCovid.push(vci); }
      if (validIdxCovid.length >= 2) {
        var peakICovid = validIdxCovid[0], troughICovid = validIdxCovid[0];
        validIdxCovid.forEach(function(vci){ if (vals[vci]>vals[peakICovid]) peakICovid=vci; if (vals[vci]<vals[troughICovid]) troughICovid=vci; });
        var lastValidCovid = validIdxCovid[validIdxCovid.length-1];
        var covidYrsSet = {"R2":1,"R3":1,"R4":1};
        if (covidReasonsPeak[key] && peakICovid !== lastValidCovid && covidYrsSet[trendYrLabelsCovid[peakICovid]]) {
          topSummaryHtml += "<div style='font-size:14px;color:#7a7a90;margin-top:6px;'>📅 "+trendYrLabelsCovid[peakICovid]+"年度が最も高い年です。新型コロナウイルス対応の時期と重なり、"+covidReasonsPeak[key]+"</div>";
        } else if (covidReasonsTrough[key] && troughICovid !== lastValidCovid && covidYrsSet[trendYrLabelsCovid[troughICovid]]) {
          topSummaryHtml += "<div style='font-size:14px;color:#7a7a90;margin-top:6px;'>📅 "+trendYrLabelsCovid[troughICovid]+"年度が最も低い年です。新型コロナウイルス対応の時期と重なり、"+covidReasonsTrough[key]+"</div>";
        }
      }
    }
    document.getElementById("shTop").innerHTML = rankHtml + topSummaryHtml; document.getElementById("shDesc").innerHTML = ((rankHtml || topSummaryHtml) ? "<div style='border-top:1px dashed #d8d5e8;margin:22px 0;'></div><div style='font-size:16px;font-weight:700;color:#3a6ee8;margin-bottom:8px;'>"+m.label+"とは？</div>" : "") + descHtml;
    var shElAfter = document.querySelector("#ovEl .sh");
    if (shElAfter) shElAfter.scrollTop = 0;
    setTimeout(function(){ var s = document.querySelector("#ovEl .sh"); if (s) s.scrollTop = 0; }, 50);
    document.querySelectorAll(".peer-chip").forEach(function(chip){
      chip.addEventListener("click", function(){
        jumpToCity(this.getAttribute("data-city"));
      });
    });
    // 先頭・末尾に連続するnull（その年のデータが存在しない）は、ラベルとグラフの両方から除外する。
    // これをしないと「ラベルはR1〜R7まであるのに点はR1とR5にしかない」ような、
    // 実データが無い年まで軸に含んでしまい、線が離れた2点をいきなり直線で結ぶ見た目になる。
    var chartVals = vals, chartYrs = yrs;
    if (key !== "budget") {
      var firstDataIdx = -1, lastDataIdx = -1;
      for (var tvi=0; tvi<vals.length; tvi++){ if (vals[tvi]!=null){ if (firstDataIdx===-1) firstDataIdx=tvi; lastDataIdx=tvi; } }
      if (firstDataIdx > 0 || (lastDataIdx !== -1 && lastDataIdx < vals.length-1)) {
        chartVals = vals.slice(firstDataIdx, lastDataIdx+1);
        chartYrs = yrs.slice(firstDataIdx, lastDataIdx+1);
      } else if (firstDataIdx === -1) {
        chartVals = []; chartYrs = [];
      }
    }
    var yrsLabelHtml = chartYrs.map(function(y,i){
      var pct = chartYrs.length>1 ? (20+(i/(chartYrs.length-1))*(300-40))/300*100 : 50;
      var yDisp = y.replace("（最新）", "");
      return "<span style='left:"+pct+"%;text-align:center;'>"+yDisp+"</span>";
    }).join("");
    // データが存在しない年度（先頭・末尾で表示から除外した分も含む）は、無言で消すのではなく
    // 「総務省の公表データが無い」ことを明記する。グラフだけを見て「バグ？」と誤解されないようにするため。
    // ※年度ラベルは絶対配置(position:absolute)の細い帯の中にあるため、同じ場所にメッセージを
    //   置くと重なってしまう。グラフの白い枠(#spWrap)より下、#shDescの先頭に独立して表示する。
    var missingNoteHtml = "";
    if (key !== "budget" && (hasHistory || hasGrowthHistory)) {
      var missingYearLabels = [];
      for (var myi=0; myi<vals.length; myi++){
        if (vals[myi]==null) missingYearLabels.push(yrs[myi].replace("（最新）",""));
      }
      if (missingYearLabels.length) {
        missingNoteHtml = "<div style='font-size:12px;color:#c98a3a;background:#c98a3a14;border:1px solid #c98a3a40;border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6;'>⚠️ "+missingYearLabels.join("・")+"年度は総務省の公表データが無いため表示していません（前後の実データを直線ではつないでいません）</div>";
      }
    }
    // 過去の実績データが1件も無い場合：架空の推計線は描かず、その旨だけをはっきり伝える
    if (key !== "budget" && noRealHistory) {
      missingNoteHtml = "<div style='font-size:12px;color:#8a8a9a;background:#8a8a9a14;border:1px solid #8a8a9a33;border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6;'>📭 過去の推移データは総務省の公表資料に無いため、表示できません（現在値のみ上に表示しています）</div>";
    }
    document.getElementById("spLabels").innerHTML = yrsLabelHtml;
    if (missingNoteHtml) {
      var shDescElForNote = document.getElementById("shDesc");
      if (shDescElForNote) shDescElForNote.innerHTML = missingNoteHtml + shDescElForNote.innerHTML;
    }
    if (key === "budget") {
      // 歳出・歳入 2本線グラフ
      var eoVal = cur.eo || 0, eiVal = cur.ei || 0;
      var budgetHistCount = countHist("eo", 1);
      var eoVals = [], eiVals = [];
      var budgetYrs;
      var noBudgetHistory = budgetHistCount <= 0;
      if (!noBudgetHistory) {
        for (var bi=1; bi<=budgetHistCount; bi++) {
          eoVals.push(cur["eo_r"+bi] != null ? cur["eo_r"+bi] : null);
          eiVals.push(cur["ei_r"+bi] != null ? cur["ei_r"+bi] : null);
        }
        eoVals.push(eoVal); eiVals.push(eiVal);
        budgetYrs = ["R1","R2","R3","R4","R5","R6","R7"].slice(0,budgetHistCount).concat(["R"+(budgetHistCount+1)+"（最新）"]);
      } else {
        // 過去の歳出入データが無い場合：以前はサインカーブで架空の推移を描いていたが、
        // 実データではないため廃止。現在値のみのグラフにし、「データなし」を明記する。
        eoVals = [eoVal]; eiVals = [eiVal];
        budgetYrs = ["R（最新）"];
      }
      var budgetMissingNote = noBudgetHistory ? "<div style='font-size:12px;color:#8a8a9a;background:#8a8a9a14;border:1px solid #8a8a9a33;border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6;'>📭 過去の歳出入の推移データは総務省の公表資料に無いため、表示できません（現在値のみ上に表示しています）</div>" : "";
      document.getElementById("spLabels").innerHTML = budgetYrs.map(function(y,i){
        var pct = budgetYrs.length>1 ? (14+(i/(budgetYrs.length-1))*(300-28))/300*100 : 50;
        var yDisp = y.replace("（最新）", "");
        return "<span style='left:"+pct+"%;text-align:center;'>"+yDisp+"</span>";
      }).join("");
      if (budgetMissingNote) {
        var shDescElForBudgetNote = document.getElementById("shDesc");
        if (shDescElForBudgetNote) shDescElForBudgetNote.innerHTML = budgetMissingNote + shDescElForBudgetNote.innerHTML;
      }
      var allV = eoVals.concat(eiVals).filter(function(v){ return v!=null; });
      var W=300,H=100,P=14;
      var mn2=Math.min.apply(null,allV), mx2=Math.max.apply(null,allV);
      var rng2 = Math.max(mx2-mn2, mx2*0.15) || 1;
      mn2 = mn2 - rng2*0.1; mx2 = mx2 + rng2*0.1; rng2 = mx2 - mn2;
      var Ptop2=22, Pbottom2=26;
      function px2(i){return eoVals.length>1 ? P+(i/(eoVals.length-1))*(W-P*2) : W/2;}
      function py2(v){return H-Pbottom2-((v-mn2)/rng2)*(H-Ptop2-Pbottom2);}
      function mkLine(arr){ var l=null; for(var j=0;j<arr.length;j++){ if(arr[j]==null) continue; l = l===null ? ("M"+px2(j)+","+py2(arr[j])) : (l+" L"+px2(j)+","+py2(arr[j])); } return l||""; }
      function fmtB(v){ return v>=10000 ? Math.round(v/100)/10+"千億" : v+"億"; }
      var eoLine=mkLine(eoVals), eiLine=mkLine(eiVals);
      var svgH = H+20;
      var dots2="";
      var maxIdx2 = Math.max(eoVals.length, eiVals.length);
      for(var k=0;k<maxIdx2;k++){
        var isLast = k===maxIdx2-1;
        var anchor2 = k===0 ? "start" : "middle";
        var eoV = eoVals[k], eiV = eiVals[k];
        var eoOnTop = (eoV!=null && eiV!=null) ? (eoV >= eiV) : true;
        if (eoV != null) {
          dots2+="<circle cx='"+px2(k)+"' cy='"+py2(eoV)+"' r='"+(isLast?5:3)+"' fill='"+(isLast?"#a08be8":"white")+"' stroke='#a08be8' stroke-width='2'/>";
          if (eoOnTop) {
            if(isLast) dots2+="<text x='"+px2(k)+"' y='"+(py2(eoV)-8)+"' text-anchor='"+anchor2+"' font-size='10' fill='#a08be8' font-weight='700'>"+fmtB(eoV)+"</text>";
            else dots2+="<text x='"+px2(k)+"' y='"+(py2(eoV)-7)+"' text-anchor='"+anchor2+"' font-size='8' fill='#a08be8' opacity='0.75'>"+fmtB(eoV)+"</text>";
          } else {
            if(isLast) dots2+="<text x='"+px2(k)+"' y='"+(py2(eoV)+18)+"' text-anchor='"+anchor2+"' font-size='10' fill='#a08be8' font-weight='700'>"+fmtB(eoV)+"</text>";
            else dots2+="<text x='"+px2(k)+"' y='"+(py2(eoV)+15)+"' text-anchor='"+anchor2+"' font-size='8' fill='#a08be8' opacity='0.75'>"+fmtB(eoV)+"</text>";
          }
        }
        if (eiV != null) {
          dots2+="<circle cx='"+px2(k)+"' cy='"+py2(eiV)+"' r='"+(isLast?5:3)+"' fill='"+(isLast?"#7bb8e8":"white")+"' stroke='#7bb8e8' stroke-width='2'/>";
          if (!eoOnTop) {
            if(isLast) dots2+="<text x='"+(px2(k)-2)+"' y='"+(py2(eiV)-8)+"' text-anchor='"+anchor2+"' font-size='10' fill='#7bb8e8' font-weight='700'>"+fmtB(eiV)+"</text>";
            else dots2+="<text x='"+(px2(k)-2)+"' y='"+(py2(eiV)-7)+"' text-anchor='"+anchor2+"' font-size='8' fill='#7bb8e8' opacity='0.75'>"+fmtB(eiV)+"</text>";
          } else {
            if(isLast) dots2+="<text x='"+(px2(k)-2)+"' y='"+(py2(eiV)+18)+"' text-anchor='"+anchor2+"' font-size='10' fill='#7bb8e8' font-weight='700'>"+fmtB(eiV)+"</text>";
            else dots2+="<text x='"+(px2(k)-2)+"' y='"+(py2(eiV)+15)+"' text-anchor='"+anchor2+"' font-size='8' fill='#7bb8e8' opacity='0.75'>"+fmtB(eiV)+"</text>";
          }
        }
      }
      // 凡例
      var budgetNote = budgetHistCount>0 ? ("※令和元〜"+(budgetHistCount+1)+"年の実績値") : "";
      var legend="<text x='"+P+"' y='"+(svgH-2)+"' font-size='10' fill='#a08be8'>■ 歳出</text><text x='"+(P+50)+"' y='"+(svgH-2)+"' font-size='10' fill='#7bb8e8'>■ 歳入</text><text x='"+P+"' y='"+(svgH+9)+"' font-size='8' fill='#aaa'>"+budgetNote+"</text>";
      var spSvg = document.getElementById("spSvg");
      spSvg.setAttribute("viewBox","0 0 "+W+" "+(svgH+10));
      spSvg.style.height=(svgH+10)+"px";
      spSvg.innerHTML =
        "<path d='"+eoLine+"' fill='none' stroke='#a08be8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>" +
        "<path d='"+eiLine+"' fill='none' stroke='#7bb8e8' stroke-width='2' stroke-dasharray='4,3' stroke-linecap='round' stroke-linejoin='round'/>" +
        dots2 + legend;
    } else {
    var validVals = chartVals.filter(function(v){ return v!=null; });
    var mn=validVals.length?Math.min.apply(null,validVals):0, mx=validVals.length?Math.max.apply(null,validVals):0, rng=mx-mn||1;
    var W=300,H=100,P=20,Ptop=26;
    function px(i){return chartVals.length>1 ? P+(i/(chartVals.length-1))*(W-P*2) : W/2;}
    function py(v){return H-P-((v-mn)/rng)*(H-Ptop-P);}
    var area="", line="", dots="";
    // 値がnull（データが無い年）の箇所はそこで線を切り、離れた実データ同士を直線で結ばない。
    // 連続してデータがある区間ごとに別々の線分・塗りつぶしとして描画する。
    var segStartIdx = null, prevIdx = null;
    for(var j=0;j<chartVals.length;j++){
      if(chartVals[j]==null) continue;
      if(prevIdx===null || j!==prevIdx+1){
        if (segStartIdx!==null) area+=" L"+px(prevIdx)+","+H+" L"+px(segStartIdx)+","+H+" Z";
        area += (area?" ":"") + "M"+px(j)+","+py(chartVals[j]);
        line += (line?" ":"") + "M"+px(j)+","+py(chartVals[j]);
        segStartIdx = j;
      } else {
        area += " L"+px(j)+","+py(chartVals[j]);
        line += " L"+px(j)+","+py(chartVals[j]);
      }
      prevIdx = j;
    }
    if (segStartIdx!==null) area+=" L"+px(prevIdx)+","+H+" L"+px(segStartIdx)+","+H+" Z";
    for(var k=0;k<chartVals.length;k++){
      if(chartVals[k]==null) continue;
      var last=k===chartVals.length-1;
      dots+="<circle cx='"+px(k)+"' cy='"+py(chartVals[k])+"' r='"+(last?5:3)+"' fill='"+(last?c:"white")+"' stroke='"+c+"' stroke-width='2'/>";
      var dispVal = (m.unit==="億円" && chartVals[k]>=10000) ? Math.round(chartVals[k]/100)/10+"千億" : chartVals[k]+(m.unit==="%"?"%":m.unit==="億円"?"億":"");
      var prevV = k>0 ? chartVals[k-1] : null;
      var nextV = k<chartVals.length-1 ? chartVals[k+1] : null;
      var isValley = (prevV==null || chartVals[k] <= prevV) && (nextV==null || chartVals[k] <= nextV) && (prevV!=null || nextV!=null);
      var lblAnchor = k===0 ? "start" : "middle";
      if(last && isValley) dots+="<text x='"+px(k)+"' y='"+(py(chartVals[k])+19)+"' text-anchor='"+lblAnchor+"' font-size='12' fill='"+cText+"' font-weight='700'>"+dispVal+"</text>";
      else if(last) dots+="<text x='"+px(k)+"' y='"+(py(chartVals[k])-9)+"' text-anchor='"+lblAnchor+"' font-size='12' fill='"+cText+"' font-weight='700'>"+dispVal+"</text>";
      else if(isValley) dots+="<text x='"+px(k)+"' y='"+(py(chartVals[k])+16)+"' text-anchor='"+lblAnchor+"' font-size='9' fill='"+cText+"' opacity='0.9'>"+dispVal+"</text>";
      else dots+="<text x='"+px(k)+"' y='"+(py(chartVals[k])-8)+"' text-anchor='"+lblAnchor+"' font-size='9' fill='"+cText+"' opacity='0.9'>"+dispVal+"</text>";
    }
    // 前後のnullを除外した実際の表示範囲(chartYrs)に合わせて注記の年度表示を作る
    // （元のN・N2ベースのままだと、末尾のデータが無い年を除外した後もラベルと表示範囲がズレるため）
    function reiwaLabelForNote(y) {
      var yy = y.replace("（最新）", "");
      var num = parseInt(yy.replace(/[^0-9]/g, ""), 10);
      return num === 1 ? "元" : String(num);
    }
    var noteText;
    if ((hasHistory || hasGrowthHistory) && chartYrs.length >= 1) {
      var noteFrom = reiwaLabelForNote(chartYrs[0]);
      var noteTo = reiwaLabelForNote(chartYrs[chartYrs.length - 1]);
      noteText = (hasGrowthHistory && key==="growth") ? ("※令和"+noteFrom+"〜"+noteTo+"年の実績値（市・都道府県）") : ("※令和"+noteFrom+"〜"+noteTo+"年の実績値");
    } else {
      // 過去の実績データが無い場合、以前はここに「※元〜4年は参考値（推計）」と出して
      // 架空の推計線を描いていたが、実データではないため廃止。注記はspLabels側の
      // 「データなし」メッセージに一本化し、グラフ領域自体は非表示にする。
      noteText = "";
    }
    var noteColor = (hasHistory||hasGrowthHistory) ? "#6dcfad" : "#aaa";
    var spSvgEl = document.getElementById("spSvg");
    if (noRealHistory) {
      spSvgEl.innerHTML = "";
      spSvgEl.style.height = "0px";
    } else {
      spSvgEl.setAttribute("viewBox","0 0 "+W+" "+(H+10));
      spSvgEl.style.height=(H+10)+"px";
      spSvgEl.innerHTML = "<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='"+c+"' stop-opacity='0.2'/><stop offset='100%' stop-color='"+c+"' stop-opacity='0'/></linearGradient></defs><text x='"+P+"' y='10' font-size='10' fill='"+noteColor+"'>"+noteText+"</text><path d='"+area+"' fill='url(#g)'/><path d='"+line+"' fill='none' stroke='"+c+"' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>"+dots;
    }
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
    var seen = {};
    for (var i=0; i<keys.length; i++) {
      var k = keys[i];
      if (k.indexOf(q) === 0) { starts.push(k); seen[k]=true; }
      else if (k.indexOf(q) >= 0) { contains.push(k); seen[k]=true; }
    }
    // 読み仮名（ひらがな）の前方一致も候補に加える。「あ」→「あい」と打つごとに絞り込まれる
    if (KANA_INDEX) {
      var kanaKeys = Object.keys(KANA_INDEX);
      for (var j=0; j<kanaKeys.length; j++) {
        if (kanaKeys[j].indexOf(q) === 0) {
          KANA_INDEX[kanaKeys[j]].forEach(function(ck){ if (!seen[ck] && DB[ck]) { starts.push(ck); seen[ck]=true; } });
        }
      }
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
      // 通常は比較モーダルを開いたまま維持し、詳細ポップアップだけ閉じる。
      // ただし比較モーダルから自治体名をタップして別画面へジャンプしていた場合は
      // モーダル自体が非表示になっているため、その場合だけ再表示する
      if (cOv && cOv.classList.contains("hidden")) {
        cOv.classList.remove("hidden");
        document.body.style.overflow = "hidden";
      }
      return;
    }
    var nkBoxEl = document.getElementById("nkBox");
    if (st && st.mitchieView === "nk") {
      if (nkBoxEl && nkBoxEl.classList.contains("hidden")) {
        nkOpenBox(true, st.region, st.zone);
      } else if (nkBoxEl) {
        nkRenderCard(st.region, st.zone);
      }
      return;
    }
    if (nkBoxEl && !nkBoxEl.classList.contains("hidden") && typeof nkCloseBox === "function") {
      nkCloseBox();
    }
    if (cOv && !cOv.classList.contains("hidden")) {
      cOv.classList.add("hidden");
    }
    document.body.style.overflow = "";
    var re = document.getElementById("resEl");
    var ma = document.getElementById("mitchieArea");
    if (st && st.mitchieView === "result" && st.city) {
      var found = find(st.city);
      if (found && !found.ambiguous) {
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
      // 詳細モーダルの状態に戻った場合は、同じ詳細パネルを再度開く。
      // ただし詳細ポップアップ内のピア自治体リンクなどで別の自治体へジャンプしていた場合は
      // cur/curNameが書き換わっているため、詳細を開き直す前に本来の自治体の画面に戻す
      if (st.city && st.city !== curName) {
        var foundD = find(st.city);
        if (foundD && !foundD.ambiguous) {
          if (re) re.classList.remove("hidden");
          if (ma) ma.classList.add("hidden");
          document.getElementById("cityInput").value = st.city;
          render(foundD, true);
          if (st.kk) { fkShowKokaikei(foundD.k, foundD.d); }
        }
      }
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

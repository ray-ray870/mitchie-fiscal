  /* --- みっちーからのひとこと（2026-10-01 作り直し）---
     「何が優れているか」「何が危ないか」「どうしたらいいか」に答える。
     ・良い／危ないの判定は、各カードの色（緑＝良い、黄・オレンジ＝気をつけたい）と同じ基準。法律の基準もそのまま使う
     ・「→」の後ろは、指標の定義と法律から言えることだけ（予想・評価の言葉は使わない）
     ・「どうしたらいい？」は、その数字を良くするには何を減らすか・増やすか（数字の仕組みから言えること）だけ
     ・最後に、住民としてできること（予算は議会で決まる・資料で確かめられる）を1行 */
  function adviceParts(name, d) {
    var isPref = !!d.__pref;
    var h = calcH(d.f, d.d, d.x, d.u, d.r, d.eo, isPref, d.sfs);
    var goods = [], warns = [];
    var p1 = function(v){ return (Math.round(v * 10) / 10).toFixed(1); };
    // 財政力指数
    if (d.f != null) {
      var cf = colorF(d.f);
      if (cf === "#6dcfad") goods.push("<b>財政力指数 " + d.f.toFixed(2) + "</b>：必要なお金の多くを、税収などでまかなえています" + (d.f >= 1 ? "（国の普通交付税をおおむね受け取らない水準）" : ""));
      else if (cf === "#f0c46a" || cf === "#f0876a") warns.push({lv: cf === "#f0876a" ? 2 : 1,
        t: "<b>財政力指数 " + d.f.toFixed(2) + "</b>：必要なお金の多くを、国の地方交付税で補っています",
        how: "税収（" + (isPref ? "住民税・事業税など" : "住民税・固定資産税など") + "）が増えると、財政力指数は上がります", cit: "地方税・地方交付税の金額"});
    }
    // 経常収支比率
    if (d.x != null) {
      var cx = colorX(d.x);
      if (cx === "#6dcfad") goods.push("<b>経常収支比率 " + p1(d.x) + "%</b>：新しいことに回せるお金が、1割以上あります");
      else if (cx === "#f0c46a" || cx === "#f0876a") warns.push({lv: d.x >= 100 ? 3 : cx === "#f0876a" ? 2 : 1,
        t: "<b>経常収支比率 " + p1(d.x) + "%</b>：" + (d.x >= 100 ? "毎年決まって入るお金だけでは、決まった支払いをまかなえていません" : "新しいことに回せるお金が、ほとんど残っていません"),
        how: "毎年決まって出ていくお金（人件費・福祉・借金の返済など）を減らすか、税などの決まって入るお金を増やすと、経常収支比率は下がります", cit: "毎年決まって出ていくお金の内訳"});
    }
    // 実質公債費比率（法律の基準）
    if (d.d != null) {
      if (d.d < 10) goods.push("<b>実質公債費比率 " + p1(d.d) + "%</b>：国の基準（18%）を大きく下回り、借金の返済に回すお金の割合が小さい水準です");
      else if (d.d >= 18) warns.push({lv: d.d >= 35 ? 5 : d.d >= 25 ? 4 : 3,
        t: "<b>実質公債費比率 " + p1(d.d) + "%</b>：" + (d.d >= 35 ? "財政再生の基準（35%）以上で、国の関与のもとで立て直しを進める水準です"
            : d.d >= 25 ? "早期健全化の基準（25%）以上で、財政健全化計画を作る必要があります"
            : "国の基準（18%）以上で、新しく借金をするのに許可が必要です"),
        how: "借金の残高が減ると、あとの返済額が減って、実質公債費比率は下がります", cit: "借金（地方債）の残高と返済の予定"});
    }
    // 将来負担比率
    var lim = uLimitOf(d, isPref), uz = (d.u == null || d.u <= 0);
    if (uz) goods.push("<b>将来負担比率「－」</b>：将来払う借金などを、貯金などでまかなえています");
    else {
      var cu = colorU(d.u, isPref);
      if (d.u >= lim || cu === "#f0c46a" || cu === "#f0876a") warns.push({lv: d.u >= lim ? 4 : cu === "#f0876a" ? 2 : 1,
        t: "<b>将来負担比率 " + p1(d.u) + "%</b>：" + (d.u >= lim ? "早期健全化の基準（" + lim + "%）以上で、財政健全化計画を作る必要があります"
            : (isPref ? "都道府県の中では、将来に残る負担が" : "全国の中では、将来に残る負担が") + (cu === "#f0876a" ? "重めです" : (isPref ? "やや重めです" : "一定程度あります"))),
        how: "借金の残高を減らすか、返済に充てられる貯金（基金）を増やすと、将来負担比率は下がります", cit: "借金（地方債）の残高と返済の予定"});
    }
    // 財政調整基金
    if (d.sfs && d.sfs > 0 && d.r != null) {
      var rr = d.r / d.sfs * 100, cr = colorR(rr, isPref);
      var rTxt = "<b>貯金（財政調整基金）" + fmtOku(d.r) + "</b>（標準財政規模の" + p1(rr) + "%）";
      if (cr === "#6dcfad") goods.push(rTxt + "：急な出費に厚めに備えています");
      else if (cr === "#f0c46a" || cr === "#f0876a") warns.push({lv: cr === "#f0876a" ? 2 : 1,
        t: rTxt + "：大きな災害などの急な出費には、貯金が少なめの状態です",
        how: "年度末に残ったお金を積み立てていくと、貯金は増えます（法律で、残ったお金の半分以上は、積み立てるか借金の返済に回すことになっています）", cit: "基金（貯金）の残高と使い道"});
    }
    // 人口（総合スコアには入らないが、住民にとって大事なので、カードの色が緑・オレンジのときだけ）
    if (d.g != null) {
      var pdv = d.pd, pdTxt = (pdv && pdv.nat + pdv.soc === pdv.chg)
        ? "（" + (pdv.nat < 0 ? "自然減" : "自然増") + Math.abs(pdv.nat).toLocaleString() + "人・" + (pdv.soc < 0 ? "社会減" : "社会増") + Math.abs(pdv.soc).toLocaleString() + "人）" : "";
      if (d.g >= 0.1) goods.push("<b>人口</b>：1年で" + d.g.toFixed(2) + "%増えました" + pdTxt);
      else if (d.g < -0.5) warns.push({lv: 1, t: "<b>人口</b>：1年で" + Math.abs(d.g).toFixed(2) + "%減りました" + pdTxt, how: null, cit: null});
    }
    warns.sort(function(a, b){ return b.lv - a.lv; });
    var head = h >= 85 ? "の財政はとても健全です⭐" : h >= 70 ? "の財政はおおむね安定しています💙"
             : h >= 50 ? "の財政は、やや課題がある状態です🐧"
             : h >= 30 ? "の財政はかなりしんどい状態です😔" : "の財政はとても厳しい状態です🚨";
    var hows = [], seen = {};
    warns.forEach(function(w){ if (w.how && !seen[w.how] && hows.length < 2) { seen[w.how] = 1; hows.push(w.how); } });
    var citW = warns.filter(function(w){ return w.cit; })[0];
    return {h: h, head: name + head, goods: goods.slice(0, 2), warns: warns.slice(0, 3), hows: hows,
            cit: "予算の使い道は、議会で決まります。" + name + "の予算書や財政状況資料集で、" + (citW ? citW.cit : "お金の使い道") + "を確かめられます",
            flexNote: (!warns.length && d.x != null && d.x >= 90 && d.x < 95) ? "黄・オレンジの指標はありません。ただ、新しいことに回せるお金は1割に満たない状態です" : ""};
  }
  function advice(name, d) {
    var a = adviceParts(name, d);
    var sec = function(title, items){
      if (!items.length) return "";
      return "<div style='margin-top:10px;'><div style='font-size:16px;font-weight:700;color:#3a2a6e;'>" + title + "</div>" +
        items.map(function(t){ return "<div style='font-size:15px;color:#2a2a3a;line-height:1.7;padding-left:1em;text-indent:-1em;margin-top:2px;'>・" + t + "</div>"; }).join("") + "</div>";
    };
    return "<div style='font-size:16px;font-weight:700;color:#2a2a3a;line-height:1.6;margin-top:4px;'>" + escapeHtml(a.head) + "</div>" +
      "<div style='font-size:13px;color:#7a7a90;line-height:1.6;margin-top:2px;'>※みっちー独自の総合点（" + a.h + "点）をもとにしたひと言です</div>" +
      sec("⚠️ 気をつけたいところ", a.warns.length ? a.warns.map(function(w){ return w.t; }) : (a.flexNote ? [a.flexNote] : [])) +
      sec("💙 優れているところ", a.goods) +
      sec("🐧 どうしたらいい？", a.hows) +
      "<div style='font-size:15px;color:#5a5a70;line-height:1.7;margin-top:10px;'>🙋 " + escapeHtml(a.cit) + "</div>";
  }
  // シェア画像用の短い文（見出しと、いちばん気をつけたいところ／優れているところ）
  function adviceSummary(name, d) {
    var a = adviceParts(name, d), strip = function(s){ return String(s).replace(/<[^>]+>/g, ""); };
    return a.head + (a.warns.length ? " 気をつけたいところ：" + strip(a.warns[0].t) : a.goods.length ? " 優れているところ：" + strip(a.goods[0]) : "");
  }


  // 70点未満のとき、トップのカードで黄色・オレンジになっている指標を「気になる点」として名指しする（2026-09-30）
  function heroWeakHtml(d, h, isPref) {
    if (h >= 70) return "";
    var wk = weakPoints(d, isPref);
    var body = wk.length
      ? "気になる点：" + wk.slice(0, 3).join("、")
      : "目立って悪い指標はありませんが、どの指標も標準的か少し弱めのため、総合点は中くらいです。";
    return "<div style='font-size:14px;line-height:1.6;margin-top:6px;'>" + body + "</div>";
  }

  /* --- 詳細画面の「◯◯市の状況」（2026-09-30）---
     「高い・低い」だけでなく、その町が今どうなのか（全国・国の基準と比べた位置、ここ数年の動き）と、
     それが何を意味するかを書く。
       🏠 状況：画面の数字・全国の中央値や分布・法令上の基準・説明文の目安・その町自身の推移だけから書く
       💡 例えると：身近な単位への置き換え（例えであることが分かるように必ずこの見出しを付ける）
       👉 つまり：指標の定義と、国の基準との位置関係から言えることだけ */
  /* --- 詳細画面の「🏠 ◯◯の状況」と「🔍 内訳から分かること」（2026-10-01 作り直し）---
     ルール：
       ・数字と推移（その自治体のデータ）、全国の中央値、国の基準（法律）だけで書く。理由の推測・評価の言葉は書かない
       ・最後に「→ 今の状態」を1文。色はカードの色にそろえる（青・緑のカード→濃い青、黄・オレンジ→濃い赤）
       ・用語は最初に出るところだけ（ ）で意味を添える
       ・🔍 は総務省の決算状況調（歳入内訳・目的別歳出）の金額をそのまま並べる（cur.bd、千円単位） */
  var SIT_BLUE = "#1a56b0", SIT_RED = "#c62828";
  /* --- グラフの「新型コロナ対応の時期」の帯と凡例（2026-10-01）---
     帯の位置は実際の日付に合わせる：国内で最初の感染者が確認された令和2年1月16日から、
     感染症法上の位置づけが5類に移った令和5年5月8日まで。
       年度のグラフ（財政・公会計）：1つの点＝その年度（4月〜翌3月）
       年のグラフ（人口増減率）　　：1つの点＝その年の1月1日の人口と、前の年の1年間の増減 → 令和k年の点は令和(k-1)年の1年間 */
  function chartYearOf(label) {
    var s0 = String(label);
    if (/H30/.test(s0)) return 0;
    var mm = s0.match(/R(\d+)/);
    if (mm) return +mm[1];
    return /元/.test(s0) ? 1 : null;
  }
  function covidBandSvg(labels, pxFn, W, yTop, yBottom, calendar) {
    var n = labels.length;
    if (n < 2) return "";
    var step = pxFn(1) - pxFn(0);
    // 日付 → グラフ上の位置。年度のグラフは4月始まり、年のグラフ（人口）は「前の年の1年間」を表す
    var xOfDate = function(yy, mo, dd){
      var d = new Date(yy, mo - 1, dd), pt;
      if (calendar) pt = {y: yy - 2017, f: (d - new Date(yy, 0, 1)) / 86400000 / 365};
      else { var fy = mo >= 4 ? yy : yy - 1; pt = {y: fy - 2018, f: (d - new Date(fy, 3, 1)) / 86400000 / 365}; }
      for (var i = 0; i < n; i++) if (chartYearOf(labels[i]) === pt.y) return pxFn(i) - step / 2 + pt.f * step;
      var y0 = chartYearOf(labels[0]), y1 = chartYearOf(labels[n - 1]);
      if (y0 != null && pt.y < y0) return pxFn(0) - step / 2;
      if (y1 != null && pt.y > y1) return pxFn(n - 1) + step / 2;
      return null;
    };
    // 国内最初の感染確認（令和2年1月16日）から少しずつ濃くなり、緊急事態宣言・まん延防止等重点措置が
    // 繰り返し出ていた時期（最初の宣言 令和2年4月7日〜最後の重点措置の終了 令和4年3月21日）がいちばん濃く、
    // 5類移行（令和5年5月8日）に向けて薄くなる
    var xs = xOfDate(2020, 1, 16), xp1 = xOfDate(2020, 4, 7), xp2 = xOfDate(2022, 3, 21), xe = xOfDate(2023, 5, 8);
    if (xs == null || xe == null || xe <= xs) return "";
    var off = function(x){ return Math.max(0, Math.min(1, (x - xs) / (xe - xs))).toFixed(3); };
    var gid = "covidG" + Math.round(xs * 10) + "_" + Math.round(xe * 10);
    var x1 = Math.max(0, xs), x2 = Math.min(W, xe);
    if (x2 <= x1) return "";
    return "<defs><linearGradient id='" + gid + "' gradientUnits='userSpaceOnUse' x1='" + xs.toFixed(1) + "' y1='0' x2='" + xe.toFixed(1) + "' y2='0'>" +
      "<stop offset='0' stop-color='#f0a860' stop-opacity='0.03'/>" +
      (xp1 != null ? "<stop offset='" + off(xp1) + "' stop-color='#f0a860' stop-opacity='0.24'/>" : "") +
      (xp2 != null ? "<stop offset='" + off(xp2) + "' stop-color='#f0a860' stop-opacity='0.24'/>" : "") +
      "<stop offset='1' stop-color='#f0a860' stop-opacity='0.03'/></linearGradient></defs>" +
      "<rect x='" + x1.toFixed(1) + "' y='" + yTop + "' width='" + (x2 - x1).toFixed(1) + "' height='" + (yBottom - yTop) + "' fill='url(#" + gid + ")'/>";
  }
  // note：グラフの注記（「※令和元〜6年度の実績値」など）。グラフの中に書くと数字と重なることがあるため、
  // グラフの下の凡例の先頭に出す（2026-10-04）
  function setChartLegend(medLabel, covid, note) {
    var wrap = document.getElementById("spWrap");
    if (!wrap) return;
    var el = document.getElementById("spLegend");
    if (!el) { el = document.createElement("div"); el.id = "spLegend"; wrap.appendChild(el); }
    el.innerHTML = (medLabel || covid || note) ? "<div style='display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;font-size:13px;color:#5a5a70;margin-top:22px;line-height:1.5;'>" +
      (note ? "<span style='flex-basis:100%;text-align:center;color:#2a8a6a;'>" + note + "</span>" : "") +
      (medLabel ? "<span><svg width='22' height='8' style='vertical-align:middle;'><line x1='0' y1='4' x2='22' y2='4' stroke='#9a96a8' stroke-width='2' stroke-dasharray='4,3'/></svg> " + medLabel + "</span>" : "") +
      (covid ? "<span><span style='display:inline-block;width:34px;height:10px;background:linear-gradient(90deg,#f0a86008,#f0a8603d 30%,#f0a8603d 70%,#f0a86008);vertical-align:middle;'></span> 新型コロナ対応の時期（令和2年1月〜令和5年5月の5類移行まで）</span>" +
               "<span style='font-size:12.5px;color:#7a7a90;'>色が濃いところ：緊急事態宣言などが繰り返し出ていた時期（令和2年4月〜令和4年3月）</span>" : "") +
      "</div>" : "";
  }
  // ある年（令和の年）の全国の中央値。財政は _r◯ が令和◯年度、主値が最新年度
  var HIST_MED_CACHE = {};
  function histMedian(field, yr, isPref, isPop) {
    var ck = field + yr + (isPref ? "p" : "m");
    if (ck in HIST_MED_CACHE) return HIST_MED_CACHE[ck];
    var latest = isPop ? DATA_YEAR.population : DATA_YEAR.fiscal;
    var arr = [];
    Object.keys(DB).forEach(function(n){
      var e = DB[n]; if (!!e.__pref !== !!isPref) return;
      var v = yr === latest ? e[field] : e[field + "_r" + yr];
      if (field === "u" && (v == null || v <= 0) && (yr === latest || Object.prototype.hasOwnProperty.call(e, field + "_r" + yr))) v = 0;
      if (typeof v === "number") arr.push(v);
    });
    arr.sort(function(a, b){ return a - b; });
    var med = arr.length ? (arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2) : null;
    HIST_MED_CACHE[ck] = med;
    return med;
  }
  function situationTrend(cur, field, opt, nullAsZero) {
    var arr = histArr(cur, field, "fiscal"), pts = [];
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (v == null && nullAsZero && (i === arr.length - 1 || Object.prototype.hasOwnProperty.call(cur, field + "_r" + (i + 1)))) v = 0;
      pts.push({y: i + 1, v: v});
    }
    return trendJP(pts, opt);
  }
  function sitB(v) { return "<b style='font-size:17px;'>" + v + "</b>"; }
  /* --- 「似ている自治体」との比較（2026-10-01）---
     総務省の類似団体の区分（国勢調査をもとに、人口と産業構造＝産業別の就業人口の構成比で分けた、同じ区分の全国の市町村。
     政令指定都市・中核市・施行時特例市・特別区は、都市の種類ごとの区分）。
     市区町村だけ。同じ区分が10団体以上あるときだけ出す。比べた結果は「高め・低め・ほぼ同じ」だけ（順位は出さない） */
  var PEER_CACHE = {};
  function peerInfo(name, isPref) {
    if (isPref || typeof KK === "undefined" || !KK || !KK[name] || !KK[name].grp) return null;
    var grp = KK[name].grp;
    if (!PEER_CACHE[grp]) PEER_CACHE[grp] = Object.keys(DB).filter(function(k){ return !DB[k].__pref && KK[k] && KK[k].grp === grp; });
    var names = PEER_CACHE[grp];
    return names.length >= 10 ? {grp: grp, names: names, n: names.length} : null;
  }
  function peerVals(info, getter) {
    return info.names.map(getter).filter(function(v){ return typeof v === "number" && !isNaN(v); });
  }
  function peerMedian(arr) {
    if (!arr.length) return null;
    var a = arr.slice().sort(function(x, y){ return x - y; }), m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  // v が似ている自治体の中央値より 高め(hi)／低め(lo)／ほぼ同じ(same)。tol：同じとみなす差（省略時は中央値の3%）
  function peerCmp(v, med, tol) {
    if (v == null || med == null) return null;
    var t = tol != null ? tol : Math.abs(med) * 0.03;
    return Math.abs(v - med) <= t ? "same" : v > med ? "hi" : "lo";
  }
  // 総務省の類似団体：一般の市と町村は人口と産業構造で、政令指定都市・中核市・施行時特例市・特別区は都市の種類で分けられている
  function peerGroupDesc(grp) {
    return /^(都市|町村)/.test(grp) ? "総務省が、人口と産業（どんな産業で働く人が多いか）などで分けたグループです"
                                    : "総務省が、都市の種類（政令指定都市・中核市・特別区など）で分けたグループです";
  }
  function peerNoteText(info) {
    return "※似ている自治体：" + info.grp + "（" + info.n + "自治体）。" + peerGroupDesc(info.grp);
  }
  // 「比べると：全国の中央値 91.5%／似ている自治体の中央値 94.0%」の1行
  function cmpRow(pairs) {
    return "比べると💡 " + pairs.filter(function(q){ return q && q[1] != null; }).map(function(q){ return q[0] + " <b>" + q[1] + "</b>"; }).join("<span style='color:#9a96a8;'>　／　</span>");
  }
  // 「→」の文の後ろにつける、似ている自治体との比べた結果。good：その前の文が良い状態か、hiIsBad：高いほうが悪い指標か
  function peerTail(good, c, hiIsBad, subject, hiWord, loWord) {
    if (c === "same") return "。似ている自治体と同じくらいです";
    var peerBad = (c === "hi") === !!hiIsBad;
    var sameDir = (good && !peerBad) || (!good && peerBad);
    return "。" + (sameDir ? "似ている自治体と比べても、" : "ただ、似ている自治体と比べると、") + subject + (c === "hi" ? hiWord : loWord) + "です";
  }
  // 国の基準（上限）に対する割合と、基準までの余裕（6割未満なら「余裕があります」、6割以上は「近づいています」）。
  // heavy：カードの色や目安で「重め」などになっているときの言葉。そのときは「余裕があります」と言わず、
  // 「国の基準の約◯%ですが、◯◯です」と2つの物差しを1文に並べる（2026-10-02：「余裕があります」と「重め」が同じ画面に出ていた）
  function limitRoom(v, lim, heavy) {
    var r = v / lim, pct = r * 100;
    var head = "国の基準（" + lim + "%）の" + (pct < 1 ? "1%未満" : "約" + Math.round(pct) + "%");
    if (r < 0.6 && heavy) return {room: false, heavy: true, text: head + "ですが、" + heavy};
    return {room: r < 0.6, text: head + "で、" + (r < 0.6 ? "基準までは余裕があります" : "基準が近づいています")};
  }
  function peerLine(medText) {
    return "似ている自治体の中央値は" + medText + "です";   // 比べた結果（高め・低め）は「→」の行に書く（重複させない）
  }
  function situationBox(name, lines, state, stateColor, note, peerState) {
    return "<div style='font-size:16px;font-weight:700;color:#3a2a6e;margin-bottom:6px;'>🏠 " + escapeHtml(name) + "の状況</div>" +
      lines.filter(function(l){ return !!l; }).map(function(l){
        return "<div style='font-size:16px;color:#2a2a3a;line-height:1.8;'>" + l + "</div>";
      }).join("") +
      (state ? "<div style='font-size:16px;font-weight:700;color:" + stateColor + ";line-height:1.7;margin-top:8px;'>→ " + state + "</div>" : "") +
      (peerState ? "<div style='font-size:16px;font-weight:700;color:#3a2a6e;line-height:1.7;margin-top:6px;'>→ " + peerState + "</div>" : "") +
      (note ? "<div style='font-size:15px;color:#5a5a70;line-height:1.7;margin-top:6px;'>" + note + "</div>" : "");
  }
  // 全国の中央値との比べ方（rel：中央値の±3%以内、abs：差がこの値以内なら「ほぼ同じ」）
  function medCompare(v, med, absTol) {
    if (med == null || v == null) return "";
    var near = absTol != null ? Math.abs(v - med) <= absTol : Math.abs(v - med) <= Math.abs(med) * 0.03;
    return near ? "とほぼ同じです" : v > med ? "より高い水準です" : "より低い水準です";
  }
  // 決算の年度の住民1人あたりに使う人口（令和6年度の決算なら、令和7年1月1日の人口）
  function popForFiscal(cur) {
    var k = DATA_YEAR.fiscal + 1;
    if (DATA_YEAR.population === k) return cur.pop;
    return cur["pop_r" + k] != null ? cur["pop_r" + k] : cur.pop;
  }
  var MUNI_U_ZERO_SHARE = null;
  function muniUZeroShare() {
    if (MUNI_U_ZERO_SHARE != null) return MUNI_U_ZERO_SHARE;
    var n = 0, z = 0;
    Object.keys(DB).forEach(function(k){ var e = DB[k]; if (e.__pref) return; n++; if (e.u == null || e.u <= 0) z++; });
    MUNI_U_ZERO_SHARE = n ? z / n : 0;
    return MUNI_U_ZERO_SHARE;
  }
  // 似ている自治体が10団体未満のグループ：比較は出さず、グループ名と理由だけを短く添える
  var PEER_NOTE_KEYS = {flex:1, fiscalPower:1, debt:1, future:1, reserve:1, education:1, childInvest:1};
  function situationHtml(key, cur, isPref, name) {
    var h = situationHtmlCore(key, cur, isPref, name);
    if (!h || isPref || !PEER_NOTE_KEYS[key] || h.indexOf("※似ている自治体") >= 0) return h;
    if (typeof KK === "undefined" || !KK || !KK[name] || !KK[name].grp || peerInfo(name, false)) return h;
    var grp = KK[name].grp;
    var n = Object.keys(DB).filter(function(k){ return !DB[k].__pref && KK[k] && KK[k].grp === grp; }).length;
    return h + "<div style='font-size:15px;color:#5a5a70;line-height:1.7;margin-top:6px;'>※似ている自治体：" + grp + "（" + n + "自治体）。自治体の数が少ないため、比較は表示していません</div>";
  }
  function situationHtmlCore(key, cur, isPref, name) {
    var b = isPref ? "pref" : "muni";
    var area = isPref ? "全国の都道府県" : "全国の市区町村";
    var pct1 = function(v){ return (Math.round(v * 10) / 10).toFixed(1) + "%"; };
    if (key === "flex" && cur.x != null) {
      var x = cur.x, c = colorX(x), med = DATA_STATS.x[b];
      var st = x >= 100 ? "毎年決まって入るお金だけでは、決まった支払いをまかなえていない状態です"
             : c === "#6dcfad" ? "新しいことに回せるお金が、1割以上ある状態です"
             : c === "#7bb8e8" ? "新しいことに回せるのは1割に満たない状態です"
             : "新しいことに回せるお金が、ほとんど残っていない状態です";
      var note = (x >= 90 && med != null && Math.abs(x - med) <= 1.5) ? "※" + area + "の多くも同じ水準ですが、それは余裕が小さいことに変わりがないという意味です" : "";
      var pi1 = peerInfo(name, isPref), pc1 = null, pm1 = null, pst1 = null;
      if (pi1) {
        pm1 = peerMedian(peerVals(pi1, function(k){ return DB[k].x; }));
        pc1 = peerCmp(x, pm1, 0.5);
        if (pc1) pst1 = x < 100 ? "似ている自治体と比べると、新しいことに回せるお金が" + (pc1 === "same" ? "同じくらいの状態です" : pc1 === "lo" ? "多めの状態です" : "少なめの状態です") : null;
      }
      if (pi1 && pc1) {
        return situationBox(name, [
          "毎年決まって入るお金（税や地方交付税など）の" + sitB(pct1(x)) + "が、毎年必ず出ていくお金に使われています",
          situationTrend(cur, "x", {tol:0.5, fmt:pct1, label:"経常収支比率"}),
          cmpRow([["全国の中央値", pct1(med)], ["似ている自治体の中央値", pct1(pm1)]])
        ], x < 100 ? "新しいことに回せるのは" + pct1(100 - x) + "で、似ている自治体" + (pc1 === "same" ? "と同じくらいです" : pc1 === "lo" ? "より多めです" : "より少なめです") : st,
          (c === "#6dcfad" || c === "#7bb8e8") && x < 100 ? SIT_BLUE : SIT_RED, [note, peerNoteText(pi1)].filter(function(t){ return !!t; }).join("<br>"));
      }
      return situationBox(name, [
        "毎年決まって入るお金（税や地方交付税など）の" + sitB(pct1(x)) + "が、毎年必ず出ていくお金に使われています",
        situationTrend(cur, "x", {tol:0.5, fmt:pct1, label:"経常収支比率"}), area + "の中央値（" + pct1(med) + "）" + medCompare(x, med, 0.5),
        pc1 && x < 100 ? "新しいことに回せるのは" + sitB(pct1(100 - x)) + "です。似ている自治体では、中央値で" + pct1(100 - pm1) + "です" : (pc1 ? peerLine(pct1(pm1)) : "")
      ], st, (c === "#6dcfad" || c === "#7bb8e8") && x < 100 ? SIT_BLUE : SIT_RED, [note, pi1 ? peerNoteText(pi1) : ""].filter(function(t){ return !!t; }).join("<br>"), pst1);
    }
    if (key === "fiscalPower" && cur.f != null) {
      var f = cur.f, cf = colorF(f), medf = DATA_STATS.f[b], wari = Math.round(f * 10);
      var st2 = f >= 1.0 ? "国が計算した「標準的な行政に必要なお金」を、税収などで上回っている状態です（3年度の平均）"
              : wari >= 10 ? "国が計算した「標準的な行政に必要なお金」のほとんどを税収などでまかない、足りない分を国の交付金で補っている状態です"
              : "国が計算した「標準的な行政に必要なお金」の" + (wari < 1 ? "1割未満" : "約" + wari + "割") + "を税収などでまかない、残りを国の交付金で補っている状態です";
      var pi2 = peerInfo(name, isPref), pc2 = null, pm2 = null, pst2 = null;
      if (pi2) {
        pm2 = peerMedian(peerVals(pi2, function(k){ return DB[k].f; }));
        pc2 = peerCmp(f, pm2, 0.01);
        if (pc2) pst2 = "似ている自治体と比べると、" + (pc2 === "same" ? "税収などでまかなえる割合は同じくらいの状態です" : pc2 === "lo" ? "税収などでまかなえる割合が小さく、国の交付金で補う割合が大きい状態です" : "税収などでまかなえる割合が大きい状態です");
      }
      if (pi2 && pc2) {
        return situationBox(name, [
          "財政力指数は" + sitB(f.toFixed(2)) + "です",
          situationTrend(cur, "f", {tol:0.01, label:"財政力指数", fmt:function(v){ return v.toFixed(2); }}),
          cmpRow([["全国の中央値", medf != null ? medf.toFixed(2) : null], ["似ている自治体の中央値", pm2.toFixed(2)]])
        ], st2 + peerTail((cf === "#6dcfad" || cf === "#7bb8e8"), pc2, false, "税収などでまかなえる割合は", "高め", "低め"),
          (cf === "#6dcfad" || cf === "#7bb8e8") ? SIT_BLUE : SIT_RED, peerNoteText(pi2));
      }
      return situationBox(name, [
        "財政力指数は" + sitB(f.toFixed(2)) + "です",
        situationTrend(cur, "f", {tol:0.01, label:"財政力指数", fmt:function(v){ return v.toFixed(2); }}), area + "の中央値（" + (medf != null ? medf.toFixed(2) : "－") + "）" + medCompare(f, medf, 0.01),
        pc2 ? peerLine(pm2.toFixed(2)) : ""
      ], st2, (cf === "#6dcfad" || cf === "#7bb8e8") ? SIT_BLUE : SIT_RED, pi2 ? peerNoteText(pi2) : "", pst2);
    }
    if (key === "debt" && cur.d != null) {
      var d = cur.d;
      var rel = d >= 35 ? "財政再生の基準（35%）以上です" : d >= 25 ? "早期健全化の基準（25%）以上です" : d >= 18 ? "国の基準（18%）以上です"
              : d <= 9 ? "国の基準（18%）の半分以下です" : "国の基準（18%）を下回っています";
      var st3 = d < 10 ? "借金の返済に回すお金の割合が小さく、住民サービスにお金を回しやすい状態です"
              : (isPref && d < 14) ? "返済の負担は、全国の都道府県の中央値（" + pct1(DATA_STATS.d.pref) + "）" + (medCompare(d, DATA_STATS.d.pref, 0.5) || "と比べる状態です")
              : d < 18 ? "返済の負担はやや重めですが、国の基準は下回っている状態です"
              : d < 25 ? "新しく借金をするのに許可が必要な水準です（グラフの下で説明）"
              : d < 35 ? "国が定める早期健全化の基準以上の状態です（グラフの下で説明）"
              : "国が定める財政再生の基準以上の状態です（グラフの下で説明）";
      var pi3 = peerInfo(name, isPref), pc3 = null, pm3 = null, pst3 = null;
      if (pi3) {
        pm3 = peerMedian(peerVals(pi3, function(k){ return DB[k].d; }));
        pc3 = peerCmp(d, pm3, 0.3);
        if (pc3) pst3 = "似ている自治体と比べると、収入のうち借金の返済に回る割合が" + (pc3 === "same" ? "同じくらいです" : pc3 === "hi" ? "大きめです" : "小さめです");
      }
      // 10%以上（目安で「やや重い」）のときは「余裕があります」と言わない
      var lr3 = limitRoom(d, 18, d >= 10 ? "返済の負担はやや重めです" : "");
      if (pi3 && pc3) {
        return situationBox(name, [
          "借金返済の重さは" + sitB(pct1(d)) + "です（収入のうち、借金の返済に回る割合）",
          situationTrend(cur, "d", {tol:0.3, fmt:pct1, label:"実質公債費比率"}),
          cmpRow([["全国の中央値", pct1(DATA_STATS.d[b])], ["似ている自治体の中央値", pct1(pm3)]])
        ], d < 18 ? lr3.text + peerTail(lr3.room, pc3, true, "返済に回る割合は", "大きめ", "小さめ")
                  : st3 + peerTail(false, pc3, true, "返済に回る割合は", "大きめ", "小さめ"), d < 18 ? SIT_BLUE : SIT_RED, peerNoteText(pi3));
      }
      return situationBox(name, [
        "借金返済の重さは" + sitB(pct1(d)) + "です（収入のうち、借金の返済に回る割合）",
        situationTrend(cur, "d", {tol:0.3, fmt:pct1, label:"実質公債費比率"}), rel,
        pc3 ? peerLine(pct1(pm3)) : ""
      ], st3, d < 18 ? SIT_BLUE : SIT_RED, pi3 ? peerNoteText(pi3) : "", pst3);
    }
    if (key === "future") {
      var u = (cur.u == null || cur.u <= 0) ? 0 : cur.u;
      var lim = uLimitOf(cur, isPref), cu = colorU(u, isPref);
      var tr4 = situationTrend(cur, "u", {tol:2, fmt:pct1, label:"将来負担比率"}, true);
      if (u <= 0) {
        var tr4z = (tr4 && tr4.indexOf("0.0%〜0.0%") >= 0) ? "" : tr4;   // ずっと実質ゼロなら推移の文は出さない
        return situationBox(name, ["将来負担比率は" + sitB("「－」（実質ゼロ）") + "です", tr4z || ""],
          "将来払う借金などを、貯金などでまかなえる状態です", SIT_BLUE, "");
      }
      var rel4 = u >= lim ? "国の基準（" + lim + "%）以上です" : u < lim * 0.3 ? "国の基準（" + lim + "%）を大きく下回ります" : "国の基準（" + lim + "%）を下回ります";
      var cmp4 = isPref ? area + "の中央値（" + pct1(DATA_STATS.u.pref) + "）" + medCompare(u, DATA_STATS.u.pref, 2)
               : (muniUZeroShare() > 0.5 ? "全国の市区町村の半数以上は実質ゼロです" : "");
      var st4, col4;
      if (u >= lim) { st4 = "国が定める早期健全化の基準以上の状態です（グラフの下で説明）"; col4 = SIT_RED; }
      else if (isPref) {
        st4 = cu === "#6dcfad" ? "都道府県としては負担が軽い状態です" : cu === "#7bb8e8" ? "都道府県としては標準的な負担の状態です"
            : cu === "#f0c46a" ? "都道府県としては負担がやや重い状態です" : "都道府県としては負担が重い状態です";
        col4 = (cu === "#6dcfad" || cu === "#7bb8e8") ? SIT_BLUE : SIT_RED;
      } else {
        st4 = cu === "#7bb8e8" ? "国の基準から見れば軽い負担ですが、全国の中では負担がある側の状態です"
            : cu === "#f0c46a" ? "国の基準から見れば低いものの、一定の負担がある状態です"
            : "国の基準は下回るものの、将来の負担が重い状態です";
        col4 = cu === "#7bb8e8" ? SIT_BLUE : SIT_RED;
      }
      if (isPref && u < lim) {
        // 都道府県：国の基準との余裕＋都道府県の中での高め・低めを「→」の1行にまとめる
        var pm4p = DATA_STATS.u.pref, pc4p = peerCmp(u, pm4p, 2);
        var lr4p = limitRoom(u, lim, cu === "#f0c46a" ? "都道府県の中ではやや重めです" : cu === "#f0876a" ? "都道府県の中では重めです" : "");
        var verd4p = lr4p.heavy ? lr4p.text
          : lr4p.text + "。" + (lr4p.room && pc4p === "hi" ? "ただ、" : "") + "都道府県の中では、" + (pc4p === "same" ? "同じくらいの状態です" : pc4p === "hi" ? "高めの状態です" : "低めの状態です");
        return situationBox(name, ["将来負担比率は" + sitB(pct1(u)) + "です", tr4, cmpRow([["全国の都道府県の中央値", pct1(pm4p)]])],
          verd4p, (lr4p.room && pc4p !== "hi") ? SIT_BLUE : SIT_RED, "");
      }
      var pi4 = peerInfo(name, isPref), pl4 = "", pst4 = null;
      if (pi4) {
        var pv4 = peerVals(pi4, function(k){ var e = DB[k]; return (e.u == null || e.u <= 0) ? 0 : e.u; });
        var pz4 = pv4.filter(function(v){ return v <= 0; }).length / (pv4.length || 1);
        var pm4 = peerMedian(pv4), pc4 = peerCmp(u, pm4, 2);
        if (pz4 > 0.5) { pl4 = "似ている自治体の半数以上は、実質ゼロです"; pst4 = "似ている自治体と比べると、将来に残る負担は大きめです"; }
        else if (pc4) { pl4 = peerLine(pct1(pm4)); pst4 = "似ている自治体と比べると、将来に残る負担は" + (pc4 === "same" ? "同じくらいです" : pc4 === "hi" ? "大きめです" : "小さめです"); }
      }
      if (pi4 && pst4) {
        var pcz = pz4 > 0.5 ? "hi" : peerCmp(u, pm4, 2);
        var lr4 = limitRoom(u, lim, cu === "#f0c46a" ? "全国の市区町村の中では一定の負担があります" : cu === "#f0876a" ? "全国の市区町村の中では重めです" : "");
        return situationBox(name, [
          "将来負担比率は" + sitB(pct1(u)) + "です",
          tr4,
          cmpRow([pz4 > 0.5 ? ["似ている自治体", "半数以上が実質ゼロ"] : ["似ている自治体の中央値", pct1(pm4)]])
        ], u < lim ? lr4.text + peerTail(lr4.room, pcz, true, "将来に残る負担は", "大きめ", "小さめ")
                   : st4 + peerTail(false, pcz, true, "将来に残る負担は", "大きめ", "小さめ"), col4, peerNoteText(pi4));
      }
      return situationBox(name, ["将来負担比率は" + sitB(pct1(u)) + "です", tr4, rel4 + (cmp4 ? "。" + cmp4 : ""), pl4], st4, col4, pi4 ? peerNoteText(pi4) : "", pst4);
    }
    if (key === "reserve" && cur.sfs && cur.sfs > 0 && cur.r != null) {
      var rr = cur.r / cur.sfs * 100, rb = reserveBands(isPref), cr = colorR(rr, isPref);
      var pp = popForFiscal(cur);
      var yenPer = pp ? cur.r * 1e8 / pp : null;
      var perCap = yenPer == null ? "" : "（住民1人あたり約" + (yenPer >= 10000 ? (Math.round(yenPer / 1000) / 10).toFixed(1) + "万円" : (Math.round(yenPer / 100) * 100).toLocaleString() + "円") + "）";
      var pi5 = peerInfo(name, isPref), pc5 = null, pm5 = null;
      if (pi5) {
        pm5 = peerMedian(peerVals(pi5, function(k){ var e = DB[k]; return (e.sfs && e.sfs > 0 && e.r != null) ? e.r / e.sfs * 100 : null; }));
        pc5 = peerCmp(rr, pm5, pm5 != null ? pm5 * 0.05 : null);
      }
      var st5 = rr >= rb.hi ? "急な出費に厚めに備えている状態です"
              : rr >= rb.mid ? "急な出費にも一定の備えがある状態です"
              : "大きな災害などの急な出費には、貯金が少なめの状態です";
      if (pi5 && pc5) {
        return situationBox(name, [
          "貯金（財政調整基金）は" + sitB(fmtOku(cur.r)) + perCap + "で、標準財政規模の" + sitB(pct1(rr)) + "です",
          situationTrend(cur, "r", {tol:0.05, rel:true, times:true, label:"残高", fmt:function(v){ return fmtOku(v); }}),
          cmpRow([["全国の中央値", pct1(DATA_STATS.rr[b])], ["似ている自治体の中央値", pct1(pm5)]])
        ], st5 + peerTail(cr === "#6dcfad" || cr === "#7bb8e8", pc5, false, "貯金は", "多め", "少なめ"), (cr === "#6dcfad" || cr === "#7bb8e8") ? SIT_BLUE : SIT_RED,
          "※総務省の調査（平成29年）では、貯金の目安を標準財政規模の割合で決めている団体は、都道府県では5%以下、市町村では5〜20%が多い結果でした。目安は団体ごとに違います。<br>" + peerNoteText(pi5));
      }
      return situationBox(name, [
        "貯金（財政調整基金）は" + sitB(fmtOku(cur.r)) + perCap + "で、標準財政規模の" + sitB(pct1(rr)) + "です",
        situationTrend(cur, "r", {tol:0.05, rel:true, times:true, label:"残高", fmt:function(v){ return fmtOku(v); }}),
        area + "の中央値は、標準財政規模の" + pct1(DATA_STATS.rr[b]) + "です",
        (function(){ if (!pi5 || pc5 == null) return ""; return peerLine(pct1(pm5)); })()
      ], st5, (cr === "#6dcfad" || cr === "#7bb8e8") ? SIT_BLUE : SIT_RED,
        "※総務省の調査（平成29年）では、貯金の目安を標準財政規模の割合で決めている団体は、都道府県では5%以下、市町村では5〜20%が多い結果でした。目安は団体ごとに違います。" + (pi5 ? "<br>" + peerNoteText(pi5) : ""),
        pc5 ? "似ている自治体と比べると、貯金は" + (pc5 === "same" ? "同じくらいの備えです" : pc5 === "hi" ? "多めです" : "少なめです") : null);
    }
    if (key === "budget" && cur.eo && cur.ei) {
      var pb = popForFiscal(cur);
      var perCapB = pb ? "、住民1人あたり年間約" + sitB(Math.round(cur.eo * 1e8 / pb / 10000) + "万円") + "を使っています" : "";
      var chg = (cur.eog != null) ? "歳出は前年度より" + Math.abs(cur.eog).toFixed(1) + "%" + (cur.eog > 0 ? "増えました" : cur.eog < 0 ? "減りました" : "で、変わりませんでした") : "";
      var diff = Math.round((cur.ei - cur.eo) * 10) / 10;
      return situationBox(name, [
        "歳出" + sitB(fmtOku(cur.eo)) + "、歳入" + sitB(fmtOku(cur.ei)) + perCapB,
        chg
      ], cur.ei >= cur.eo ? "差し引き約" + fmtOku(diff) + "が残った状態です（翌年度に繰り越す分を含む）"
                          : "歳出が歳入を上回った状態です。不足分は翌年度の収入を前倒しして埋めることになっています",
         cur.ei >= cur.eo ? SIT_BLUE : SIT_RED, "");
    }
    if (key === "education" && cur.edu != null) {
      var med6 = DATA_STATS.edu[b];
      var eduOku = cur.eo ? Math.round(cur.eo * cur.edu / 100 * 10) / 10 : null;
      var pi6 = peerInfo(name, isPref), pc6 = null, pm6 = null, pst6 = null, pl6 = "";
      if (pi6) {
        pm6 = peerMedian(peerVals(pi6, function(k){ return DB[k].edu; }));
        pc6 = peerCmp(cur.edu, pm6, 0.5);
        if (pc6) {
          pl6 = peerLine(pct1(pm6));
          pst6 = "似ている自治体と比べると、歳出に占める教育費の割合は" + (pc6 === "same" ? "同じくらいです" : pc6 === "hi" ? "大きめです" : "小さめです");
          // 民生費（福祉・子育て）の割合が大きいと、ほかの費目の割合は小さくなる（割合の合計は100%）
          var shM = function(k){ var e = DB[k], b0 = e.bd && e.bd.ex; return (b0 && b0.minsei != null && e.eo) ? b0.minsei / (e.eo * 1e5) * 100 : null; };
          var mySh = shM(name), pmSh = peerMedian(peerVals(pi6, shM)), cSh = peerCmp(mySh, pmSh, 1);
          if (pc6 === "lo" && cSh === "hi") pl6 += "。福祉・子育て（民生費）は、歳出の" + pct1(mySh) + "（似ている自治体の中央値は" + pct1(pmSh) + "）です";
          if (pc6 === "lo" && cSh === "hi") pst6 += "。福祉・子育てに使う割合が大きい分、ほかの費目の割合は小さくなります";
        }
      }
      if (pi6 && pc6) {
        return situationBox(name, [
          (cur.eo ? "使ったお金" + fmtOku(cur.eo) + "のうち、約" + sitB(fmtOku(eduOku) + "（" + pct1(cur.edu) + "）") : sitB(pct1(cur.edu))) + "を教育に使っています",
          situationTrend(cur, "edu", {tol:0.5, fmt:pct1, label:"教育費比率"}),
          cmpRow([["全国の中央値", pct1(med6)], ["似ている自治体の中央値", pct1(pm6)]])
        ], "似ている自治体" + (pc6 === "same" ? "と同じくらいです" : pc6 === "hi" ? "より大きめです" : "より小さめです"), "#3a2a6e", peerNoteText(pi6));
      }
      return situationBox(name, [
        (cur.eo ? "使ったお金" + fmtOku(cur.eo) + "のうち、約" + sitB(fmtOku(eduOku) + "（" + pct1(cur.edu) + "）") : sitB(pct1(cur.edu))) + "を教育に使っています",
        situationTrend(cur, "edu", {tol:0.5, fmt:pct1, label:"教育費比率"}), area + "の中央値は" + pct1(med6) + "です", pl6
      ], null, null, pi6 ? peerNoteText(pi6) : "", pst6);
    }
    if (key === "childInvest" && cur.ch != null) {
      var med7 = DATA_STATS.ch[b];
      var pi7 = peerInfo(name, isPref), pc7 = null, pm7 = null;
      if (pi7) { pm7 = peerMedian(peerVals(pi7, function(k){ return DB[k].ch; })); pc7 = peerCmp(cur.ch, pm7); }
      if (pi7 && pc7) {
        return situationBox(name, [
          "18歳未満の子ども1人あたり、年間約" + sitB(cur.ch.toFixed(1) + "万円") + "です（教育費と児童福祉費の合計）",
          situationTrend(cur, "ch", {tol:0.03, rel:true, times:true, label:"投資額", fmt:function(v){ return v.toFixed(1) + "万円"; }}),
          cmpRow([["全国の中央値", med7 != null ? med7.toFixed(1) + "万円" : null], ["似ている自治体の中央値", pm7.toFixed(1) + "万円"]])
        ], "似ている自治体" + (pc7 === "same" ? "と同じくらいです" : pc7 === "hi" ? "より大きめです" : "より小さめです"), "#3a2a6e", peerNoteText(pi7));
      }
      return situationBox(name, [
        "18歳未満の子ども1人あたり、年間約" + sitB(cur.ch.toFixed(1) + "万円") + "です（教育費と児童福祉費の合計）",
        situationTrend(cur, "ch", {tol:0.03, rel:true, times:true, label:"投資額", fmt:function(v){ return v.toFixed(1) + "万円"; }}), area + "の中央値は" + (med7 != null ? med7.toFixed(1) : "－") + "万円です",
        pc7 ? peerLine(pm7.toFixed(1) + "万円") : ""
      ], null, null, pi7 ? peerNoteText(pi7) : "", pc7 ? "似ている自治体と比べると、子ども1人あたりにかけている金額は" + (pc7 === "same" ? "同じくらいです" : pc7 === "hi" ? "大きめです" : "小さめです") : null);
    }
    return "";
  }

  // 🔍 内訳から分かること（決算状況調の金額。cur.bd が無ければ出さない）
  var BD_EX_LABEL = {minsei:"民生費（福祉・子育て）", somu:"総務費（役所の運営など）", eisei:"衛生費（ごみ処理・保健など）", doboku:"土木費（道路・公園など）",
    edu:"教育費", kosai:"公債費（借金の返済）", shobo:"消防費", norin:"農林水産業費", shoko:"商工費", saigai:"災害復旧費", keisatsu:"警察費", rodo:"労働費", gikai:"議会費"};
  var BD_ED_LABEL = {kyu:"学校給食費", sho:"小学校費", chu:"中学校費", koko:"高等学校費", shakai:"社会教育費（公民館・図書館など）", somu:"教育総務費", tokushi:"特別支援学校費", yochi:"幼稚園費", hoken:"保健体育費"};
  function okuT(v) { return fmtOku(v / 100000); }   // 千円 → 「◯億円」「◯兆◯億円」
  function bdBox(title, rows, tail, tailColor) {
    if (!rows.length) return "";
    return "<div style='margin-top:12px;padding:12px 14px;background:#ffffffc0;border:1px solid #d8d5e8;border-radius:12px;'>" +
      "<div style='font-size:16px;font-weight:700;color:#3a2a6e;margin-bottom:6px;'>🔍 " + title + "</div>" +
      rows.map(function(r){ return "<div style='font-size:16px;color:#2a2a3a;line-height:1.6;'>" + r + "</div>"; }).join("") +
      (tail ? "<div style='font-size:16px;font-weight:700;color:" + (tailColor || SIT_BLUE) + ";line-height:1.7;margin-top:6px;'>→ " + tail + "</div>" : "") +
      "</div>";
  }
  function breakdownHtml(key, cur, isPref, name) {
    var bd = cur && cur.bd;
    if (!bd || bd.y !== DATA_YEAR.fiscal) return "";   // 財政のデータと同じ年度のときだけ
    var rv = bd.rv || {}, ex = bd.ex || {}, ed = bd.ed || {};
    var fy = reiwaText(DATA_YEAR.fiscal) + "度";
    var eiK = cur.ei ? cur.ei * 1e5 : null, eoK = cur.eo ? cur.eo * 1e5 : null;
    var pctOf = function(v, tot){ return tot ? "（" + (Math.round(v / tot * 1000) / 10).toFixed(1) + "%）" : ""; };
    var line = function(label, v, tot, peerPct){
      if (peerPct != null && tot) {   // 似ている自治体の数字があるときは、割合の行を下に分ける（項目名が狭くならないように）
        return "<div style='border-bottom:1px dotted #e0dcef;padding:4px 0;'>" +
          "<div style='display:flex;justify-content:space-between;align-items:baseline;gap:8px;'><span style='flex:1;'>" + label + "</span><b style='font-size:17px;white-space:nowrap;'>" + okuT(v) + "</b></div>" +
          "<div style='text-align:right;font-size:14px;color:#6a6a80;'>" + pctOf(v, tot).replace(/[（）]/g, "") + "　<span style='color:#8a7ab0;'>似ている自治体 " + (Math.round(peerPct * 10) / 10).toFixed(1) + "%</span></div></div>";
      }
      return "<div style='display:flex;justify-content:space-between;align-items:baseline;gap:8px;border-bottom:1px dotted #e0dcef;padding:4px 0;'>" +
        "<span style='flex:1;'>" + label + "</span>" +
        "<span style='white-space:nowrap;text-align:right;'><b style='font-size:17px;'>" + okuT(v) + "</b>" + (tot ? "<br><span style='font-size:14px;color:#6a6a80;'>" + pctOf(v, tot).replace(/[（）]/g, "") + "</span>" : "") + "</span></div>";
    };
    // 似ている自治体（類似団体）の、同じ年度の内訳の中央値（割合）。市区町村で、同じ区分が10団体以上あるときだけ
    var pinfo = peerInfo(name, isPref);
    if (pinfo) { var pn = pinfo.names.filter(function(k){ return DB[k].bd && DB[k].bd.y === DATA_YEAR.fiscal; }); pinfo = pn.length >= 10 ? {grp: pinfo.grp, names: pn, n: pn.length} : null; }
    var shEx = function(f){ return function(k){ var e = DB[k], x = e.bd && e.bd.ex; return (x && x[f] != null && e.eo) ? x[f] / (e.eo * 1e5) * 100 : null; }; };
    var shRv = function(f){ return function(k){ var e = DB[k], x = e.bd && e.bd.rv; return (x && x[f] != null && e.ei) ? x[f] / (e.ei * 1e5) * 100 : null; }; };
    var shEd = function(f){ return function(k){ var e = DB[k], x = e.bd && e.bd.ed, ee = e.bd && e.bd.ex; return (x && ee && ee.edu && x[f] != null) ? x[f] / ee.edu * 100 : null; }; };
    var pMed = function(getter){ return pinfo ? peerMedian(peerVals(pinfo, getter)) : null; };
    var cmpW = function(v, m){ var c = peerCmp(v, m, 1); return c == null ? null : c === "same" ? "同じくらい" : c === "hi" ? "大きめ" : "小さめ"; };
    var PTAIL = "#3a2a6e";
    var topEx = function(n){
      return Object.keys(ex).filter(function(k){ return BD_EX_LABEL[k] && ex[k] > 0; })
        .sort(function(a, c){ return ex[c] - ex[a]; }).slice(0, n)
        .map(function(k){ return line(BD_EX_LABEL[k], ex[k], eoK); });
    };
    if (key === "fiscalPower") {
      var r1 = [];
      if (rv.tax != null) r1.push(line("地方税（自治体の税収）", rv.tax, eiK));
      if (rv.lat != null) r1.push(line("地方交付税（国から配られるお金）", rv.lat, eiK));
      if (rv.nat != null) r1.push(line("国庫支出金（国の補助金など）", rv.nat, eiK));
      if (pinfo && eiK && rv.tax != null && rv.lat != null && rv.nat != null) {
        r1 = [line("地方税（自治体の税収）", rv.tax, eiK, pMed(shRv("tax"))), line("地方交付税（国から配られるお金）", rv.lat, eiK, pMed(shRv("lat"))), line("国庫支出金（国の補助金など）", rv.nat, eiK, pMed(shRv("nat")))];
        var wt = cmpW(shRv("tax")(name), pMed(shRv("tax")));
        var wn = cmpW((rv.lat + rv.nat) / eiK * 100, pMed(function(k){ var x = DB[k].bd.rv, e = DB[k]; return (x && x.lat != null && x.nat != null && e.ei) ? (x.lat + x.nat) / (e.ei * 1e5) * 100 : null; }));
        return bdBox("歳入" + fmtOku(cur.ei) + "の内訳から分かること", r1, (wt && wn) ? "似ている自治体と比べると、自前の税収の割合は" + wt + "、国から来るお金（地方交付税・国庫支出金）の割合は" + wn + "です" : "", PTAIL);
      }
      return bdBox("歳入" + (cur.ei ? fmtOku(cur.ei) : "") + "の内訳から分かること", r1, "");
    }
    if (key === "flex") {
      if (pinfo && eoK) {
        var tk = Object.keys(ex).filter(function(k){ return BD_EX_LABEL[k] && ex[k] > 0; }).sort(function(a, c){ return ex[c] - ex[a]; }).slice(0, 3);
        var rowsF = tk.map(function(k){ return line(BD_EX_LABEL[k], ex[k], eoK, pMed(shEx(k))); });
        var w1 = cmpW(shEx(tk[0])(name), pMed(shEx(tk[0])));
        return bdBox("歳出" + fmtOku(cur.eo) + "の内訳から分かること", rowsF, w1 ? "いちばん多いのは" + BD_EX_LABEL[tk[0]] + "で、似ている自治体" + (w1 === "同じくらい" ? "と同じくらいです" : "より" + w1 + "です") : "", PTAIL);
      }
      return bdBox("歳出" + (cur.eo ? fmtOku(cur.eo) : "") + "の内訳から分かること", topEx(3), "");
    }
    if (key === "debt" || key === "future") {
      if (ex.kosai == null || rv.bond == null) return "";
      return bdBox(fy + "の借金の動き", [line("借金の返済（公債費）", ex.kosai), line("新たな借金（地方債）", rv.bond)],
        rv.bond > ex.kosai ? "新たに借りた額が返済額を上回ったため、借金の残高は増えています" : "");
    }
    if (key === "reserve") {
      if (rv.tr == null) return "";
      if (pinfo && eiK) {
        var wtr = cmpW(shRv("tr")(name), pMed(shRv("tr")));
        return bdBox(fy + "の貯金の動き", [line("基金からの繰入金（貯金の取り崩しなど）", rv.tr, eiK, pMed(shRv("tr")))], wtr ? "貯金などの取り崩しに頼る割合は、似ている自治体" + (wtr === "同じくらい" ? "と同じくらいです" : "より" + wtr + "です") : "", PTAIL);
      }
      return bdBox(fy + "の貯金の動き", [line("基金からの繰入金（貯金の取り崩しなど）", rv.tr)], "");
    }
    if (key === "budget") {
      var html = "";
      var prev = bd.exp, eoPrev = cur["eo_r" + (DATA_YEAR.fiscal - 1)];
      if (prev && eoPrev != null && cur.eo) {
        var dEo = Math.round((cur.eo - eoPrev) * 10) / 10;
        // 増えたものと減ったものを両方出す（減ったものだけだと、合計の増減と合わなく見えるため）
        var diffs = Object.keys(ex).filter(function(k){ return BD_EX_LABEL[k] && prev[k] != null && ex[k] != null && ex[k] !== prev[k]; })
          .map(function(k){ return {k:k, d:ex[k] - prev[k]}; });
        var ups = diffs.filter(function(o){ return o.d > 0; }).sort(function(a, c){ return c.d - a.d; }).slice(0, 2);
        var downs = diffs.filter(function(o){ return o.d < 0; }).sort(function(a, c){ return a.d - c.d; }).slice(0, 2);
        var rows = [];
        ups.concat(downs).forEach(function(o){ rows.push("<div style='display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #e0dcef;padding:4px 0;'><span style='flex:1;'>" + BD_EX_LABEL[o.k] + "</span><b style='font-size:17px;white-space:nowrap;color:#2a2a3a;'>" + (o.d >= 0 ? "＋" : "−") + okuT(Math.abs(o.d)) + "</b></div>"); });
        var topMove = dEo < 0 ? downs[0] : ups[0];
        html += bdBox("前年度からの主な増減（歳出 " + (dEo >= 0 ? "＋" : "−") + fmtOku(Math.abs(dEo)) + "）", rows,
          topMove ? "いちばん大きく" + (dEo < 0 ? "減った" : "増えた") + "のは" + BD_EX_LABEL[topMove.k].replace(/（.*）/, "") + "（" + (topMove.d >= 0 ? "＋" : "−") + okuT(Math.abs(topMove.d)) + "）です" : "", PTAIL);
      }
      var r2 = [];
      if (rv.bond != null) r2.push(line("地方債（借金）", rv.bond, eiK, pMed(shRv("bond"))));
      if (rv.tr != null) r2.push(line("基金からの繰入金（貯金の取り崩しなど）", rv.tr, eiK, pMed(shRv("tr"))));
      var wb = (pinfo && rv.bond != null) ? cmpW(shRv("bond")(name), pMed(shRv("bond"))) : null, wr2 = (pinfo && rv.tr != null) ? cmpW(shRv("tr")(name), pMed(shRv("tr"))) : null;
      html += bdBox("歳入の中の借金と取り崩し", r2, (wb && wr2) ? "似ている自治体と比べると、借金に頼る割合は" + wb + "、貯金の取り崩しに頼る割合は" + wr2 + "です" : "", PTAIL);
      return html;
    }
    if (key === "education") {
      var ek = Object.keys(ed).filter(function(k){ return BD_ED_LABEL[k] && ed[k] > 0; })
        .sort(function(a, c){ return ed[c] - ed[a]; }).slice(0, 5);
      if (pinfo && ex.edu) {
        var r3p = ek.map(function(k){ return line(BD_ED_LABEL[k], ed[k], ex.edu, pMed(shEd(k))); });
        // 似ている自治体の中央値との差がいちばん大きい項目
        var best = null;
        ek.forEach(function(k){ var m = pMed(shEd(k)); if (m == null) return; var dd = shEd(k)(name) - m; if (best == null || Math.abs(dd) > Math.abs(best.dd)) best = {k: k, dd: dd}; });
        var tl = best == null ? "" : Math.abs(best.dd) < 1 ? "似ている自治体と同じような内訳です" : BD_ED_LABEL[best.k].replace(/（.*）/, "") + "の割合が、似ている自治体より" + (best.dd > 0 ? "大きめ" : "小さめ") + "です";
        return bdBox("教育費の内訳", r3p, tl, PTAIL);
      }
      var r3 = ek.map(function(k){ return line(BD_ED_LABEL[k], ed[k]); });
      return bdBox("教育費の内訳", r3, "");
    }
    if (key === "childInvest") {
      var r4 = [];
      if (ex.edu != null) r4.push(line("教育費", ex.edu));
      if (ex.jido != null) r4.push(line("児童福祉費", ex.jido));
      return bdBox(fy + "の内訳", r4, "");
    }
    return "";
  }

  function prof(s) {
    if (s>=85) return {l:"絶好調みっちー",c:"#6dcfad",bg:"#d4f0e8",e:"⭐",m:"財政は非常に健全です。",img:"happy"};
    if (s>=70) return {l:"元気なみっちー",c:"#7bb8e8",bg:"#e8f4fd",e:"💙",m:"財政はおおむね安定しています。",img:"normal"};
    if (s>=50) return {l:"ちょっとしんどいみっちー",c:"#f0c46a",bg:"#fdf5d4",e:"⚠️",m:"財政にやや課題があります。",img:"tired"};
    if (s>=30) return {l:"ぐったりみっちー",c:"#f0876a",bg:"#fde8e0",e:"🆘",m:"財政状況はかなり厳しい状態です。",img:"sick"};
    return {l:"ひんし状態みっちー",c:"#d0505a",bg:"#ffe0e4",e:"🚨",m:"財政は非常に厳しい状態です。",img:"critical"};
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
  /* ================= 国の基準を超えた自治体の枠（2026-10-01）=================
     実質公債費比率・将来負担比率の詳細画面と、財政調整基金の詳細画面で、グラフの下・「◯◯とは？」の前に出す。
     ・見出しと本文は、データ（実質公債費比率・将来負担比率）と法律で決まっていることだけ。
         35%以上 … 財政再生の基準（地方公共団体の財政の健全化に関する法律）
         25%以上、または将来負担比率が基準以上（市町村350%・都道府県と政令市400%）… 早期健全化の基準（同法）
         18%以上 … 新しい借金に許可が必要（地方財政法）。許可には公債費負担適正化計画が求められる（総務省 地方債同意等基準）
     ・📄 の欄は、財政状況資料集に自治体自身が書いた説明（shiryou.json）を、言い換えずにそのまま出す。
       取り込めなかった年・項目は出さない。 */
  function legalStatusBoxHtml(key, cur, isPref, name) {
    if (!cur) return "";
    var d = cur.d, u = cur.u, uLimit = uLimitOf(cur, isPref);
    function over(v, th) { return v > th ? "を超えています" : "に達しています"; }
    var lv = 0, head = "", lines = [], law = "";
    if (d != null && d >= 35) {
      lv = 1;
      head = "🏛️ 財政再生団体の基準" + over(d, 35);
      lines.push("実質公債費比率が" + d.toFixed(1) + "%で、財政再生の基準（35%）以上です");
      law = "法律により、財政再生計画を作り、総務大臣の同意を得て立て直しを進める必要があります。同意がないと、災害復旧などを除き、新しい借金ができません";
    } else if ((d != null && d >= 25) || (u != null && u >= uLimit)) {
      lv = 2;
      var dOver = d != null && d >= 25, uOver = u != null && u >= uLimit;
      head = "⚠️ 早期健全化の基準" + over(dOver ? d : u, dOver ? 25 : uLimit);
      if (dOver) lines.push("実質公債費比率が" + d.toFixed(1) + "%で、早期健全化の基準（25%）以上です");
      if (uOver) lines.push("将来負担比率が" + u.toFixed(1) + "%で、早期健全化の基準（" + uLimit + "%）以上です");
      law = "法律により、財政健全化計画を作り、議会の議決を経て、立て直しを進める必要があります";
    } else if (d != null && d >= 18) {
      lv = 3;
      var auth = (isPref || cur.__seirei) ? "国（総務大臣）" : "都道府県（知事）";
      head = "📝 借金に" + auth + "の許可が必要な水準です";
      lines.push("実質公債費比率が" + d.toFixed(1) + "%で、18%以上です");
      law = "新しく借金をするには、" + auth + "の許可が必要です。許可を受けるには、借金返済の負担を減らす計画（公債費負担適正化計画）を作ることが求められます";
    }
    if (!lv) return "";
    var col = lv === 1 ? {b:"#b71c1c", bg:"#fdeaea", h:"#a31515"}
            : lv === 2 ? {b:"#d84343", bg:"#fdf0f0", h:"#b71c1c"}
            :            {b:"#e88b8b", bg:"#fff6f6", h:"#c62828"};
    var html = "<div style='border:2px solid " + col.b + ";background:" + col.bg + ";border-radius:14px;padding:14px 16px;margin:22px 0 6px;'>" +
      "<div style='font-size:17px;font-weight:700;color:" + col.h + ";margin-bottom:8px;line-height:1.5;'>" + head + "</div>" +
      "<div style='font-size:16px;color:#2a2a3a;line-height:1.75;'>" + lines.map(escapeHtml).join("<br>") + "</div>" +
      "<div style='font-size:16px;color:#2a2a3a;line-height:1.75;margin-top:4px;'>→ " + escapeHtml(law) + "</div>";
    var sh = (typeof SHIRYOU === "object" && SHIRYOU) ? SHIRYOU[name] : null;
    var txt = sh && sh[key];
    if (txt) {
      var body = escapeHtml(txt).replace(/（(増減理由|今後の方針)）\n?/g, "<b style='color:#5a4a7a;'>（$1）</b>").replace(/\n/g, "<br>");
      html += "<div style='border-top:1px solid " + col.b + "55;margin-top:12px;padding-top:10px;'>" +
        "<div style='font-size:16px;font-weight:700;color:#3a2a6e;margin-bottom:6px;'>📄 " + escapeHtml(name) + "の説明（" + escapeHtml(SHIRYOU._year || "") + " 財政状況資料集より）</div>" +
        "<div style='font-size:15px;color:#3a3a4a;line-height:1.8;'>" + body + "</div></div>";
    }
    return html + "</div>";
  }
  /* ================= アップデート情報 =================
     新しい版を出したら、いちばん上に1件足す（新しい順）。
     番号の決め方：大きな作り直し→左、機能の追加→真ん中、不具合の修正だけ→右 を1つ上げる。
     （みっちーの席くじと同じ考え方） */
  var APP_UPDATES = [
    { version:"3.5.4", date:"2026.10", items:["グラフの表示を改善"] },
    { version:"3.5.3", date:"2026.10", items:["グラフの色と数字の表示を改善","順位の表示を改善（同じ値は同じ順位）","説明の修正"] },
    { version:"3.5.2", date:"2026.10", items:["詳細画面の「みっちーチェック」の表示を改善"] },
    { version:"3.5.1", date:"2026.10", items:["大きな金額を「兆」で表示するなど、金額を読みやすい表示に変更","似ている自治体が少ないときの説明を追加"] },
    { version:"3.5.0", date:"2026.10", items:["内訳の枠に、似ている自治体との比較を表示","総合スコアの内訳に説明を追加","説明の修正"] },
    { version:"3.4.0", date:"2026.10", items:["人口や産業が似ている自治体との比較を表示","説明の修正"] },
    { version:"3.3.3", date:"2026.10", items:["説明の修正","「ひとこと」に、独自の総合点であることを表示"] },
    { version:"3.3.2", date:"2026.10", items:["説明の修正"] },
    { version:"3.3.1", date:"2026.10", items:["ふるさと納税の注記を更新","表示の改善"] },
    { version:"3.3.0", date:"2026.10", items:["グラフに、全国の中央値と新型コロナ対応の時期を表示","表示の改善"] },
    { version:"3.2.0", date:"2026.10", items:["国の基準を超えた自治体に、法律で決まっていることと、自治体自身の説明を表示","人口増減率に、自然増減・社会増減の内訳を表示","歳入・歳出の内訳から分かることを表示","各項目の説明を、見出しと箇条書きで読みやすく改善","公会計を令和6年度のデータに更新","表示の改善"] },
    { version:"3.1.1", date:"2026.9", items:["財政と公会計を比べる欄で、組み合わせから分かることを表示"] },
    { version:"3.1.0", date:"2026.9", items:["各項目の説明を、自治体の今の状況が分かる形に改善"] },
    { version:"3.0.9", date:"2026.9", items:["説明文をより分かりやすく改善","公会計タブに「みっちーからのひとこと」を追加"] },
    { version:"3.0.8", date:"2026.9", items:["表示の改善"] },
    { version:"3.0.7", date:"2026.9", items:["公会計のグラフに注記を追加"] },
    { version:"3.0.6", date:"2026.9", items:["公会計のグラフの表示を改善"] },
    { version:"3.0.5", date:"2026.9", items:["グラフの過去データを、総務省の公表値に合わせて更新"] },
    { version:"3.0.4", date:"2026.9", items:["グラフの表示期間を直近8年分に整理"] },
    { version:"3.0.3", date:"2026.9", items:["人口データを更新","人口の注記を追加"] },
    { version:"3.0.2", date:"2026.9", items:["人口増減率の説明文を改善"] },
    { version:"3.0.1", date:"2026.9", items:["グラフの表示を改善"] },
    { version:"3.0.0", date:"2026.9", items:[
      "「Myみっちー」機能を追加（自分の街を登録、全国・県内での順位を表示）",
      "「公会計」タブを追加（住民一人当たり資産額・負債額など9指標）",
      "類似団体（同規模の自治体）との比較を追加",
      "「ふるさと納税」タブを追加"
    ]}
  ];
  var UPDATE_SEEN_KEY = "mitchie-fiscal-seen-version";
  function hasUnseenUpdate(){
    try{ return localStorage.getItem(UPDATE_SEEN_KEY) !== APP_UPDATES[0].version; }catch(e){ return false; }
  }
  function markUpdateSeen(){
    try{ localStorage.setItem(UPDATE_SEEN_KEY, APP_UPDATES[0].version); }catch(e){}
  }
  function closeUpdatesModal(overlay){
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  function openUpdatesModal(){
    markUpdateSeen();
    var dot = document.getElementById("updateDot");
    if (dot) dot.style.display = "none";
    var listHtml = APP_UPDATES.map(function(u){
      var itemsHtml = u.items.map(function(t){ return "<li>" + escapeHtml(t) + "</li>"; }).join("");
      return "<div class='update-item'>" +
        "<div class='update-item-head'><span>Ver " + escapeHtml(u.version) + "</span><span class='update-item-date'>" + escapeHtml(u.date) + "</span></div>" +
        "<ul>" + itemsHtml + "</ul>" +
      "</div>";
    }).join("");
    var overlay = document.createElement("div");
    overlay.className = "update-modal-overlay";
    overlay.innerHTML =
      "<div class='update-modal-box'>" +
        "<div class='update-modal-title'>&#127881; アップデート情報</div>" +
        listHtml +
        "<button type='button' class='update-modal-close'>とじる</button>" +
      "</div>";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e){ if (e.target === overlay) closeUpdatesModal(overlay); });
    var closeBtnEl = overlay.querySelector(".update-modal-close");
    if (closeBtnEl) closeBtnEl.addEventListener("click", function(){ closeUpdatesModal(overlay); });
  }
  function initUpdatePill(){
    var btn = document.getElementById("updatePillBtn");
    if (!btn) return;
    var verEl = document.getElementById("updatePillVer");
    if (verEl) verEl.textContent = APP_UPDATES[0].version;
    var dot = document.getElementById("updateDot");
    if (dot) dot.style.display = hasUnseenUpdate() ? "" : "none";
    btn.addEventListener("click", openUpdatesModal);
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

  // 区分の判定（バッジと「現在該当」の一覧で同じ判定を使う）
  function fiscalStatusOf(d, isPref) {
    var dd = d.d, uu = (d.u!=null && d.u!=="-" && d.u!=="－") ? d.u : null;
    var jr = (d.jr!=null && d.jr!=="-" && d.jr!=="－") ? d.jr : null;
    var rjr = (d.rjr!=null && d.rjr!=="-" && d.rjr!=="－") ? d.rjr : null;
    var early = isPref ? {jr:3.75, rjr:8.75, d:25, u:400} : {jr:15, rjr:20, d:25, u:uLimitOf(d, false)};
    var recon = isPref ? {jr:5, rjr:15, d:35} : {jr:20, rjr:30, d:35};
    var isRecon = (jr!=null && jr>=recon.jr) || (rjr!=null && rjr>=recon.rjr) || (dd!=null && dd>=recon.d);
    var isEarly = !isRecon && ((jr!=null && jr>=early.jr) || (rjr!=null && rjr>=early.rjr) || (dd!=null && dd>=early.d) || (uu!=null && uu>=early.u));
    return {recon: isRecon, early: isEarly, bond: dd!=null && dd>=18};
  }
  // 説明パネルの「現在該当」を、読み込んだデータから作る（2026-09-30：以前は団体名を直接書いていた）
  function fiscalStatusLists(html) {
    if (!DB || html.indexOf("{LIST_") < 0) return html;
    var lists = {bond: [], early: [], recon: []};
    Object.keys(DB).forEach(function(n){
      var st = fiscalStatusOf(DB[n], DB[n].p === n);
      if (st.bond) lists.bond.push(n);
      if (st.early) lists.early.push(n);
      if (st.recon) lists.recon.push(n);
    });
    // 都道府県を先、市区町村を後に並べる
    Object.keys(lists).forEach(function(k){
      lists[k].sort(function(a,b){ return (DB[b].p === b) - (DB[a].p === a); });
    });
    var colors = {bond: "#8b7ae8", early: "#f0a860", recon: "#e85060"};
    function chips(k) {
      if (!lists[k].length) return "該当団体はありません";
      return lists[k].map(function(n){
        return "<span class='peer-chip' data-city='" + escapeHtml(n) + "' style='display:inline-block;background:" + colors[k] + "14;border:1px solid " + colors[k] + "40;border-radius:12px;padding:2px 9px;font-size:12px;margin:2px 3px 0 0;cursor:pointer;'>" + escapeHtml(n) + "</span>";
      }).join("");
    }
    return html.replace("{LIST_BOND}", chips("bond")).replace("{LIST_EARLY}", chips("early")).replace("{LIST_RECON}", chips("recon"));
  }
  function fiscalStatusBadge(d, isPref) {
    var st = fiscalStatusOf(d, isPref);
    var isRecon = st.recon, isEarly = st.early, isBond = st.bond;
    var yrLabel = fillYears("{FY}決算時点");
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
    var dc = colorD(d.d);
    var xc = colorX(d.x);
    var uc = colorU(d.u, d.p === curName);
    var rc = colorR((d.sfs && d.sfs > 0) ? d.r / d.sfs * 100 : null, d.p === curName);
    var gc = colorG(d.g);   // 説明文の「目安」と同じ4色（±0.1%未満は青＝ほぼ横ばい）
    // 人口増減率だけ「年」（暦年）区切り、他の財政指標は「年度」区切りで総務省が別々に公表しているため、
    // 人口の方が新しいデータが先に出て年度がズレて見えることがある（2026-09-23）。
    // 年号は読み込んだデータから決まる（js/data.js の DATA_YEAR）ので、来年以降の更新でも注記が古いまま残らない。
    var gYearNoteHtml = (DATA_YEAR.population !== DATA_YEAR.fiscal) ?
      ("<div style='font-size:11px;color:#8a8a9a;margin-top:2px;'>※財政指標は" + reiwaText(DATA_YEAR.fiscal) + "度、人口は" + reiwaText(DATA_YEAR.population) + "1月時点（区切り方が異なります）</div>") : "";
    var ul = d.u<=0?"負担なし":d.u.toFixed(1)+"%";
    var chc = "#a08be8";  /* 良し悪しを判定できない指標のため中立色 */
    var chl = d.ch!=null ? d.ch.toFixed(1)+"万円" : "－";
    var educ = "#a08be8";  /* 良し悪しを判定できない指標のため中立色 */
    var edul = d.edu!=null ? d.edu.toFixed(1)+"%" : "－";
    var fuc = (d.fu!=null && d.fk!=null) ? (d.fu > d.fk ? "#6dcfad" : (d.fk > d.fu ? "#f0876a" : "#a0a0a0")) : "#a0a0a0";
    var eoc = "#7a64d0", eic = "#7a64d0";  /* 歳出・歳入が増えた・減ったこと自体は良し悪しではないため中立色（2026-10-02） */
    var eol = d.eo ? fmtOku(d.eo) : "－";
    var eil = d.ei ? fmtOku(d.ei) : "－";
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
          "<div class='hmsg'>"+pr.m+heroWeakHtml(d, h, nm===d.p)+"</div>" +
        "</div>" +
      "</div>" +
      "<h2 class='sr-only'>健康度スコア</h2>" + noteHtml(d, h, d.p === nm) + "<div class='meter' id='m0' role='button' tabindex='0' style='border:3px solid "+pr.c+";background:"+pr.c+"10;'><div class='mt'><span>財政健全度スコア</span><span style='color:"+pr.c+";font-weight:700;'>"+h+"点</span></div>" +
        mmScoreBoxRanks(nm, d) +
        "<div class='mt-tap' style='text-align:center;margin-top:6px;'>タップで<span style='color:"+pr.c+";font-weight:700;'>"+nm+"</span>と似た自治体と詳細を見る▶</div>" +
      "</div>" +
      "<div class='meter' id='m1' role='button' tabindex='0'><div class='mt'><span>実質公債費比率<span style='font-size:12px;font-weight:400;color:#7a7a90;'>（借金返済の重さ）</span></span><span class='mt-tap'>タップで詳細 ▶</span></div>" +
        "<div class='mb'><div id='dbar' class='mf' style='width:0%;background:"+dc+";'></div></div>" +
        "<div class='mv'><span>0%</span><span style='color:"+dc+";font-weight:700;'>"+d.d+"%</span><span>35%+</span></div>" +
      "</div>" +
      "<div class='tap-hint'>📊 各項目をタップすると説明とグラフが表示されます</div>" +
      "<h2 class='sr-only'>財政指標の一覧</h2><div class='grid'>" +
        "<div class='stat' id='s0' role='button' tabindex='0' style='background:"+fc+"18;border-color:"+fc+"44;'><div class='si'>💪</div><div class='sl'>財政力指数</div><div style='font-size:12px;color:#7a7a90;line-height:1.35;margin-bottom:2px;'>税収でまかなえる度合い</div><div class='sv' style='color:"+fc+";'>"+d.f.toFixed(2)+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s1' role='button' tabindex='0' style='background:"+xc+"18;border-color:"+xc+"44;'><div class='si'>📊</div><div class='sl'>経常収支比率</div><div style='font-size:12px;color:#7a7a90;line-height:1.35;margin-bottom:2px;'>決まって出ていくお金の割合</div><div class='sv' style='color:"+xc+";'>"+d.x.toFixed(1)+"%</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s2' role='button' tabindex='0' style='background:"+uc+"18;border-color:"+uc+"44;'><div class='si'>🏦</div><div class='sl'>将来負担比率</div><div style='font-size:12px;color:#7a7a90;line-height:1.35;margin-bottom:2px;'>将来に残る負担の重さ</div><div class='sv' style='color:"+uc+";'>"+ul+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s3' role='button' tabindex='0' style='background:"+rc+"18;border-color:"+rc+"44;'><div class='si'>🐧</div><div class='sl'>財政調整基金</div><div style='font-size:12px;color:#7a7a90;line-height:1.35;margin-bottom:2px;'>自治体の貯金</div><div class='sv' style='color:"+rc+";'>"+((d.sfs && d.sfs>0)?(d.r/d.sfs*100).toFixed(1)+"%":fmtOku(d.r))+"</div><div style='font-size:12px;color:#8a8a9a;margin-top:2px;'>("+fmtOku(d.r)+")</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s4' role='button' tabindex='0' style='background:"+gc+"18;border-color:"+gc+"44;'><div class='si'>👥</div><div class='sl'>人口増減率</div><div style='font-size:12px;color:#7a7a90;line-height:1.35;margin-bottom:2px;'>前年からの人口の増減</div><div class='sv' style='color:"+gc+";'>"+(d.g>=0?"+":"")+d.g.toFixed(2)+"%</div>"+gYearNoteHtml+"<div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s5' role='button' tabindex='0' style='background:#7bb8e818;border-color:#7bb8e844;'><div class='si'>💹</div><div class='sl'>歳出／歳入</div><div style='font-size:12px;color:#7a7a90;line-height:1.35;margin-bottom:2px;'>使ったお金／入ったお金</div><div class='sv' style='font-size:14px;line-height:1.7;'><span style='color:"+eoc+";display:block;'>💸 歳出 "+eol+" <small style='font-size:13px;'>"+eogs+"</small></span><span style='color:"+eic+";display:block;'>💰 歳入 "+eil+" <small style='font-size:13px;'>"+eigs+"</small></span></div></div>" +
        "<div class='stat' id='s6' role='button' tabindex='0' style='background:"+educ+"18;border-color:"+educ+"44;'><div class='si'>📚</div><div class='sl'>教育費比率</div><div style='font-size:12px;color:#7a7a90;line-height:1.35;margin-bottom:2px;'>歳出のうち教育に使った割合</div><div class='sv' style='color:"+educ+";'>"+edul+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s7' role='button' tabindex='0' style='background:"+chc+"18;border-color:"+chc+"44;'><div class='si'>👧</div><div class='sl'>子ども1人当たり投資額</div><div class='sv' style='color:"+chc+";'>"+chl+"</div><div class='su'>詳細を見る ▶</div></div>" +
        "<div class='stat' id='s8' role='button' tabindex='0' style='background:"+fuc+"18;border-color:"+fuc+"44;'><div class='si'>🎁</div><div class='sl'>ふるさと納税</div><div class='sv' style='font-size:14px;line-height:1.7;'><span style='color:#6dcfad;display:block;'>🎁 受入額 "+(d.fu!=null?fmtManOku(d.fu):"—")+"</span><span style='color:#f0876a;display:block;'>📤 住民税控除額 "+(d.fk!=null?fmtManOku(d.fk):"—")+"</span></div></div>" +
      "</div>" +
      "<div class='adv'><strong>みっちーからのひとこと</strong>"+advice(nm,d)+"</div>" +
      "<div style='text-align:center;margin:16px 0 4px;'><button id='shareImgBtn' style='background:linear-gradient(135deg,#a08be8,#e060a8);color:white;border:none;border-radius:50px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(140,80,220,0.3);display:inline-flex;align-items:center;gap:8px;'>結果を共有する<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='18' cy='5' r='3'></circle><circle cx='6' cy='12' r='3'></circle><circle cx='18' cy='19' r='3'></circle><line x1='8.59' y1='13.51' x2='15.42' y2='17.49'></line><line x1='15.41' y1='6.51' x2='8.59' y2='10.49'></line></svg></button></div>" +
      "<div class='src'>📋 総務省「地方財政状況調査関係資料」"+fillYears("{FY}")+" | <a href='https://www.soumu.go.jp/iken/jokyo_chousa_shiryo.html' target='_blank'>総務省公式</a></div>" +
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

  // 順位：自分より良い値の数＋1。同じ値なら同じ順位になる
  // （2026-10-02：以前は並べた順の番号だったため、同じ値でも順位が違っていた。将来負担比率「－」の自治体どうしなど）
  function tieRank(list, name, lowerBetter) {
    var me = null, better = 0;
    list.forEach(function(o){ if (o.k === name) me = o.v; });
    if (me == null) return null;
    list.forEach(function(o){ if (lowerBetter ? o.v < me : o.v > me) better++; });
    return better + 1;
  }

  var META_ONELINE = {
    fiscalPower: "自治体がどれだけ自前の税収でやりくりできているかを見る指標",
    debt: "自治体が借金返済にどれくらい財源を使っているかを見る指標",
    flex: "毎年入るお金のうち、固定費でどれだけ使われているかを見る指標",
    future: "借金など将来支払う負担が、貯金などを差し引いてどれくらい重いかを見る指標",
    reserve: "自治体の「もしもの時のための貯金」がどれくらいあるかを見る指標",
    growth: "自治体の人口がどれくらい増えている・減っているかを見る指標",
    education: "自治体の支出のうち、教育にどれだけ使われているかを見る指標",
    childInvest: "子ども1人あたりにどれくらいお金をかけているかを見る指標",
    budget: "自治体が1年間に使ったお金と入ってきたお金を見る指標"
  };
  var META = {
    health:{icon:"🏥",label:"総合財政健全度スコア",desc:"総務省の公式データから財政力・借金返済・固定費・将来負担・貯金の5指標を用いて算出した、本アプリ独自の参考スコアです（0〜100点）。公式の格付けではありません。\n\n都道府県は高校・国道・河川など大規模な資産を抱えるため、将来負担比率や経常収支比率の水準が市区町村より構造的に高くなります。そのため都道府県には専用の基準を用いており、市区町村の点数とは直接比較できません。\n\n目安\n85点以上 → 絶好調\n70点以上 → 元気\n50点以上 → ちょっとしんどい\n30点以上 → ぐったり\n30点未満 → ひんし状態\n\nスコアの上に出る帯について\n⚠️「ただし、〜は高い水準です」\n総合スコアは高めでも、その指標だけが弱い場合に出ます。たとえば税収などの体力はあるものの、毎年の支出が固まっていて、新しい取り組みに回せるお金は少ない、という状態です。\n\n💡「〜は健全な水準です」\n総合スコアは低めでも、その指標は明確に良い場合に出ます。全体としては厳しくても、その部分の管理はできている、という意味です。\n\nスコアは5つの指標をまとめた参考値です。1つの数字だけで判断せず、各指標もあわせて見てください。",unit:"pt"},
    debt:{icon:"💳",label:"実質公債費比率",desc:"毎年の収入（標準財政規模）のうち、借金の返済に使った割合です（過去3年度の平均）。\n\n## 📏 目安\n🟢 10%未満 → 返済の負担が軽い\n🔵 10〜18% → 返済の負担がやや重い（国の基準は下回る）\n🟡 18〜25% → 借金に許可が必要な水準\n🟠 25%以上 → 早期健全化の基準以上\n・中央値：市区町村{MED:d:muni:1}%／都道府県{MED:d:pref:1}%\n\n## 📜 国の基準\n・18%以上 → 新しく借金をするのに許可が必要（地方財政法）\n・25%以上 → 早期健全化の基準。財政健全化計画を作る必要があります\n・35%以上 → 財政再生の基準。国の関与のもとで立て直しを進めます\n・出典：総務省 主要財政指標一覧（{FY}）、地方公共団体の財政の健全化に関する法律",unit:"%"},
    fiscalPower:{icon:"💪",label:"財政力指数",desc:"自治体の税収などで、国が計算した「標準的な行政に必要なお金」をどれだけまかなえるかを表す数字です（過去3年度の平均）。\n\n## 🧮 計算のしかた\n・基準財政収入額（税収などの見込み）÷ 基準財政需要額（標準的な行政に必要なお金）\n・足りない分は、地方交付税（国から配られるお金）で補われます\n\n## 📏 目安\n🟢 0.70以上 → 税収などでまかなえる割合が大きい\n🔵 0.45〜0.70 → 全国の中では標準的\n🟡 0.25〜0.45 → 地方交付税で補う割合が大きい\n🟠 0.25未満 → 地方交付税で補う割合が特に大きい\n・中央値：市区町村{MED:f:muni:2}／都道府県{MED:f:pref:2}\n・1.0以上は、おおむね普通交付税を受け取らない「不交付団体」にあたります（交付・不交付は各年度の値で決まるため、この平均と一致しないことがあります）\n・低いこと自体は、財政危機を意味しません。足りない分は地方交付税で補われる仕組みだからです\n・出典：総務省 主要財政指標一覧（{FY}）",unit:""},
    flex:{icon:"📊",label:"経常収支比率",desc:"毎年決まって入るお金（税や地方交付税など）のうち、毎年必ず出ていくお金（人件費・福祉の費用・借金の返済など）に使われた割合です。\n\n## 🛠️ 新しいことを始めるお金の出どころ\n・施設づくり → 借金（地方債）や国の補助金を使えます\n・災害からの復旧 → 借金を使えます\n・子育て支援など毎年かかるサービス → 原則、借金では払えません。毎年の収入でまかなう必要があります\n・急な出費 → 貯金（財政調整基金）を取り崩して対応できます\n\n## 📏 目安\n🟢 90%未満 → 全国の中では余裕があるほう\n🔵 90〜95% → 全国の中では標準的\n🟡 95〜98% → 新しいことに回せるお金が少ない\n🟠 98%以上 → 余力がほぼない\n・中央値：市区町村{MED:x:muni:1}%／都道府県{MED:x:pref:1}%\n・昭和44年（1969年）の自治省の資料では、「75%程度が妥当、80%を超えると財政の弾力性を失いつつある」とされていましたが、法律の基準ではありません。今は全国の6割以上が90%を超えています\n・出典：総務省 主要財政指標一覧（{FY}）、地方財政法 第5条",unit:"%"},
    future:{icon:"🏦",label:"将来負担比率",desc:"これから払う借金など（職員の退職金の見込みなども含む）が、毎年の収入（標準財政規模）の何%にあたるかを表す数字です。貯金など返済に充てられるお金は差し引いて計算します。\n\n## 📏 目安（市区町村）\n🟢 負担なし（「－」）\n🔵 60%未満\n🟡 60〜100%\n🟠 100%以上\n\n## 📏 目安（都道府県）\n🟢 100%未満\n🔵 100〜160%\n🟡 160〜250%\n🟠 250%以上\n・数字が小さいほど、将来払う借金が少ない状態です\n・「－」（実質ゼロ）は、返済に充てられるお金のほうが多い状態です\n・都道府県は高校・国道などを持つため、水準が高くなります（中央値{MED:u:pref:1}%）\n\n## 📜 国の基準\n・早期健全化の基準：市区町村350%以上、都道府県・政令市400%以上\n・出典：総務省 主要財政指標一覧（{FY}）、地方公共団体の財政の健全化に関する法律",unit:"%"},
    reserve:{icon:"🐧",label:"財政調整基金残高",desc:"財政調整基金は、年度ごとの歳入不足や災害などの急な出費に備える貯金です。取り崩すと減るため、毎年の歳入不足を補い続けることはできません。\n\n## 🧮 比べ方\n・金額ではなく、標準財政規模（使い道を決められるお金の標準的な総額）に対する割合で比べます\n\n## 📏 目安（市区町村・中央値{MED:rr:muni:1}%）\n🟢 20%以上\n🔵 10〜20%\n🟡 5〜10%\n🟠 5%未満\n\n## 📏 目安（都道府県・中央値{MED:rr:pref:1}%）\n🟢 10%以上\n🔵 5〜10%\n🟡 2.5〜5%\n🟠 2.5%未満\n・法律の基準はありません。総務省の平成29年の調査では、都道府県で5%以下、市町村で5〜20%とする団体が多い結果でした\n・多いほど良いとは限りません。積立の元は住民が納めた税金です\n・出典：総務省 基金残高等一覧（{FY}）",unit:"億円"},
    growth:{icon:"👥",label:"人口増減率",desc:"住民基本台帳の人口が、前の年の1月1日から何%増えたか・減ったかを表す数字です。\n\n## 🧮 増減の内訳\n・自然増減（生まれた人と亡くなった人の差）\n・社会増減（転入と転出の差など）\n\n## 📏 目安\n🟢 増加（＋0.1%以上）\n🔵 ほぼ横ばい（±0.1%未満）\n🟡 減少（−0.5%まで）\n🟠 −0.5%を超える減少\n・人口が少ない自治体は、少しの転入・転出でも率が大きく動きます\n・出典：総務省 住民基本台帳に基づく人口、人口動態及び世帯数（{PY}）",unit:"%"},
    budget:{icon:"💹",label:"歳出／歳入",desc:"自治体が1年間に受け取ったお金（歳入）と、使ったお金（歳出）の、決算の合計額です。\n\n## 💰 歳入に含まれるもの\n・地方税（住民税・固定資産税など、自治体の税収）\n・地方交付税（国から配られるお金。使い道は自由）\n・国庫支出金・都道府県支出金（国や県からの補助金など。使い道が決まっている）\n・地方債（借金）\n・繰入金（基金からの取り崩しなど）\n・繰越金（前年度から繰り越したお金）\n・使用料・手数料、寄附金（ふるさと納税など）\n\n## 💸 歳出に含まれるもの\n・民生費（福祉・子育て）\n・総務費（役所の運営・戸籍など）\n・教育費（学校・給食・図書館など）\n・土木費（道路・公園・下水道など）\n・衛生費（ごみ処理・保健など）\n・公債費（借金の返済）\n・消防費、農林水産業費、商工費、災害復旧費 など\n\n## 📏 目安\n・歳入には借金（地方債）と前年度からの繰越金も入るため、ほぼすべての自治体で歳入が歳出を上回ります\n・→ 歳入が多いことは、財政に余裕がある証拠にはなりません\n・歳出が歳入を上回るのは珍しく、不足分は翌年度の収入を前倒しして埋めることになっています（繰上充用）\n・財政の余裕は、経常収支比率と財政調整基金で見ます\n・出典：総務省 決算状況調（{FY}）",unit:"億円"},
    education:{icon:"📚",label:"教育費比率",desc:"歳出のうち、教育に使ったお金の割合です。\n\n## 🧮 教育費に含まれるもの\n・小学校費・中学校費、学校給食費、社会教育費（公民館・図書館など）、教育総務費 など\n\n## 📏 目安\n・中央値：市区町村{MED:edu:muni:1}%／都道府県{MED:edu:pref:1}%\n・都道府県は高校・特別支援学校を持つため、高くなります\n・この数字には良し悪しがないため、色分けしていません\n・出典：総務省 決算状況調（{FY}）",unit:"%"},
    childInvest:{icon:"👧",label:"子ども1人当たり投資額",desc:"教育費と児童福祉費の合計を、18歳未満の人口（15〜19歳の人数の5分の3を足して見積もり）で割った金額です。\n\n## 📏 目安\n・中央値：市区町村{MED:ch:muni:1}万円／都道府県{MED:ch:pref:1}万円\n・この数字には良し悪しがないため、色分けしていません\n・子どもの数で割るため、子どもが少ない自治体ほど大きく出ます（全国で最も高いのは{MAX:ch:0}万円）\n・出典：総務省 決算状況調（{FY}）、住民基本台帳 年齢階級別人口",unit:"万円"},
    fiscalStatus:{icon:"📋",label:"起債許可団体・早期健全化団体・財政再生団体とは",desc:"",htmlDesc:
      "財政状況を示す3つの区分です。実は2つの別々の制度に基づいています。<br>" +
      "・起債許可団体 → 地方財政法（地方債協議・許可制度）<br>" +
      "・早期健全化団体／財政再生団体 → 地方公共団体の財政の健全化に関する法律（財政健全化法）<br><br>" +
      "いずれも{FY}決算に基づく判定です。<br><br>" +
      "<span style='display:inline-block;background:#8b7ae818;color:#6b5b95;border:1px solid #8b7ae844;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>📋 起債許可団体</span><br>" +
      "実質公債費比率が18%以上になると、地方債（借金）を新しく発行する際に総務大臣・知事の許可が必要になります。<br>" +
      "現在該当：{LIST_BOND}<br><br>" +
      "<span style='display:inline-block;background:#f0a86018;color:#c07a1f;border:1px solid #f0a86044;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>⚠️ 早期健全化団体</span><br>" +
      "実質赤字比率（都道府県3.75% / 市町村11.25〜15%）・連結実質赤字比率（都道府県8.75% / 市町村16.25〜20%）・実質公債費比率（25%）・将来負担比率（都道府県・政令市400% / 市町村350%）のいずれか1つでも基準を超えると、自主的な改善計画（財政健全化計画）を作ることが義務付けられます。<br>" +
      "現在該当：{LIST_EARLY}<br><br>" +
      "<span style='display:inline-block;background:#e8506018;color:#c23b3b;border:1px solid #e8506044;border-radius:14px;padding:3px 11px;font-size:12px;font-weight:700;'>🚨 財政再生団体</span><br>" +
      "実質赤字比率（都道府県5% / 市町村20%）・連結実質赤字比率（都道府県15% / 市町村30%）・実質公債費比率（35%）のいずれか1つでも基準を超えると、国の関与のもとで確実な再生に取り組む「財政再生計画」の策定が義務付けられます（将来負担比率にはこの基準はありません）。<br>" +
      "現在該当：{LIST_RECON}",
    unit:""},
    furusato:{icon:"🎁",label:"ふるさと納税受入額",desc:"",htmlDesc:"",unit:"万円"}
  };

  function openD(key, skipPush) {
    if (typeof hkRestoreChart === "function") hkRestoreChart();   // グラフを元の位置へ戻す（2026-10-02）
    setChartLegend("", false);   // 前の画面の凡例を消す
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
      document.getElementById("shDesc").innerHTML = fiscalStatusLists(fillYears(m.htmlDesc));
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
      // ふるさと納税グラフの年度ラベル（受入額の年度）。scripts/build_furusato.py が年次更新時に自動で書き換える
      var FURU_YEARS = ["H30","R1","R2","R3","R4","R5","R6","R7"];
      document.getElementById("shTitle").textContent = m.icon+" "+m.label;
      var isPrefViewF = cur && curName === cur.p;

      var rankHtmlF = "";
      if (DB && cur) {
        if (isPrefViewF) {
          var prefListF = [];
          Object.keys(DB).forEach(function(k){ var e=DB[k]; if (k===e.p && e.fu!=null) prefListF.push({k:k,v:e.fu}); });
          var myRankPF = tieRank(prefListF, curName, false);
          if (myRankPF) {
            rankHtmlF = "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:#6dcfad18;border:1.5px solid #6dcfad44;border-radius:12px;padding:6px 14px;margin:6px 0 18px;font-size:14px;font-weight:700;color:#2a8a6a;'>" +
              mmMedalFor(myRankPF, true) + "全国 <span style='font-size:17px;'>" + myRankPF + "位</span>/" + prefListF.length + "都道府県中</div>";
          }
        } else {
          var natListF = [], prefListF2 = [];
          Object.keys(DB).forEach(function(k){
            var e = DB[k];
            if (k === e.p) return;
            if (e.fu == null) return;
            if (!(e.fu > 0) && !(e.fk > 0)) return; // データなしは順位の対象外
            natListF.push({k:k, v:e.fu});
            if (e.p === cur.p) prefListF2.push({k:k, v:e.fu});
          });
          var myRankNF = tieRank(natListF, curName, false), myRankPrefF = tieRank(prefListF2, curName, false);
          var linesF = "";
          if (myRankNF) {
            linesF += "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:#6dcfad18;border:1.5px solid #6dcfad44;border-radius:12px;padding:6px 14px;margin:0 0 6px;font-size:14px;font-weight:700;color:#2a8a6a;'>" + mmMedalFor(myRankNF, true) + "全国 <span style='font-size:17px;'>" + myRankNF + "位</span>/" + natListF.length + "自治体中</div>";
          }
          if (myRankPrefF) {
            linesF += "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:#6dcfad18;border:1.5px solid #6dcfad44;border-radius:12px;padding:6px 14px;margin:0;font-size:14px;font-weight:700;color:#2a8a6a;'>" + mmMedalFor(myRankPrefF, false) + cur.p + "内 <span style='font-size:17px;'>" + myRankPrefF + "位</span>/" + prefListF2.length + "自治体中</div>";
          }
          rankHtmlF = linesF ? (linesF + "<div style='margin-bottom:10px;'></div>") : "";
        }
      }

      var fu = cur.fu || 0, fk = cur.fk || 0;
      var fuH = (cur.fuH && cur.fuH.length) ? cur.fuH : [fu];
      var fkH = (cur.fkH && cur.fkH.length) ? cur.fkH : [fk];

      var noFuruData = !(fu > 0) && !(fk > 0);
      var diff = fu - fk;
      var mainColor = diff > 0 ? "#2a8a6a" : (diff < 0 ? "#c04030" : "#5a5a7a");
      // 「黒字・赤字」は当アプリ独自の言い方（受入額 − 住民税控除額）。総務省「ふるさと納税に関する現況調査」は
      // 2つを別々に公表していて、この言い方はしていない。説明文にも独自の言い方であることを書く（2026-10-02）
      var mainTerm = diff > 0 ? "黒字" : (diff < 0 ? "赤字" : "均衡");
      var relText;
      if (noFuruData) relText = "";
      else if (fk <= 0 && fu > 0) relText = "住民税控除額がほとんど発生しておらず";
      else if (fu >= fk*2) relText = "受入額が住民税控除額を大きく上回っており";
      else if (fu > fk) relText = "受入額が住民税控除額を上回っており";
      else if (fk >= fu*2) relText = "住民税控除額が受入額を大きく上回っており";
      else if (fk > fu) relText = "住民税控除額が受入額を上回っており";
      else relText = "受入額と住民税控除額がほぼ同水準で";

      var topSummaryHtmlF = "<div style='background:"+mainColor+"14;border:1px solid "+mainColor+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;'>" +
        "<div style='background:rgba(255,255,255,0.6);border-radius:10px;padding:8px 10px;text-align:center;'><div style='font-size:14px;color:#5a5a7a;'>受入額</div><div style='font-size:17px;font-weight:700;color:#6dcfad;'>"+fmtManOku(fu)+"</div></div>" +
        "<div style='background:rgba(255,255,255,0.6);border-radius:10px;padding:8px 10px;text-align:center;'><div style='font-size:14px;color:#5a5a7a;'>住民税控除額</div><div style='font-size:17px;font-weight:700;color:#f0876a;'>"+fmtManOku(fk)+"</div></div>" +
        "</div>" +
        (noFuruData
          ? "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+mainColor+";font-weight:700;'>"+curName+"</span>は、ふるさと納税の受入額・住民税控除額のデータがありません。</div>"
          : "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+mainColor+";font-weight:700;'>"+curName+"</span>は、"+relText+"、ふるさと納税で<span style='color:"+mainColor+";font-weight:700;'>"+mainTerm+"</span>です。</div>");
      // 指定取消しなどの事情がある自治体の注記（scripts/furusato_notes.json → fuNote）
      if (cur.fuNote && cur.fuNote.length) {
        for (var fni=0; fni<cur.fuNote.length; fni++){
          var nt = cur.fuNote[fni];
          topSummaryHtmlF += "<div style='background:#fff6e0;border:1px solid #f0c060;border-radius:10px;padding:8px 10px;margin-top:10px;font-size:15px;color:#6a5020;line-height:1.6;'>⚠️ "+nt.t+
            (nt.u ? "<div style='font-size:14px;margin-top:4px;'>出典：<a href='"+nt.u+"' target='_blank' rel='noopener' style='color:#8a6a20;'>"+(nt.s||"リンク")+"</a></div>" : "")+
            "</div>";
        }
      }
      if (fuH.length >= 2 && fuH[0] > 0) {
        var yrLabelsShortF = FURU_YEARS.slice(0, fuH.length);
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
          topSummaryHtmlF += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>📊 "+yrLabelsShortF[peakIdxF]+"年度が最も多く"+fmtManOku(maxFu)+"でした"+covidNoteF+"。その後は減少しており、直近の"+yrLabelsShortF[lastIdxF]+"年度は"+fmtManOku(fuH[lastIdxF])+"です</div>";
        } else if (ratioF >= 1.5) {
          topSummaryHtmlF += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>📈 "+yrLabelsShortF[0]+"年度から増えており、直近の"+yrLabelsShortF[lastIdxF]+"年度はおよそ"+ratioF.toFixed(1)+"倍の"+fmtManOku(fuH[lastIdxF])+"です</div>";
        } else if (ratioF <= 0.67) {
          topSummaryHtmlF += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>📉 "+yrLabelsShortF[0]+"年度から下がってきており、直近の"+yrLabelsShortF[lastIdxF]+"年度はおよそ"+(1/ratioF).toFixed(1)+"分の1の"+fmtManOku(fuH[lastIdxF])+"です</div>";
        } else if (volatileFu) {
          topSummaryHtmlF += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>📊 受入額は年によって変動が大きく、"+yrLabelsShortF[peakIdxF]+"年度が最も多い"+fmtManOku(maxFu)+"でした"+covidNoteF+"</div>";
        } else if (ratioF >= 1.15) {
          // 2026-10-02：以前は1.5倍未満の増加（例：1.4倍）も「横ばい」と書いていた
          topSummaryHtmlF += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>📈 "+yrLabelsShortF[0]+"年度から増えており、直近の"+yrLabelsShortF[lastIdxF]+"年度はおよそ"+ratioF.toFixed(1)+"倍の"+fmtManOku(fuH[lastIdxF])+"です</div>";
        } else if (ratioF <= 0.87) {
          topSummaryHtmlF += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>📉 "+yrLabelsShortF[0]+"年度から下がってきており、直近の"+yrLabelsShortF[lastIdxF]+"年度はおよそ"+Math.round((1-ratioF)*10)+"割減の"+fmtManOku(fuH[lastIdxF])+"です</div>";
        } else {
          topSummaryHtmlF += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>➡️ 受入額はこの"+fuH.length+"年で大きな変化はなく、横ばい傾向です</div>";
        }
      }
      topSummaryHtmlF += "<div style='font-size:14px;color:#7a7a90;margin-top:8px;line-height:1.6;'>※「黒字・赤字」は、受入額から住民税控除額を引いた、当アプリ独自の見方です<br>※受入額は、返礼品などの費用を引く前の金額です<br>※住民税控除額による減収は、地方交付税を受け取っている自治体では、その75%が地方交付税で補われる仕組みです</div>";
      topSummaryHtmlF += "</div>";

      // (shTopの設定はグラフ構築後にまとめて行う)

      // グラフ（受入額・住民税控除額をそれぞれ独立したグラフで表示）
      function fmtFuruShort(v){ return v>=10000 ? (Math.round(v/1000)/10)+"億" : Math.round(v)+"万"; }
      var yrLabelsF = FURU_YEARS.slice(0, fuH.length);

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
        var lastX = pts[n-1][0];
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
        "<div style='font-size:14px;font-weight:700;color:#2a8a6a;margin-bottom:2px;'>🎁 受入額の推移</div>" +
        buildMiniChart(fuH, "#6dcfad", "#3a8a6a", "#2a8a6a", "gFuruUke") +
        "</div>" +
        "<div style='background:rgba(255,255,255,0.8);border-radius:12px;padding:10px 12px;margin-bottom:14px;'>" +
        "<div style='font-size:14px;font-weight:700;color:#c05a30;margin-bottom:2px;'>💸 住民税控除額の推移</div>" +
        buildMiniChart(fkH, "#f0876a", "#b06a40", "#c05a30", "gFuruKojo") +
        "</div>" +
        "<div style='font-size:14px;color:#9090a8;text-align:center;margin-bottom:14px;'>※それぞれ別スケールで表示しています</div>";

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
      var natTotalOkuF = fmtOku(Math.round(natTotalF / 10000));

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
          "<div style='flex:1;min-width:0;'><div style='font-size:14px;font-weight:700;color:#2c2c3c;'>"+escapeHtml(row.name)+mmChip+"</div><div style='font-size:14px;color:#9a97b5;'>"+escapeHtml(row.pref||"")+"</div></div>" +
          "<div style='font-size:15px;font-weight:700;color:#2a8a6a;white-space:nowrap;'>"+fmtManOku(row.fu)+"</div>" +
        "</div>";
      }).join("");
      var furuRankBoxHtml = "<div id='furuRankBox' style='display:"+(furuRankOpen?"block":"none")+";margin-top:10px;'>" +
        "<div style='font-size:14px;color:#9090a8;margin-bottom:8px;'>受入額 TOP10（"+FURU_YEARS[FURU_YEARS.length-1]+"年度・総務省公表データ）</div>" +
        topFuRowsHtml +
      "</div>";

      var descHtmlF = "<div style='font-size:15px;color:#3a3a4a;line-height:1.8;margin-bottom:14px;'>" +
        "生まれ故郷や応援したい自治体に寄附をすると、返礼品がもらえ、翌年の住民税・所得税が控除される制度です。寄附する自治体は自由に選べます。" +
        "</div>" +
        "<div style='background:#eeecf8;border:1px solid #dcd8ee;border-radius:14px;padding:14px 16px;margin-bottom:16px;'>" +
        "<div style='font-size:15px;color:#3a3a4a;line-height:1.8;'><strong><span style='color:#3a6ee8;'>"+FURU_YEARS[FURU_YEARS.length-1]+"年度</span> 全国のふるさと納税受入額は約<span style='color:#3a6ee8;font-size:16px;'>" + natTotalOkuF + "</span>です。</strong></div>" +
        "<div style='text-align:center;margin-top:10px;'><button type='button' onclick=\"furuToggleRank()\" style='display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#f7b955,#f0876a);color:#fff;font-weight:700;font-size:15px;border:none;border-radius:999px;padding:9px 16px;box-shadow:0 3px 8px rgba(240,135,106,0.35);cursor:pointer;font-family:inherit;'><span id='furuRankBtnLabel'>"+(furuRankOpen?"🏆 全国ランキングTOP10 ▲":"🏆 全国ランキングTOP10 ▶")+"</span></button></div>" +
        furuRankBoxHtml +
        "</div>" +
        "<div style='font-size:15px;color:#3a3a4a;line-height:1.8;'>" +
        "ふるさと納税には、方向が逆の2つのお金の動きがあります。<br><br>" +
        "<span style='display:inline-block;background:#6dcfad18;color:#2a8a6a;border-radius:8px;padding:2px 8px;font-weight:700;font-size:15px;'>🎁 受入額</span><br>" +
        "全国の人がこの自治体に寄附した金額の合計（＝この自治体の収入）。返礼品や経費を引く前の総額です。<br><br>" +
        "<span style='display:inline-block;background:#f0876a18;color:#c05a30;border-radius:8px;padding:2px 8px;font-weight:700;font-size:15px;'>💸 住民税控除額</span><br>" +
        "逆に、この自治体に住む人が「他の自治体」に寄附したことで、この自治体に入るはずだった住民税が差し引かれた金額（＝この自治体にとっての減収）。<br><br>" +
        "総務省は、この2つを別々に公表しています。当アプリでは、<strong>受入額 − 住民税控除額</strong> がプラスなら「黒字」、マイナスなら「赤字」と呼んでいます（当アプリ独自の言い方です）。<br><br>" +
        "・受入額からは、返礼品の調達・送付や広報などの費用がかかります<br>" +
        "・住民税控除額による減収は、地方交付税を受け取っている自治体では、その75%が地方交付税で補われる仕組みです（受け取っていない不交付団体は補われません）<br>" +
        "・受け入れた寄附金は、地方交付税の計算では収入に数えられません<br>" +
        "・出典：参議院事務局「立法と調査」No.371（2015年12月）" +
        "</div>" +
        "<div style='font-size:14px;color:#7a7a9a;margin-top:10px;text-align:right;'>📋 総務省「ふるさと納税に関する現況調査」| <a href='https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/080430_2_kojin.html' target='_blank'>総務省公式</a></div>";

      document.getElementById("shDesc").innerHTML = "<div style='border-top:1px dashed #d8d5e8;margin:22px 0;'></div><div style='font-size:16px;font-weight:700;color:#3a6ee8;margin-bottom:8px;'>ふるさと納税とは？</div>" + descHtmlF;

      document.getElementById("ovEl").classList.remove("hidden");
      return;
    }
    // 将来負担比率(u)は総務省の資料で「充当可能財源等が将来負担額を上回る（＝負担なし）」場合に
    // 数値ではなく「－」で公表されており、取り込み時にnullになっている。これは欠測ではなく
    // 実質0%（負担なし）を意味するため、以後この値を扱う箇所ではnullを0として扱う。
    var val = key==="health"?calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs):key==="fiscalPower"?cur.f:key==="debt"?cur.d:key==="flex"?cur.x:key==="future"?(cur.u==null?0:cur.u):key==="reserve"?cur.r:key==="budget"?(cur.eo||0):key==="education"?(cur.edu||0):key==="childInvest"?(cur.ch||0):cur.g;
    var isPrefView = curName === cur.p;
    // 履歴キーの「_r」の後ろの数字は令和の年（年度）そのもの（pop_r1＝令和元年）。データは毎年
    // 追加していき、件数は全部数える（MAX_HIST）。グラフには直近の8点（履歴7＋最新1）だけを表示する（SHOW_HIST）。
    // ラベルは「R」＋キーの数字から作るので、年が増えてもラベルと値がずれない（2026-09-29）。
    var MAX_HIST = 40;
    var SHOW_HIST = 7;
    function countHist(prefix, startIdx) {
      var n = 0;
      for (var i = startIdx; i < startIdx + MAX_HIST; i++) {
        if (Object.prototype.hasOwnProperty.call(cur, prefix + "_r" + i)) n++;
        else break;
      }
      return n;
    }
    var histCountFiscal = countHist("f", 1);
    // 人口増減率も、実際にはg_r1（令和元年）に実データが存在するため、他の指標と同じくR1始まりに統一。
    // （2026-09-20：以前はg_r1が存在しない前提でR2始まりだったが、全1,786/1,788自治体で
    //   実データが確認できたため、取得開始位置を1に修正。取得開始位置と件数カウントの起点は必ず揃えること）
    var growthStartIdx = 1;
    // 歳出・歳入(eo/ei)は、過去のデータ移行時の事故でeo_r1・ei_r1が実在せず、
    // 本物の履歴データはeo_r2から始まる（2026-09-23：eo/eiのラベル入れ替わり・
    // 重複データを総務省の実データで修正した際に判明。取得開始位置と件数カウントの
    // 起点は必ず揃えること）。
    var budgetStartIdx = 2;
    var histCountGrowth = (key==="reserve"||key==="education"||key==="childInvest") ? countHist(key==="education"?"edu":key==="childInvest"?"ch":"r", growthStartIdx) : countHist("g", growthStartIdx);
    var vals = [];
    var yrs;
    // f・x・d・health・reserve・education・childInvest・growthは、すべて令和元年始まりの実績データ
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
          // その年度の5指標で計算する（2026-10-02：以前は将来負担比率と基金残高だけ最新の値を使っていて、
          // 過去の点数がその年度の実際の指標と合っていなかった）。
          // 標準財政規模は、過去の年度の値を持っていないため、いちばん近い年度の値を使う
          // （sfs_r1＝最新の1年前の年度。それより前の年度は sfs_r1、無ければ最新の値）。グラフの注記にも書く
          var f=cur["f"+suffix], d=cur["d"+suffix], x=cur["x"+suffix], rH=cur["r"+suffix];
          var sfsH = cur.sfs_r1 != null ? cur.sfs_r1 : cur.sfs;
          return (f!=null&&d!=null&&x!=null&&rH!=null)?calcH(f,d,x,cur["u"+suffix],rH,null,cur.__pref,sfsH):null;
        }
        return null;
      };
      var mainVal = key==="fiscalPower"?cur.f:key==="debt"?cur.d:key==="flex"?cur.x:key==="future"?(cur.u==null?0:cur.u):key==="health"?calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs):null;
      var histDecimals = key==="fiscalPower" ? 2 : 1;
      var fiscalFrom = Math.max(1, N - SHOW_HIST + 1);
      for (var hi=fiscalFrom; hi<=N; hi++) {
        var v2 = getVal(hi);
        vals.push(v2!=null ? parseFloat(parseFloat(v2).toFixed(histDecimals)) : null);
      }
      vals.push(mainVal!=null ? parseFloat(parseFloat(mainVal).toFixed(histDecimals)) : null);
      yrs = [];
      for (var hy=fiscalFrom; hy<=N; hy++) yrs.push("R"+hy);
      yrs.push("R"+(N+1)+"（最新）");
    } else if (hasGrowthHistory) {
      var N2 = histCountGrowth;
      var fieldPrefix = key==="growth"?"g":key==="reserve"?"r":key==="education"?"edu":"ch";
      var decimals = key==="growth" ? 2 : 1;
      var gMain = key==="growth"?cur.g:key==="reserve"?cur.r:key==="education"?cur.edu:cur.ch;
      var growthFrom = growthStartIdx + Math.max(0, N2 - SHOW_HIST);
      for (var gi=growthFrom; gi<growthStartIdx+N2; gi++) {
        var v3 = cur[fieldPrefix+"_r"+gi];
        vals.push(v3!=null ? parseFloat(parseFloat(v3).toFixed(decimals)) : null);
      }
      vals.push(gMain!=null ? parseFloat(gMain.toFixed(decimals)) : null);
      yrs = [];
      for (var gy2=growthFrom; gy2<growthStartIdx+N2; gy2++) yrs.push("R"+gy2);
      yrs.push("R"+(N2+growthStartIdx)+"（最新）");
    } else {
      // 過去の実績データが1件も無い場合：以前はサインカーブで「それっぽい」架空の推移を
      // 描いていたが、実データではないので誤解を招く。架空データは作らず、
      // グラフ自体を「データなし」表示にする（下のnoRealHistoryフラグで分岐）。
      yrs = [];
    }
    var noRealHistory = (!hasHistory && !hasGrowthHistory);
    var reserveRatio = (cur && cur.sfs && cur.sfs > 0) ? (cur.r / cur.sfs * 100) : null;
    // グラフの色は、トップ画面のカードと同じ関数で決める（2026-10-02：以前はここだけ古い基準が残っていて、
    // カードは青なのにグラフは黄色、のように色が食い違っていた。都道府県の基金の色も市区町村の基準になっていた）
    var cmap = {
      health: HEALTH_LABELS[healthState(val)][1],
      debt: colorD(val),
      fiscalPower: colorF(val),
      flex: colorX(val),
      future: val >= uLimitOf(cur, isPrefView) ? "#d0505a" : colorU(val, isPrefView),
      reserve: colorR(reserveRatio, isPrefView),
      growth: colorG(val)
    };
    var c = cmap[key]||"#a08be8";   // 教育費比率・子ども投資額・歳出／歳入は、良し悪しを判定しないので中立色
    // グラフの線色は薄い色（黄・水色など）だと数値の文字が読みにくいため、文字専用に濃い色を用意する（TEXT_COLOR_MAPは共通定義）
    var cText = TEXT_COLOR_MAP[c] || c;
    document.getElementById("shTitle").innerHTML = escapeHtml(m.icon+" "+m.label) + (META_ONELINE[key] ? "<div style='font-size:15px;font-weight:400;color:#222;margin-top:4px;'>"+escapeHtml(META_ONELINE[key])+"</div>" : "");
    // ランキング（自治体は同一都道府県内、都道府県は全国47都道府県内）
    var rankHtml = "";
    var rankableKeys = {fiscalPower:1,debt:1,flex:1,future:1,reserve:1,health:1};
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
      if (isPrefView) {
        if (list.length) {
          var myRank = tieRank(list, curName, lowerBetter);
          if (myRank) {
            var pct = myRank / list.length;
            var rankColor = pct<=0.2 ? "#6dcfad" : pct<=0.5 ? "#7bb8e8" : pct<=0.8 ? "#f0c46a" : "#f0876a";
            rankHtml = "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:"+rankColor+"18;border:1.5px solid "+rankColor+"44;border-radius:12px;padding:6px 14px;margin:6px 0 18px;font-size:14px;font-weight:700;color:"+rankColor+";'>"+mmMedalFor(myRank, true)+"全国 <span style='font-size:17px;'>"+myRank+"位</span>/"+list.length+"都道府県中</div>";
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
        var myRankN = tieRank(natListG, curName, lowerBetter), myRankP = tieRank(list, curName, lowerBetter);
        var linesG = "";
        if (myRankN) {
          var pctN = myRankN/natListG.length;
          var colorN = pctN<=0.2 ? "#6dcfad" : pctN<=0.5 ? "#7bb8e8" : pctN<=0.8 ? "#f0c46a" : "#f0876a";
          linesG += "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:"+colorN+"18;border:1.5px solid "+colorN+"44;border-radius:12px;padding:6px 14px;margin:0 0 6px;font-size:14px;font-weight:700;color:"+colorN+";'>"+mmMedalFor(myRankN, true)+"全国 <span style='font-size:17px;'>"+myRankN+"位</span>/"+natListG.length+"自治体中</div>";
        }
        if (myRankP) {
          var pctP = myRankP/list.length;
          var colorP = pctP<=0.2 ? "#6dcfad" : pctP<=0.5 ? "#7bb8e8" : pctP<=0.8 ? "#f0c46a" : "#f0876a";
          linesG += "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:"+colorP+"18;border:1.5px solid "+colorP+"44;border-radius:12px;padding:6px 14px;margin:0;font-size:14px;font-weight:700;color:"+colorP+";'>"+mmMedalFor(myRankP, false)+cur.p+"内 <span style='font-size:17px;'>"+myRankP+"位</span>/"+list.length+"自治体中</div>";
        }
        rankHtml = linesG ? (linesG + "<div style='margin-bottom:10px;'></div>") : "";
      }
    }

    // 将来負担比率が「－」（実質ゼロ）の団体は全部が同じ値なので、順位ではなく団体数を出す（2026-10-02）
    if (key === "future" && (cur.u == null || cur.u <= 0)) {
      var uZeroN = Object.keys(DB).filter(function(k){ var e = DB[k]; return (k === e.p) === isPrefView && (e.u == null || e.u <= 0); }).length;
      rankHtml = "<div style='display:flex;width:fit-content;align-items:center;gap:6px;background:#6dcfad18;border:1.5px solid #6dcfad44;border-radius:12px;padding:6px 14px;margin:6px 0 18px;font-size:14px;font-weight:700;color:#2a8a6a;'>将来負担なし（全国で" + uZeroN.toLocaleString() + (isPrefView ? "都道府県" : "団体") + "）</div>";
    }
    // 総合健全度スコアが近い自治体（自治体は同一都道府県内、都道府県は全国）
    var peersHtml = "";
    var curTypeLabel = "";
    if (key === "health" && cur && DB) {
      var myScore = calcH(cur.f,cur.d,cur.x,cur.u,cur.r,cur.eo,cur.__pref,cur.sfs);
      var peerType = function(e){
        // 財政力指数は説明文の目安（0.70以上／0.45以上／それ未満）、将来負担比率は「－」（実質ゼロ）／軽め／重め
        // （2026-10-02：以前は別の区切り（1.0・0.6）で、カードが「標準的」の自治体に「財政力低め」と出ていた。
        //   また将来負担比率「－」を「借金なし」と書いていたが、借金がないという意味ではない）
        var fLv = e.f>=0.70 ? "財政力高め" : e.f>=0.45 ? "財政力標準" : "財政力低め";
        var uLv = (e.u==null||e.u<=0) ? "将来負担なし" : futureBurdenHigh(e.u, !!e.__pref) ? "将来負担重め" : "将来負担軽め";
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
            "<div style='font-size:15px;font-weight:700;color:#6050a8;'>"+p.k+" "+p.s+"点</div>" +
            "<div style='font-size:14px;color:#9080b0;margin-top:2px;'><strong style='color:#6a3de8;'>"+num+"</strong> "+p.type+"</div>" +
            "</div>";
        }).join("");
        var peersLabel = isPrefView ? "🐧 全国でスコアが近い都道府県" : ("🐧 "+cur.p+"内でスコアが近い自治体");
        peersHtml = "<div style='background:rgba(232,160,150,0.1);border:1.5px solid rgba(232,160,150,0.3);border-radius:10px;padding:10px 12px;'>" +
          "<div style='font-size:15px;color:#c07050;font-weight:700;margin-bottom:6px;'>"+peersLabel+"</div>" +
          "<div style='font-size:15px;color:#7050a0;background:rgba(160,139,232,0.12);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-weight:600;'>※同じ点数でも内訳の組み合わせが違うと、<strong style='color:#6a3de8;'>A〜I</strong>の9タイプに分かれます</div>" +
          "<div>"+chips+"</div></div>";
      }
      var myNum = circled[(typeNums[myType]-1) % circled.length];
      curTypeLabel = "<strong style='color:#6a3de8;'>"+myNum+"</strong> "+myType;
    }

    var descSrc = fillYears(m.desc);
    // 「目安」の見出しを目立たせる（「## 見出し」形式でない説明文＝総合スコア用）
    function chipifyHeaders(text) {
      text = text.replace(/目安[^\n]*/g, function(m){
        return "<span style='display:inline-block;background:#8b7ae818;color:#6b5b95;border:1px solid #8b7ae844;border-radius:14px;padding:3px 11px;font-size:14px;font-weight:700;'>"+m+"</span>";
      });
      return text;
    }
    var topSummaryHtml = "";
    // 説明文の書式（2026-10-01）：「## 見出し」は太字の見出し、「・」は小さめの補足、🟢🔵🟡🟠 は目安の1行。空行で区切る
    function renderDescMarkup(text) {
      return text.split("\n").map(function(line){
        if (line === "") return "<div style='height:10px;'></div>";
        if (line.indexOf("## ") === 0) return "<div style='font-size:16px;font-weight:700;color:#3a2a6e;margin:6px 0 4px;'>" + line.slice(3) + "</div>";
        if (line.charAt(0) === "・") return "<div style='font-size:15px;color:#5a5a70;line-height:1.7;padding-left:1em;text-indent:-1em;'>" + line + "</div>";
        return "<div style='font-size:16px;color:#2a2a3a;line-height:1.8;'>" + line + "</div>";
      }).join("");
    }
    var descHtml = descSrc.indexOf("\n## ") >= 0 ? renderDescMarkup(descSrc) : chipifyHeaders(descSrc).replace(/\n/g,"<br>");
    // 「🏠 ◯◯の状況」＋みっちーチェック＋グラフの置き場所＋「🔍 内訳から分かること」をまとめた枠
    var sitBoxHtml = function(color) {
      var sit = situationHtml(key, cur, isPrefView, curName);
      var body = sit + (sit ? mitchieHitokoto(key, curName, isPrefView) + HK_CHART_SLOT : "") + breakdownHtml(key, cur, isPrefView, curName);
      return body ? "<div style='background:"+color+"14;border:1px solid "+color+"55;border-radius:12px;padding:12px 14px;'>" + body + "</div>" : "";
    };
    if (key === "reserve" && cur && cur.sfs && cur.sfs > 0) {
      var ratio = cur.r / cur.sfs * 100;
      topSummaryHtml += sitBoxHtml(colorR(ratio, isPrefView));
      if (KK && KK[curName] && KK[curName].ka4 != null) {
        var ka4v = KK[curName].ka4;
        topSummaryHtml += kkCrossBox("🔗 公会計と比べてみると",
          "財政調整基金残高", ratio.toFixed(1)+"%", reserveLevelLabel(ratio, isPrefView),
          "純資産比率", ka4v+"%", kkMedianJudge(ka4v, isPrefView ? KK_MEDIANS.ka4.pref : KK_MEDIANS.ka4.muni),
          crossInsight("ka4", cur, KK[curName], isPrefView),
          false, "純資産比率", trendWithMeaning("ka4", kkTrendText(KK[curName], "ka4", "")));
        topSummaryHtml += KK_CROSSCHECK_CAVEAT;
      }
    }
    if (key === "growth" && cur && cur.pop) {
      // 人口の説明文（2026-09-29 作り直し）
      // 以前は「前年比の増減率」1年分だけで警告を出し、推移も増減率どうしの差で
      // 「大きく減少」と書いていたため、人口が長期的に増えている自治体でも
      // 減っているように読めてしまっていた（例：姶良市）。
      // そこで「令和元年からの人口の実数の変化（累計）」と「直近1年の増減率」の
      // 2つを軸にして、組み合わせで文章を選ぶ。
      //   増減の幅の目安（年率）：±0.1%未満→ほぼ横ばい／0.5%未満→緩やかに／1%未満→（修飾なし）／1%以上→大きく
      var gLevel = function(rate) {
        if (rate == null || isNaN(rate)) return null;
        var a = Math.abs(rate);
        if (a < 0.1) return "flat";
        if (a < 0.5) return rate > 0 ? "upSlight" : "downSlight";
        if (a < 1.0) return rate > 0 ? "up" : "down";
        return rate > 0 ? "upLarge" : "downLarge";
      };
      var gWord = function(level) {
        return {flat:"ほぼ横ばい", upSlight:"緩やかに増加", downSlight:"緩やかに減少", up:"増加", down:"減少", upLarge:"大きく増加", downLarge:"大きく減少"}[level];
      };
      var fmtPct2 = function(v) { return (v >= 0 ? "+" : "") + v.toFixed(2) + "%"; };
      var fmtPpl = function(v) { return (v >= 0 ? "+" : "-") + Math.abs(v).toLocaleString() + "人"; };
      var reiwaLabel = function(n) { return "令和" + (n === 1 ? "元" : String(n)) + "年"; };
      var popStr = cur.pop.toLocaleString();
      var gSign = cur.g >= 0 ? "+" : "";
      // 最新年の人口が前年とまったく同じで、増減率も0%の場合は、総務省の公表値で前年の値が
      // そのまま使われている可能性が高い（2026-09-29：西米良村・喜茂別町の令和8年で確認）。
      // この場合は「ほぼ横ばい」とは判定せず、注記を出して長期の推移で説明する。
      var prevPopForCarry = cur["pop_r" + countHist("pop", 1)];
      var popCarry = cur.g === 0 && prevPopForCarry != null && Math.round(prevPopForCarry) === Math.round(cur.pop);
      var latestLv = popCarry ? null : gLevel(cur.g);
      var isUpLv = function(lv){ return lv === "upSlight" || lv === "up" || lv === "upLarge"; };
      var isDownLv = function(lv){ return lv === "downSlight" || lv === "down" || lv === "downLarge"; };
      var popColor = popCarry ? "#a08be8" : colorG(cur.g);   // トップ画面のカードと同じ色
      // ハードコードした年号ではなく、実際に読み込まれているデータの件数から
      // 現在値の対象年（令和何年か）を動的に算出する（来年以降の更新で年号が取り残されないように）。
      // 人口(pop)の年号なので、g基準ではなく pop 自身の実データ件数(countHist("pop",1))を基準に算出する。
      // ※pop_r1＝令和元年、pop_r6＝令和6年…のように、_rの後ろの数字がそのまま令和の年を表す。
      var curPopReiwaNum = countHist("pop", 1) + 1;
      var curPopReiwaLabel = curPopReiwaNum === 1 ? "元" : String(curPopReiwaNum);
      topSummaryHtml += "<div style='background:"+popColor+"14;border:1px solid "+popColor+"55;border-radius:12px;padding:12px 14px;'>" +
        "<div style='font-size:16px;font-weight:700;color:#3a2a6e;margin-bottom:6px;'>🏠 "+escapeHtml(curName)+"の状況</div>" +
        "<div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+popColor+";font-weight:700;'>"+curName+"</span>の人口は"+popStr+"人（令和"+curPopReiwaLabel+"年1月1日時点）。前年比<span style='color:"+popColor+";font-weight:700;'>"+gSign+cur.g.toFixed(2)+"%</span>"+(latestLv ? "（"+gWord(latestLv)+"）" : "")+"です。</div>";
      if (popCarry) {
        topSummaryHtml += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>ℹ️ 令和"+curPopReiwaLabel+"年の人口は、前年と同じ値で公表されています。実際の増減を表していない場合があります。</div>";
      }

      // ---- 人口動態：前の年の1年間の自然増減・社会増減（2026-10-01）----
      // 総務省「住民基本台帳に基づく人口、人口動態及び世帯数」の同じ表の数字だけを使う（理由の推測はしない）。
      // 社会増減には転入・転出のほかに「その他」（住民票の記載・消除のその他）も含まれるため、（転入／転出など）と書く。
      var pdv = cur.pd;
      if (pdv && !popCarry && pdv.nat + pdv.soc === pdv.chg) {
        var pdYear = reiwaLabel(curPopReiwaNum - 1);
        var sgn = function(v){ return (v > 0 ? "＋" : v < 0 ? "−" : "±") + Math.abs(v).toLocaleString() + "人"; };
        var natW = pdv.nat < 0 ? "自然減" : "自然増", socW = pdv.soc < 0 ? "社会減" : "社会増";
        var natD = pdv.nat < 0 ? "亡くなった人が生まれた人より多い分" : "生まれた人が亡くなった人より多い分";
        var socD = pdv.soc < 0 ? "転出が転入より多い分" : "転入が転出より多い分";
        var row = function(w, d, v, detail){
          return "<div style='margin-top:8px;padding:8px 12px;background:#ffffffb0;border-radius:10px;'>" +
            "<div style='font-size:16px;color:#2a2a3a;'>" + w + "<span style='font-size:14px;color:#7a7a90;'>（" + d + "）</span></div>" +
            "<div style='font-size:20px;font-weight:700;color:#2a2a3a;margin-top:2px;'>" + sgn(v) + "</div>" +
            "<div style='font-size:15px;color:#5a5a70;'>" + detail + "</div></div>";
        };
        var stTxt, stCol;
        if (pdv.nat < 0 && pdv.soc > 0) {
          if (pdv.chg < 0) { stTxt = "亡くなる人が生まれる人を上回っていますが、転入による増加で、自然減の約" + Math.floor(pdv.soc / -pdv.nat * 10) + "割を補っている状態です"; }
          else { stTxt = "亡くなる人が生まれる人を上回っていますが、転入による増加がそれを上回り、人口が増えている状態です"; }
        } else if (pdv.nat < 0 && pdv.soc < 0) stTxt = "自然減と社会減の両方で、人口が減っている状態です";
        else if (pdv.nat > 0 && pdv.soc > 0) stTxt = "自然増と社会増の両方で、人口が増えている状態です";
        else if (pdv.nat > 0 && pdv.soc < 0) stTxt = "生まれる人は亡くなる人より多いものの、転出が転入を上回っている状態です";
        else stTxt = null;
        // 状態の一文の色：カードの色の判定（増加・横ばいは青、減少は赤）にそろえる
        stCol = (latestLv === "flat" || isUpLv(latestLv)) ? "#1a56b0" : "#c62828";
        if (pdv.nat < 0 && pdv.soc > 0 && pdv.chg < 0 && Math.floor(pdv.soc / -pdv.nat * 10) < 1) stTxt = "亡くなる人が生まれる人を上回り、転入による増加はわずかな状態です";
        topSummaryHtml += "<div style='margin-top:12px;padding-top:10px;border-top:1px dashed " + popColor + "55;'>" +
          "<div style='font-size:16px;color:#2a2a3a;'>" + pdYear + "の1年間で、人口は<b style='font-size:18px;'>" + Math.abs(pdv.chg).toLocaleString() + "人" + (pdv.chg < 0 ? "減りました" : pdv.chg > 0 ? "増えました" : "変わりませんでした") + "</b></div>" +
          row(natW, natD, pdv.nat, "生まれた人 " + pdv.b.toLocaleString() + "人／亡くなった人 " + pdv.dth.toLocaleString() + "人") +
          row(socW, socD, pdv.soc, "転入 " + pdv["in"].toLocaleString() + "人／転出 " + pdv.out.toLocaleString() + "人など") +
          (stTxt ? "<div style='font-size:16px;font-weight:700;color:" + stCol + ";margin-top:10px;line-height:1.7;'>→ " + stTxt + "</div>" : "") +
          "</div>";
      }

      // ---- 令和元年からの累計（人口の実数で比べる） ----
      // 人口の実数は年によって欠けている自治体があるため（令和元年・6年・7年だけ等）、
      // 実数がある最も古い年と最新を比べる。
      var popAt = function(y){ return y === curPopReiwaNum ? cur.pop : cur["pop_r"+y]; };
      var cumFromY = null;
      for (var py = Math.max(1, curPopReiwaNum - SHOW_HIST); py < curPopReiwaNum; py++) { if (popAt(py) != null) { cumFromY = py; break; } }
      var cumPpl = null, cumPct = null, cumAnnual = null, cumLv = null;
      if (cumFromY != null) {
        var pFrom = popAt(cumFromY);
        cumPpl = Math.round(cur.pop - pFrom);
        cumPct = (cur.pop - pFrom) / pFrom * 100;
        cumAnnual = cumPct / (curPopReiwaNum - cumFromY);
        // 念のための整合チェック：同じ期間の「毎年の増減率」を積み上げた値と大きく食い違う場合は、
        // 統計の基準が年によって違う可能性があるため、累計の文章は出さない
        var prod = 1, prodOk = true;
        for (var gy = cumFromY + 1; gy <= curPopReiwaNum; gy++) {
          var gv = gy === curPopReiwaNum ? cur.g : cur["g_r"+gy];
          if (gv == null) { prodOk = false; break; }
          prod *= 1 + gv / 100;
        }
        if (prodOk && Math.abs((prod - 1) * 100 - cumPct) > 1.0) { cumPpl = null; cumPct = null; cumAnnual = null; }
        else cumLv = gLevel(cumAnnual);
      }
      if (cumLv && curPopReiwaNum - cumFromY >= 2) {
        var spanYrs = curPopReiwaNum - cumFromY;
        var cumIcon = cumLv === "flat" ? "➡️" : isUpLv(cumLv) ? "📈" : "📉";
        var cumVerb = cumLv === "flat" ? "ほぼ横ばい" : {upSlight:"緩やかに増えました", downSlight:"緩やかに減りました", up:"増えました", down:"減りました", upLarge:"大きく増えました", downLarge:"大きく減りました"}[cumLv];
        var cumLine = cumIcon + " " + reiwaLabel(cumFromY) + "からの" + spanYrs + "年間で、人口は" + fmtPpl(cumPpl) + "（" + fmtPct2(cumPct) + "）" + (cumLv === "flat" ? "で、ほぼ横ばいです" : cumVerb) + "。";
        // 直近で流れが変わっている場合（増えてきたが直近2年以上減っている、など）は、山・谷の年を添える
        var runDir = 0, runLen = 0;
        for (var ry = curPopReiwaNum; ry > cumFromY; ry--) {
          var rv = ry === curPopReiwaNum ? cur.g : cur["g_r"+ry];
          var rd = rv == null ? 0 : rv > 0 ? 1 : rv < 0 ? -1 : 0;
          if (rd === 0) break;
          if (runDir === 0) runDir = rd;
          if (rd !== runDir) break;
          runLen++;
        }
        var turnY = curPopReiwaNum - runLen;
        if (runLen >= 2 && turnY > cumFromY && popAt(turnY) != null && ((isUpLv(cumLv) && runDir < 0) || (isDownLv(cumLv) && runDir > 0))) {
          var sinceTurn = Math.round(cur.pop - popAt(turnY));
          var sinceTurnPct = Math.abs(sinceTurn / popAt(turnY) * 100);
          cumLine += reiwaLabel(turnY) + "（" + popAt(turnY).toLocaleString() + "人）を" + (runDir < 0 ? "ピーク" : "底") + "に、直近" + runLen + "年は" + (sinceTurnPct < 0.5 ? "わずかに" : "") + (runDir < 0 ? "減っています" : "増えています") + "（" + fmtPpl(sinceTurn) + "）。";
        }
        topSummaryHtml += "<div style='font-size:16px;color:#2a2a3a;margin-top:8px;line-height:1.8;'>" + cumLine + "</div>";
      }

      if (cur.pop < 3000) {
        topSummaryHtml += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>⚠️ "+curName+"は人口が少ない（"+popStr+"人）ため、少数の転入・転出だけでも増減率が大きく振れやすい点にご注意ください。</div>";
      }
      topSummaryHtml += "</div>";
    }
    if (key === "health" && cur) {
      var h2 = calcH(cur.f, cur.d, cur.x, cur.u, cur.r, cur.eo, cur.__pref, cur.sfs);
      var hj = h2>=85?"絶好調な状態":h2>=70?"おおむね安定した状態":h2>=50?"やや課題がある状態":h2>=30?"かなり厳しい状態":"非常に危機的な状態";
      var hc = h2>=85?"#6dcfad":h2>=70?"#7bb8e8":h2>=50?"#f0c46a":h2>=30?"#f0876a":"#d0505a";
      topSummaryHtml += "<div style='background:"+hc+"14;border:1px solid "+hc+"55;border-radius:12px;padding:12px 14px;'><div style='font-size:16px;color:#2a2a3a;line-height:1.7;'><span style='color:"+hc+";font-weight:700;'>"+curName+"</span>のみっちー独自の総合スコアは<span style='color:"+hc+";font-weight:700;'>"+h2+"点</span>で、"+hj+"です。</div>" + (curTypeLabel ? "<div style='color:#8070c0;font-size:14px;margin-top:4px;'>（"+curTypeLabel+"）</div>" : "") + "</div>";
      var bdp = scoreBreakdown(cur, isPrefView);  // 総合スコアと同じ式（都道府県は都道府県の式）
      var bd_sf = bdp.f, bd_sd = bdp.d, bd_sx = bdp.x, bd_su = bdp.u, bd_sr = bdp.r;
      var bdColor = function(score, max){ return (score/max) >= 0.5 ? "#1a7a5a" : "#c02020"; };
      topSummaryHtml += "<div class='bd-toggle' onclick=\"var c=document.getElementById('bdContent');var a=document.getElementById('bdArrow');var isOpen=c.style.maxHeight&&c.style.maxHeight!=='0px';c.style.maxHeight=isOpen?'0px':'420px';a.classList.toggle('open');\" style='display:flex;justify-content:space-between;align-items:center;cursor:pointer;margin-top:10px;background:rgba(160,139,232,0.08);border-radius:10px;padding:10px 12px;font-size:14px;color:#6a3de8;font-weight:700;'>" +
        "<span>📊 内訳を見る</span><span id='bdArrow' style='transition:transform 0.2s;'>▼</span></div>" +
        "<div id='bdContent' style='max-height:0;overflow:hidden;transition:max-height 0.25s ease;font-size:14px;color:#5a5a7a;line-height:1.9;'>" +
        "<div style='padding-top:8px;'>" +
        "財政力指数 <strong style='color:"+bdColor(bd_sf,25)+";'>"+bd_sf.toFixed(1)+"点</strong>／25点満点<br>" +
        "実質公債費比率 <strong style='color:"+bdColor(bd_sd,20)+";'>"+bd_sd.toFixed(1)+"点</strong>／20点満点<br>" +
        "経常収支比率 <strong style='color:"+bdColor(bd_sx,20)+";'>"+bd_sx.toFixed(1)+"点</strong>／20点満点<br>" +
        "将来負担比率 <strong style='color:"+bdColor(bd_su,20)+";'>"+bd_su.toFixed(1)+"点</strong>／20点満点<br>" +
        "財政調整基金 <strong style='color:"+bdColor(bd_sr,15)+";'>"+bd_sr.toFixed(1)+"点</strong>／15点満点" +
        "<div style='font-size:15px;color:#7a7a90;line-height:1.7;margin-top:6px;'>※財政力指数は、自前の税収でまかなえる力を測る指標であり、自治体の財政基盤をみる重要な指標の一つとして、配点を大きく設定しています。</div>" +
        "</div></div>" +
        "<div style='border-top:2px dashed rgba(160,139,232,0.3);margin:14px 0 12px;'></div>";
      if (peersHtml) {
        topSummaryHtml += "<div class='bd-toggle' onclick=\"var c=document.getElementById('peerContent');var a=document.getElementById('peerArrow');var isOpen=c.style.maxHeight&&c.style.maxHeight!=='0px';c.style.maxHeight=isOpen?'0px':'600px';a.classList.toggle('open');\" style='display:flex;justify-content:space-between;align-items:center;cursor:pointer;background:rgba(232,160,150,0.12);border-radius:10px;padding:10px 12px;font-size:14px;color:#c07050;font-weight:700;'>" +
          "<span>🐧 スコアが近い自治体を見る</span><span id='peerArrow' style='transition:transform 0.2s;'>▼</span></div>" +
          "<div id='peerContent' style='max-height:0;overflow:hidden;transition:max-height 0.3s ease;'>" +
          "<div style='padding-top:10px;'>" + peersHtml + "</div></div>";
      }
    }
    if (key === "debt" && cur) {
      topSummaryHtml += sitBoxHtml(colorD(cur.d));
      if (KK && KK[curName] && KK[curName].ka7 != null) {
        var ka7v = KK[curName].ka7;
        topSummaryHtml += kkCrossBox("🔗 公会計と比べてみると",
          "実質公債費比率", cur.d+"%", debtLevelLabel(cur.d, isPrefView),
          "住民一人当たり負債額", ka7v+"万円", kkMedianJudge(ka7v, isPrefView ? KK_MEDIANS.ka7.pref : KK_MEDIANS.ka7.muni),
          crossInsight("ka7", cur, KK[curName], isPrefView),
          false, "住民一人当たり負債額", trendWithMeaning("ka7", kkTrendText(KK[curName], "ka7", "")));
        topSummaryHtml += KK_CROSSCHECK_CAVEAT;
      }
    }
    if (key === "fiscalPower" && cur) {
      topSummaryHtml += sitBoxHtml(colorF(cur.f));
    }
    if (key === "flex" && cur) {
      topSummaryHtml += sitBoxHtml(colorX(cur.x));
    }
    if (key === "future" && cur) {
      // 枠の色は、トップ画面のカードの色（score.js の colorU）。早期健全化基準（市区町村350%・都道府県と政令市400%）以上は赤
      topSummaryHtml += sitBoxHtml(cur.u >= uLimitOf(cur, isPrefView) ? "#d0505a" : colorU(cur.u, isPrefView));

      var kkCrossBoxShownF = false;
      var futureEntry = KK ? KK[curName] : null;
      var futureBoxCount = 0;
      ["ka3","ka1","ka6"].forEach(function(code){
        if (futureEntry && futureEntry[code] != null) {
          var boxHtml = buildFutureComboBox(code, futureEntry[code], isPrefView, cur, futureEntry, false, futureBoxCount+1);
          if (boxHtml) { topSummaryHtml += boxHtml; kkCrossBoxShownF = true; futureBoxCount++; }
        }
      });
      if (kkCrossBoxShownF) { topSummaryHtml += KK_CROSSCHECK_CAVEAT; }
    }
    if (key === "education" && cur && cur.edu!=null) {
      // 2026-09-30：「◯◯市の状況」（位置・推移・例え・意味）に置き換え。以前の「過去平均より大きく上がった
      // → 大型事業の可能性」のような推測や、最初と最後の2点だけで決めた推移は出さない
      topSummaryHtml += "<div style='background:#a08be814;border:1px solid #a08be855;border-radius:12px;padding:12px 14px;'>" +
        situationHtml("education", cur, isPrefView, curName) + breakdownHtml("education", cur, isPrefView, curName) + "</div>";
    }
    if (key === "childInvest" && cur && cur.ch!=null) {
      topSummaryHtml += "<div style='background:#a08be814;border:1px solid #a08be855;border-radius:12px;padding:12px 14px;'>" +
        situationHtml("childInvest", cur, isPrefView, curName) + breakdownHtml("childInvest", cur, isPrefView, curName);
      if (cur.pop && cur.pop < 3000 && cur.ch > 250) {
        topSummaryHtml += "<div style='font-size:15px;color:#5a5a70;margin-top:8px;line-height:1.7;'>⚠️ "+curName+"は人口が少ない（"+cur.pop.toLocaleString()+"人）ため、子どもの人数自体が少なく、1人当たりで計算すると数値が大きく出ます（人口3,000人未満の自治体の中央値は"+smallPopMed(function(k){ return DB[k].ch; }, 3000)+"万円、全国は"+DATA_STATS.ch.muni.toFixed(1)+"万円）。</div>";
      }
      topSummaryHtml += "</div>";
    }
    if (key === "budget" && cur && cur.eo && cur.ei) {
      topSummaryHtml += sitBoxHtml(cur.ei>=cur.eo ? "#6dcfad" : cur.ei>=cur.eo*0.99 ? "#7bb8e8" : "#f0876a");
    }
    document.getElementById("shTop").innerHTML = rankHtml + topSummaryHtml; if (typeof hkPlaceChart === "function") hkPlaceChart(); document.getElementById("shDesc").innerHTML = ((key==="debt"||key==="future"||key==="reserve") ? legalStatusBoxHtml(key, cur, isPrefView, curName) : "") + ((rankHtml || topSummaryHtml) ? "<div style='border-top:1px dashed #d8d5e8;margin:22px 0;'></div><div style='font-size:16px;font-weight:700;color:#3a6ee8;margin-bottom:8px;'>"+m.label+"とは？</div>" : "") + descHtml;
    var shElAfter = document.querySelector("#ovEl .sh");
    if (shElAfter) shElAfter.scrollTop = 0;
    setTimeout(function(){ var s = document.querySelector("#ovEl .sh"); if (s) s.scrollTop = 0; }, 50);
    document.querySelectorAll(".peer-chip").forEach(function(chip){
      chip.addEventListener("click", function(){
        jumpToCity(this.getAttribute("data-city"));
      });
    });
    // データが無い年（null）は、先頭・末尾はもちろん、途中の年も含めて
    // ラベル・グラフの両方から完全に取り除く（間延びした空白の目盛りを表示しない）。
    // ただし「実際の年が連続しているか」は取り除く前の位置(chartGap)で覚えておき、
    // 年が飛んでいる箇所だけは線をつながず、連続している箇所だけ線でつなぐ。
    // これにより「歯抜けは常にコンパクトな表示になり、線がつながるのは本当に連続した年だけ」で統一される。
    var chartVals = [], chartYrs = [], chartGap = [];
    if (key !== "budget") {
      var prevRealIdx = null;
      for (var tvi=0; tvi<vals.length; tvi++){
        if (vals[tvi]==null) continue;
        chartVals.push(vals[tvi]);
        chartYrs.push(yrs[tvi]);
        chartGap.push(prevRealIdx!==null && tvi!==prevRealIdx+1);
        prevRealIdx = tvi;
      }
    } else {
      chartVals = vals; chartYrs = yrs;
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
        missingNoteHtml = "<div style='font-size:14px;color:#c98a3a;background:#c98a3a14;border:1px solid #c98a3a40;border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6;'>⚠️ "+missingYearLabels.join("・")+"年度は総務省の公表データが無いため表示していません（前後の実データを直線ではつないでいません）</div>";
      }
    }
    // 過去の実績データが1件も無い場合：架空の推計線は描かず、その旨だけをはっきり伝える
    if (key !== "budget" && noRealHistory) {
      missingNoteHtml = "<div style='font-size:14px;color:#8a8a9a;background:#8a8a9a14;border:1px solid #8a8a9a33;border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6;'>📭 過去の推移データは総務省の公表資料に無いため、表示できません（現在値のみ上に表示しています）</div>";
    }
    document.getElementById("spLabels").innerHTML = yrsLabelHtml;
    if (missingNoteHtml) {
      var shDescElForNote = document.getElementById("shDesc");
      if (shDescElForNote) shDescElForNote.innerHTML = missingNoteHtml + shDescElForNote.innerHTML;
    }
    if (key === "budget") {
      // 歳出・歳入 2本線グラフ
      var eoVal = cur.eo || 0, eiVal = cur.ei || 0;
      var budgetHistCount = countHist("eo", budgetStartIdx);
      var eoVals = [], eiVals = [];
      var budgetYrs;
      var noBudgetHistory = budgetHistCount <= 0;
      if (!noBudgetHistory) {
        var budgetFrom = budgetStartIdx + Math.max(0, budgetHistCount - SHOW_HIST);
        for (var bi=budgetFrom; bi<budgetStartIdx+budgetHistCount; bi++) {
          eoVals.push(cur["eo_r"+bi] != null ? cur["eo_r"+bi] : null);
          eiVals.push(cur["ei_r"+bi] != null ? cur["ei_r"+bi] : null);
        }
        eoVals.push(eoVal); eiVals.push(eiVal);
        budgetYrs = [];
        for (var by=budgetFrom; by<budgetStartIdx+budgetHistCount; by++) budgetYrs.push("R"+by);
        budgetYrs.push("R"+(budgetHistCount+budgetStartIdx)+"（最新）");
      } else {
        // 過去の歳出入データが無い場合：以前はサインカーブで架空の推移を描いていたが、
        // 実データではないため廃止。現在値のみのグラフにし、「データなし」を明記する。
        eoVals = [eoVal]; eiVals = [eiVal];
        budgetYrs = ["R（最新）"];
      }
      // 途中の年だけ歳出・歳入データが欠測している場合も、他の指標(future/growthなど)と同じく
      // 「総務省の公表データが無い」ことを明記する（2026-09-20追加：以前はbudgetだけこの注記が無かった）。
      var budgetMissingYearLabels = [];
      if (!noBudgetHistory) {
        for (var bmi=0; bmi<budgetYrs.length; bmi++){
          if (eoVals[bmi]==null || eiVals[bmi]==null) budgetMissingYearLabels.push(budgetYrs[bmi].replace("（最新）",""));
        }
      }
      var budgetMissingNote = noBudgetHistory
        ? "<div style='font-size:14px;color:#8a8a9a;background:#8a8a9a14;border:1px solid #8a8a9a33;border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6;'>📭 過去の歳出入の推移データは総務省の公表資料に無いため、表示できません（現在値のみ上に表示しています）</div>"
        : (budgetMissingYearLabels.length ? "<div style='font-size:14px;color:#c98a3a;background:#c98a3a14;border:1px solid #c98a3a40;border-radius:10px;padding:10px 12px;margin:10px 0;line-height:1.6;'>⚠️ "+budgetMissingYearLabels.join("・")+"年度は総務省の公表データが無いため表示していません（前後の実データを直線ではつないでいません）</div>" : "");
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
      // 年が飛んでいる箇所(欠測年)は線をつながず、実際に連続している年だけ線でつなぐ
      // （他の指標(future/growthなど)と同じ「chartGap」の考え方をbudgetにも適用。2026-09-20追加）
      function mkLine(arr){
        var l=null, prevRealIdx=null;
        for(var j=0;j<arr.length;j++){
          if(arr[j]==null) continue;
          if (l===null || j!==prevRealIdx+1) {
            l = (l===null?"":l+" ") + "M"+px2(j)+","+py2(arr[j]);
          } else {
            l += " L"+px2(j)+","+py2(arr[j]);
          }
          prevRealIdx = j;
        }
        return l||"";
      }
      // 1兆円未満はカードや文章と同じ書き方（「6,917億」）。1兆円以上は幅に収まるよう「3.1兆」
      function fmtB(v){ return v>=10000 ? Math.round(v/1000)/10+"兆" : fmtOku(v).replace(/円$/, ""); }
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
      var budgetFromNum = budgetStartIdx + Math.max(0, budgetHistCount - SHOW_HIST);
      var budgetNoteFrom = budgetFromNum===1 ? "元" : String(budgetFromNum);
      var budgetNote = budgetHistCount>0 ? ("※令和"+budgetNoteFrom+"〜"+(budgetHistCount+budgetStartIdx)+"年度の実績値") : "";
      var legend="<text x='"+P+"' y='"+(svgH-2)+"' font-size='10' fill='#a08be8'>■ 歳出</text><text x='"+(P+50)+"' y='"+(svgH-2)+"' font-size='10' fill='#7bb8e8'>■ 歳入</text><text x='"+P+"' y='"+(svgH+9)+"' font-size='8' fill='#aaa'>"+budgetNote+"</text>";
      var spSvg = document.getElementById("spSvg");
      spSvg.setAttribute("viewBox","0 0 "+W+" "+(svgH+10));
      spSvg.style.height=(svgH+10)+"px";
      var covidHtml2 = eoVals.length > 1 ? covidBandSvg(budgetYrs || [], px2, W, 4, H - Pbottom2 + 14, false) : "";
      setChartLegend("", !!covidHtml2);
      spSvg.innerHTML = covidHtml2 +
        "<path d='"+eoLine+"' fill='none' stroke='#a08be8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>" +
        "<path d='"+eiLine+"' fill='none' stroke='#7bb8e8' stroke-width='2' stroke-dasharray='4,3' stroke-linecap='round' stroke-linejoin='round'/>" +
        dots2 + legend;
    } else {
    var validVals = chartVals.filter(function(v){ return v!=null; });
    // 全国の中央値の線（2026-10-01）：その年の動きが、その自治体だけか、全国でも同じかを見られるように
    var yrNum = chartYearOf;
    var medField = {fiscalPower:"f", flex:"x", debt:"d", future:"u", education:"edu", childInvest:"ch", growth:"g"}[key];
    var medVals = medField ? chartYrs.map(function(lbl){ var yn = yrNum(lbl); return yn == null ? null : histMedian(medField, yn, isPrefView, key === "growth"); }) : [];
    var medValid = medVals.filter(function(v){ return v != null; });
    var allForScale = validVals.concat(medValid);
    var mn=allForScale.length?Math.min.apply(null,allForScale):0, mx=allForScale.length?Math.max.apply(null,allForScale):0, rng=mx-mn||1;
    var W=300,H=100,P=20,Ptop=26;
    function px(i){return chartVals.length>1 ? P+(i/(chartVals.length-1))*(W-P*2) : W/2;}
    function py(v){return H-P-((v-mn)/rng)*(H-Ptop-P);}
    var line="", dots="";
    // 実際の年が飛んでいる箇所（chartGap[j]===true）はそこで線を切り、
    // 年が連続している区間だけを線でつなぐ（歯抜けの2点をいきなり直線で結ばない）。
    for(var j=0;j<chartVals.length;j++){
      line += (line?" ":"") + ((j===0 || chartGap[j]) ? "M" : "L") + px(j)+","+py(chartVals[j]);
    }
    // 数字の書き方は文章と同じ桁数にそろえる（財政力指数・人口増減率は小数2桁、ほかの%は1桁）。
    // 単位は最新の値だけに付ける（全部に付けると、隣の数字と重なって読めないため）
    var lblDecimals = (key==="fiscalPower"||key==="growth") ? 2 : (key==="health" ? 0 : 1);
    var fmtLbl = function(v, withUnit) {
      if (m.unit==="億円") return v>=10000 ? Math.round(v/1000)/10+"兆" : v+(withUnit?"億":"");
      return v.toFixed(lblDecimals) + ((withUnit && m.unit==="%") ? "%" : "");
    };
    for(var k=0;k<chartVals.length;k++){
      var last=k===chartVals.length-1;
      dots+="<circle cx='"+px(k)+"' cy='"+py(chartVals[k])+"' r='"+(last?5:3)+"' fill='"+(last?c:"white")+"' stroke='"+c+"' stroke-width='2'/>";
      var dispVal = fmtLbl(chartVals[k], last);
      var prevV = k>0 ? chartVals[k-1] : null;
      var nextV = k<chartVals.length-1 ? chartVals[k+1] : null;
      var isValley = (prevV==null || chartVals[k] <= prevV) && (nextV==null || chartVals[k] <= nextV) && (prevV!=null || nextV!=null);
      var lblAnchor = "middle";
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
      // 人口は「年」（1月1日時点）、財政は「年度」。総合スコアは各年度の指標から計算した点数
      noteText = key==="growth" ? ("※令和"+noteFrom+"〜"+noteTo+"年の実績値（各年1月1日時点）")
               : key==="health" ? "※各年度の指標で計算（基金は直近の標準財政規模比）"
               : ("※令和"+noteFrom+"〜"+noteTo+"年度の実績値");
    } else {
      // 過去の実績データが無い場合、以前はここに「※元〜4年は参考値（推計）」と出して
      // 架空の推計線を描いていたが、実データではないため廃止。注記はspLabels側の
      // 「データなし」メッセージに一本化し、グラフ領域自体は非表示にする。
      noteText = "";
    }
    // 人口増減率タブ限定：財政指標（f/d/x/u/health、年度基準）と人口（暦年基準）は
    // 総務省の別々の公表統計・別々の区切り方（年度／暦年）に基づくため、最新の対象年がズレうる。
    // ハードコードした年号ではなく、実際に読み込まれているデータの件数(histCountFiscal・
    // chartYrsの実データ末尾)から動的に算出することで、来年以降データを更新しても
    // このメッセージ自体が古いまま残って矛盾する、という事故を防ぐ。
    if (key === "growth" && hasGrowthHistory && chartYrs.length >= 1) {
      var fiscalReiwaNum = histCountFiscal + 1;
      var fiscalReiwaLabel = fiscalReiwaNum === 1 ? "元" : String(fiscalReiwaNum);
      // グラフのx軸は増減率(g)の実データ件数を基準にしているが、この文言は「人口」自体の
      // 最新年を説明するものなので、g基準(chartYrs)ではなくpop自身の実データ件数を使う。
      // g側だけ前年と数値が完全一致してスライドがスキップされるケースがあり、その場合
      // chartYrs(g基準)を使うと人口の実際の最新年より1年古い表示になってしまうため。
      var popReiwaNum2 = countHist("pop", 1) + 1;
      var popReiwaLabel = popReiwaNum2 === 1 ? "元" : String(popReiwaNum2);
      var yearNoteHtml =
        "<div style='font-size:12.5px;color:#5a5a7a;background:#eef0fb;border:1px solid #d6d9f2;border-radius:12px;padding:12px 14px;margin:10px 0;line-height:1.75;'>" +
        "<p style='margin:0 0 6px;'>ℹ️ 財政力指数などの財政指標は、総務省の決算統計に基づき「年度」（4月〜翌3月）区切りで公表されるため、最新は<b style='color:#4a4a72;'>令和"+fiscalReiwaLabel+"年度</b>です。</p>" +
        "<p style='margin:0 0 6px;'>人口は総務省「住民基本台帳に基づく人口、人口動態及び世帯数」に基づき「年」（暦年）区切りで公表されるため、最新は<b style='color:#4a4a72;'>令和"+popReiwaLabel+"年1月1日時点</b>です。</p>" +
        "<p style='margin:0;'>出典となる統計と集計期間の区切り方（年度／暦年）が異なるため、対象年が一致しない場合があります。</p>" +
        "</div>";
      var shDescElForYearNote = document.getElementById("shDesc");
      if (shDescElForYearNote) shDescElForYearNote.innerHTML = yearNoteHtml + shDescElForYearNote.innerHTML;
    }
    var spSvgEl = document.getElementById("spSvg");
    if (noRealHistory) {
      spSvgEl.innerHTML = "";
      spSvgEl.style.height = "0px";
    } else {
      spSvgEl.setAttribute("viewBox","0 0 "+W+" "+(H+10));
      spSvgEl.style.height=(H+10)+"px";
      var covidHtml = chartVals.length > 1 ? covidBandSvg(chartYrs, px, W, 14, H + 10, key === "growth") : "";
      var medHtml = "";
      if (medValid.length >= 2) {
        var mLine = "";
        medVals.forEach(function(v, i){ if (v == null) return; mLine += (mLine ? " L" : "M") + px(i) + "," + py(v); });
        medHtml = "<path d='" + mLine + "' fill='none' stroke='#9a96a8' stroke-width='1.5' stroke-dasharray='4,3'/>";
      }
      setChartLegend(medHtml ? (isPrefView ? "全国の都道府県の中央値" : "全国の市区町村の中央値") : "", !!covidHtml, noteText);
      spSvgEl.innerHTML = covidHtml+medHtml+"<path d='"+line+"' fill='none' stroke='"+c+"' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'/>"+dots;
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
  initUpdatePill();
  window.scrollTo(0, 0);

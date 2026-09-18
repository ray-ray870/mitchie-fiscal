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

  function find(q) {
    q = q.trim();
    if (!q) return null;
    if (DB[q]) return {k:q, d:DB[q]};
    if (ALIAS[q] && DB[ALIAS[q]]) return {k:ALIAS[q], d:DB[ALIAS[q]]};
    // 読み仮名（ひらがな）での完全一致検索。「こがし」のように同じ読みで違う漢字の
    // 自治体（古河市・古賀市など）が複数ある場合は、名前と同じく候補一覧を返す
    if (KANA_INDEX && KANA_INDEX[q]) {
      var kanaMatches = KANA_INDEX[q];
      if (kanaMatches.length >= 2) return {ambiguous: true, candidates: kanaMatches};
      if (kanaMatches.length === 1 && DB[kanaMatches[0]]) return {k: kanaMatches[0], d: DB[kanaMatches[0]]};
    }
    var keys = Object.keys(DB);
    // 「府中市」のように、括弧付きの正式名（府中市（東京）等）が複数該当する場合は、
    // どれか1つを無言で選ばず、候補一覧として返す（同名自治体の誤表示を防ぐ）
    var startsMatches = keys.filter(function(k){ return k.indexOf(q) === 0 && k !== q; });
    if (startsMatches.length >= 2) {
      return {ambiguous: true, candidates: startsMatches};
    }
    if (startsMatches.length === 1) {
      return {k: startsMatches[0], d: DB[startsMatches[0]]};
    }
    for (var i=0; i<keys.length; i++) {
      if (keys[i].indexOf(q)>=0 || q.indexOf(keys[i])>=0) return {k:keys[i], d:DB[keys[i]]};
    }
    return null;
  }


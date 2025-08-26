// DigiCoach 7-Stage — FIX v2 (Battles + Store + Uploads + Cache Bypass)
// Works on iPhone Safari (uploads & dialogs), adds self-test (?autotest=1), and fixes battle/store issues.

(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---------- Types & effectiveness ----------
  function typeMultiplier(att, def){
    if (att===def) return 1.0;
    if ((att==="Flame" && def==="Nature") || (att==="Nature" && def==="Aqua") || (att==="Aqua" && def==="Flame")) return 1.5;
    if ((def==="Flame" && att==="Nature") || (def==="Nature" && att==="Aqua") || (def==="Aqua" && att==="Flame")) return 0.75;
    if ((att==="Light" && def==="Shadow") || (att==="Shadow" && def==="Light")) return 1.5;
    if ((att==="Storm" && (def==="Aqua" || def==="Nature"))) return 1.2;
    return 1.0;
  }

  // ---------- Persistent game state ----------
  const state = {
    trainerName: "Trainer",
    companionName: "Buddy",
    companionType: "Flame",
    level: 1, xp: 0, coins: 0, stage: 1, mood: "🙂",
    playerHP: 120, playerHPMax: 120,
    tasks: [
      { id: "t1", text: "Hydrate (8 cups)", done: false, xp: 10, coins: 2 },
      { id: "t2", text: "Workout 20–30 min", done: false, xp: 20, coins: 5 },
      { id: "t3", text: "Focus block (25 min)", done: false, xp: 15, coins: 3 },
      { id: "t4", text: "Journal 3 lines", done: false, xp: 10, coins: 2 }
    ],
    lastDayKey: null,
    campaignDay: 1, lastCampaignKey: null, battlesToday: 0, todayPlan: ["daily","daily","daily"],
    manualBonus: 0,
    inv: { potion: 1, elixir: 0, bomb: 0, restkit: 0, xp20: 0 },
    stageImages: { "1":"", "2":"", "3":"", "4":"", "5":"", "6":"", "7":"" }
  };
  try { const saved = localStorage.getItem("digicoach_fix_all_v2"); if (saved) Object.assign(state, JSON.parse(saved)); } catch {}

  const thresholds = [1,5,12,20,30,40,55];
  const stageNames = ["Egg","In Training","Rookie","Champion","Ultimate","Mega","Grand Mega"];
  function save(){ localStorage.setItem("digicoach_fix_all_v2", JSON.stringify(state)); }
  function calcLevel(xp){ return Math.max(1, Math.floor(xp/100) + 1); }
  function stageFromLevel(level){ let idx=1; for(let i=thresholds.length-1;i>=0;i--){ if(level>=thresholds[i]){ idx=i+1; break; } } return idx; }
  function stageLabel(s){ return stageNames[s-1] || "Egg"; }
  function hpMaxForStage(s){ return 100 + s*20; }

  // ---------- Daily reset / campaign plan ----------
  const todayKey = new Date().toISOString().slice(0,10);
  const resetNoteEl = $("#dailyResetNote");
  function computePlan(day){ return (day % 3 === 0) ? ["daily","daily","boss"] : ["daily","daily","daily"]; }
  if (state.lastDayKey !== todayKey) {
    state.tasks.forEach(t => t.done = false);
    state.battlesToday = 0; state.manualBonus = 0; state.todayPlan = computePlan(state.campaignDay);
    state.lastDayKey = todayKey;
    if (resetNoteEl) resetNoteEl.textContent = "Daily reset applied ("+ todayKey +").";
  } else if (resetNoteEl) resetNoteEl.textContent = "Daily quests track for "+ todayKey +".";
  if (state.lastCampaignKey !== todayKey) {
    state.campaignDay += 1; state.lastCampaignKey = todayKey; state.todayPlan = computePlan(state.campaignDay);
    if (!localStorage.getItem("digicoach_fix_all_v2")) state.campaignDay = 1;
  }

  // ---------- UI refs ----------
  const petImg = $("#petImg"), levelEl=$("#level"), xpBar=$("#xpBar"), xpNum=$("#xpNum");
  const coinsEl=$("#coins"), moodEl=$("#mood"), stageName=$("#stageName"), typeChip=$("#typeChip");
  const buddyHPBar=$("#buddyHPBar"), buddyHPText=$("#buddyHPText");
  const taskList=$("#taskList"), taskInput=$("#taskInput"), taskXP=$("#taskXP"), taskCoins=$("#taskCoins");
  const manualBonusEl=$("#manualBonus");
  const campDayEl=$("#campDay"), battleNoEl=$("#battleNo"), battleTypeEl=$("#battleType"), extraPoolEl=$("#extraPool"), battleStatusEl=$("#battleStatus");
  const btnStartBattle=$("#btnStartBattle"), btnResumeBattle=$("#btnResumeBattle");
  const moveA=$("#moveA"), moveB=$("#moveB"), moveC=$("#moveC"), moveD=$("#moveD");
  const battleDialog=$("#battleDialog"), battleLog=$("#battleLog");
  const youName=$("#youName"), youStage=$("#youStage"), youType=$("#youType"), youHPBar=$("#youHPBar"), youHPText=$("#youHPText");
  const enemyName=$("#enemyName"), enemyStage=$("#enemyStage"), enemyType=$("#enemyType"), enemyHPBar=$("#enemyHPBar"), enemyHPText=$("#enemyHPText");
  const itemSelect=$("#itemSelect"), useItemBtn=$("#useItem");
  const storeDialog=$("#storeDialog"), storeItems=$("#storeItems");

  // ---------- Settings ----------
  $("#btnSettings")?.addEventListener("click", () => {
    $("#trainerName").value = state.trainerName;
    $("#companionName").value = state.companionName;
    $("#typeSelect").value = state.companionType;
    document.querySelector("#settingsDialog").showModal();
  });
  $("#saveSettings")?.addEventListener("click", (e) => {
    e.preventDefault();
    state.trainerName = $("#trainerName").value.trim() || state.trainerName;
    state.companionName = $("#companionName").value.trim() || state.companionName;
    state.companionType = $("#typeSelect").value;
    save(); refreshAvatar(); refreshStats(); document.querySelector("#settingsDialog").close();
  });

  // ---------- Bypass cache ----------
  $("#btnBypassCache")?.addEventListener("click", async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    location.reload(true);
  });

  // ---------- Export / Import ----------
  $("#btnExport")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "digicoach-save.json"; a.click(); URL.revokeObjectURL(url);
  });
  $("#fileImport")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => {
      try { const incoming = JSON.parse(reader.result); Object.assign(state, incoming); save(); boot(); alert("Save imported!"); } catch { alert("Invalid save file."); }
    }; reader.readAsText(file);
  });

  // ---------- Stage uploads (iPhone-friendly) ----------
  $$(".avatar-actions button").forEach(btn => {
    btn.addEventListener("click", () => {
      const stage = btn.getAttribute("data-pick");
      const input = $("#imgStage" + stage);
      if (!input) return; input.value = ""; input.click();
    });
  });
  for (let i=1;i<=7;i++){
    const el = $("#imgStage"+i);
    el?.addEventListener("change", () => {
      const f = el.files && el.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => { state.stageImages[String(i)] = rd.result; save(); refreshAvatar(); alert("Stage "+i+" image saved."); };
      rd.readAsDataURL(f);
    });
  }

  // ---------- Tasks ----------
  function renderTasks() {
    taskList.innerHTML = "";
    state.tasks.forEach((t) => {
      const li = document.createElement("li");
      li.className = "task";
      li.innerHTML = `<input type="checkbox" ${t.done ? "checked" : ""}><div class="txt">${escapeHtml(t.text)}</div><span class="badge">+${t.xp} XP · 🪙${t.coins}</span><button class="del">🗑️</button>`;
      const checkbox = li.querySelector("input");
      const del = li.querySelector(".del");
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked && !t.done) { t.done=true; state.xp+=t.xp; state.coins+=t.coins; }
        else if (!e.target.checked && t.done) { t.done=false; state.xp=Math.max(0,state.xp-t.xp); state.coins=Math.max(0,state.coins-t.coins); }
        save(); refreshStats(); refreshBattleSummary();
      });
      del.addEventListener("click", () => { state.tasks = state.tasks.filter(x => x !== t); save(); renderTasks(); refreshBattleSummary(); });
      taskList.appendChild(li);
    });
  }
  $("#addTask")?.addEventListener("click", () => {
    const txt = taskInput.value.trim(); const xp = Math.max(1, parseInt(taskXP.value||"10",10)); const coins = Math.max(0, parseInt(taskCoins.value||"2",10));
    if (!txt) return;
    state.tasks.push({ id: "t"+Math.random().toString(36).slice(2,8), text: txt, done:false, xp, coins });
    taskInput.value=""; taskXP.value="10"; taskCoins.value="2";
    save(); renderTasks(); refreshBattleSummary();
  });

  // ---------- Battle data ----------
  const MOB_NAMES = {
    1: ["Pixel Slime","Data Wisp","Shard Bug"],
    2: ["MicroBat","Byte Rat","Shadow Wisp"],
    3: ["Claw Cub","Spark Wolf","Data Hawk"],
    4: ["Steel Bear","Flame Golem","Storm Crab"],
    5: ["Chaos Wyvern","Volt Serpent","Crystal Knight"],
    6: ["Hell Titan","Storm Colossus","Void Beast"],
    7: ["Doom Leviathan","Wraith Dragon","Overlord Prime"]
  };
  function moveSet(stage, boss=false, type="Flame"){
    const s = stage, boost = boss ? 1.12 : 1.0;
    const mk = (name, a,b, mtype="atk", value=0, turns=0, elem=null) => ({name, dmg:[Math.round(a*boost), Math.round(b*boost)], type:mtype, value, turns, elem});
    const elem1 = type;
    const alt = (type==="Flame")?"Nature": (type==="Aqua")?"Storm": (type==="Nature")?"Aqua": (type==="Storm")?"Flame": (type==="Light")?"Light":"Shadow";
    switch(s){
      case 1: return [ mk("Glow Spark",5,9,"atk",0,0,elem1), mk("Quick Peck",6,10,"atk",0,0,alt), mk("Guard Up",0,0,"shield",0.4,1), mk("Focus",0,0,"buff",1.15,2) ];
      case 2: return [ mk("Pixel Bite",7,12,"atk",0,0,elem1), mk("Data Zap",8,13,"atk",0,0,alt), mk("Data Shield",0,0,"shield",0.45,1), mk("Inspire",0,0,"buff",1.2,2) ];
      case 3: return [ mk("Claw Swipe",11,17,"atk",0,0,elem1), mk("Spark Pulse",10,16,"atk",0,0,alt), mk("Howl",0,0,"buff",1.2,2), mk("Static Veil",0,0,"shield",0.5,1) ];
      case 4: return [ mk("Armor Smash",16,24,"atk",0,0,elem1), mk("Energy Wave",15,23,"atk",0,0,alt), mk("War Cry",0,0,"buff",1.25,2), mk("Aegis",0,0,"shield",0.5,2) ];
      case 5: return [ mk("Blade Storm",22,32,"atk",0,0,elem1), mk("Crystal Pierce",20,30,"atk",0,0,alt), mk("Barrier Code",0,0,"shield",0.5,2), mk("Overclock",0,0,"buff",1.25,2) ];
      case 6: return [ mk("Nova Flare",28,40,"atk",0,0,elem1), mk("Thunder Rift",26,38,"atk",0,0,alt), mk("Cyber Roar",0,0,"debuff",0.8,2), mk("Phase Guard",0,0,"shield",0.55,2) ];
      case 7: return [ mk("Digital Apocalypse",36,52,"atk",0,0,elem1), mk("Royal Burst",34,50,"atk",0,0,alt), mk("Eternal Guard",0,0,"shield",0.6,2), mk("Dominion",0,0,"buff",1.3,2) ];
      default: return [ mk("Byte Nudge",4,8,"atk",0,0,elem1), mk("Guard",0,0,"shield",0.4,1), mk("Cheer",0,0,"buff",1.1,2), mk("Nibble",4,8,"atk",0,0,alt) ];
    }
  }

  // ---------- Battle state ----------
  const battleState = {
    active:false, isBoss:false, extraPool:0,
    you:{ hp:120, hpMax:120, shield:0, atkMod:1.0, atkTurns:0, debuff:1.0, debuffTurns:0, type:"Flame" },
    enemy:{ hp:100, hpMax:100, shield:0, atkMod:1.0, atkTurns:0, debuff:1.0, debuffTurns:0, type:"Aqua" },
    youMoves:[], enemyMoves:[], enemyLabel:"", enemyStageNum:1
  };

  function tasksDone(){ return state.tasks.filter(t=>t.done).length; }
  function todaysBattleType(){ return (state.todayPlan[state.battlesToday] || "done"); }
  function setBuddyHPUI(){ buddyHPBar.style.width = Math.max(0, Math.round((state.playerHP/state.playerHPMax)*100)) + "%"; buddyHPText.textContent = `${state.playerHP}/${state.playerHPMax}`; }

  function refreshAvatar(){
    const fallback = (n)=>`data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'><rect width='100%25' height='100%25' rx='80' fill='%23b3e5fc'/><text x='50%25' y='54%25' text-anchor='middle' dominant-baseline='middle' font-size='220'>${["🥚","🌱","🐾","🛡️","⚔️","🔥","👑"][n-1]}</text></svg>`;
    const img = state.stageImages[String(state.stage)] || fallback(state.stage);
    petImg.src = img; stageName.textContent = stageLabel(state.stage); typeChip.textContent = state.companionType; setBuddyHPUI();
  }
  function refreshStats(){
    state.level = calcLevel(state.xp);
    const nextXP = state.level * 100, prevXP = (state.level-1) * 100;
    const within = state.xp - prevXP, span = Math.max(1, nextXP - prevXP);
    const pct = Math.max(0, Math.min(1, within / span));
    xpBar.style.width = (pct*100).toFixed(1) + "%"; xpNum.textContent = `${within} / ${span}`;
    levelEl.textContent = state.level; coinsEl.textContent = state.coins; moodEl.textContent = state.mood;
    const newStage = stageFromLevel(state.level);
    if (newStage !== state.stage) {
      const oldMax = state.playerHPMax;
      state.stage = newStage; state.playerHPMax = hpMaxForStage(newStage);
      state.playerHP = Math.min(state.playerHPMax, Math.round(state.playerHP * (state.playerHPMax/oldMax)));
      refreshAvatar();
    }
  }
  function refreshBattleSummary(){
    $("#campDay").textContent = state.campaignDay;
    $("#battleNo").textContent = Math.min(3, state.battlesToday+1);
    const type = todaysBattleType();
    $("#battleType").textContent = (type==="boss"?"Boss":"Daily");
    $("#extraPool").textContent = Math.min(4, tasksDone() + (parseInt(state.manualBonus)||0));
    $("#battleStatus").textContent = (state.battlesToday>=3 || type==="done") ? "All battles done" : "Ready";
    btnStartBattle.disabled = (state.battlesToday>=3 || type==="done");
    btnResumeBattle?.classList.toggle("hidden", !battleState.active);
  }
  manualBonusEl?.addEventListener("change", () => {
    state.manualBonus = Math.max(0, Math.min(4, parseInt(manualBonusEl.value||"0",10)));
    save(); refreshBattleSummary();
  });

  // ---------- Store ----------
  function renderStore(){
    const STORE = [
      { id:"potion", name:"Potion (+30 HP)", price:12, desc:"Heal 30 HP in battle.", buy: () => { state.inv.potion += 1; } },
      { id:"elixir", name:"Elixir (+1 Extra Action)", price:16, desc:"+1 extra action this battle.", buy: () => { state.inv.elixir += 1; } },
      { id:"bomb", name:"Data Bomb (20 dmg)", price:14, desc:"Instant 20 damage to enemy.", buy: () => { state.inv.bomb += 1; } },
      { id:"restkit", name:"Rest Kit (+50% HP)", price:20, desc:"Restore 50% HP when used.", buy: () => { state.inv.restkit += 1; } },
      { id:"xp20", name:"+20 XP", price:8, desc:"Instant +20 XP.", buy: () => { state.inv.xp20 += 1; } }
    ];
    storeItems.innerHTML = "";
    STORE.forEach(it => {
      const card = document.createElement("div");
      card.className = "store-item";
      card.innerHTML = `<div class="title"><strong>${it.name}</strong></div><div class="desc">${it.desc}</div><div class="row"><span>Cost: 🪙 ${it.price}</span><button data-id="${it.id}">Buy</button></div>`;
      card.querySelector("button").addEventListener("click", () => {
        if (state.coins < it.price){ alert("Not enough coins."); return; }
        state.coins -= it.price; it.buy(); save(); refreshStats(); alert(\`Purchased ${it.name}.\`); refreshItemSelect();
      });
      storeItems.appendChild(card);
    });
  }
  $("#btnStore")?.addEventListener("click", () => { renderStore(); safeShowDialog(storeDialog); });
  $("#closeStore")?.addEventListener("click", () => safeCloseDialog(storeDialog));

  // ---------- Battle helpers ----------
  function rng(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function safeShowDialog(dlg){ if (dlg && dlg.showModal) dlg.showModal(); else if (dlg) dlg.style.display='block'; }
  function safeCloseDialog(dlg){ if (dlg && dlg.close) dlg.close(); else if (dlg) dlg.style.display='none'; }
  function setHPBars(){
    const yPct = Math.max(0, Math.round((battleState.you.hp / battleState.you.hpMax) * 100));
    const ePct = Math.max(0, Math.round((battleState.enemy.hp / battleState.enemy.hpMax) * 100));
    youHPBar.style.width = yPct + "%"; enemyHPBar.style.width = ePct + "%";
    youHPText.textContent = `${battleState.you.hp}/${battleState.you.hpMax}`; enemyHPText.textContent = `${battleState.enemy.hp}/${battleState.enemy.hpMax}`;
  }
  function introText(){
    const idx = state.battlesToday + 1, type = todaysBattleType();
    return `${type==="boss" ? "Boss" : "Daily"} — Battle ${idx}/3.\nItems consume a turn. Extra actions today: ${battleState.extraPool}.`;
  }
  function applyMove(attacker, defender, move, label){
    let log = `${label} used ${move.name}!`;
    if (move.type === "atk"){
      let dmg = rng(move.dmg[0], move.dmg[1]);
      if (move.elem && attacker.type===move.elem) dmg = Math.round(dmg * 1.1); // STAB
      if (move.elem && defender.type) { const mult = typeMultiplier(move.elem, defender.type); dmg = Math.round(dmg * mult); if (mult>1) log += " It’s super effective!"; else if (mult<1) log += " It’s not very effective."; }
      dmg = Math.round(dmg * (attacker.atkMod||1.0) * (attacker.debuff||1.0));
      if (defender.shield>0){ dmg = Math.round(dmg * (1 - defender.shield)); defender.shield = 0; }
      defender.hp = Math.max(0, defender.hp - dmg); log += ` ${dmg} damage.`;
    } else if (move.type === "shield"){ attacker.shield = Math.max(attacker.shield, move.value); log += ` A protective field appears.`; }
    else if (move.type === "debuff"){ defender.debuff = move.value; defender.debuffTurns = move.turns; log += ` Their power weakens.`; }
    else if (move.type === "buff"){ attacker.atkMod = Math.max(attacker.atkMod, move.value); attacker.atkTurns = move.turns; log += ` Power surges!`; }
    return log;
  }
  function tickTurns(who){
    if (who.atkTurns){ who.atkTurns--; if (who.atkTurns<=0) who.atkMod = 1.0; }
    if (who.debuffTurns){ who.debuffTurns--; if (who.debuffTurns<=0) who.debuff = 1.0; }
  }

  function startBattle(){
    const typeStr = todaysBattleType();
    if (typeStr==="done"){ alert("You've finished all three battles today."); return; }
    battleState.extraPool = Math.min(4, tasksDone() + (parseInt(state.manualBonus)||0));
    battleState.active = true; battleState.isBoss = (typeStr==="boss");

    const s = state.stage;
    battleState.you.hpMax = state.playerHPMax; battleState.you.hp = state.playerHP; battleState.you.type = state.companionType;
    battleState.you.shield=0; battleState.you.atkMod=1.0; battleState.you.atkTurns=0; battleState.you.debuff=1.0; battleState.you.debuffTurns=0;
    battleState.youMoves = moveSet(s,false,battleState.you.type);

    const enemyTypePool = ["Aqua","Nature","Flame","Storm","Shadow","Light"];
    const eType = enemyTypePool[(state.campaignDay + s + state.battlesToday) % enemyTypePool.length];
    battleState.enemyStageNum = battleState.isBoss ? Math.min(7, s+1) : s;
    battleState.enemy.hpMax = 100 + battleState.enemyStageNum*20; battleState.enemy.hp = battleState.enemy.hpMax; battleState.enemy.type = eType;
    battleState.enemy.shield=0; battleState.enemy.atkMod=1.0; battleState.enemy.atkTurns=0; battleState.enemy.debuff=1.0; battleState.enemy.debuffTurns=0;
    battleState.enemyMoves = moveSet(battleState.enemyStageNum, battleState.isBoss, eType);

    youName.textContent = state.companionName; youStage.textContent = stageLabel(s); youType.textContent = battleState.you.type;
    const names = MOB_NAMES[battleState.enemyStageNum]; const nick = names[Math.floor(Math.random()*names.length)];
    battleState.enemyLabel = (battleState.isBoss ? "Boss " : "") + nick;
    enemyName.textContent = battleState.enemyLabel; enemyStage.textContent = stageLabel(battleState.enemyStageNum); enemyType.textContent = battleState.enemy.type;

    setHPBars();
    battleLog.textContent = introText();
    [moveA,moveB,moveC,moveD].forEach((btn,i)=>{ btn.textContent = battleState.youMoves[i].name; btn.disabled=false; });
    refreshItemSelect();
    $("#apLeft")?.textContent = battleState.extraPool;
    safeShowDialog(battleDialog);
  }

  function yourAction(kindIndex){
    if (!battleState.active) return;
    if (kindIndex>=0){
      const m = battleState.youMoves[kindIndex];
      const log = applyMove(battleState.you, battleState.enemy, m, state.companionName);
      battleLog.textContent += (battleLog.textContent?"\n":"") + log;
      setHPBars();
      if (battleState.enemy.hp<=0) return endBattle(true);
    }
    if (battleState.extraPool>0){ battleState.extraPool -= 1; $("#apLeft") && ($("#apLeft").textContent = battleState.extraPool); tickTurns(battleState.you); return; }
    tickTurns(battleState.you);
    const em = battleState.enemyMoves[Math.floor(Math.random()*battleState.enemyMoves.length)];
    const el = applyMove(battleState.enemy, battleState.you, em, battleState.enemyLabel);
    battleLog.textContent += "\n" + el;
    setHPBars();
    if (battleState.you.hp<=0) return endBattle(false);
    tickTurns(battleState.enemy);
  }

  // ---------- Items ----------
  function refreshItemSelect(){
    if (!itemSelect) return;
    const labels = {potion:"Potion (+30 HP)", elixir:"+1 Extra Action", bomb:"Data Bomb (20 dmg)", restkit:"Rest Kit (+50% HP)", xp20:"+20 XP"};
    const opts = [];
    Object.entries(state.inv).forEach(([k,v])=>{ if (v>0) opts.push(`<option value="${k}">${labels[k]} ×${v}</option>`); });
    itemSelect.innerHTML = opts.length ? opts.join("") : `<option value="">(no items)</option>`;
  }
  $("#useItem")?.addEventListener("click", () => {
    const key = itemSelect?.value; if (!key || !state.inv[key]){ alert("No usable item selected."); return; }
    if (!battleState.active){ alert("Start a battle to use items."); return; }
    if (key==="potion"){ const heal=30; battleState.you.hp = Math.min(battleState.you.hpMax, battleState.you.hp + heal); setHPBars(); battleLog.textContent += `\nYou used a Potion. +${heal} HP.`; }
    if (key==="elixir"){ battleState.extraPool = Math.min(4, battleState.extraPool + 1); $("#apLeft") && ($("#apLeft").textContent = battleState.extraPool); battleLog.textContent += `\nYou quaff an Elixir. +1 extra action.`; }
    if (key==="bomb"){ const dmg=20; battleState.enemy.hp = Math.max(0, battleState.enemy.hp - dmg); setHPBars(); battleLog.textContent += `\nYou threw a Data Bomb. ${dmg} dmg.`; if (battleState.enemy.hp<=0) return endBattle(true); }
    if (key==="restkit"){ const heal = Math.round(battleState.you.hpMax*0.5); battleState.you.hp = Math.min(battleState.you.hpMax, battleState.you.hp + heal); setHPBars(); battleLog.textContent += `\nYou used a Rest Kit. +${heal} HP.`; }
    if (key==="xp20"){ state.xp += 20; refreshStats(); battleLog.textContent += `\nYou used +20 XP.`; }
    state.inv[key] -= 1; if (state.inv[key]<0) state.inv[key]=0; save(); refreshItemSelect();
    yourAction(-1); // item consumes a turn
  });

  // ---------- Move buttons ----------
  [["moveA",0],["moveB",1],["moveC",2],["moveD",3]].forEach(([id,idx])=>{
    const btn = document.getElementById(id); btn?.addEventListener("click", () => yourAction(idx));
  });
  $("#btnBattleClose")?.addEventListener("click", () => { if (battleDialog.open) battleDialog.close(); else battleDialog.style.display='none'; });
  btnStartBattle?.addEventListener("click", startBattle);
  btnResumeBattle?.addEventListener("click", () => { if (battleDialog.showModal) battleDialog.showModal(); else battleDialog.style.display='block'; });

  // ---------- Helpers ----------
  function escapeHtml(s){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) }

  // ---------- AUTOTEST ----------
  function maybeAutoTest(){
    if (!location.search.includes("autotest")) return;
    try {
      state.coins += 100; save();
      setTimeout(()=>{ document.getElementById("btnStore")?.click(); }, 300);
      setTimeout(()=>{
        const btn = document.querySelector("#storeItems button"); if (btn) btn.click();
        document.getElementById("closeStore")?.click();
      }, 700);
      setTimeout(()=>{ document.getElementById("btnStartBattle")?.click(); }, 1100);
      setTimeout(()=>{ document.getElementById("moveA")?.click(); }, 1600);
      setTimeout(()=>{ document.getElementById("moveB")?.click(); }, 2100);
    } catch(e){ console.log("autotest error", e); }
  }

  // ---------- Boot ----------
  function boot(){
    refreshAvatar(); refreshStats(); renderTasks(); refreshBattleSummary(); refreshItemSelect(); maybeAutoTest();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

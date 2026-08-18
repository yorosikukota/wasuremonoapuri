// script.js
const DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS = {mon:"月",tue:"火",wed:"水",thu:"木",fri:"金",sat:"土",sun:"日"};
const DAY_COLORS = {mon:"#7c6cf0",tue:"#ff8fb1",wed:"#6cc2e8",thu:"#9b8cf5",fri:"#ff9d6c",sat:"#8ee0b3",sun:"#ff6c8c"};

const DEFAULT_DATA = {
  items:{
    mon:["連絡帳","筆箱","水筒","ハンカチ・ティッシュ","給食セット"],
    tue:["体操着","水筒","タオル","ハンカチ・ティッシュ","給食セット"],
    wed:["連絡帳","筆箱","水筒","上ばき","ハンカチ"],
    thu:["絵の具セット","筆箱","水筒","ハンカチ"],
    fri:["体操着","水筒","タオル","給食セット"],
    sat:[],
    sun:[]
  },
  checks:{}, // { "mon-連絡帳": true }
  coin:250,
  xp:120,
  xpMax:200,
  level:5,
  mood:4, // ハート数(5段階)
  streak:7,
  weekHistory:{mon:"full",tue:"full",wed:"full",thu:"full",fri:"full",sat:"full",sun:"partial"},
  reminderTime:"21:00",
  reminderDays:["mon","tue","wed","thu","fri"],
  reminderMsg:"明日の持ち物を確認しましょう！",
  weekPercent:87
};

function loadData(){
  const raw = localStorage.getItem("mochimono_data");
  if(!raw){
    saveData(DEFAULT_DATA);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  try{
    const parsed = JSON.parse(raw);
    // 足りないキーを補完
    return Object.assign(JSON.parse(JSON.stringify(DEFAULT_DATA)), parsed);
  }catch(e){
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}
function saveData(data){
  localStorage.setItem("mochimono_data", JSON.stringify(data));
}

let state = loadData();
let currentEditDay = null;

// 「明日」の曜日を決める（今日基準、なければmonをデフォルト表示に）
function getTomorrowKey(){
  const jsDay = new Date().getDay(); // 0=日
  const map = ["sun","mon","tue","wed","thu","fri","sat"];
  const todayKey = map[jsDay];
  const idx = DAY_KEYS.indexOf(todayKey);
  if(idx === -1) return "tue";
  return DAY_KEYS[(idx+1)%7 === 7 ? 0 : DAY_KEYS[(idx+1)%DAY_KEYS.length]] || DAY_KEYS[(idx+1)%DAY_KEYS.length];
}
function tomorrowKey(){
  const map = ["sun","mon","tue","wed","thu","fri","sat"];
  const jsDay = new Date().getDay();
  const tKey = map[(jsDay+1)%7];
  return DAY_KEYS.includes(tKey) ? tKey : "mon";
}

// ---------- 画面切り替え ----------
function showScreen(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const target = document.querySelector(`.screen[data-screen="${name}"]`);
  if(target) target.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n=>{
    n.classList.toggle("active", n.dataset.screen === name);
  });
  if(name==="calendar") renderDayList();
  if(name==="home") renderHome();
  if(name==="pet") renderPet();
  if(name==="record") renderRecord();
  if(name==="reminder") renderReminderScreen();
}
document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click", ()=>showScreen(btn.dataset.screen));
});
document.querySelectorAll(".back-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>showScreen(btn.dataset.back));
});
document.querySelectorAll(".settings-item[data-goto]").forEach(el=>{
  el.addEventListener("click", ()=>showScreen(el.dataset.goto));
});

// ---------- ホーム ----------
function renderHome(){
  const tKey = tomorrowKey();
  const items = state.items[tKey] || [];
  const list = document.getElementById("checkList");
  list.innerHTML = "";
  items.forEach(name=>{
    const ck = !!state.checks[tKey+"-"+name];
    const li = document.createElement("li");
    if(ck) li.classList.add("checked");
    li.innerHTML = `<input type="checkbox" ${ck?"checked":""} data-day="${tKey}" data-name="${name}"><span>${name}</span>`;
    list.appendChild(li);
  });
  list.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", onCheckChange);
  });
  updateReadyUI(tKey, false);

  const map = ["日","月","火","水","木","金","土"];
  const now = new Date();
  const tomorrow = new Date(now.getTime()+86400000);
  document.getElementById("tomorrowDate").textContent =
    `${tomorrow.getMonth()+1}/${tomorrow.getDate()} ${map[tomorrow.getDay()]}曜日`;

  document.getElementById("petLevelMini").textContent = state.level;
  document.getElementById("xpBarMini").style.width = Math.min(100,(state.xp/state.xpMax*100))+"%";
  document.getElementById("xpTextMini").textContent = `${state.xp}/${state.xpMax}`;
}

function updateReadyUI(tKey, animate){
  const items = state.items[tKey] || [];
  const total = items.length;
  const done = items.filter(n=>state.checks[tKey+"-"+n]).length;
  const percent = total===0 ? 100 : Math.round(done/total*100);
  document.getElementById("readyPercent").textContent = percent;
  const remain = total - done;
  document.getElementById("readySub").textContent = percent>=100 ? "🎉 準備完了！" : `あと${remain}個で100%！`;
  const circle = document.getElementById("gaugeCircle");
  const dash = 264 - (264*percent/100);
  circle.style.strokeDashoffset = dash;
  return {percent, total, done};
}

function onCheckChange(e){
  const day = e.target.dataset.day;
  const name = e.target.dataset.name;
  const key = day+"-"+name;
  const wasChecked = !!state.checks[key];
  state.checks[key] = e.target.checked;
  e.target.closest("li").classList.toggle("checked", e.target.checked);

  const {percent} = updateReadyUI(day, true);

  if(e.target.checked && !wasChecked){
    changeMood(1);
  }

  if(percent>=100 && !state._celebrated_today){
    state._celebrated_today = true;
    giveReward(20,20);
    showPopup("🎉 準備完了！<br><span style='font-size:14px'>+20コイン &nbsp; +20 XP</span>");
  } else if(percent<100){
    state._celebrated_today = false;
  }
  saveData(state);
}

function giveReward(coin, xp){
  state.coin += coin;
  state.xp += xp;
  while(state.xp >= state.xpMax){
    state.xp -= state.xpMax;
    state.level += 1;
    state.xpMax = Math.round(state.xpMax*1.15);
    setTimeout(()=>showPopup(`🎉 Lv.${state.level}になったよ！`), 900);
  }
  saveData(state);
}

function changeMood(delta){
  state.mood = Math.max(0, Math.min(5, state.mood + delta));
  saveData(state);
}

function showPopup(html){
  const overlay = document.getElementById("popupOverlay");
  document.getElementById("popupBox").innerHTML = html;
  overlay.classList.add("show");
  setTimeout(()=>overlay.classList.remove("show"), 1800);
}
document.getElementById("popupOverlay").addEventListener("click", ()=>{
  document.getElementById("popupOverlay").classList.remove("show");
});

document.getElementById("addItemBtn").addEventListener("click", ()=>{
  currentEditDay = tomorrowKey();
  prepareAddScreen();
  showScreen("additem");
});
document.getElementById("editListBtn").addEventListener("click", ()=>{
  showScreen("calendar");
});

// ---------- カレンダー（曜日ごと） ----------
function renderDayList(){
  const ul = document.getElementById("dayList");
  ul.innerHTML = "";
  DAY_KEYS.forEach(day=>{
    const items = state.items[day] || [];
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="day-badge" style="background:${DAY_COLORS[day]}">${DAY_LABELS[day]}</div>
      <div class="day-items ${items.length===0?'empty':''}">${items.length? items.join("・") : "設定なし"}</div>
      <div class="day-arrow">›</div>
    `;
    li.addEventListener("click", ()=>{
      currentEditDay = day;
      prepareAddScreen();
      showScreen("additem");
    });
    ul.appendChild(li);
  });
}
document.getElementById("goAddBtn").addEventListener("click", ()=>{
  currentEditDay = tomorrowKey();
  prepareAddScreen();
  showScreen("additem");
});

// ---------- 持ち物追加画面 ----------
function prepareAddScreen(){
  document.getElementById("itemNameInput").value = "";
  document.querySelectorAll(".toggle-btn").forEach(b=>b.classList.remove("active"));
  document.querySelector('.toggle-btn[data-repeat="weekly"]').classList.add("active");
  document.querySelectorAll("#daySelectRow .day-chip").forEach(chip=>{
    chip.classList.toggle("active", chip.dataset.day === currentEditDay);
  });
  document.getElementById("reminderTimeInput").value = state.reminderTime;
}
document.querySelectorAll(".toggle-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".toggle-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
  });
});
document.querySelectorAll("#daySelectRow .day-chip").forEach(chip=>{
  chip.addEventListener("click", ()=>chip.classList.toggle("active"));
});
function saveNewItem(){
  const name = document.getElementById("itemNameInput").value.trim();
  if(!name){
    showPopup("持ち物の名前を入れてね🦊");
    return;
  }
  const selectedDays = [...document.querySelectorAll("#daySelectRow .day-chip.active")].map(c=>c.dataset.day);
  const days = selectedDays.length ? selectedDays : [currentEditDay];
  days.forEach(day=>{
    if(!state.items[day]) state.items[day] = [];
    if(!state.items[day].includes(name)) state.items[day].push(name);
  });
  state.reminderTime = document.getElementById("reminderTimeInput").value || state.reminderTime;
  saveData(state);
  showPopup(`「${name}」を追加したよ！`);
  showScreen("calendar");
}
document.getElementById("saveItemBtn").addEventListener("click", saveNewItem);
document.getElementById("saveItemBtn2").addEventListener("click", saveNewItem);

// ---------- リマインダー設定 ----------
function renderReminderScreen(){
  document.getElementById("settingTimeInput").value = state.reminderTime;
  document.querySelectorAll("#settingDayRow .day-chip").forEach(chip=>{
    chip.classList.toggle("active", state.reminderDays.includes(chip.dataset.day));
  });
  document.getElementById("settingMsgInput").value = state.reminderMsg;
  document.getElementById("msgCount").textContent = state.reminderMsg.length;
}
document.querySelectorAll("#settingDayRow .day-chip").forEach(chip=>{
  chip.addEventListener("click", ()=>chip.classList.toggle("active"));
});
document.getElementById("settingMsgInput").addEventListener("input", (e)=>{
  document.getElementById("msgCount").textContent = e.target.value.length;
});
document.getElementById("saveReminderBtn").addEventListener("click", ()=>{
  state.reminderTime = document.getElementById("settingTimeInput").value;
  state.reminderDays = [...document.querySelectorAll("#settingDayRow .day-chip.active")].map(c=>c.dataset.day);
  state.reminderMsg = document.getElementById("settingMsgInput").value;
  saveData(state);
  showPopup("設定を保存したよ！");
});
document.getElementById("testNotifyBtn").addEventListener("click", ()=>{
  document.getElementById("notifyClock").textContent = state.reminderTime;
  document.getElementById("notifySub").textContent = document.getElementById("settingMsgInput").value.length
    ? "設定を確認したよ🙂" : "";
  const msgEl = document.querySelector(".notify-title");
  msgEl.textContent = state.reminderMsg;
  document.getElementById("notifyOverlay").classList.add("show");
});
document.getElementById("notifyCloseBtn").addEventListener("click", ()=>{
  document.getElementById("notifyOverlay").classList.remove("show");
});

// ---------- どうぶつ ----------
function renderPet(){
  document.getElementById("coinCountPet").textContent = state.coin;
  document.getElementById("petLevelPet").textContent = state.level;
  document.getElementById("xpBarPet").style.width = Math.min(100,(state.xp/state.xpMax*100))+"%";
  document.getElementById("xpTextPet").textContent = `${state.xp}/${state.xpMax}`;
  const heartRow = document.getElementById("heartRow");
  heartRow.innerHTML = "";
  for(let i=0;i<5;i++){
    heartRow.innerHTML += i < state.mood ? "💗" : "🤍";
  }
}
document.getElementById("petBig").addEventListener("click", ()=>{
  const pet = document.getElementById("petBig");
  pet.classList.remove("jump");
  void pet.offsetWidth;
  pet.classList.add("jump");
  const msgs = [
    "わあ！<br>準備がんばってるね！",
    "コロちゃんも応援してるよ🦊",
    "今日も一緒にがんばろう！",
    "きみのこと大好きだよ〜💗"
  ];
  document.getElementById("petSpeech").innerHTML = msgs[Math.floor(Math.random()*msgs.length)];
});
document.getElementById("carePetBtn").addEventListener("click", ()=>{
  changeMood(1);
  state.coin += 2;
  saveData(state);
  renderPet();
  document.getElementById("petSpeech").innerHTML = "わあ！<br>うれしいな〜💗<br>+2コインもらった！";
  const pet = document.getElementById("petBig");
  pet.classList.remove("jump"); void pet.offsetWidth; pet.classList.add("jump");
});
document.getElementById("shopPetBtn").addEventListener("click", ()=>{
  showPopup(`🏪 どうぶつショップ<br><span style="font-size:13px">（このさきの機能はこれから作ろうね！）</span>`);
});

// ---------- 記録 ----------
function renderRecord(){
  document.getElementById("weekPercent").textContent = state.weekPercent;
  const dash = 264 - (264*state.weekPercent/100);
  document.getElementById("weekGaugeCircle").style.strokeDashoffset = dash;
  document.getElementById("streakCount").textContent = state.streak;

  const grid = document.getElementById("weekGrid");
  grid.innerHTML = "";
  const labels = ["月","火","水","木","金","土","日"];
  DAY_KEYS.forEach((day,i)=>{
    const status = state.weekHistory[day];
    const wd = document.createElement("div");
    wd.className = "wd"; wd.textContent = labels[i];
    const wc = document.createElement("div");
    wc.className = "wc" + (status==="full" ? " full" : status==="partial" ? " partial" : "");
    wc.textContent = status==="full" ? "✓" : status==="partial" ? "△" : "";
    grid.appendChild(wd);
  });
  DAY_KEYS.forEach((day,i)=>{
    const status = state.weekHistory[day];
    const wc = grid.children[7+i] || null;
  });
  // 2段目を作り直す（曜日ラベル→丸記録）
  grid.innerHTML = "";
  DAY_KEYS.forEach((day,i)=>{
    const wd = document.createElement("div");
    wd.className = "wd"; wd.textContent = labels[i];
    grid.appendChild(wd);
  });
  DAY_KEYS.forEach((day)=>{
    const status = state.weekHistory[day];
    const wc = document.createElement("div");
    wc.className = "wc" + (status==="full" ? " full" : status==="partial" ? " partial" : "");
    wc.textContent = status==="full" ? "✓" : status==="partial" ? "△" : "";
    grid.appendChild(wc);
  });
}

// ---------- 設定：リセット ----------
document.getElementById("resetDataBtn").addEventListener("click", ()=>{
  showPopup("データをリセットしたよ🦊<br><span style='font-size:13px'>もう一度タップで元通り！</span>");
  localStorage.removeItem("mochimono_data");
  state = loadData();
  renderHome();
});

// ---------- 初期表示 ----------
showScreen("home");

// ---------- PWA: サービスワーカー登録 ----------
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(err=>{
      console.log("SW登録できなかったよ:", err);
    });
  });
}
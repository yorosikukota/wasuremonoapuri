// script.js
const DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS = {mon:"月",tue:"火",wed:"水",thu:"木",fri:"金",sat:"土",sun:"日"};
const DAY_COLORS = {mon:"#7c6cf0",tue:"#ff8fb1",wed:"#6cc2e8",thu:"#9b8cf5",fri:"#ff9d6c",sat:"#8ee0b3",sun:"#ff6c8c"};
const PETS = {
  shiba:{name:"コロちゃん", short:"コロ", image:"assets/pets/shiba.png", voice:"わん！"},
  calico:{name:"ミイちゃん", short:"ミイ", image:"assets/pets/calico.png", voice:"にゃあ！"},
  rabbit:{name:"モカちゃん", short:"モカ", image:"assets/pets/rabbit.png", voice:"ぴょん！"}
};
const FOOD_ITEMS = [
  {id:"bone", name:"ほね", emoji:"🦴", price:20, xp:5},
  {id:"cookie", name:"クッキー", emoji:"🍪", price:35, xp:10},
  {id:"meat", name:"ごちそう肉", emoji:"🍖", price:60, xp:20}
];
const CLOTHES_ITEMS = [
  {id:"ribbon", name:"赤いリボン", emoji:"🎀", price:80},
  {id:"cap", name:"おでかけ帽子", emoji:"🧢", price:120},
  {id:"crown", name:"王さまクラウン", emoji:"👑", price:200}
];

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
  selectedPet:"shiba",
  foodInventory:{bone:1,cookie:0,meat:0},
  ownedClothes:[],
  equippedClothes:null,
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
    const merged = Object.assign(JSON.parse(JSON.stringify(DEFAULT_DATA)), parsed);
    merged.foodInventory = Object.assign({}, DEFAULT_DATA.foodInventory, parsed.foodInventory || {});
    merged.ownedClothes = Array.isArray(parsed.ownedClothes) ? parsed.ownedClothes : [];
    return merged;
  }catch(e){
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}
function saveData(data){
  localStorage.setItem("mochimono_data", JSON.stringify(data));
}

let state = loadData();
let currentEditDay = null;
let petIdleTimer = null;
let petActionTimer = null;
let petPointer = {active:false, startX:0, lastX:0, distance:0};
let suppressPetClick = false;

function localDateKey(){
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
}

// 前回開いた日の準備が終わっていなければ、次に会った時だけ心配する
const currentDateKey = localDateKey();
if(state._lastVisitDate && state._lastVisitDate !== currentDateKey && Number(state._lastPreparedPercent || 0) < 100){
  state._missedPreparation = true;
}
state._lastVisitDate = currentDateKey;
saveData(state);

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
  if(name==="shop") renderShop();
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
  const pet = getSelectedPet();
  document.getElementById("petNameMini").textContent = pet.name;
  document.getElementById("petMiniImg").src = pet.image;
  document.getElementById("petMiniImg").alt = pet.name;
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
  state._lastPreparedPercent = percent;

  if(e.target.checked && !wasChecked){
    changeMood(1);
  }

  if(percent>=100 && !state._celebrated_today){
    state._celebrated_today = true;
    giveReward(20,20);
    showPopup("🎉 準備完了！<br><span style='font-size:14px'>+20コイン &nbsp; +20 XP</span>");
    playPetAction("celebrate", "ぜんぶ準備できたね！<br>すごい、すごーい！ 🎉");
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
  const selectedPet = getSelectedPet();
  document.getElementById("coinCountPet").textContent = state.coin;
  document.getElementById("petNamePet").textContent = selectedPet.name;
  document.getElementById("petLevelPet").textContent = state.level;
  document.getElementById("xpBarPet").style.width = Math.min(100,(state.xp/state.xpMax*100))+"%";
  document.getElementById("xpTextPet").textContent = `${state.xp}/${state.xpMax}`;
  const heartRow = document.getElementById("heartRow");
  heartRow.innerHTML = "";
  for(let i=0;i<5;i++){
    heartRow.innerHTML += i < state.mood ? "💗" : "🤍";
  }
  const outfit = CLOTHES_ITEMS.find(item=>item.id === state.equippedClothes);
  const outfitEl = document.getElementById("petOutfit");
  outfitEl.textContent = outfit ? outfit.emoji : "";
  outfitEl.className = `pet-outfit${outfit ? ` outfit-${outfit.id}` : ""}`;
  document.getElementById("petAvatar").className = `pet-avatar pet-${state.selectedPet}`;
  const totalFood = Object.values(state.foodInventory).reduce((sum,count)=>sum + Number(count || 0), 0);
  document.getElementById("feedPetBtn").innerHTML = `🦴 餌をあげる <span class="item-count">${totalFood}</span>`;
  document.getElementById("petSelectedLabel").textContent = selectedPet.name;
  document.getElementById("petCharacterImg").src = selectedPet.image;
  document.getElementById("petCharacterImg").alt = selectedPet.name;
  document.getElementById("petBig").setAttribute("aria-label", `${selectedPet.name}をタップしたり、左右になでる`);
  document.querySelectorAll(".pet-choice").forEach(btn=>btn.classList.toggle("active", btn.dataset.pet === state.selectedPet));
  const speech = document.getElementById("petSpeech");
  if(speech.dataset.pet !== state.selectedPet){
    speech.dataset.pet = state.selectedPet;
    speech.innerHTML = `${selectedPet.short}だよ！<br>タップしたり、なでてみてね`;
  }
  resetPetIdleTimer();
  if(state._missedPreparation){
    state._missedPreparation = false;
    saveData(state);
    setTimeout(()=>playPetAction("worry", "きのうの準備、大丈夫だった？<br>今日は一緒に確認しようね"), 250);
  }
}

function getSelectedPet(){
  return PETS[state.selectedPet] || PETS.shiba;
}

document.querySelectorAll(".pet-choice").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    state.selectedPet = btn.dataset.pet;
    saveData(state);
    renderPet();
    const pet = getSelectedPet();
    playPetAction("celebrate", `${pet.name}といっしょ！<br>よろしくね 💗`);
  });
});

function playPetAction(action, message){
  const pet = document.getElementById("petBig");
  if(!pet) return;
  clearTimeout(petActionTimer);
  pet.className = "pet-big";
  void pet.offsetWidth;
  const classMap = {tap:"look", pet:"petted", feed:"eat", celebrate:"jump", sleep:"sleep", worry:"worry"};
  pet.classList.add(classMap[action] || "look");
  if(message) document.getElementById("petSpeech").innerHTML = message;
  if(action === "pet") showPetEffect("💗  💕  💗");
  if(action === "celebrate") showPetEffect("✨  🎉  ✨");
  if(action === "sleep") showPetEffect("z  z  Z");
  petActionTimer = setTimeout(()=>{
    if(action !== "sleep") pet.className = "pet-big";
  }, action === "feed" ? 1450 : 1050);
  if(action !== "sleep") resetPetIdleTimer();
}

function showPetEffect(content){
  const effect = document.getElementById("petEffect");
  effect.textContent = content;
  effect.classList.remove("pop");
  void effect.offsetWidth;
  effect.classList.add("pop");
}

function resetPetIdleTimer(){
  clearTimeout(petIdleTimer);
  const petScreen = document.getElementById("screen-pet");
  if(!petScreen || !petScreen.classList.contains("active")) return;
  petIdleTimer = setTimeout(()=>playPetAction("sleep", "ちょっと休憩……<br>むにゃむにゃ 💤"), 15000);
}

document.getElementById("petBig").addEventListener("click", ()=>{
  if(suppressPetClick){
    suppressPetClick = false;
    return;
  }
  const msgs = [
    `${getSelectedPet().voice} なあに？<br>いっしょに遊ぼう！`,
    `${getSelectedPet().short}も応援してるよ🐾`,
    "今日も一緒にがんばろう！",
    "きみのこと大好きだよ〜💗"
  ];
  playPetAction("tap", msgs[Math.floor(Math.random()*msgs.length)]);
});

function petTheDog(){
  changeMood(1);
  saveData(state);
  renderPet();
  playPetAction("pet", "そこ、気持ちいい〜！<br>もっとなでて 💗");
}

document.getElementById("carePetBtn").addEventListener("click", petTheDog);

const petBig = document.getElementById("petBig");
petBig.addEventListener("pointerdown", e=>{
  petPointer = {active:true, startX:e.clientX, lastX:e.clientX, distance:0};
  petBig.setPointerCapture(e.pointerId);
});
petBig.addEventListener("pointermove", e=>{
  if(!petPointer.active) return;
  petPointer.distance += Math.abs(e.clientX - petPointer.lastX);
  petPointer.lastX = e.clientX;
});
petBig.addEventListener("pointerup", e=>{
  if(!petPointer.active) return;
  petPointer.active = false;
  if(petPointer.distance > 70){
    e.preventDefault();
    suppressPetClick = true;
    petTheDog();
  }
});

document.getElementById("feedPetBtn").addEventListener("click", ()=>{
  const foodItem = FOOD_ITEMS.find(item=>(state.foodInventory[item.id] || 0) > 0);
  if(!foodItem){
    showPopup("おやつがないよ🍽️<br><span style='font-size:13px'>ショップで買ってきてね！</span>");
    return;
  }
  state.foodInventory[foodItem.id] -= 1;
  const foodEl = document.getElementById("petFood");
  foodEl.textContent = foodItem.emoji;
  foodEl.classList.remove("show"); void foodEl.offsetWidth; foodEl.classList.add("show");
  changeMood(1);
  giveReward(0, foodItem.xp);
  renderPet();
  playPetAction("feed", `おいしい！<br>ごちそうさま！ +${foodItem.xp} XP ${foodItem.emoji}`);
});
document.getElementById("shopPetBtn").addEventListener("click", ()=>{
  showScreen("shop");
});

function spendCoins(price){
  if(state.coin < price){
    showPopup(`コインが足りないよ🪙<br><span style="font-size:13px">あと${price-state.coin}コイン必要だよ</span>`);
    return false;
  }
  state.coin -= price;
  return true;
}

function renderShop(){
  document.getElementById("coinCountShop").textContent = state.coin;
  document.getElementById("shopPetName").textContent = getSelectedPet().name;
  const foodGrid = document.getElementById("foodShopGrid");
  foodGrid.innerHTML = FOOD_ITEMS.map(item=>`
    <article class="shop-item">
      <div class="shop-item-emoji">${item.emoji}</div><strong>${item.name}</strong>
      <small>+${item.xp} XP・所持 ${state.foodInventory[item.id] || 0}</small>
      <button class="shop-buy" data-food="${item.id}">🪙 ${item.price}</button>
    </article>`).join("");
  const clothesGrid = document.getElementById("clothesShopGrid");
  clothesGrid.innerHTML = CLOTHES_ITEMS.map(item=>{
    const owned = state.ownedClothes.includes(item.id);
    const equipped = state.equippedClothes === item.id;
    return `<article class="shop-item ${equipped ? "equipped" : ""}">
      <div class="shop-item-emoji">${item.emoji}</div><strong>${item.name}</strong>
      <small>${equipped ? "いま着ています" : owned ? "購入済み" : "ずっと使えるよ"}</small>
      <button class="shop-buy" data-clothes="${item.id}">${equipped ? "はずす" : owned ? "着せる" : `🪙 ${item.price}`}</button>
    </article>`;
  }).join("");
  foodGrid.querySelectorAll("[data-food]").forEach(btn=>btn.addEventListener("click", ()=>buyFood(btn.dataset.food)));
  clothesGrid.querySelectorAll("[data-clothes]").forEach(btn=>btn.addEventListener("click", ()=>handleClothes(btn.dataset.clothes)));
}

function buyFood(id){
  const item = FOOD_ITEMS.find(food=>food.id === id);
  if(!item || !spendCoins(item.price)) return;
  state.foodInventory[id] = (state.foodInventory[id] || 0) + 1;
  saveData(state); renderShop();
  showPopup(`${item.emoji} ${item.name}を買ったよ！`);
}

function handleClothes(id){
  const item = CLOTHES_ITEMS.find(clothes=>clothes.id === id);
  if(!item) return;
  if(!state.ownedClothes.includes(id)){
    if(!spendCoins(item.price)) return;
    state.ownedClothes.push(id);
  }
  state.equippedClothes = state.equippedClothes === id ? null : id;
  saveData(state); renderShop();
  showPopup(state.equippedClothes ? `${item.emoji} ${getSelectedPet().name}に着せたよ！` : "おようふくをはずしたよ");
}

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

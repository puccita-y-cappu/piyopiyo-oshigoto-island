// マイ・おしごと島 - ゲームのルールやデータは主にこのファイルで変更します.
//
// カスタマイズ例:
// ・ミッション名/報酬を変える → initialTasks の中身を編集
// ・商品/価格を変える → shopItems の中身を編集
// ・新しい機能を追加する → 下のイベント処理などを編集

const initialTasks = [
  { id: "task-paperwork", icon: "🗂️", title: "無意味な事務処理を片付けた", category: "おかたづけミッション", reward: 100 },
  { id: "task-smile", icon: "😊", title: "苦手なコトリに笑顔で対応した", category: "にこにこ対応ミッション", reward: 100 },
  { id: "task-boundary", icon: "🪽", title: "他のコトリのおしごとを押し付けられそうになっても笑顔で断った", category: "やさしくおことわりミッション", reward: 100 },
  { id: "task-meeting", icon: "🐥", title: "コトリたちの作戦会議に参加した", category: "チームミッション", reward: 100 },
  { id: "task-silent", icon: "💭", title: "余計なことを言い返さなかった", category: "ことばをのみこんだミッション", reward: 100 }
];

const shopItems = [
  { id: "flower", icon: "🌷", title: "お花の苗", cost: 250 },
  { id: "chair", icon: "🪑", title: "木のいす", cost: 500 },
  { id: "pond", icon: "🐸", title: "小さな池", cost: 900 }
];

const today = new Date();
const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
document.getElementById("dateLabel").textContent = `${today.getMonth() + 1}/${today.getDate()}`;

let state;
try {
  state = JSON.parse(localStorage.getItem("oshigoto-island-v1") || "null");
} catch (error) {
  state = null;
}
if (!state) state = { balance: 0, claimed: {}, purchases: [] };
if (!state.claimed) state.claimed = {};
if (!state.purchases) state.purchases = [];
if (!state.daily) state.daily = {};
if (!state.daily[dayKey]) state.daily[dayKey] = {};

function saveState() {
  localStorage.setItem("oshigoto-island-v1", JSON.stringify(state));
}

function isTaskCompleteToday(id) {
  return Boolean(state.daily[dayKey]?.[id]);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function render() {
  document.getElementById("balance").textContent = state.balance.toLocaleString("ja-JP");

  const completedCount = initialTasks.filter(task => isTaskCompleteToday(task.id)).length;
  const earnedToday = initialTasks.reduce(
    (sum, task) => sum + (isTaskCompleteToday(task.id) ? task.reward : 0), 0
  );

  document.getElementById("todayMiles").textContent = `+${earnedToday.toLocaleString("ja-JP")}`;
  document.getElementById("progressText").textContent = `${completedCount} / ${initialTasks.length} 達成`;
  document.getElementById("progressBar").style.width = `${completedCount / initialTasks.length * 100}%`;

  document.getElementById("tasks").innerHTML = initialTasks.map(task => {
    const done = isTaskCompleteToday(task.id);
    return `
      <article class="task ${done ? "done" : ""}">
        <div class="task-icon" aria-hidden="true">${task.icon}</div>
        <div class="task-copy">
          <strong>${task.title}</strong>
          <small>${task.category}</small>
        </div>
        <div class="reward">+${task.reward}</div>
        <button class="${done ? "claimed" : "claim"}" data-task="${task.id}" ${done ? "disabled" : ""}>
          ${done ? "達成済み" : "達成！"}
        </button>
      </article>`;
  }).join("");

  document.getElementById("shop").innerHTML = shopItems.map(item => {
    const owned = state.purchases.includes(item.id);
    const affordable = state.balance >= item.cost;
    const buttonLabel = owned ? "交換済み" : affordable ? "交換する" : `あと${(item.cost - state.balance).toLocaleString("ja-JP")}`;
    return `
      <article class="item">
        <div class="emoji" aria-hidden="true">${item.icon}</div>
        <strong>${item.title}</strong>
        <small>${item.cost.toLocaleString("ja-JP")} マイル</small>
        <button data-buy="${item.id}" ${owned || !affordable ? "disabled" : ""}>${buttonLabel}</button>
      </article>`;
  }).join("");
}

document.getElementById("tasks").addEventListener("click", event => {
  const button = event.target.closest("[data-task]");
  if (!button) return;

  const task = initialTasks.find(item => item.id === button.dataset.task);
  if (!task || isTaskCompleteToday(task.id)) return;

  state.daily[dayKey][task.id] = true;
  state.balance += task.reward;
  saveState();
  render();
  showToast(`🎉 ミッション達成！ +${task.reward} マイル`);
});

document.getElementById("shop").addEventListener("click", event => {
  const button = event.target.closest("[data-buy]");
  if (!button) return;

  const item = shopItems.find(product => product.id === button.dataset.buy);
  if (!item || state.purchases.includes(item.id) || state.balance < item.cost) return;

  state.balance -= item.cost;
  state.purchases.push(item.id);
  saveState();
  render();
  showToast(`${item.icon} ${item.title}を手に入れた！`);
});

const modal = document.getElementById("modalBg");
document.getElementById("accountBtn").addEventListener("click", () => modal.classList.add("open"));
document.getElementById("closeModal").addEventListener("click", () => modal.classList.remove("open"));
document.getElementById("understood").addEventListener("click", () => modal.classList.remove("open"));
modal.addEventListener("click", event => {
  if (event.target === modal) modal.classList.remove("open");
});

render();

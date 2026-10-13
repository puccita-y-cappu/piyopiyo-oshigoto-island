// マイ・おしごと島：Firebase同期対応版
// Googleログイン中はセーブデータをFirestoreにも保存します。

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBAFd8aJK99LLdV9cxG_FaUr7S_uJxg2j4",
  authDomain: "piyopiyo-oshigoto-island.firebaseapp.com",
  projectId: "piyopiyo-oshigoto-island",
  storageBucket: "piyopiyo-oshigoto-island.firebasestorage.app",
  messagingSenderId: "891671653767",
  appId: "1:891671653767:web:9944ebbcdd84e653b3b722"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

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

const STORAGE_KEY = "oshigoto-island-v1";
let currentUser = null;
let authReady = false;
let cloudReady = false;
let cloudWriteQueue = Promise.resolve();

function normalizeState(data) {
  const result = data && typeof data === "object"
    ? JSON.parse(JSON.stringify(data))
    : { balance: 0, claimed: {}, purchases: [], daily: {} };

  if (typeof result.balance !== "number" || !Number.isFinite(result.balance)) result.balance = 0;
  if (!result.claimed || typeof result.claimed !== "object") result.claimed = {};
  if (!Array.isArray(result.purchases)) result.purchases = [];
  if (!result.daily || typeof result.daily !== "object") result.daily = {};
  if (!result.daily[dayKey] || typeof result.daily[dayKey] !== "object") result.daily[dayKey] = {};
  return result;
}

function readLocalState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch (error) {
    return normalizeState(null);
  }
}

let state = readLocalState();

function updateAuthUI(status, note = "") {
  const statusEl = document.getElementById("authStatus");
  const noteEl = document.getElementById("syncNote");
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");

  statusEl.textContent = status;
  noteEl.textContent = note;
  signInBtn.hidden = Boolean(currentUser);
  signOutBtn.hidden = !currentUser;
  signInBtn.disabled = !authReady;
  signOutBtn.disabled = !authReady;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (!currentUser || !cloudReady) return;
  const uid = currentUser.uid;
  const snapshot = JSON.parse(JSON.stringify(state));
  cloudWriteQueue = cloudWriteQueue
    .catch(() => {})
    .then(() => setDoc(doc(db, "users", uid), {
      state: snapshot,
      updatedAt: serverTimestamp()
    }, { merge: true }))
    .catch(error => {
      console.error("クラウド保存エラー:", error);
      updateAuthUI(`ログイン中：${currentUser?.email || "Googleアカウント"}`,
        "クラウド保存に失敗しました。通信状態やFirestoreのルールを確認してください。");
    });
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
  if (!authReady) return;
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
  if (!authReady) return;
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
modal.addEventListener("click", event => {
  if (event.target === modal) modal.classList.remove("open");
});

document.getElementById("signInBtn").addEventListener("click", async () => {
  const button = document.getElementById("signInBtn");
  button.disabled = true;
  updateAuthUI("Googleログイン画面を開いています…", "Googleアカウントを選択してください。");
  try {
    await signInWithPopup(auth, googleProvider);
    // 実際のデータ読み込みは onAuthStateChanged で行います。
  } catch (error) {
    console.error("Googleログインエラー:", error);
    authReady = true;
    updateAuthUI("ログインできませんでした",
      error.code === "auth/popup-blocked"
        ? "ポップアップがブロックされたようです。ブラウザでポップアップを許可して、もう一度お試しください。"
        : `エラー：${error.message || error.code || "不明なエラー"}`);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("ログアウトしました");
  } catch (error) {
    console.error("ログアウトエラー:", error);
    updateAuthUI("ログアウトできませんでした", error.message || "もう一度お試しください。");
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  cloudReady = false;

  if (!user) {
    authReady = true;
    updateAuthUI("ログインしていません", "この端末のデータはそのまま残っています。同期するにはGoogleでログインしてください。");
    render();
    return;
  }

  authReady = false;
  updateAuthUI("クラウドデータを確認中…", "少し待ってね。");
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (currentUser?.uid !== user.uid) return;

    if (userDoc.exists() && userDoc.data().state) {
      state = normalizeState(userDoc.data().state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateAuthUI(`ログイン中：${user.email || "Googleアカウント"}`,
        "クラウドのセーブデータを読み込みました。別の端末ではページを再読み込みすると最新データを読み込めます。");
    } else {
      state = readLocalState();
      await setDoc(doc(db, "users", user.uid), {
        state: JSON.parse(JSON.stringify(state)),
        updatedAt: serverTimestamp()
      }, { merge: true });
      updateAuthUI(`ログイン中：${user.email || "Googleアカウント"}`,
        "この端末のセーブデータをクラウドに保存しました。");
    }

    if (currentUser?.uid !== user.uid) return;
    cloudReady = true;
    authReady = true;
    render();
  } catch (error) {
    console.error("クラウド読み込みエラー:", error);
    if (currentUser?.uid !== user.uid) return;
    authReady = true;
    cloudReady = false;
    updateAuthUI(`ログイン中：${user.email || "Googleアカウント"}`,
      "クラウドを読み込めませんでした。Firestoreのルールや通信状態を確認してください。");
    render();
  }
});

updateAuthUI("ログイン状態を確認中…", "Firebaseに接続しています。");
render();

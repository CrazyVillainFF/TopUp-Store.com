import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAPHv_ibm0KB025gGCKgsn_biOcokcbS9c",
  authDomain: "topup-store-2d708.firebaseapp.com",
  projectId: "topup-store-2d708",
  storageBucket: "topup-store-2d708.firebasestorage.app",
  messagingSenderId: "135503745090",
  appId: "1:135503745090:web:878f62cc297e33be151ddb",
  measurementId: "G-T81SY3RG3B"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const TopupData = {
  upiId: "vishnubangaru001@oksbi",
  paymentQr: "image/payment-qr.jpg",
  games: {
    freefire: { name: "Free Fire", item: "Diamonds", logo: "image/freefire.png", page: "freefire.html", description: "Fast diamond packs for Free Fire accounts with UPI checkout.", bundles: [{ label: "100 Diamonds", amount: 79 }, { label: "310 Diamonds", amount: 240 }, { label: "520 Diamonds", amount: 399 }, { label: "1060 Diamonds", amount: 799 }] },
    bgmi: { name: "BGMI", item: "UC", logo: "image/bgmi.jpg", page: "bgmi.html", description: "Reliable BGMI UC packs with Firestore order tracking.", bundles: [{ label: "60 UC", amount: 75 }, { label: "325 UC", amount: 380 }, { label: "660 UC", amount: 750 }, { label: "1800 UC", amount: 1850 }] },
    pubg: { name: "PUBG Mobile", item: "UC", logo: "image/pubg.png", page: "pubg.html", description: "PUBG Mobile UC bundles with a clear payment summary before checkout.", bundles: [{ label: "60 UC", amount: 75 }, { label: "325 UC", amount: 380 }, { label: "660 UC", amount: 750 }, { label: "1800 UC", amount: 1850 }] },
    cod: { name: "Call of Duty Mobile", item: "CP", logo: "image/cod.png", page: "cod.html", description: "CP bundles for Call of Duty Mobile with clear checkout steps.", bundles: [{ label: "80 CP", amount: 79 }, { label: "420 CP", amount: 399 }, { label: "880 CP", amount: 799 }, { label: "2400 CP", amount: 1999 }] }
  }
};

let currentUser = null;
let currentProfileCache = null;
export const authReady = new Promise((resolve) => onAuthStateChanged(auth, (user) => { currentUser = user; resolve(user); }));
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  currentProfileCache = null;
  await updateHeaderFromAuth();
});

function withTimeout(promise, message = "Request timed out. Check Firebase setup and internet connection.", ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

export function money(amount) { return "INR " + Number(amount).toFixed(2); }
export function discounted(amount, apply) { return apply ? Number(amount) * 0.9 : Number(amount); }
export function gmailValid(email) { return /^[^\s@]+@gmail\.com$/i.test(email); }
export function strongPassword(password) { return password.length >= 8 && /[a-z]/.test(password) && /\d/.test(password) && (/[A-Z]/.test(password) || /[^A-Za-z0-9]/.test(password)); }

function authMessage(error) {
  const code = error?.code || "";
  if (code === "auth/email-already-in-use") return "This Gmail ID is already registered. Use Login instead.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") return "Incorrect email or password.";
  if (code === "auth/user-not-found") return "No account found for this Gmail ID. Create an account first.";
  if (code === "auth/weak-password") return "Password must be at least 6 characters.";
  if (code === "auth/operation-not-allowed") return "Enable Email/Password in Firebase Authentication first.";
  if (code === "permission-denied") return "Firestore permission denied. Publish test rules or proper user rules.";
  if (code === "auth/network-request-failed") return "Network error. Check your internet connection.";
  return error?.message || "Firebase request failed.";
}

export async function ensureUserProfile(user = auth.currentUser) {
  if (!user) return null;
  if (currentProfileCache?.uid === user.uid) return currentProfileCache;
  const ref = doc(db, "users", user.uid);
  const snap = await withTimeout(getDoc(ref), "Could not load user profile from Firestore.");
  if (snap.exists()) {
    currentProfileCache = snap.data();
    return currentProfileCache;
  }
  const username = user.displayName || user.email.split("@")[0];
  const profile = { uid: user.uid, username, usernameLower: username.toLowerCase(), email: user.email, points: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await withTimeout(setDoc(ref, profile), "Could not create user profile in Firestore.");
  currentProfileCache = { ...profile, createdAt: null, updatedAt: null };
  return currentProfileCache;
}

export async function createAccount(username, email, password) {
  try {
    const credential = await withTimeout(createUserWithEmailAndPassword(auth, email, password), "Signup timed out. Check Email/Password provider.");
    await updateProfile(credential.user, { displayName: username });
    try {
      await withTimeout(setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        username,
        usernameLower: username.toLowerCase(),
        email: credential.user.email,
        points: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }), "Account created, but Firestore profile save timed out.");
    } catch (profileError) {
      return { ok: true, warning: authMessage(profileError) };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: authMessage(error) };
  }
}

export async function loginAccount(email, password) {
  try {
    const credential = await withTimeout(signInWithEmailAndPassword(auth, email, password), "Login timed out. Check Firebase Authentication.");
    try { await ensureUserProfile(credential.user); } catch (profileError) { console.warn("Profile load failed", profileError); }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: authMessage(error) };
  }
}

export async function logoutAccount() { await signOut(auth); }

export async function resetPassword(email) {
  try {
    await withTimeout(sendPasswordResetEmail(auth, email), "Password reset request timed out.");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: authMessage(error) };
  }
}

export async function currentProfile() {
  await authReady;
  return ensureUserProfile(auth.currentUser);
}

export async function currentPoints() {
  try {
    const profile = await currentProfile();
    return profile ? Number(profile.points) || 0 : 0;
  } catch {
    return 0;
  }
}

export function upiLink(order) {
  const params = new URLSearchParams({ pa: TopupData.upiId, pn: "Unlimited Topup", tn: `${order.game} | ${order.bundle} | ID:${order.playerId}`, am: Number(order.amount).toFixed(2), cu: "INR" });
  return "upi://pay?" + params.toString();
}

function showPaymentPanel(order) {
  const oldModal = document.querySelector("[data-payment-modal]");
  if (oldModal) oldModal.remove();
  const modal = document.createElement("div");
  modal.className = "modal open payment-modal";
  modal.dataset.paymentModal = "";
  modal.innerHTML = `
    <div class="modal-panel payment-panel">
      <div class="modal-head">
        <div>
          <h2>Complete Payment</h2>
          <p class="muted">Scan this QR code or open your UPI payment app.</p>
        </div>
        <button class="icon-btn" data-close-payment aria-label="Close">x</button>
      </div>
      <div class="payment-summary">
        <img class="payment-qr" src="${TopupData.paymentQr}" alt="Unlimited Topup payment QR code">
        <div class="payment-details">
          <span>Payable Amount</span>
          <strong>${money(order.amount)}</strong>
          <p>${order.game} - ${order.bundle}</p>
          <p>Player ID: ${order.playerId}</p>
          <p>UPI ID: <b>${TopupData.upiId}</b></p>
        </div>
      </div>
      <div class="reward-notice">
        Pay to this QR code. Your reward will be added within 12hr after payment confirmation.
      </div>
      <div class="payment-actions">
        <a class="link-btn primary full" href="${upiLink(order)}">Open UPI Payment App</a>
        <button class="btn ghost full" data-close-payment>Done</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close-payment]").forEach((button) => button.addEventListener("click", () => modal.remove()));
}

export async function saveOrder(order) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login before placing an order.");
  let profile = null;
  try { profile = await ensureUserProfile(user); } catch { profile = { username: user.displayName || user.email }; }
  const pointsEarned = Math.floor(Number(order.amount) * 4);
  await withTimeout(addDoc(collection(db, "orders"), { ...order, uid: user.uid, username: profile.username, email: user.email, pointsEarned, status: "pending_payment", createdAt: serverTimestamp() }), "Could not save order in Firestore.");
}

function navHtml(active) {
  const nav = [["index", "Home", "index.html"], ["freefire", "Free Fire", "freefire.html"], ["bgmi", "BGMI", "bgmi.html"], ["pubg", "PUBG", "pubg.html"], ["cod", "Call of Duty", "cod.html"]];
  return nav.map(([key, label, href]) => `<a class="${active === key ? "active" : ""}" href="${href}">${label}</a>`).join("");
}

function headerShell(active, authHtml) {
  return `<div class="page-shell navbar"><a class="brand" href="index.html"><span class="brand-mark">UT</span><span class="brand-text"><strong>Unlimited Topup</strong><span>Firebase connected</span></span></a><nav class="nav-links">${navHtml(active)}</nav><div class="auth-area">${authHtml}</div></div>`;
}

function bindSignOut(header) {
  const logout = header.querySelector("[data-logout]");
  if (logout) logout.addEventListener("click", async () => { await logoutAccount(); window.location.href = "login.html"; });
}

async function updateHeaderFromAuth() {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  const active = header.dataset.active || "index";
  const guest = `<a class="link-btn" href="login.html">Login</a><a class="link-btn primary" href="signup.html">Sign Up</a>`;
  if (!currentUser) {
    header.innerHTML = headerShell(active, guest);
    return;
  }
  let profile = null;
  try { profile = await ensureUserProfile(currentUser); } catch (error) { console.warn("Profile load failed", error); }
  const label = profile?.username || currentUser.displayName || currentUser.email || "Profile";
  const points = Number(profile?.points) || 0;
  header.innerHTML = headerShell(active, `<span class="user-pill">${label}</span><span class="points-pill" data-points>${points} pts</span><button class="btn ghost" data-logout>Sign Out</button>`);
  bindSignOut(header);
}

export function renderHeader(active) {
  const header = document.querySelector("[data-header]");
  if (!header) return;
  header.dataset.active = active;
  header.innerHTML = headerShell(active, `<a class="link-btn" href="login.html">Login</a><a class="link-btn primary" href="signup.html">Sign Up</a>`);
  updateHeaderFromAuth();
}

async function requireLogin() {
  await authReady;
  if (auth.currentUser) return true;
  alert("Please login before placing an order.");
  window.location.href = "login.html";
  return false;
}

async function refreshPoints() {
  const points = await currentPoints();
  document.querySelectorAll("[data-points]").forEach((node) => { node.textContent = points + " pts"; });
}

function fillBundleSelect(select, gameKey) {
  const game = TopupData.games[gameKey];
  if (!select || select.options.length > 1) return;
  select.innerHTML = '<option value="">Select a bundle</option>';
  game.bundles.forEach((bundle, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${bundle.label} - ${money(bundle.amount)}`;
    select.appendChild(option);
  });
}

export function initOrderModal() {
  const modal = document.querySelector("[data-order-modal]");
  if (!modal) return;
  const title = modal.querySelector("[data-modal-title]");
  const player = modal.querySelector("[data-player-id]");
  const phone = modal.querySelector("[data-phone]");
  const bundle = modal.querySelector("[data-bundle]");
  const offer = modal.querySelector("[data-offer]");
  const summary = modal.querySelector("[data-summary]");
  const pay = modal.querySelector("[data-pay]");
  if (pay) pay.textContent = "Show QR and Pay";
  let currentKey = null;
  const update = () => {
    if (!currentKey || bundle.value === "") { summary.textContent = "Choose a bundle to see the final amount."; return; }
    const selected = TopupData.games[currentKey].bundles[Number(bundle.value)];
    summary.textContent = `${selected.label} | ${offer.checked ? "10% first order offer applied" : "Standard price"} | Total ${money(discounted(selected.amount, offer.checked))}`;
  };
  document.querySelectorAll("[data-open-order]").forEach((button) => button.addEventListener("click", async () => {
    if (!(await requireLogin())) return;
    currentKey = button.dataset.openOrder;
    const game = TopupData.games[currentKey];
    title.textContent = `Order ${game.name} ${game.item}`;
    player.value = ""; phone.value = ""; offer.checked = true;
    fillBundleSelect(bundle, currentKey); update(); modal.classList.add("open"); player.focus();
  }));
  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => modal.classList.remove("open")));
  bundle.addEventListener("change", update); offer.addEventListener("change", update);
  pay.addEventListener("click", async () => {
    if (!currentKey) return;
    if (!player.value.trim()) { alert("Please enter your player ID."); player.focus(); return; }
    if (bundle.value === "") { alert("Please select a bundle."); return; }
    const game = TopupData.games[currentKey];
    const selected = game.bundles[Number(bundle.value)];
    const order = { game: game.name, item: game.item, bundle: selected.label, playerId: player.value.trim(), phone: phone.value.trim() || "Not provided", amount: discounted(selected.amount, offer.checked) };
    try {
      await saveOrder(order); await refreshPoints(); modal.classList.remove("open");
      showPaymentPanel(order);
    } catch (error) { alert(error.message || "Could not save order."); }
  });
}

export function initGamePage(gameKey) {
  const game = TopupData.games[gameKey];
  if (!game) return;
  document.querySelectorAll("[data-game-name]").forEach((node) => { node.textContent = game.name; });
  document.querySelectorAll("[data-game-item]").forEach((node) => { node.textContent = game.item; });
  document.querySelectorAll("[data-game-logo]").forEach((node) => { node.src = game.logo; node.alt = game.name + " logo"; });
  document.querySelectorAll("[data-game-description]").forEach((node) => { node.textContent = game.description; });
  const plans = document.querySelector("[data-plan-grid]");
  if (plans && !plans.children.length) plans.innerHTML = game.bundles.map((bundle, index) => `<article class="plan-card"><img src="${game.logo}" alt="${game.name} logo"><div><strong>${bundle.label}</strong><span>${money(bundle.amount)}</span></div><button class="btn ghost" data-select-plan="${index}">Select</button></article>`).join("");
  const form = document.querySelector("[data-game-form]");
  if (!form) return;
  const player = form.querySelector("[data-player-id]");
  const phone = form.querySelector("[data-phone]");
  const bundle = form.querySelector("[data-bundle]");
  const offer = form.querySelector("[data-offer]");
  const summary = form.querySelector("[data-summary]");
  const submit = form.querySelector("button[type='submit']");
  if (submit) submit.textContent = "Show QR and Pay";
  fillBundleSelect(bundle, gameKey);
  const update = () => {
    if (bundle.value === "") { summary.textContent = "Select a bundle to calculate the final payable amount."; return; }
    const selected = game.bundles[Number(bundle.value)];
    summary.textContent = `${selected.label} | ${offer.checked ? "10% first order offer applied" : "Standard price"} | Total ${money(discounted(selected.amount, offer.checked))}`;
  };
  bundle.addEventListener("change", update); offer.addEventListener("change", update);
  document.querySelectorAll("[data-select-plan]").forEach((button) => button.addEventListener("click", () => { bundle.value = button.dataset.selectPlan; update(); form.scrollIntoView({ behavior: "smooth", block: "center" }); }));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!(await requireLogin())) return;
    if (!player.value.trim()) { alert("Please enter your player ID."); player.focus(); return; }
    if (bundle.value === "") { alert("Please select a bundle."); return; }
    const selected = game.bundles[Number(bundle.value)];
    const order = { game: game.name, item: game.item, bundle: selected.label, playerId: player.value.trim(), phone: phone.value.trim() || "Not provided", amount: discounted(selected.amount, offer.checked) };
    try {
      await saveOrder(order); await refreshPoints();
      showPaymentPanel(order);
    } catch (error) { alert(error.message || "Could not save order."); }
  });
  update();
}

export function initRedeem() {
  const button = document.querySelector("[data-redeem]");
  if (!button) return;
  button.addEventListener("click", async () => {
    if (!(await requireLogin())) return;
    const profile = await currentProfile();
    const points = Number(profile?.points) || 0;
    if (points < 280) { alert(`You have ${points} points. You need 280 points to redeem INR 70 credit.`); return; }
    const redeem = Math.floor(points / 280) * 280;
    const credit = (redeem / 280) * 70;
    if (!confirm(`Redeem ${redeem} points for INR ${credit.toFixed(2)} topup credit?`)) return;
    await addDoc(collection(db, "redemptions"), { uid: auth.currentUser.uid, username: profile.username, pointsRedeemed: redeem, topupCredit: credit, createdAt: serverTimestamp() });
    await updateDoc(doc(db, "users", auth.currentUser.uid), { points: increment(-redeem), updatedAt: serverTimestamp() });
    await refreshPoints();
    alert("Redemption saved in Firebase.");
  });
}

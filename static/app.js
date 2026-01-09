const clientId = (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : (Date.now().toString(36) + Math.random().toString(36).slice(2));

const $ = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");

async function api(path, method = "GET", data = null) {
  const opts = { method, headers: {} };
  if (data) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(data);
  }
  const res = await fetch(path, opts);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

// Sections
const startMenu = $("startMenu");
const loginPanel = $("loginPanel");
const createPanel = $("createPanel");
const forgotPanel = $("forgotPanel"); // NEW
const userArea = $("userArea");

// Delete modal UI
const deleteModal = $("deleteModal");
const confirmDeleteBtn = $("confirmDeleteBtn");
const cancelDeleteBtn = $("cancelDeleteBtn");

// User UI
const playerName = $("playerName");
const playerScore = $("playerScore");
const playerGames = $("playerGames");
const toast = $("toast");

const userMenuButtons = $("userMenuButtons");
const lbPanel = $("lbPanel");
const leaderboardEl = $("leaderboard");
const closeLbBtn = $("closeLbBtn");

const gamePanel = $("gamePanel");
const exitToMenuBtn = $("exitToMenuBtn");

const rules = $("rules");
const guessInput = $("guessInput");
const guessBtn = $("guessBtn");
const forfeitBtn = $("forfeitBtn");
const remainingEl = $("remaining");
const historyEl = $("history");

// Performance UI (right side)
const myStats = $("myStats");
const pctChart = $("pctChart");
const timeChart = $("timeChart");
const perfTitle = $("perfTitle");

// Profile modal (may not exist)
const profileModal = $("profileModal");
const closeProfileBtn = $("closeProfileBtn");

let currentUser = null;
let activeGame = false;
let selectedProfileUser = null;

// Difficulty highlight
const diffButtons = Array.from(document.querySelectorAll(".diff"));
function setActiveDiffButton(clickedBtn) {
  diffButtons.forEach(b => b.classList.remove("active-diff"));
  if (clickedBtn) clickedBtn.classList.add("active-diff");
}

function setToast(msg) {
  if (toast) toast.textContent = msg || "";
}

function resetToDefault(message = "") {
  currentUser = null;
  selectedProfileUser = null;
  activeGame = false;

  setActiveDiffButton(null);

  hide(loginPanel);
  hide(createPanel);
  hide(forgotPanel);
  hide(userArea);
  hide(lbPanel);
  hide(gamePanel);
  hide(profileModal);
  hide(deleteModal);

  if ($("loginMsg")) $("loginMsg").textContent = "";
  if ($("createMsg")) $("createMsg").textContent = "";
  if ($("forgotMsg")) $("forgotMsg").textContent = "";
  if ($("resetMsg")) $("resetMsg").textContent = "";
  if ($("startMsg")) $("startMsg").textContent = message;

  if ($("loginName")) $("loginName").value = "";
  if ($("loginPass")) $("loginPass").value = "";

  if ($("createName")) $("createName").value = "";
  if ($("createEmail")) $("createEmail").value = "";
  if ($("createPass")) $("createPass").value = "";

  if ($("forgotEmail")) $("forgotEmail").value = "";
  if ($("resetToken")) $("resetToken").value = "";
  if ($("resetNewPass")) $("resetNewPass").value = "";

  setToast("");
  show(startMenu);
}

// Navigation
$("btnGoLogin").onclick = () => {
  hide(startMenu);
  hide(createPanel);
  hide(forgotPanel);
  show(loginPanel);
  $("loginName")?.focus();
};

$("btnGoCreate").onclick = () => {
  hide(startMenu);
  hide(loginPanel);
  hide(forgotPanel);
  show(createPanel);
  $("createName")?.focus();
};

$("backFromLogin").onclick = () => {
  hide(loginPanel);
  show(startMenu);
  if ($("loginMsg")) $("loginMsg").textContent = "";
};

$("backFromCreate").onclick = () => {
  hide(createPanel);
  show(startMenu);
  if ($("createMsg")) $("createMsg").textContent = "";
};

// Forgot password navigation
const goForgot = $("goForgot");
if (goForgot) {
  goForgot.onclick = () => {
    hide(loginPanel);
    hide(createPanel);
    hide(startMenu);
    show(forgotPanel);
    $("forgotEmail")?.focus();
  };
}

const backFromForgot = $("backFromForgot");
if (backFromForgot) {
  backFromForgot.onclick = () => {
    hide(forgotPanel);
    show(loginPanel);
    if ($("forgotMsg")) $("forgotMsg").textContent = "";
    if ($("resetMsg")) $("resetMsg").textContent = "";
  };
}

// View helpers
function showMenuView() {
  activeGame = false;
  setActiveDiffButton(null);

  hide(gamePanel);
  hide(lbPanel);
  hide(profileModal);
  hide(deleteModal);
  show(userMenuButtons);
  setToast("");
}

function showGameView() {
  hide(userMenuButtons);
  hide(lbPanel);
  hide(profileModal);
  hide(deleteModal);
  show(gamePanel);
  setToast("Pick a difficulty to start.");
}

function showLeaderboardView() {
  hide(gamePanel);
  hide(userMenuButtons);
  hide(deleteModal);
  hide(profileModal);
  show(lbPanel);
  setToast("Leaderboard loaded.");
}

// LEADERBOARD LIST
function renderLeaderboard(list) {
  leaderboardEl.innerHTML = "";

  if (!list || list.length === 0) {
    const li = document.createElement("li");
    li.className = "top-player-line";
    li.textContent = "No players yet";
    leaderboardEl.appendChild(li);
    return;
  }

  list.forEach((u, i) => {
    const li = document.createElement("li");
    li.className = "top-player-line";
    li.dataset.username = u.username;

    // Mark logged-in player by default
    if (currentUser && u.username === currentUser) li.classList.add("active-player");
    // Mark clicked player as selected
    if (selectedProfileUser && u.username === selectedProfileUser) li.classList.add("selected-player");

    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = String(i + 1);

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = u.username;

    const score = document.createElement("span");
    score.className = "lb-score";
    score.textContent = `Scores - ${u.total_score}`;

    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(score);
    leaderboardEl.appendChild(li);
  });
}

if (closeProfileBtn) closeProfileBtn.onclick = () => hide(profileModal);

// MY PERFORMANCE
function renderMyStats(summary) {
  if (!myStats) return;

  myStats.innerHTML = `
    <div class="stat-card"><div class="label">Total Games</div><div class="value">${summary.total_games}</div></div>
    <div class="stat-card"><div class="label">Wins</div><div class="value">${summary.wins}</div></div>
    <div class="stat-card"><div class="label">Losses</div><div class="value">${summary.losses}</div></div>
    <div class="stat-card"><div class="label">Winning %</div><div class="value">${summary.win_pct}%</div></div>
    <div class="stat-card"><div class="label">Losing %</div><div class="value">${summary.lose_pct}%</div></div>
    <div class="stat-card"><div class="label">Average Time</div><div class="value">${summary.avg_time}s</div></div>
  `;
}

function buildTimeSeries(history) {
  let games = 0, wins = 0;
  let timeSum = 0, timeCount = 0;

  const labels = ["0"];
  const winPct = [0];
  const losePct = [0];
  const totalGames = [0];
  const avgTime = [0];

  history.forEach((h, i) => {
    games += 1;
    if (h.won === true) wins += 1;

    if (typeof h.time_taken === "number") {
      timeSum += h.time_taken;
      timeCount += 1;
    }

    const ts = h.ts || "";
    const label = ts.includes(" ") ? ts.split(" ")[1].slice(0, 5) : String(i + 1);
    labels.push(label);

    const w = games > 0 ? (wins / games) * 100 : 0;
    const w1 = Number(w.toFixed(1));
    const l1 = Number((100 - w1).toFixed(1));

    winPct.push(w1);
    losePct.push(l1);
    totalGames.push(games);

    const a = timeCount > 0 ? (timeSum / timeCount) : 0;
    avgTime.push(Number(a.toFixed(1)));
  });

  return { labels, winPct, losePct, totalGames, avgTime };
}

function clearCanvas(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function drawSmoothPartial(ctx, pts, color, tNorm) {
  if (pts.length < 2) return;

  const segCount = Math.max(2, Math.floor(pts.length * tNorm));
  const points = pts.slice(0, segCount);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const cx = (points[i].x + points[i + 1].x) / 2;
    const cy = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, cx, cy);
  }

  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

function niceMax(maxVal) {
  if (maxVal <= 1) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const n = maxVal / pow;
  let nice = 1;
  if (n <= 1) nice = 1;
  else if (n <= 2) nice = 2;
  else if (n <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

function drawAxesCommon(ctx, padL, padT, chartW, chartH) {
  ctx.strokeStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + chartH);
  ctx.lineTo(padL + chartW, padT + chartH);
  ctx.stroke();
}

function drawDualAxisLineChart(canvas, labels, leftSeries, rightSeries) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const W = canvas.width, H = canvas.height;
  const padL = 55, padR = 55, padT = 26, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const n = labels.length;

  const leftDataMax = Math.max(0, ...leftSeries);
  let leftMax = Math.ceil(leftDataMax);
  if (leftMax < 4) leftMax = 4;
  const leftTicks = leftMax;

  const rightDataMax = Math.max(0, ...rightSeries);
  const rightMax = niceMax(Math.max(1, rightDataMax));
  const rightTicks = 4;

  const step = Math.max(1, Math.floor(n / 6));

  function xAt(i) { return padL + (i / Math.max(1, n - 1)) * chartW; }
  function yLeft(v) { return padT + chartH - (v / leftMax) * chartH; }
  function yRight(v) { return padT + chartH - (v / rightMax) * chartH; }

  const leftPoints = leftSeries.map((v, i) => ({ x: xAt(i), y: yLeft(v) }));
  const rightPoints = rightSeries.map((v, i) => ({ x: xAt(i), y: yRight(v) }));

  function drawAxes() {
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + chartH);
    ctx.lineTo(padL + chartW, padT + chartH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(padL + chartW, padT);
    ctx.lineTo(padL + chartW, padT + chartH);
    ctx.stroke();

    ctx.font = "12px Arial";

    for (let i = 0; i <= leftTicks; i++) {
      const t = i / leftTicks;
      const y = padT + chartH - t * chartH;

      ctx.strokeStyle = "#1f2937";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(String(i), 10, y + 4);
    }

    for (let i = 0; i <= rightTicks; i++) {
      const y = padT + chartH - (i / rightTicks) * chartH;
      const rVal = Math.round((rightMax / rightTicks) * i);
      const text = String(rVal);
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(text, (padL + chartW + 45) - tw, y + 4);
    }

    for (let i = 0; i < n; i += step) {
      const x = xAt(i);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(labels[i], x - 10, padT + chartH + 26);
    }

    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(padL, padT - 14, 10, 10);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText("Total Games", padL + 14, padT - 5);

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(padL + 130, padT - 14, 10, 10);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText("Avg Time (s)", padL + 144, padT - 5);
  }

  const duration = 800;
  const start = performance.now();

  function frame(now) {
    const raw = Math.min(1, (now - start) / duration);
    const t = easeOutCubic(raw);

    drawAxes();
    drawSmoothPartial(ctx, leftPoints, "#3b82f6", t);
    drawSmoothPartial(ctx, rightPoints, "#f59e0b", t);

    if (raw < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function drawPercentLineChart(canvas, labels, winPct, losePct) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const W = canvas.width, H = canvas.height;
  const padL = 55, padR = 15, padT = 26, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const n = labels.length;
  const ticks = 4;
  const step = Math.max(1, Math.floor(n / 6));

  function xAt(i) { return padL + (i / Math.max(1, n - 1)) * chartW; }
  function yAtPct(v) { return padT + chartH - (v / 100) * chartH; }

  const winPoints = winPct.map((v, i) => ({ x: xAt(i), y: yAtPct(v) }));
  const losePoints = losePct.map((v, i) => ({ x: xAt(i), y: yAtPct(v) }));

  function drawAxes() {
    ctx.clearRect(0, 0, W, H);
    drawAxesCommon(ctx, padL, padT, chartW, chartH);

    ctx.font = "12px Arial";
    for (let i = 0; i <= ticks; i++) {
      const y = padT + chartH - (i / ticks) * chartH;

      ctx.strokeStyle = "#1f2937";
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(String(Math.round((100 / ticks) * i)) + "%", 10, y + 4);
    }

    for (let i = 0; i < n; i += step) {
      const x = xAt(i);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(labels[i], x - 10, padT + chartH + 26);
    }

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(padL, padT - 14, 10, 10);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText("Win %", padL + 14, padT - 5);

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(padL + 90, padT - 14, 10, 10);
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText("Lose %", padL + 104, padT - 5);
  }

  const duration = 800;
  const start = performance.now();

  function frame(now) {
    const raw = Math.min(1, (now - start) / duration);
    const t = easeOutCubic(raw);

    drawAxes();
    drawSmoothPartial(ctx, winPoints, "#22c55e", t);
    drawSmoothPartial(ctx, losePoints, "#ef4444", t);

    if (raw < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// Load any user's profile into RIGHT graphs
async function loadProfileToRight(username) {
  if (!username) return;

  selectedProfileUser = username;

  try {
    const lb = await api("/api/leaderboard");
    renderLeaderboard(lb.leaderboard);
  } catch (_) {}

  try {
    const out = await api("/api/profile", "POST", { client_id: clientId, username });

    if (perfTitle) {
      perfTitle.textContent = (username === currentUser) ? "My Performance" : `${username} Performance`;
    }

    renderMyStats(out.summary);

    const history = out.history || [];
    if (!history.length) {
      clearCanvas(pctChart);
      clearCanvas(timeChart);
      return;
    }

    const ts = buildTimeSeries(history);
    drawPercentLineChart(pctChart, ts.labels, ts.winPct, ts.losePct);
    drawDualAxisLineChart(timeChart, ts.labels, ts.totalGames, ts.avgTime);
  } catch (err) {
    setToast(err.message);
  }
}

leaderboardEl.addEventListener("click", async (e) => {
  const li = e.target.closest("li");
  if (!li || !li.dataset.username) return;
  await loadProfileToRight(li.dataset.username);
});

// ---------- LOGIN (username + password) ----------
$("loginBtn").onclick = async () => {
  $("loginMsg").textContent = "";
  try {
    const username = $("loginName").value.trim();
    const password = $("loginPass").value;

    if (!username) return $("loginMsg").textContent = "Enter your username.";
    if (!password) return $("loginMsg").textContent = "Enter your password.";

    const out = await api("/api/login", "POST", { client_id: clientId, username, password });

    currentUser = out.username;
    selectedProfileUser = out.username;

    playerName.textContent = out.username;
    playerScore.textContent = out.profile.total_score;
    playerGames.textContent = out.profile.total_games;

    hide(startMenu); hide(loginPanel); hide(createPanel); hide(forgotPanel);
    show(userArea);

    showMenuView();
    setToast("Logged in. Choose an option.");
  } catch (e) {
    $("loginMsg").textContent = e.message;
  }
};

// ---------- CREATE (username + email + password) ----------
$("createBtn").onclick = async () => {
  $("createMsg").textContent = "";
  try {
    const username = $("createName").value.trim();
    const email = $("createEmail").value.trim();
    const password = $("createPass").value;

    if (!username) return $("createMsg").textContent = "Enter a new username.";
    if (!email) return $("createMsg").textContent = "Enter your email.";
    if (!password || password.length < 6) return $("createMsg").textContent = "Password must be at least 6 characters.";

    const out = await api("/api/create", "POST", { client_id: clientId, username, email, password });

    currentUser = out.username;
    selectedProfileUser = out.username;

    playerName.textContent = out.username;
    playerScore.textContent = out.profile.total_score;
    playerGames.textContent = out.profile.total_games;

    hide(startMenu); hide(loginPanel); hide(createPanel); hide(forgotPanel);
    show(userArea);

    showMenuView();
    setToast("Account created. Choose an option.");
  } catch (e) {
    $("createMsg").textContent = e.message;
  }
};

// ---------- FORGOT PASSWORD ----------
const requestResetBtn = $("requestResetBtn");
if (requestResetBtn) {
  requestResetBtn.onclick = async () => {
    if ($("forgotMsg")) $("forgotMsg").textContent = "";
    try {
      const email = $("forgotEmail").value.trim();
      if (!email) return $("forgotMsg").textContent = "Enter your email.";

      const out = await api("/api/request_password_reset", "POST", { email });

      // Demo: backend returns token
      if (out.reset_token && $("resetToken")) {
        $("resetToken").value = out.reset_token;
      }

      if ($("forgotMsg")) $("forgotMsg").textContent = out.message || "If the account exists, a reset token was generated.";
      setToast("Reset token requested.");
    } catch (e) {
      if ($("forgotMsg")) $("forgotMsg").textContent = e.message;
    }
  };
}

const resetPassBtn = $("resetPassBtn");
if (resetPassBtn) {
  resetPassBtn.onclick = async () => {
    if ($("resetMsg")) $("resetMsg").textContent = "";
    try {
      const token = $("resetToken").value.trim();
      const new_password = $("resetNewPass").value;

      if (!token) return $("resetMsg").textContent = "Paste the reset token.";
      if (!new_password || new_password.length < 6) return $("resetMsg").textContent = "New password must be at least 6 characters.";

      const out = await api("/api/reset_password", "POST", { token, new_password });

      if ($("resetMsg")) $("resetMsg").textContent = out.message || "Password updated.";
      setToast("Password updated. Please login.");

      // go back to login
      hide(forgotPanel);
      show(loginPanel);
      $("loginName")?.focus();
    } catch (e) {
      if ($("resetMsg")) $("resetMsg").textContent = e.message;
    }
  };
}

// ---------- MENU ----------
$("menuPlay").onclick = () => showGameView();

$("menuLb").onclick = async () => {
  try {
    const out = await api("/api/leaderboard");
    renderLeaderboard(out.leaderboard);

    // load logged-in user performance by default
    if (currentUser) await loadProfileToRight(currentUser);

    showLeaderboardView();
  } catch (e) {
    setToast(e.message);
  }
};

closeLbBtn.onclick = () => {
  // "Back to Menu" from leaderboard: ensure logged-in user remains the active highlight next time
  selectedProfileUser = currentUser;
  showMenuView();
};

$("menuDelete").onclick = () => show(deleteModal);

if (confirmDeleteBtn) {
  confirmDeleteBtn.onclick = async () => {
    if (!currentUser) return;
    try {
      await api("/api/delete", "POST", { client_id: clientId, username: currentUser });
      hide(deleteModal);
      resetToDefault("Account deleted successfully.");
    } catch (e) {
      hide(deleteModal);
      setToast(e.message);
    }
  };
}

if (cancelDeleteBtn) {
  cancelDeleteBtn.onclick = () => hide(deleteModal);
}

$("menuExit").onclick = async () => {
  try { await api("/api/logout", "POST", { client_id: clientId }); } catch (_) {}
  resetToDefault("Exited game. Please login or create an account.");
};

exitToMenuBtn.onclick = () => {
  setActiveDiffButton(null);
  showMenuView();
};

// ---------- GAME ----------
diffButtons.forEach(btn => {
  btn.onclick = async () => {
    try {
      setActiveDiffButton(btn);

      const d = btn.dataset.d;
      const out = await api("/api/start", "POST", { client_id: clientId, difficulty: d });

      activeGame = true;

      rules.textContent = `Range ${out.game.range_min} - ${out.game.range_max}, Tries: ${out.game.max_guesses}`;
      remainingEl.textContent = out.game.max_guesses;
      historyEl.textContent = "-";

      guessInput.value = "";
      guessInput.focus();

      setToast("Game started. Make a guess.");
    } catch (e) {
      setActiveDiffButton(null);
      setToast(e.message);
    }
  };
});

guessBtn.onclick = async () => {
  if (!activeGame) return setToast("Start a game first.");
  try {
    const out = await api("/api/guess", "POST", { client_id: clientId, guess: guessInput.value });

    if (out.status === "win") {
      activeGame = false;
      setToast(`You won! Points: ${out.earned} | Time: ${out.time_taken}s`);
      if (out.profile) {
        playerScore.textContent = out.profile.total_score;
        playerGames.textContent = out.profile.total_games;
      }
      remainingEl.textContent = "-";
      historyEl.textContent = "-";
    } else if (out.status === "lose") {
      activeGame = false;
      setToast(out.message);
      if (out.profile && typeof out.profile.total_games !== "undefined") {
        playerGames.textContent = out.profile.total_games;
      }
      remainingEl.textContent = "0";
      historyEl.textContent = (out.history || []).join(", ") || "-";
    } else {
      setToast(out.message + " " + out.hint);
      remainingEl.textContent = out.remaining;
      historyEl.textContent = out.history.join(", ");
    }

    guessInput.select();
  } catch (e) {
    setToast(e.message);
  }
};

forfeitBtn.onclick = async () => {
  if (!activeGame) return setToast("No active game.");
  try {
    const out = await api("/api/forfeit", "POST", { client_id: clientId });

    activeGame = false;
    setToast(out.message);

    if (out.profile && typeof out.profile.total_games !== "undefined") {
      playerGames.textContent = out.profile.total_games;
    }

    remainingEl.textContent = "-";
    historyEl.textContent = "-";
  } catch (e) {
    setToast(e.message);
  }
};

// Start
resetToDefault("");

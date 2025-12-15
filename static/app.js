// Views
const viewHome = document.getElementById("view-home");
const viewName = document.getElementById("view-name");
const viewGame = document.getElementById("view-game");

// Home buttons
const btnCreate = document.getElementById("btn-create");
const btnJoin = document.getElementById("btn-join");

// Name view
const namePartyIdSpan = document.getElementById("name-party-id");
const nameInput = document.getElementById("name-input");
const btnNameConfirm = document.getElementById("btn-name-confirm");
const btnBackName = document.getElementById("btn-back-name");
const nameError = document.getElementById("name-error");

// Game top
const topPartyIdSpan = document.getElementById("top-party-id");
const playerNameDisplay = document.getElementById("player-name-display");
const playerRoleSpan = document.getElementById("player-role");
const playerStarsSpan = document.getElementById("player-stars");
const questionsLeftSpan = document.getElementById("questions-left");
const statusLabel = document.getElementById("status-label");
const statusValue = document.getElementById("status-value");

// Main section and action button
const mainSection = document.getElementById("main-section");
const actionButton = document.getElementById("action-button");

// Bottom info
const infoPrimary = document.getElementById("info-primary");
const infoSecondary = document.getElementById("info-secondary");

// Ranking
const btnRankingToggle = document.getElementById("btn-ranking-toggle");
const btnRankingClose = document.getElementById("btn-ranking-close");
const btnExit = document.getElementById("btn-exit");
const rankingPanel = document.getElementById("ranking-panel");
const rankingBackdrop = document.getElementById("ranking-backdrop");
const rankingList = document.getElementById("ranking-list");

// Local storage keys
const LS_PARTY_ID_KEY = "actrix_party_id";
const LS_PLAYER_ID_KEY = "actrix_player_id";
const LS_PLAYER_NAME_KEY = "actrix_player_name";

// Client state
let currentPartyId = null;
let currentPlayerId = null;
let currentPlayerName = null;
let meIsHost = false;
let currentState = "idle";
let pollInterval = null;

let myVoteTargetId = null;
let hasVoted = false;
let starPlayerId = null;
let starPlayerName = null;
let isPositive = null;
let taskOptions = [];
let selectedTaskIndex = null;

let currentActionMode = null;
let lastRenderKey = null;

// Helpers for session
function saveSession() {
  if (currentPartyId && currentPlayerId) {
    localStorage.setItem(LS_PARTY_ID_KEY, currentPartyId);
    localStorage.setItem(LS_PLAYER_ID_KEY, currentPlayerId);
    localStorage.setItem(LS_PLAYER_NAME_KEY, currentPlayerName || "");
  }
}

function clearSession() {
  localStorage.removeItem(LS_PARTY_ID_KEY);
  localStorage.removeItem(LS_PLAYER_ID_KEY);
  localStorage.removeItem(LS_PLAYER_NAME_KEY);
  currentPartyId = null;
  currentPlayerId = null;
  currentPlayerName = null;
}

// View switching
function showView(name) {
  viewHome.classList.add("hidden");
  viewName.classList.add("hidden");
  viewGame.classList.add("hidden");

  if (name === "home") viewHome.classList.remove("hidden");
  if (name === "name") viewName.classList.remove("hidden");
  if (name === "game") viewGame.classList.remove("hidden");

  if (name === "game" && !pollInterval) {
    pollInterval = setInterval(refreshPartyState, 1000);
  }
}

// Create party
btnCreate.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/create_party", { method: "POST" });
    if (!res.ok) {
      alert("Could not create party");
      return;
    }
    const data = await res.json();
    currentPartyId = data.party_id;
    namePartyIdSpan.textContent = currentPartyId;
    nameInput.value = "";
    nameError.classList.add("hidden");
    showView("name");
  } catch (e) {
    console.error(e);
    alert("Network problem while creating party");
  }
});

// Join party
btnJoin.addEventListener("click", async () => {
  const code = (window.prompt("Enter party id", "") || "").trim();
  if (!code || code.length !== 4) {
    alert("Please enter a four digit party id");
    return;
  }
  try {
    const res = await fetch("/api/join_party", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ party_id: code }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.detail || "Party not found");
      return;
    }
    const data = await res.json();
    currentPartyId = data.party_id;
    namePartyIdSpan.textContent = currentPartyId;
    nameInput.value = "";
    nameError.classList.add("hidden");
    showView("name");
  } catch (e) {
    console.error(e);
    alert("Network problem while joining party");
  }
});

// Name view
btnBackName.addEventListener("click", () => {
  currentPartyId = null;
  nameInput.value = "";
  nameError.classList.add("hidden");
  showView("home");
});

btnNameConfirm.addEventListener("click", async () => {
  if (!currentPartyId) {
    nameError.textContent = "No party selected";
    nameError.classList.remove("hidden");
    return;
  }
  const name = nameInput.value.trim();
  if (!name) {
    nameError.textContent = "Name cannot be empty";
    nameError.classList.remove("hidden");
    return;
  }
  if (name.length > 10) {
    nameError.textContent = "Name must be at most 10 characters";
    nameError.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch("/api/register_player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ party_id: currentPartyId, player_name: name }),
    });
    if (!res.ok) {
      const err = await res.json();
      nameError.textContent = err.detail || "Could not register player";
      nameError.classList.remove("hidden");
      return;
    }
    const data = await res.json();
    currentPlayerId = data.player_id;
    currentPlayerName = data.name;
    meIsHost = data.is_host;

    topPartyIdSpan.textContent = data.party_id;
    playerNameDisplay.textContent = data.name;
    playerStarsSpan.textContent = data.stars;
    playerRoleSpan.textContent = meIsHost ? "Host" : "Player";
    questionsLeftSpan.textContent = "0";
    statusLabel.textContent = "Lobby";
    statusValue.textContent = "Waiting";

    infoPrimary.textContent = "Lobby";
    infoSecondary.textContent = "Host starts the next round.";

    myVoteTargetId = null;
    hasVoted = false;
    starPlayerId = null;
    starPlayerName = null;
    isPositive = null;
    taskOptions = [];
    selectedTaskIndex = null;
    currentState = "idle";
    currentActionMode = null;
    lastRenderKey = null;

    saveSession();
    showView("game");
    refreshPartyState();
  } catch (e) {
    console.error(e);
    nameError.textContent = "Network problem while registering";
    nameError.classList.remove("hidden");
  }
});

// Ranking panel
function openRanking() {
  rankingPanel.classList.add("open");
  rankingBackdrop.classList.remove("hidden");
}

function closeRanking() {
  rankingPanel.classList.remove("open");
  rankingBackdrop.classList.add("hidden");
}

btnRankingToggle.addEventListener("click", () => {
  if (!currentPartyId || !currentPlayerId) return;
  openRanking();
  refreshPartyState();
});

btnRankingClose.addEventListener("click", () => {
  closeRanking();
});

rankingBackdrop.addEventListener("click", () => {
  closeRanking();
});

// Exit button
btnExit.addEventListener("click", () => {
  clearSession();
  closeRanking();
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  showView("home");
});

// Action button handler
actionButton.addEventListener("click", async () => {
  if (actionButton.disabled) return;
  if (!currentPartyId || !currentPlayerId) return;

  if (currentActionMode === "start_round") {
    try {
      const res = await fetch("/api/start_round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_id: currentPartyId,
          player_id: currentPlayerId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Could not start round");
        return;
      }
      refreshPartyState();
    } catch (e) {
      console.error(e);
      alert("Network problem while starting round");
    }
    return;
  }

  if (currentActionMode === "submit_vote") {
    if (!myVoteTargetId) return;
    try {
        const res = await fetch("/api/submit_vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            party_id: currentPartyId,
            player_id: currentPlayerId,
            target_player_id: myVoteTargetId,
        }),
        });
        if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Could not submit vote");
        return;
        }

        // Immediately lock this client
        hasVoted = true;
        updateActionButtonState();

        // Then pull fresh state for everyone
        setTimeout(refreshPartyState, 200);
    } catch (e) {
        console.error(e);
        alert("Network problem while submitting vote");
    }
    return;
    }

  if (currentActionMode === "choose_task") {
    if (selectedTaskIndex === null) return;
    try {
      const res = await fetch("/api/star_choose_task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_id: currentPartyId,
          player_id: currentPlayerId,
          task_index: selectedTaskIndex,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Could not choose task");
        return;
      }
      setTimeout(refreshPartyState, 300);
    } catch (e) {
      console.error(e);
      alert("Network problem while choosing task");
    }
    return;
  }
});

// Party state polling
async function refreshPartyState() {
  if (!currentPartyId || !currentPlayerId) return;
  try {
    const res = await fetch(
      `/api/party_state?party_id=${currentPartyId}&player_id=${currentPlayerId}`
    );
    if (!res.ok) {
      if (res.status === 404) {
        clearSession();
        showView("home");
      }
      return;
    }
    const data = await res.json();
    applyPartyState(data);
  } catch (e) {
    console.error(e);
  }
}

function applyPartyState(data) {
  currentState = data.state;
  meIsHost = data.me_is_host;
  starPlayerId = data.star_player_id;
  starPlayerName = data.star_player_name;
  isPositive = data.is_positive;

  // Keep local selection while still choosing during voting
  if (data.state === "voting") {
    if (data.you.has_voted) {
      // Server says you already voted, trust that
      hasVoted = true;
      myVoteTargetId = data.you.vote_target_id;
    }
    // If has_voted is false, do not overwrite myVoteTargetId
    // so your current choice stays live until you hit Confirm
  } else {
    // Outside voting we can sync everything from server
    myVoteTargetId = data.you.vote_target_id;
    hasVoted = data.you.has_voted;
  }

  playerNameDisplay.textContent = data.you.name;
  playerStarsSpan.textContent = data.you.stars;
  questionsLeftSpan.textContent = data.questions_left;
  topPartyIdSpan.textContent = data.party_id;
  playerRoleSpan.textContent = meIsHost ? "Host" : "Player";

  // Ranking list and the rest stay the same
  rankingList.innerHTML = "";
  data.players.forEach((p, index) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    const right = document.createElement("span");
    left.textContent = `${index + 1}. ${p.name}`;
    right.textContent = p.stars;
    li.appendChild(left);
    li.appendChild(right);
    rankingList.appendChild(li);
  });

  renderMainSection(data);
  updateStatusAndInfo(data);
  updateActionButtonState();
}

function makeRenderKey(data) {
  const q = data.question_text || "";
  const state = data.state;
  const starId = data.star_player_id || "";
  const selTask = data.selected_task || "";
  return `${state}|${q}|${starId}|${selTask}|${data.round_number}`;
}

function renderMainSection(data) {
  const key = makeRenderKey(data);
  if (key === lastRenderKey) {
    return;
  }
  lastRenderKey = key;

  mainSection.innerHTML = "";

  if (data.state === "finished") {
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = "No more questions. Open ranking and tap Exit when you are done.";
    mainSection.appendChild(p);
    return;
  }

  if (data.state === "idle") {
    const p1 = document.createElement("p");
    p1.className = "placeholder";
    p1.textContent = meIsHost
      ? "Tap Start round to begin."
      : "Waiting for host to start the next round.";
    mainSection.appendChild(p1);
    return;
  }

  if (data.state === "voting") {
    const title = document.createElement("div");
    title.className = "question-title";
    title.textContent = "In this party";
    const q = document.createElement("div");
    q.className = "question-text";
    q.textContent = data.question_text || "";
    mainSection.appendChild(title);
    mainSection.appendChild(q);

    const list = document.createElement("div");
    list.className = "players-list";

    data.players.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "player-choice";
      btn.textContent = p.name;
      btn.dataset.playerId = p.id;
      if (myVoteTargetId === p.id) {
        btn.classList.add("selected");
      }
      btn.addEventListener("click", () => {
        if (hasVoted) return;
        myVoteTargetId = p.id;
        const all = mainSection.querySelectorAll(".player-choice");
        all.forEach((b) => {
          b.classList.toggle("selected", b.dataset.playerId === myVoteTargetId);
        });
        updateActionButtonState();
      });
      list.appendChild(btn);
    });

    mainSection.appendChild(list);
    return;
  }

  if (data.state === "task_choice") {
    if (currentPlayerId === data.star_player_id) {
      const p1 = document.createElement("div");
      p1.className = "question-title";
      p1.textContent = "You are the star of this round.";
      const p2 = document.createElement("div");
      p2.className = "question-text";
      p2.textContent = "Choose one task and confirm.";
      mainSection.appendChild(p1);
      mainSection.appendChild(p2);

      const opts = data.task_options_for_star || [];
      taskOptions = opts;
      selectedTaskIndex = selectedTaskIndex ?? null;

      const list = document.createElement("div");
      list.className = "task-options";

      opts.forEach((text, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "task-option";
        btn.textContent = text;
        btn.dataset.index = String(index);
        if (selectedTaskIndex === index) {
          btn.classList.add("selected");
        }
        btn.addEventListener("click", () => {
          selectedTaskIndex = index;
          const all = mainSection.querySelectorAll(".task-option");
          all.forEach((b, i) => {
            b.classList.toggle("selected", i === index);
          });
          updateActionButtonState();
        });
        list.appendChild(btn);
      });
      mainSection.appendChild(list);
    } else {
      const p1 = document.createElement("p");
      p1.className = "placeholder";
      if (data.star_player_name) {
        p1.textContent = `${data.star_player_name} has the majority votes and is choosing a task.`;
      } else {
        p1.textContent = "The star is choosing a task.";
      }
      mainSection.appendChild(p1);
    }
    return;
  }

  if (data.state === "task_result") {
    const p1 = document.createElement("div");
    p1.className = "question-title";
    p1.textContent = "Result";

    const p2 = document.createElement("div");
    p2.className = "question-text";
    if (data.star_player_name && data.selected_task) {
      p2.textContent = `${data.star_player_name} selected:`;
      const p3 = document.createElement("p");
      p3.className = "placeholder";
      p3.textContent = data.selected_task;
      mainSection.appendChild(p1);
      mainSection.appendChild(p2);
      mainSection.appendChild(p3);
      return;
    } else {
      p2.textContent = "Waiting for host to start the next round.";
      mainSection.appendChild(p1);
      mainSection.appendChild(p2);
      return;
    }
  }

  const p = document.createElement("p");
  p.className = "placeholder";
  p.textContent = "Waiting for game state.";
  mainSection.appendChild(p);
}

function updateStatusAndInfo(data) {
  if (data.state === "idle") {
    statusLabel.textContent = "State";
    statusValue.textContent = "Lobby";
    infoPrimary.textContent = "Lobby";
    infoSecondary.textContent = meIsHost
      ? "Tap Start round when everyone is ready."
      : "Waiting for host.";
    return;
  }
  if (data.state === "voting") {
    statusLabel.textContent = "State";
    statusValue.textContent = "Voting";
    infoPrimary.textContent = "Vote for one person.";
    infoSecondary.textContent = hasVoted
      ? "You voted. Waiting for others."
      : "Tap one name and confirm.";
    return;
  }
  if (data.state === "task_choice") {
    statusLabel.textContent = "State";
    statusValue.textContent = "Task choice";
    if (currentPlayerId === data.star_player_id) {
      infoPrimary.textContent = "Pick one task.";
      infoSecondary.textContent = "Tap a task then confirm.";
    } else {
      infoPrimary.textContent = "Waiting for the star.";
      infoSecondary.textContent = data.star_player_name
        ? `Waiting for ${data.star_player_name} to choose.`
        : "Star is choosing.";
    }
    return;
  }
  if (data.state === "task_result") {
    statusLabel.textContent = "State";
    statusValue.textContent = "Result";
    infoPrimary.textContent = "Task revealed.";
    infoSecondary.textContent = meIsHost
      ? "Tap Next round when you are ready."
      : "Wait for host to start next round.";
    return;
  }
  if (data.state === "finished") {
    statusLabel.textContent = "State";
    statusValue.textContent = "Finished";
    infoPrimary.textContent = "No more questions.";
    infoSecondary.textContent = "Open ranking and tap Exit.";
    return;
  }
}

function updateActionButtonState() {
  actionButton.disabled = true;
  currentActionMode = null;

  if (!currentPartyId || !currentPlayerId) {
    actionButton.textContent = "Waiting";
    return;
  }

  if (currentState === "finished") {
    actionButton.textContent = "Finished";
    return;
  }

  if (currentState === "idle") {
    if (meIsHost) {
      actionButton.textContent = "Start round";
      actionButton.disabled = false;
      currentActionMode = "start_round";
    } else {
      actionButton.textContent = "Waiting for host";
    }
    return;
  }

  if (currentState === "voting") {
    if (hasVoted) {
      actionButton.textContent = "Vote sent";
      actionButton.disabled = true;
      return;
    }
    actionButton.textContent = "Confirm vote";
    if (myVoteTargetId) {
      actionButton.disabled = false;
      currentActionMode = "submit_vote";
    } else {
      actionButton.disabled = true;
    }
    return;
  }

  if (currentState === "task_choice") {
    if (currentPlayerId === starPlayerId) {
      actionButton.textContent = "Confirm task";
      if (selectedTaskIndex !== null) {
        actionButton.disabled = false;
        currentActionMode = "choose_task";
      } else {
        actionButton.disabled = true;
      }
    } else {
      actionButton.textContent = "Waiting for star";
      actionButton.disabled = true;
    }
    return;
  }

  if (currentState === "task_result") {
    if (meIsHost) {
      actionButton.textContent = "Next round";
      actionButton.disabled = false;
      currentActionMode = "start_round";
    } else {
      actionButton.textContent = "Waiting for host";
      actionButton.disabled = true;
    }
    return;
  }

  actionButton.textContent = "Waiting";
}

// Resume on reload
async function initApp() {
  const storedPartyId = localStorage.getItem(LS_PARTY_ID_KEY);
  const storedPlayerId = localStorage.getItem(LS_PLAYER_ID_KEY);
  const storedName = localStorage.getItem(LS_PLAYER_NAME_KEY);

  if (!storedPartyId || !storedPlayerId) {
    showView("home");
    return;
  }

  try {
    const res = await fetch(
      `/api/party_state?party_id=${storedPartyId}&player_id=${storedPlayerId}`
    );
    if (!res.ok) {
      clearSession();
      showView("home");
      return;
    }
    const data = await res.json();
    currentPartyId = storedPartyId;
    currentPlayerId = storedPlayerId;
    currentPlayerName = storedName || data.you.name;
    meIsHost = data.me_is_host;

    topPartyIdSpan.textContent = data.party_id;
    playerNameDisplay.textContent = data.you.name;
    playerStarsSpan.textContent = data.you.stars;
    playerRoleSpan.textContent = meIsHost ? "Host" : "Player";
    questionsLeftSpan.textContent = data.questions_left;

    statusLabel.textContent = "State";
    statusValue.textContent = data.state;

    infoPrimary.textContent = "Restored session.";
    infoSecondary.textContent = "Waiting for updates.";

    showView("game");
    applyPartyState(data);
  } catch (e) {
    console.error(e);
    clearSession();
    showView("home");
  }
}

initApp();
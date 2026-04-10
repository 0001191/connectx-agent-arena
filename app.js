const boardElement = document.getElementById("board");
const headerElement = document.getElementById("board-header");
const statusElement = document.getElementById("status-text");
const restartButton = document.getElementById("restart-button");
const choiceButtons = Array.from(document.querySelectorAll(".choice"));
const boardShellElement = document.querySelector(".board-shell");
const backendNoteElement = document.getElementById("backend-note");

const params = new URLSearchParams(window.location.search);
const configuredApiBase = params.get("api") || window.CONNECTX_API_BASE || "";
const API_BASE = configuredApiBase.replace(/\/$/, "");
const GAME_ID_KEY = "connectx_public_game_id";

let state = null;
let gameId = null;
let aiRequestInFlight = false;

function markClassForCell(value) {
  if (!state) {
    return "";
  }
  if (value === state.human_mark) {
    return "human";
  }
  if (value === state.ai_mark) {
    return "ai";
  }
  return "";
}

function isPlayableColumn(col) {
  return state && !state.done && state.turn === state.human_mark && state.board[col] === 0;
}

function isWinningCell(row, col) {
  return state && state.winning_cells.some((cell) => cell.row === row && cell.col === col);
}

function isLastMove(row, col) {
  return state && state.last_move && state.last_move.row === row && state.last_move.column === col;
}

function rememberGameId(nextGameId) {
  gameId = nextGameId;
  if (nextGameId) {
    window.localStorage.setItem(GAME_ID_KEY, nextGameId);
  } else {
    window.localStorage.removeItem(GAME_ID_KEY);
  }
}

function renderHeader() {
  headerElement.innerHTML = "";
  for (let col = 0; col < state.columns; col += 1) {
    const label = document.createElement("div");
    label.textContent = `Col ${col}`;
    headerElement.appendChild(label);
  }
}

function renderBoard() {
  boardElement.innerHTML = "";
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.columns; col += 1) {
      const cell = document.createElement("button");
      const value = state.board[col + row * state.columns];
      cell.className = "cell";
      const occupantClass = markClassForCell(value);
      if (occupantClass) {
        cell.classList.add(occupantClass);
      }
      if (isPlayableColumn(col)) {
        cell.classList.add("playable");
        cell.addEventListener("mouseenter", () => highlightColumn(col, true));
        cell.addEventListener("mouseleave", () => highlightColumn(col, false));
        cell.addEventListener("click", () => playMove(col));
      }
      if (isWinningCell(row, col)) {
        cell.classList.add("winning");
      }
      if (isLastMove(row, col)) {
        cell.classList.add("last-move");
      }
      cell.setAttribute("aria-label", `row ${row} column ${col}`);
      boardElement.appendChild(cell);
    }
  }
}

function highlightColumn(col, on) {
  const children = Array.from(boardElement.children);
  children.forEach((cell, index) => {
    const cellCol = index % state.columns;
    if (cellCol === col) {
      cell.classList.toggle("hovered", on && isPlayableColumn(col));
    }
  });
}

function renderStatus() {
  statusElement.textContent = state.message;
}

function renderControls() {
  choiceButtons.forEach((button) => {
    const isActive = Number(button.dataset.humanMark) === state.human_mark;
    button.classList.toggle("active", isActive);
  });
}

function renderThinkingState() {
  const isThinking = state && !state.done && state.turn === state.ai_mark;
  boardShellElement.classList.toggle("thinking", Boolean(isThinking));
}

function renderBackendNote() {
  if (!API_BASE || API_BASE.includes("YOUR-SPACE-NAME")) {
    backendNoteElement.textContent = "Backend: set window.CONNECTX_API_BASE in config.js to your Hugging Face Space URL.";
    backendNoteElement.classList.add("warning");
    return;
  }
  backendNoteElement.textContent = `Backend: ${API_BASE}`;
  backendNoteElement.classList.remove("warning");
}

function render() {
  renderBackendNote();
  renderHeader();
  renderBoard();
  renderStatus();
  renderControls();
  renderThinkingState();
}

async function fetchJson(path, options = {}) {
  if (!API_BASE || API_BASE.includes("YOUR-SPACE-NAME")) {
    throw new Error("Frontend is not configured yet. Update gh_pages_connectx/config.js with your Space URL.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Unexpected response from backend (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

async function loadState() {
  renderBackendNote();
  const savedGameId = window.localStorage.getItem(GAME_ID_KEY);
  if (!savedGameId) {
    await newGame(1);
    return;
  }

  try {
    const payload = await fetchJson(`/api/state/${savedGameId}`);
    rememberGameId(payload.game_id);
    state = payload;
    render();
    if (!state.done && state.turn === state.ai_mark) {
      await requestAiMove();
    }
  } catch (error) {
    rememberGameId(null);
    statusElement.textContent = error.message;
    if (error.message.includes("Frontend is not configured yet")) {
      return;
    }
    await newGame(1);
  }
}

async function playMove(column) {
  if (!isPlayableColumn(column) || aiRequestInFlight || !gameId) {
    return;
  }
  aiRequestInFlight = true;
  statusElement.textContent = "Dropping your piece...";
  try {
    state = await fetchJson(`/api/move/${gameId}`, {
      method: "POST",
      body: JSON.stringify({ column }),
    });
    rememberGameId(state.game_id);
    render();
    if (!state.done && state.turn === state.ai_mark) {
      await requestAiMove();
    }
  } catch (error) {
    statusElement.textContent = error.message;
  } finally {
    aiRequestInFlight = false;
  }
}

async function newGame(humanMark) {
  if (aiRequestInFlight) {
    return;
  }
  aiRequestInFlight = true;
  statusElement.textContent = "Starting new game...";
  try {
    state = await fetchJson("/api/new-game", {
      method: "POST",
      body: JSON.stringify({ human_mark: humanMark }),
    });
    rememberGameId(state.game_id);
    render();
    if (!state.done && state.turn === state.ai_mark) {
      await requestAiMove();
    }
  } catch (error) {
    statusElement.textContent = error.message;
  } finally {
    aiRequestInFlight = false;
  }
}

async function requestAiMove() {
  statusElement.textContent = state?.message || "AI is thinking...";
  await new Promise((resolve) => window.setTimeout(resolve, 220));
  state = await fetchJson(`/api/ai-move/${gameId}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  rememberGameId(state.game_id);
  render();
}

restartButton.addEventListener("click", () => {
  const activeButton = choiceButtons.find((button) => button.classList.contains("active"));
  const humanMark = Number(activeButton?.dataset.humanMark || 1);
  newGame(humanMark);
});

choiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    choiceButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    newGame(Number(button.dataset.humanMark));
  });
});

loadState();

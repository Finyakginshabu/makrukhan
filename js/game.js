const { BOARD_SIZE, START_SQUARE, toSquare, toPos, getValidMoves, simulate } = GameRules;

// Scores are sent to a small proxy (worker/index.js) that keeps the Discord
// webhook secret and recomputes the score from the moves.
const SUBMIT_URL = "https://makrukhan-submit.finyakginshabu.workers.dev";

const canvas = document.getElementById("chessboard");
const ctx = canvas.getContext("2d");

const LOGICAL_SIZE = 640;
const SCALE_FACTOR = 3;
const SQUARE_SIZE = LOGICAL_SIZE / BOARD_SIZE;
const ANIMATION_MS = 150;

canvas.width = LOGICAL_SIZE * SCALE_FACTOR;
canvas.height = LOGICAL_SIZE * SCALE_FACTOR;
ctx.scale(SCALE_FACTOR, SCALE_FACTOR);

const el = {
    score: document.getElementById("score-number"),
    delta: document.getElementById("score-delta"),
    pieceIcon: document.getElementById("piece-icon"),
    pieceName: document.getElementById("piece-name"),
    shieldChip: document.getElementById("shield-chip"),
    multChip: document.getElementById("mult-chip"),
    endChip: document.getElementById("end-chip"),
    history: document.getElementById("move-history"),
    copy: document.getElementById("copy-btn"),
    copyIcon: document.getElementById("copy-icon"),
    undo: document.getElementById("undo-btn"),
    reset: document.getElementById("reset-btn"),
    name: document.getElementById("nameInput"),
    send: document.getElementById("send-btn"),
    sendStatus: document.getElementById("send-status"),
    replayInput: document.getElementById("replay-input"),
    replayStart: document.getElementById("replay-start"),
    replayBack: document.getElementById("replay-back"),
    replayPlay: document.getElementById("replay-play"),
    replayPlayIcon: document.getElementById("replay-play-icon"),
    replayForward: document.getElementById("replay-forward"),
    replayEnd: document.getElementById("replay-end"),
    replaySpeed: document.getElementById("replay-speed"),
    replayStatus: document.getElementById("replay-status"),
};

const PIECE_SRC = {
    knight: "assets/pieces/knight.svg",
    rook: "assets/pieces/rook.svg",
    bishop: "assets/pieces/bishop.svg",
};

// Where each piece is actually drawn inside its 100×100 SVG (x, y, width,
// height, measured). The drawings aren't centred and differ in size, so they
// are scaled and centred from these boxes to fit every square the same way.
const PIECE_BOX = {
    knight: { x: 3.0, y: 18.7, w: 78.8, h: 72.1 },
    rook: { x: 13.3, y: 16.8, w: 66.4, h: 74.2 },
    bishop: { x: 20.5, y: 7.6, w: 59.0, h: 83.2 },
};
const PIECE_FILL = 0.86; // share of the square the piece may fill

const images = {
    board: loadImage("assets/board.svg"),
    knight: loadImage(PIECE_SRC.knight),
    rook: loadImage(PIECE_SRC.rook),
    bishop: loadImage(PIECE_SRC.bishop),
};

function loadImage(src) {
    const image = new Image();
    image.onload = () => render();
    image.src = src;
    return image;
}

// Every square visited, starting with START_SQUARE. All other game state
// (score, shields, current piece, visited squares) is derived by replaying it.
let history = [START_SQUARE];
let state = simulate([]);
let lastDelta = 0; // score change caused by the latest move
let sendState = "idle"; // idle | sending | sent | failed

let isAnimating = false;
let animation = null; // { target, frame } while a tapped move is sliding
let press = null; // set between pointerdown and pointerup on the canvas
let dragPoint = null; // where the dragged piece is drawn, in logical pixels

// ---------- Drawing ----------

function render(pieceAt = null) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    ctx.drawImage(images.board, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);
    grayOutVisitedSquares();

    if (!isAnimating) drawValidMoves();

    if (pieceAt) {
        drawPiece(pieceAt.x + SQUARE_SIZE / 2, pieceAt.y + SQUARE_SIZE / 2);
    } else if (dragPoint) {
        drawPiece(dragPoint.x, dragPoint.y);
    } else {
        const { row, col } = knightPos();
        drawPiece((col + 0.5) * SQUARE_SIZE, (row + 0.5) * SQUARE_SIZE);
    }
}

// Draws the current piece centred on (cx, cy), scaled so its drawn area fills
// PIECE_FILL of a square.
function drawPiece(cx, cy) {
    const box = PIECE_BOX[state.piece];
    const scale = (PIECE_FILL * SQUARE_SIZE) / Math.max(box.w, box.h); // px per SVG unit
    const left = cx - (box.x + box.w / 2) * scale;
    const top = cy - (box.y + box.h / 2) * scale;
    ctx.drawImage(images[state.piece], left, top, 100 * scale, 100 * scale);
}

// The "saturation" blend keeps each pixel's luminosity and drops its colour,
// so no pixel data has to be read back from the canvas.
function grayOutVisitedSquares() {
    ctx.save();
    ctx.globalCompositeOperation = "saturation";
    ctx.fillStyle = "#808080";
    for (const square of state.visited) {
        const { row, col } = toPos(square);
        ctx.fillRect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE);
    }
    ctx.restore();
}

function drawValidMoves() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    for (const { row, col } of getValidMoves(knightPos())) {
        ctx.beginPath();
        ctx.arc((col + 0.5) * SQUARE_SIZE, (row + 0.5) * SQUARE_SIZE, SQUARE_SIZE / 4, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// ---------- Game state ----------

function knightPos() {
    return toPos(state.current);
}

function isValidTarget(pos) {
    return getValidMoves(knightPos()).some(m => m.row === pos.row && m.col === pos.col);
}

function setHistory(newHistory) {
    history = newHistory;
    state = simulate(history.slice(1));
    lastDelta = history.length > 1 ? state.score - simulate(history.slice(1, -1)).score : 0;
    sendState = "idle";
    updateUI();
    render();
}

function makeMove(pos) {
    setHistory([...history, toSquare(pos)]);
}

function animateMove(target, duration = ANIMATION_MS) {
    isAnimating = true;
    const from = knightPos();
    let startTime = null;

    function step(timestamp) {
        if (startTime === null) startTime = timestamp;
        const linear = Math.min((timestamp - startTime) / duration, 1);

        if (linear < 1) {
            const progress = 1 - (1 - linear) ** 3; // ease-out: fast start, soft landing
            render({
                x: (from.col + (target.col - from.col) * progress) * SQUARE_SIZE,
                y: (from.row + (target.row - from.row) * progress) * SQUARE_SIZE,
            });
            animation.frame = requestAnimationFrame(step);
        } else {
            finishAnimation();
        }
    }

    animation = { target, frame: requestAnimationFrame(step) };
}

// Lands a sliding move right away, so fast taps never have to wait for it.
function finishAnimation() {
    if (!animation) return;
    cancelAnimationFrame(animation.frame);
    const { target } = animation;
    animation = null;
    isAnimating = false;
    makeMove(target);
}

// ---------- Panel ----------

function updateUI() {
    el.score.textContent = state.score;

    el.delta.hidden = lastDelta === 0;
    el.delta.textContent = lastDelta > 0 ? `+${lastDelta}` : `−${Math.abs(lastDelta)}`;
    el.delta.className = "delta " + (lastDelta > 0 ? "up" : "down");

    el.pieceIcon.src = PIECE_SRC[state.piece];
    el.pieceName.textContent = t("piece." + state.piece);

    // Armour no longer matters once the game is over.
    el.shieldChip.hidden = state.shields === 0 || state.ended;
    el.shieldChip.textContent = t("shield.chip", { n: state.shields });
    el.multChip.hidden = state.multiplier === 0;
    el.multChip.textContent = t("mult.chip", { n: state.multiplier });

    el.endChip.hidden = !state.ended;
    el.endChip.textContent = t("end.chip");

    el.history.replaceChildren(...history.map(square => {
        const li = document.createElement("li");
        li.textContent = square;
        return li;
    }));
    el.history.scrollTop = el.history.scrollHeight;

    el.copyIcon.textContent = copied ? "check" : "content_copy";
    el.copy.title = t(copied ? "history.copied" : "history.copy");
    el.copy.setAttribute("aria-label", el.copy.title);

    el.undo.disabled = history.length === 1;
    el.reset.disabled = history.length === 1;

    el.send.disabled = !state.ended || sendState === "sending" || sendState === "sent";
    el.sendStatus.textContent = !state.ended ? t("send.hint")
        : sendState === "idle" ? t("send.ready")
        : t("send." + sendState);

    updateReplayUI(); // its status shows the score at the end
}

// ---------- Input (mouse, touch and pen) ----------

function pointerPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (LOGICAL_SIZE / rect.width),
        y: (event.clientY - rect.top) * (LOGICAL_SIZE / rect.height),
    };
}

function pointerSquare(event) {
    const { x, y } = pointerPoint(event);
    return { row: Math.floor(y / SQUARE_SIZE), col: Math.floor(x / SQUARE_SIZE) };
}

canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    unloadReplay(); // the player takes over from a replay where it is
    finishAnimation(); // a new tap lands the previous move first

    const pos = pointerSquare(event);
    const knight = knightPos();
    press = { dragging: pos.row === knight.row && pos.col === knight.col };
    // Capture so the drop is still seen if the pointer leaves the canvas.
    canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
    if (!press?.dragging) return;
    dragPoint = pointerPoint(event);
    render();
});

canvas.addEventListener("pointerup", (event) => {
    if (!press) return;
    const { dragging } = press;
    press = null;
    dragPoint = null;

    const target = pointerSquare(event);
    if (!isValidTarget(target)) {
        render();
    } else if (dragging) {
        makeMove(target);
    } else {
        animateMove(target);
    }
});

canvas.addEventListener("pointercancel", () => {
    press = null;
    dragPoint = null;
    render();
});

// ---------- Buttons ----------

function undo() {
    unloadReplay();
    finishAnimation();
    if (history.length === 1) return;
    setHistory(history.slice(0, -1));
}

el.undo.addEventListener("click", undo);

el.reset.addEventListener("click", () => {
    unloadReplay();
    finishAnimation();
    setHistory([START_SQUARE]);
});

// ---------- Copy the move history ----------

let copied = false; // shows a tick on the copy button for a moment
let copiedTimer = 0;

// Copies the moves as "b1 a3 b5 …", the format the replay box takes.
el.copy.addEventListener("click", async () => {
    const text = history.join(" ");
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        // Older browsers, or a page not served over https.
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.append(area);
        area.select();
        document.execCommand("copy");
        area.remove();
    }

    copied = true;
    updateUI();
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
        copied = false;
        updateUI();
    }, 1500);
});

// ---------- Replay a pasted route ----------

// A loaded route can be played, paused and stepped through like a video. The
// board always shows the route's first `index` moves.

const REPLAY_STEP_MS = 800; // time from one move to the next at 1×
const REPLAY_SLIDE_MS = 280; // slide time per move at 1×
const REPLAY_SPEEDS = [0.67, 1, 2, 4];

let replay = null; // { moves, text, index, playing, timer } while a route is loaded
let replaySpeed = 1;
let replayError = null; // { key, params } when the pasted route can't be loaded

// Accepts any separators ("b1 a3", "b1-a3", "b1, a3"); a leading b1 is optional.
function parseRoute(text) {
    const squares = text.toLowerCase().match(/[a-h][1-8]/g) || [];
    if (squares[0] === START_SQUARE) squares.shift();
    return squares;
}

// Loads the route in the text box and puts the board back on b1. Returns
// false, with a message saying why, if the route is empty or has an illegal move.
function loadRoute() {
    unloadReplay();
    const moves = parseRoute(el.replayInput.value);
    if (moves.length === 0) {
        replayError = { key: "replay.empty", params: {} };
    } else {
        for (let i = 1; i <= moves.length; i++) {
            if (!simulate(moves.slice(0, i)).valid) {
                replayError = { key: "replay.invalid", params: { n: i, square: moves[i - 1] } };
                break;
            }
        }
    }
    if (replayError) {
        updateReplayUI();
        return false;
    }

    replay = { moves, text: el.replayInput.value, index: 0, playing: false, timer: 0 };
    finishAnimation();
    setHistory([START_SQUARE]);
    return true;
}

// Drops the loaded route, e.g. when the player makes a move of their own.
function unloadReplay() {
    if (replay) clearTimeout(replay.timer);
    replay = null;
    replayError = null;
    updateReplayUI();
}

function play() {
    // A new or edited route in the box is loaded first.
    if (!replay || replay.text !== el.replayInput.value) {
        if (!loadRoute()) return;
    }
    if (replay.index === replay.moves.length) goTo(0);
    replay.playing = true;
    tick();
}

function pause() {
    if (!replay) return;
    clearTimeout(replay.timer);
    replay.playing = false;
    updateReplayUI();
}

function tick() {
    finishAnimation(); // land the previous move
    if (replay.index === replay.moves.length) return pause();
    slideForward();
    replay.timer = setTimeout(tick, REPLAY_STEP_MS / replaySpeed);
}

function slideForward() {
    finishAnimation();
    if (replay.index === replay.moves.length) return;
    const square = replay.moves[replay.index++];
    animateMove(toPos(square), REPLAY_SLIDE_MS / replaySpeed);
    updateReplayUI();
}

// Jumps straight to the position after `index` moves, without sliding.
function goTo(index) {
    finishAnimation();
    replay.index = Math.max(0, Math.min(index, replay.moves.length));
    setHistory([START_SQUARE, ...replay.moves.slice(0, replay.index)]);
}

function updateReplayUI() {
    const loaded = replay !== null;
    const index = loaded ? replay.index : 0;
    const total = loaded ? replay.moves.length : 0;
    const playing = loaded && replay.playing;

    // Play loads the route from the box, so it needs something in the box (or a running replay to pause).
    el.replayPlay.disabled = !playing && el.replayInput.value.trim() === "";
    el.replayStart.disabled = el.replayBack.disabled = !loaded || index === 0;
    el.replayForward.disabled = el.replayEnd.disabled = !loaded || index === total;

    el.replayPlayIcon.textContent = playing ? "pause" : "play_arrow";
    setLabel(el.replayPlay, playing ? "replay.pause" : "replay.play");
    setLabel(el.replayStart, "replay.start");
    setLabel(el.replayBack, "replay.back");
    setLabel(el.replayForward, "replay.forward");
    setLabel(el.replayEnd, "replay.end");
    setLabel(el.replaySpeed, "replay.speed");
    el.replaySpeed.textContent = replaySpeed + "×";

    el.replayStatus.textContent = replayError ? t(replayError.key, replayError.params)
        : !loaded ? ""
        : index === total && !isAnimating ? t("replay.done", { score: state.score, total })
        : t("replay.progress", { n: index, total });
}

function setLabel(button, key) {
    button.title = t(key);
    button.setAttribute("aria-label", t(key));
}

el.replayPlay.addEventListener("click", () => (replay?.playing ? pause() : play()));
el.replayStart.addEventListener("click", () => { pause(); goTo(0); });
el.replayEnd.addEventListener("click", () => { pause(); goTo(replay.moves.length); });
el.replayBack.addEventListener("click", () => { pause(); goTo(replay.index - 1); });
el.replayForward.addEventListener("click", () => { pause(); slideForward(); });

el.replaySpeed.addEventListener("click", () => {
    replaySpeed = REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(replaySpeed) + 1) % REPLAY_SPEEDS.length];
    updateReplayUI(); // a playing replay picks the new speed up from its next move
});

el.replayInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        if (loadRoute()) play();
    }
});

// Pasting a route loads it, ready to play or step through.
el.replayInput.addEventListener("paste", () => setTimeout(loadRoute));
el.replayInput.addEventListener("input", updateReplayUI);

// Ctrl/Cmd+Z undoes a move, unless the player is typing.
document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z"
        && !event.target.closest("input, textarea, dialog")) {
        event.preventDefault();
        undo();
    }
});

el.send.addEventListener("click", async () => {
    if (!state.ended) return;

    const sentHistory = history;
    sendState = "sending";
    updateUI();

    let ok = false;
    try {
        const response = await fetch(SUBMIT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: el.name.value.trim(), moves: history.slice(1) }),
        });
        ok = response.ok;
    } catch {
        ok = false;
    }

    // Ignore the result if the player undid or reset while it was sending.
    if (history !== sentHistory) return;

    sendState = ok ? "sent" : "failed";
    updateUI();
});

// ---------- Help dialog ----------

const helpDialog = document.getElementById("help");

document.getElementById("help-btn").addEventListener("click", () => helpDialog.showModal());
document.getElementById("help-close").addEventListener("click", () => helpDialog.close());

// A click on the backdrop lands on the <dialog> itself, not its content.
helpDialog.addEventListener("click", (event) => {
    if (event.target === helpDialog) helpDialog.close();
});

onLanguageChange(updateUI);
updateUI();
render();

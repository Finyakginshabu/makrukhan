const canvas = document.getElementById("chessboard");
const ctx = canvas.getContext("2d");

const LOGICAL_SIZE = 640;
const SCALE_FACTOR = 3;

canvas.width = LOGICAL_SIZE * SCALE_FACTOR;
canvas.height = LOGICAL_SIZE * SCALE_FACTOR;

canvas.style.width = `${LOGICAL_SIZE}px`;
canvas.style.height = `${LOGICAL_SIZE}px`;
canvas.style.maxWidth = "100%";
canvas.style.maxHeight = "100%";
canvas.style.objectFit = "contain";

canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

ctx.scale(SCALE_FACTOR, SCALE_FACTOR);

const moveHistoryBox = document.getElementById("move-history");
const currentPieceBox = document.getElementById("current-piece");
const shields = document.getElementById("shields");
const multiplier = document.getElementById("multiplier");

const BOARD_SIZE = 8;
const SQUARE_SIZE = LOGICAL_SIZE / BOARD_SIZE;
const PIECE_SIZE = SQUARE_SIZE;

let knightPos = { row: 7, col: 1 };
let targetPos = { row: 7, col: 1 };
let isDragging = false;
let isRookForOneMove = false;
let isBishopForOneMove = false;
let moveHistory = [["b1"]];
let currentScore = 0;
let noPenaltyMoves = 0;
let lastMoveWasMultiplier = 0;
let moveHistoryStack = [];
let scoreHistory = [0];

let isAnimating = false;

const knightImage = new Image();
const rookImage = new Image();
const bishopImage = new Image();
const boardImage = new Image();

knightImage.draggable = false;
rookImage.draggable = false;
bishopImage.draggable = false;
boardImage.draggable = false;

knightImage.src = "assets/knight.svg";
rookImage.src = "assets/rook.svg";
bishopImage.src = "assets/bishop.svg";
boardImage.src = "assets/board.svg";

const specialSquares = {
    "a3": { points: 100, visited: false },
    "a5": { points: 300, visited: false },
    "a7": { points: 200, visited: false },
    "b8": { points: 600, visited: false },
    "c1": { points: 200, visited: false },
    "c3": { points: 100, visited: false },
    "c5": { points: 100, visited: false },
    "d2": { points: 100, visited: false },
    "d4": { points: 200, visited: false },
    "d6": { points: 100, visited: false },
    "d8": { points: 600, visited: false },
    "f2": { points: 200, visited: false },
    "f4": { points: 300, visited: false },
    "f6": { points: 200, visited: false },
    "f8": { points: 600, visited: false },
    "g1": { points: 100, visited: false },
    "g7": { points: 200, visited: false },
    "h2": { points: 200, visited: false },
    "h4": { points: 200, visited: false },
    "h8": { points: 600, visited: false },
};

boardImage.onload = knightImage.onload = rookImage.onload = bishopImage.onload = function () {
    drawGame();
};

function drawGame() {
    drawBoard();
    drawKnight();
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(boardImage, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

    const colNames = "abcdefgh";

    Object.keys(specialSquares).forEach(square => {
        if (specialSquares[square].visited) {
            let col = colNames.indexOf(square[0]);
            let row = 8 - parseInt(square[1]);

            let x = col * SQUARE_SIZE;
            let y = row * SQUARE_SIZE;

            let imageData = ctx.getImageData(
                x * SCALE_FACTOR, y * SCALE_FACTOR, 
                SQUARE_SIZE * SCALE_FACTOR, SQUARE_SIZE * SCALE_FACTOR
            );

            let pixels = imageData.data;
            for (let i = 0; i < pixels.length; i += 4) {
                let gray = 0.3 * pixels[i] + 0.59 * pixels[i + 1] + 0.11 * pixels[i + 2];
                pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
            }

            ctx.putImageData(imageData, x * SCALE_FACTOR, y * SCALE_FACTOR);
        }
    });

    if (!isAnimating) {
        drawValidMoves();
    }
}

function drawValidMoves() {
    const validMoves = getValidMoves(knightPos);
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";

    validMoves.forEach(move => {
        let x = move.col * SQUARE_SIZE + SQUARE_SIZE / 2;
        let y = move.row * SQUARE_SIZE + SQUARE_SIZE / 2;

        ctx.beginPath();
        ctx.arc(x, y, SQUARE_SIZE / 4, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function drawKnight() {
    let x = knightPos.col * SQUARE_SIZE;
    let y = knightPos.row * SQUARE_SIZE;

    let pieceImage = isRookForOneMove ? rookImage : isBishopForOneMove ? bishopImage : knightImage;

    ctx.drawImage(pieceImage, x, y, PIECE_SIZE, PIECE_SIZE);
}

function getValidMoves(pos) {
    const restrictedPositions = ["a8", "c8", "e8", "g8"];
    const colNames = "abcdefgh";
    let moveNotation = colNames[pos.col] + (8 - pos.row);

    if (restrictedPositions.includes(moveNotation)) {
        return [];
    }

    if (isRookForOneMove) return getRookMoves(pos);
    if (isBishopForOneMove) return getBishopMoves(pos);

    const moves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    return moves.map(([dr, dc]) => ({ row: pos.row + dr, col: pos.col + dc }))
        .filter(move => move.row >= 0 && move.row < BOARD_SIZE && move.col >= 0 && move.col < BOARD_SIZE);
}

function updateStatus() {
    currentPieceBox.textContent = isRookForOneMove
        ? "หมากปัจจุบัน: เรือ"
        : isBishopForOneMove
        ? "หมากปัจจุบัน: บิชอป"
        : "หมากปัจจุบัน: อัศวิน";
    shields.textContent = noPenaltyMoves > 0 ? `[${noPenaltyMoves}]` : "";
    multiplier.textContent = lastMoveWasMultiplier > 0 ? `X${lastMoveWasMultiplier}` : "";
}

function getRookMoves(pos) {
    let moves = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
        if (i !== pos.row) moves.push({ row: i, col: pos.col });
        if (i !== pos.col) moves.push({ row: pos.row, col: i });
    }
    return moves;
}

function getBishopMoves(pos) {
    let moves = [];
    for (let i = 1; i < BOARD_SIZE; i++) {
        if (pos.row + i < BOARD_SIZE && pos.col + i < BOARD_SIZE) moves.push({ row: pos.row + i, col: pos.col + i });
        if (pos.row + i < BOARD_SIZE && pos.col - i >= 0) moves.push({ row: pos.row + i, col: pos.col - i });
        if (pos.row - i >= 0 && pos.col + i < BOARD_SIZE) moves.push({ row: pos.row - i, col: pos.col + i });
        if (pos.row - i >= 0 && pos.col - i >= 0) moves.push({ row: pos.row - i, col: pos.col - i });
    }
    return moves;
}

function getMouseSquare(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_SIZE / rect.width;
    const scaleY = LOGICAL_SIZE / rect.height;

    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    return {
        row: Math.floor(mouseY / SQUARE_SIZE),
        col: Math.floor(mouseX / SQUARE_SIZE)
    };
}

function animateKnightMove() {
    isAnimating = true;

    let knightX = knightPos.col * SQUARE_SIZE;
    let knightY = knightPos.row * SQUARE_SIZE;
    let targetX = targetPos.col * SQUARE_SIZE;
    let targetY = targetPos.row * SQUARE_SIZE;

    const duration = 190;
    let startTime = null;

    function slideKnight(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = (timestamp - startTime) / duration;

        if (progress < 1) {
            let x = knightX + (targetX - knightX) * progress;
            let y = knightY + (targetY - knightY) * progress;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawBoard();
            ctx.drawImage(knightImage, x, y, PIECE_SIZE, PIECE_SIZE);

            requestAnimationFrame(slideKnight);
        } else {
            knightPos = { ...targetPos };
            isAnimating = false;
            updateMoveHistory();
            drawBoard();
            drawKnight();
        }
    }

    requestAnimationFrame(slideKnight);
}

canvas.addEventListener("mousedown", (event) => {
    const pos = getMouseSquare(event);
    if (pos.row === knightPos.row && pos.col === knightPos.col) {
        isDragging = true;
    }
});

canvas.addEventListener("mouseup", (event) => {
    if (!isDragging) return;
    isDragging = false;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (event.clientX - rect.left) * scaleX / SCALE_FACTOR;
    const mouseY = (event.clientY - rect.top) * scaleY / SCALE_FACTOR;

    const newPos = {
        row: Math.floor(mouseY / SQUARE_SIZE),
        col: Math.floor(mouseX / SQUARE_SIZE),
    };

    const validMoves = getValidMoves(knightPos);

    if (validMoves.some(move => move.row === newPos.row && move.col === newPos.col)) {
        knightPos = newPos;
        const colNames = "abcdefgh";
        const moveNotation = colNames[knightPos.col] + (8 - knightPos.row);

        if (moveNotation === "b4" || moveNotation === "e4" || moveNotation === "g3") {
            isBishopForOneMove = true;
        } else if (moveNotation === "d1" || moveNotation === "d7" || moveNotation === "g6") {
            isRookForOneMove = true;
        } else {
            isBishopForOneMove = false;
            isRookForOneMove = false;
        }

        updateMoveHistory();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    drawKnight();
});

function handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    const pos = getMouseSquare(touch);
    if (pos.row === knightPos.row && pos.col === knightPos.col) {
        isDragging = true;
    }
}

function handleTouchMove(event) {
    if (!isDragging) return;
    event.preventDefault();
    const touch = event.touches[0];

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x = (touch.clientX - rect.left) * scaleX / SCALE_FACTOR;
    let y = (touch.clientY - rect.top) * scaleY / SCALE_FACTOR;

    let pieceImage = isRookForOneMove ? rookImage : isBishopForOneMove ? bishopImage : knightImage;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    ctx.drawImage(pieceImage, x - PIECE_SIZE / 2, y - PIECE_SIZE / 2, PIECE_SIZE, PIECE_SIZE);
}

function handleTouchEnd(event) {
    if (!isDragging) return;
    isDragging = false;
    event.preventDefault();

    const touch = event.changedTouches[0];
    const newPos = getMouseSquare(touch);

    const validMoves = getValidMoves(knightPos);
    if (validMoves.some(move => move.row === newPos.row && move.col === newPos.col)) {
        knightPos = newPos;
        updateMoveHistory();
    }

    drawBoard();
    drawKnight();
}

canvas.addEventListener("mousemove", (event) => {
    if (isDragging) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBoard();

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let x = (event.clientX - rect.left) * scaleX / SCALE_FACTOR;
        let y = (event.clientY - rect.top) * scaleY / SCALE_FACTOR;

        let pieceImage = isRookForOneMove ? rookImage : isBishopForOneMove ? bishopImage : knightImage;

        ctx.drawImage(pieceImage, x - PIECE_SIZE / 2, y - PIECE_SIZE / 2, PIECE_SIZE, PIECE_SIZE);
    }
});

canvas.addEventListener("click", (event) => {

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (event.clientX - rect.left) * scaleX / SCALE_FACTOR;
    const mouseY = (event.clientY - rect.top) * scaleY / SCALE_FACTOR;

    const newPos = {
        row: Math.floor(mouseY / SQUARE_SIZE),
        col: Math.floor(mouseX / SQUARE_SIZE),
    };

    const validMoves = getValidMoves(knightPos);

    if (validMoves.some(move => move.row === newPos.row && move.col === newPos.col)) {
        targetPos = newPos;
        animateKnightMove();
        
        const colNames = "abcdefgh";
        const moveNotation = colNames[newPos.col] + (8 - newPos.row);

        if (moveNotation === "b4" || moveNotation === "e4" || moveNotation === "g3") {
            isRookForOneMove = false;
            isBishopForOneMove = true;
        } else if (moveNotation === "d1" || moveNotation === "d7" || moveNotation === "g6") {
            isBishopForOneMove = false;
            isRookForOneMove = true;
        } else {
            isBishopForOneMove = false;
            isRookForOneMove = false;
        }
    }
});

function updateMoveHistory() {
    const colNames = "abcdefgh";
    let moveNotation = colNames[knightPos.col] + (8 - knightPos.row);

    const allowedSendPositions = ["a8", "c8", "e8", "g8"];
    document.getElementById("send-btn").disabled = !allowedSendPositions.includes(moveNotation);

    const noPenaltySquares = ["b1", "b5", "c2", "c4", "c6", "e2", "f5", "g2", "h3", "a8", "c8", "e8", "g8"];
    let newScore = currentScore;

    // ✅ Apply penalty *only* if `noPenaltyMoves === 0`
    if (!noPenaltySquares.includes(moveNotation) && noPenaltyMoves === 0) {
        newScore *= 0.9;
    }

    if (noPenaltyMoves > 0) {
        noPenaltyMoves--;
    }

    // ✅ Assign multipliers for future moves
    let lastMove = null;
    if (moveHistory.length > 0) {
        let lastMoveSet = moveHistory[moveHistory.length - 1];
        if (lastMoveSet.length > 0) {
            lastMove = lastMoveSet[lastMoveSet.length - 1];
        }
    }

    // ✅ If last move was a multiplier square, apply the multiplier
    let multiplier = 1;
    if (["a6", "b3", "e6", "f3", "h5"].includes(lastMove)) {
        multiplier = 2;
    } else if (["f7", "h1"].includes(lastMove)) {
        multiplier = 3;
    }

    if (["a6", "b3", "e6", "f3", "h5"].includes(moveNotation)) {
        lastMoveWasMultiplier = 2;
    } else if (["f7", "h1"].includes(moveNotation)) {
        lastMoveWasMultiplier = 3;
    }

    if (["a4", "d3", "d5", "f1", "h7"].includes(moveNotation)) {
        noPenaltyMoves = 2;
    } else if (["a2", "b7", "g4"].includes(moveNotation)) {
        noPenaltyMoves = 3;
    }

    const bonusSquares = {
        "a1": 1.7, "b2": 1.2, "b6": 1.3, "c7": 1.2,
        "e1": 1.3, "e3": 1.2, "e5": 1.3, "e7": 1.3,
        "g5": 1.2, "h6": 1.3
    };

    // ✅ Apply bonus squares if they haven't been visited
    if (bonusSquares[moveNotation] && !specialSquares[moveNotation]?.visited) {
        newScore *= bonusSquares[moveNotation];
    }

    // ✅ Apply special square points if not visited
    if (specialSquares[moveNotation] && !specialSquares[moveNotation].visited) {
        let points = specialSquares[moveNotation].points;

        // ✅ Use multiplier based on last move
        points *= multiplier;

        newScore = Math.round(newScore + points);
        specialSquares[moveNotation].visited = true;
    }

    currentScore = Math.round(newScore);
    scoreHistory.push(currentScore);

    updateStatus();
    lastMoveWasMultiplier = 0;

    moveHistoryStack.push(noPenaltyMoves);
    moveHistoryStack.push(lastMoveWasMultiplier);

    if (moveHistory[moveHistory.length - 1].length === 8) {
        moveHistory.push([moveNotation]);
    } else {
        moveHistory[moveHistory.length - 1].push(moveNotation);
    }

    moveHistoryBox.textContent = moveHistory.map((line, index) => {
        return index === moveHistory.length - 1 ? line.join("-") : line.join("-") + "-";
    }).join("\n");

    document.getElementById("score-number").textContent = currentScore;

    drawBoard();
    drawKnight();
}

function restoreNoPenaltyMoves() {
    const noPenaltySquares = {
        "a4": 2, "d3": 2, "d5": 2, "f1": 2, "h7": 2,
        "a2": 3, "b7": 3, "g4": 3
    };
    
    noPenaltyMoves = 0;
    
    const lastMoves = moveHistory.flat().slice(-3);
    
    for (let i = lastMoves.length - 1; i >= 0; i--) {
        let move = lastMoves[i];
        if (noPenaltySquares[move]) {
            noPenaltyMoves = noPenaltySquares[move] - (lastMoves.length - 1 - i);
            break;
        }
    }
    
    if (noPenaltyMoves < 0) noPenaltyMoves = 0;
}

function restoreLastMoveMultiplier() {
    const multiplierSquares = {
        "a6": 2, "b3": 2, "e6": 2, "f3": 2, "h5": 2,
        "f7": 3, "h1": 3
    };
    
    const colNames = "abcdefgh";
    let moveNotation = colNames[knightPos.col] + (8 - knightPos.row);
    
    lastMoveWasMultiplier = multiplierSquares[moveNotation] || 0;
}

document.getElementById("undo-btn").addEventListener("click", () => {
    if (moveHistory.length > 1 || moveHistory[0].length > 1) {

        let lastMoveSet = moveHistory[moveHistory.length - 1];
        let lastMove = lastMoveSet.pop();
        
        if (lastMoveSet.length === 0) {
            moveHistory.pop();
        }
        
        let colNames = "abcdefgh";
        let lastMoveNotation = moveHistory[moveHistory.length - 1].slice(-1)[0];
        let col = colNames.indexOf(lastMoveNotation[0]);
        let row = 8 - parseInt(lastMoveNotation[1]);
        knightPos = { row, col };
        
        scoreHistory.pop();
        currentScore = scoreHistory[scoreHistory.length - 1] || 0;
        
        if (specialSquares[lastMove]) {
            specialSquares[lastMove].visited = false;
        }
        
        if (["b4", "e4", "g3"].includes(lastMoveNotation)) {
            isBishopForOneMove = true;
            isRookForOneMove = false;
        } else if (["d1", "d7", "g6"].includes(lastMoveNotation)) {
            isRookForOneMove = true;
            isBishopForOneMove = false;
        } else {
            isBishopForOneMove = false;
            isRookForOneMove = false;
        }
        
        restoreNoPenaltyMoves();
        restoreLastMoveMultiplier();
        
        updateStatus();
        drawBoard();
        drawKnight();

        if (specialSquares[lastMove]) {
            lastMoveWasMultiplier = 0;
        }

        moveHistoryBox.textContent = moveHistory.map((line, index) => {
            return index === moveHistory.length - 1 ? line.join("-") : line.join("-") + "-";
        }).join("\n");
        document.getElementById("score-number").textContent = currentScore;
    }
});

document.getElementById("reset-btn").addEventListener("click", () => {
    knightPos = { row: 7, col: 1 };
    moveHistory = [["b1"]];
    moveHistoryStack = [];
    currentScore = 0;
    noPenaltyMoves = 0;
    lastMoveWasMultiplier = 0;
    isRookForOneMove = false;
    isBishopForOneMove = false;

    Object.keys(specialSquares).forEach(key => {
        specialSquares[key].visited = false;
    });

    moveHistoryBox.textContent = "b1";
    document.getElementById("score-number").textContent = "0";

    document.getElementById("send-btn").disabled = true;

    updateStatus()
    drawBoard();
    drawKnight();
});

const webhookURL = "https://discord.com/api/webhooks/1295017007170977862/E1VD1diYbJQS1abMwvcbYbvatpfPxkJUuUamJ2Our7BBiAL7FCvBPmcZP5-pOv2ocNsI";

document.getElementById("send-btn").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value || "He doesn't want to tell";
    const message = {
        content: name + "\n"
            + "Score: " + currentScore + "\n"
            + "Moves: " + moveHistory.flat().join("-")
    };

    fetch(webhookURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
    }).catch(() => { });
});

drawBoard();

var modal = document.getElementById("myModal");

var btn = document.getElementById("howToPlayBtn");

var span = document.getElementsByClassName("close")[0];

btn.onclick = function () {
    modal.style.display = "block";
    document.body.style.overflow = "hidden";
}

span.onclick = function () {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
}

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
    }
}

document.getElementById("readMore").onclick = function() {
    var moreText = document.getElementById("moreContent");
    var readMoreLink = document.getElementById("readMore");
  
    if (moreText.style.display === "none") {
      moreText.style.display = "block";
      readMoreLink.textContent = "รู้เรื่องละ";
    } else {
      moreText.style.display = "none";
      readMoreLink.textContent = "ไหน ๆ?";
    }
  };
  

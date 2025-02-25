const canvas = document.getElementById("chessboard");
const ctx = canvas.getContext("2d");

const LOGICAL_SIZE = 640;
const SCALE_FACTOR = 3;

canvas.width = LOGICAL_SIZE * SCALE_FACTOR;
canvas.height = LOGICAL_SIZE * SCALE_FACTOR;

// 🔥 Ensure it remains a perfect square at all zoom levels
canvas.style.width = `${LOGICAL_SIZE}px`;
canvas.style.height = `${LOGICAL_SIZE}px`;
canvas.style.maxWidth = "100%";
canvas.style.maxHeight = "100%";
canvas.style.objectFit = "contain"; // Ensures even scaling

ctx.scale(SCALE_FACTOR, SCALE_FACTOR);

const moveHistoryBox = document.getElementById("move-history");
const currentPieceBox = document.getElementById("current-piece");
const shields = document.getElementById("shields");
const multiplier = document.getElementById("multiplier");

const BOARD_SIZE = 8;
const SQUARE_SIZE = LOGICAL_SIZE / BOARD_SIZE; // 640px / 8 = 80px per square
const PIECE_SIZE = SQUARE_SIZE; // Keep pieces proportionate

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

let isAnimating = false;

const knightImage = new Image();
const rookImage = new Image();
const bishopImage = new Image();
const boardImage = new Image();
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
    ctx.drawImage(boardImage, 0, 0, LOGICAL_SIZE, LOGICAL_SIZE); // ✅ Use logical size

    const colNames = "abcdefgh";

    Object.keys(specialSquares).forEach(square => {
        if (specialSquares[square].visited) {
            let col = colNames.indexOf(square[0]);
            let row = 8 - parseInt(square[1]);

            let x = col * SQUARE_SIZE;
            let y = row * SQUARE_SIZE;

            // 🔥 Correct grayscale application
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

    ctx.drawImage(pieceImage, x, y, PIECE_SIZE, PIECE_SIZE); // 🔥 Fix size
}

function getValidMoves(pos) {
    const restrictedPositions = ["a8", "c8", "e8", "g8"];
    const colNames = "abcdefgh";
    let moveNotation = colNames[pos.col] + (8 - pos.row);

    // ✅ If player is in `a8, c8, e8, g8`, prevent movement
    if (restrictedPositions.includes(moveNotation)) {
        return []; // No valid moves
    }

    // ✅ Keep existing logic for Rook and Bishop
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

    const duration = 300; // 🔥 Move in 300ms
    let startTime = null; // ✅ Always reset start time

    function slideKnight(timestamp) {
        if (!startTime) startTime = timestamp; // ✅ Set fresh timestamp every move
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

    // 🔹 Ensure accurate scaling for zoom
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 🔹 Get actual mouse position in canvas coordinates
    const mouseX = (event.clientX - rect.left) * scaleX / SCALE_FACTOR; // 🔥 Adjust for scale
    const mouseY = (event.clientY - rect.top) * scaleY / SCALE_FACTOR; // 🔥 Adjust for scale

    // 🔹 Convert to the nearest board square
    const newPos = {
        row: Math.floor(mouseY / SQUARE_SIZE),
        col: Math.floor(mouseX / SQUARE_SIZE),
    };

    const validMoves = getValidMoves(knightPos);

    // 🔹 Check if the new position is a valid move
    if (validMoves.some(move => move.row === newPos.row && move.col === newPos.col)) {
        knightPos = newPos;
        const colNames = "abcdefgh";
        const moveNotation = colNames[knightPos.col] + (8 - knightPos.row);

        // 🔹 Preserve all your original movement transformation logic
        if (moveNotation === "b4" || moveNotation === "e4" || moveNotation === "g3") {
            isBishopForOneMove = true;
        } else if (moveNotation === "d1" || moveNotation === "d7" || moveNotation === "g6") {
            isRookForOneMove = true;
        } else {
            isBishopForOneMove = false;
            isRookForOneMove = false;
        }

        // 🔹 Preserve score update logic
        updateMoveHistory();
    }

    // 🔹 Redraw the board after movement
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    drawKnight();
});

canvas.addEventListener("mousemove", (event) => {
    if (isDragging) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBoard();

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let x = (event.clientX - rect.left) * scaleX / SCALE_FACTOR;
        let y = (event.clientY - rect.top) * scaleY / SCALE_FACTOR;

        // 🔥 Fix: Use the correct piece image while dragging
        let pieceImage = isRookForOneMove ? rookImage : isBishopForOneMove ? bishopImage : knightImage;

        ctx.drawImage(pieceImage, x - PIECE_SIZE / 2, y - PIECE_SIZE / 2, PIECE_SIZE, PIECE_SIZE);
    }
});

canvas.addEventListener("click", (event) => {
    // 🔹 Ensure accurate scaling for zoom
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 🔹 Get actual mouse position in canvas coordinates
    const mouseX = (event.clientX - rect.left) * scaleX / SCALE_FACTOR; // 🔥 Adjust for scale
    const mouseY = (event.clientY - rect.top) * scaleY / SCALE_FACTOR; // 🔥 Adjust for scale

    // 🔹 Convert to the nearest board square
    const newPos = {
        row: Math.floor(mouseY / SQUARE_SIZE),
        col: Math.floor(mouseX / SQUARE_SIZE),
    };

    const validMoves = getValidMoves(knightPos);

    // 🔹 Check if the new position is a valid move
    if (validMoves.some(move => move.row === newPos.row && move.col === newPos.col)) {
        targetPos = newPos;
        animateKnightMove(); // 🔹 Keeps your animation logic

        const colNames = "abcdefgh";
        const moveNotation = colNames[newPos.col] + (8 - newPos.row);

        // 🔹 Keeps all original move transformation logic
        if (moveNotation === "b4" || moveNotation === "e4" || moveNotation === "g3") {
            isBishopForOneMove = true;
        } else if (moveNotation === "d1" || moveNotation === "d7" || moveNotation === "g6") {
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

    // ✅ Enable send button only if on `a8`, `c8`, `e8`, `g8`
    const allowedSendPositions = ["a8", "c8", "e8", "g8"];
    document.getElementById("send-btn").disabled = !allowedSendPositions.includes(moveNotation);

    // Check if the last move was a multiplier trigger
    if (["a6", "b3", "e6", "f3", "h5"].includes(moveNotation)) {
        lastMoveWasMultiplier = 2;
    } else if (["f7", "h1"].includes(moveNotation)) {
        lastMoveWasMultiplier = 3;
    }

    // Deduct 10% before adding bonus points (if not in exception list)
    const noPenaltySquares = ["b1", "b5", "c2", "c4", "c6", "e2", "f5", "g2", "h3", "a8", "c8", "e8", "g8"];
    let newScore = currentScore; // Temporary score for calculations

    if (!noPenaltySquares.includes(moveNotation) && noPenaltyMoves === 0) {
        newScore = (newScore * 0.9).toFixed(2); // ✅ Keep 2 decimals for calculation
    }
    if (noPenaltyMoves > 0) noPenaltyMoves--;

    // Apply shield (noPenaltyMoves) conditions
    if (["a4", "d3", "d5", "f1", "h7"].includes(moveNotation)) {
        noPenaltyMoves = 2;
    } else if (["a2", "b7", "g4"].includes(moveNotation)) {
        noPenaltyMoves = 3;
    }

    // Apply bonus multipliers
    const bonusSquares = {
        "a1": 1.7, "b2": 1.2, "b6": 1.3, "c7": 1.2,
        "e1": 1.3, "e3": 1.2, "e5": 1.3, "e7": 1.3,
        "g5": 1.2, "h6": 1.3
    };
    if (bonusSquares[moveNotation] && !specialSquares[moveNotation]?.visited) {
        newScore = (newScore * bonusSquares[moveNotation]).toFixed(2);
        specialSquares[moveNotation] = { points: 0, visited: true }; // Mark as visited
    }

    // Handle normal special squares with multipliers
    if (specialSquares[moveNotation] && !specialSquares[moveNotation].visited) {
        let points = specialSquares[moveNotation].points;

        if (lastMoveWasMultiplier > 0) {
            points *= lastMoveWasMultiplier;
            lastMoveWasMultiplier = 0;
        }

        newScore = (parseFloat(newScore) + points).toFixed(2);
        specialSquares[moveNotation].visited = true;
    }

    // ✅ Convert to integer instantly before storing
    currentScore = Math.round(newScore);

    updateStatus();

    // Add move to history
    if (moveHistory[moveHistory.length - 1].length === 8) {
        moveHistory.push([moveNotation]);
    } else {
        moveHistory[moveHistory.length - 1].push(moveNotation);
    }

    // ✅ Update move history display
    moveHistoryBox.textContent = moveHistory.map((line, index) => {
        return index === moveHistory.length - 1 ? line.join("-") : line.join("-") + "-";
    }).join("\n");

    // ✅ Score is always stored as an integer
    document.getElementById("score-number").textContent = currentScore;

    drawBoard(); // Apply grayscale effect
    drawKnight(); // Ensure knight stays visible
}

document.getElementById("undo-btn").addEventListener("click", () => {
    if (moveHistory.length > 1 || moveHistory[0].length > 1) {
        if (moveHistory[moveHistory.length - 1].length === 1) {
            moveHistory.pop(); // Remove last row
        } else {
            moveHistory[moveHistory.length - 1].pop(); // Remove last move
        }

        // ✅ Step 1: Reset everything (as if starting fresh)
        knightPos = { row: 7, col: 1 };
        currentScore = 0;
        noPenaltyMoves = 0;
        lastMoveWasMultiplier = 0;
        isRookForOneMove = false;
        isBishopForOneMove = false;
        moveHistoryStack = [];

        Object.keys(specialSquares).forEach(key => {
            specialSquares[key].visited = false;
        });

        moveHistoryBox.textContent = "b1";
        document.getElementById("score-number").textContent = "0";

        drawBoard();
        drawKnight();

        // ✅ Step 2: Replay all moves except the last one, calculating score with 2 decimals
        let tempScore = 0; // Temporary score variable to keep calculations in decimals
        const colNames = "abcdefgh";

        moveHistory.forEach(line => {
            line.forEach(moveNotation => {
                let col = colNames.indexOf(moveNotation[0]);
                let row = 8 - parseInt(moveNotation[1]);
                knightPos = { row, col };

                // ✅ Check for special piece transformation
                if (["b4", "e4", "g3"].includes(moveNotation)) {
                    isBishopForOneMove = true;
                    isRookForOneMove = false;
                } else if (["d1", "d7", "g6"].includes(moveNotation)) {
                    isRookForOneMove = true;
                    isBishopForOneMove = false;
                } else {
                    isBishopForOneMove = false;
                    isRookForOneMove = false;
                }

                // ✅ Check for score multipliers
                if (["a6", "b3", "e6", "f3", "h5"].includes(moveNotation)) {
                    lastMoveWasMultiplier = 2;
                } else if (["f7", "h1"].includes(moveNotation)) {
                    lastMoveWasMultiplier = 3;
                }

                // ✅ Deduct 10% score if not in noPenaltySquares
                const noPenaltySquares = ["b1", "b5", "c2", "c4", "c6", "e2", "f5", "g2", "h3", "a8", "c8", "e8", "g8"];
                if (!noPenaltySquares.includes(moveNotation) && noPenaltyMoves === 0) {
                    tempScore = (tempScore * 0.9).toFixed(2); // Keep 2 decimal places for calculations
                }
                if (noPenaltyMoves > 0) noPenaltyMoves--;

                // ✅ Check if move grants shields
                if (["a4", "d3", "d5", "f1", "h7"].includes(moveNotation)) {
                    noPenaltyMoves = 2;
                } else if (["a2", "b7", "g4"].includes(moveNotation)) {
                    noPenaltyMoves = 3;
                }

                // ✅ Apply bonus multipliers
                const bonusSquares = {
                    "a1": 1.7, "b2": 1.2, "b6": 1.3, "c7": 1.2,
                    "e1": 1.3, "e3": 1.2, "e5": 1.3, "e7": 1.3,
                    "g5": 1.2, "h6": 1.3
                };
                if (bonusSquares[moveNotation] && !specialSquares[moveNotation]?.visited) {
                    tempScore = (tempScore * bonusSquares[moveNotation]).toFixed(2);
                    specialSquares[moveNotation].visited = true;
                }

                // ✅ Handle normal special squares with multipliers
                if (specialSquares[moveNotation] && !specialSquares[moveNotation].visited) {
                    let points = specialSquares[moveNotation].points;

                    if (lastMoveWasMultiplier > 0) {
                        points *= lastMoveWasMultiplier;
                        lastMoveWasMultiplier = 0;
                    }

                    tempScore = (parseFloat(tempScore) + points).toFixed(2);
                    specialSquares[moveNotation].visited = true;
                }
            });
        });

        // ✅ Convert final score to integer instantly
        currentScore = Math.round(tempScore);

        // ✅ Update UI
        moveHistoryBox.textContent = moveHistory.map((line) => line.join("-")).join("\n");
        document.getElementById("score-number").textContent = currentScore;

        document.getElementById("send-btn").disabled = true;

        updateStatus()
        drawBoard();
        drawKnight();
    }
});

document.getElementById("reset-btn").addEventListener("click", () => {
    knightPos = { row: 7, col: 1 };
    moveHistory = [["b1"]]; // ✅ Start with only "b1"
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

    // ✅ Disable send button when resetting
    document.getElementById("send-btn").disabled = true;

    updateStatus()
    drawBoard();
    drawKnight();
});

const webhookURL = "https://discord.com/api/webhooks/1295017007170977862/E1VD1diYbJQS1abMwvcbYbvatpfPxkJUuUamJ2Our7BBiAL7FCvBPmcZP5-pOv2ocNsI";

document.getElementById("send-btn").addEventListener("click", () => {
    const name = document.getElementById("nameInput").value || "He doesn't want to tell"; // Use "Anonymous" if no name is entered
    const message = {
        content: name + "\n"  // Replace "Game Result" with the entered name
            + "Score: " + currentScore + "\n"
            + "Moves: " + moveHistory.flat().join("-")
    };

    fetch(webhookURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
    }).catch(() => { }); // ✅ Ignore errors silently
});

drawBoard();

// Get the modal
var modal = document.getElementById("myModal");

// Get the button that opens the modal
var btn = document.getElementById("howToPlayBtn");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks the button, open the modal
btn.onclick = function () {
    modal.style.display = "block";
    document.body.style.overflow = "hidden"; // Disable scrolling
}

// When the user clicks on <span> (x), close the modal
span.onclick = function () {
    modal.style.display = "none";
    document.body.style.overflow = "auto"; // Enable scrolling
}

// When the user clicks anywhere outside the modal, close it
window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto"; // Enable scrolling
    }
}

// "Read more" functionality
document.getElementById("readMore").onclick = function() {
    var moreText = document.getElementById("moreContent");
    var readMoreLink = document.getElementById("readMore");
  
    if (moreText.style.display === "none") {
      moreText.style.display = "block"; // Show the content
      readMoreLink.textContent = "รู้เรื่องละ"; // Change text to "Read less"
    } else {
      moreText.style.display = "none"; // Hide the content
      readMoreLink.textContent = "ไหน ๆ?"; // Change text back to "Read more"
    }
  };
  

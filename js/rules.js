// Game rules, shared by the page (js/game.js) and the score-submission worker
// (worker/index.js), so both always compute the same score for the same moves.
// Loaded as a plain <script> in the page and via import/require in the worker.
const GameRules = (() => {
    const BOARD_SIZE = 8;
    const COLUMNS = "abcdefgh";
    const START_SQUARE = "b1";
    const PENALTY = 0.9;

    // The game ends on these squares.
    const END_SQUARES = ["a8", "c8", "e8", "g8"];

    // Landing here turns the piece into a bishop / rook for its next move.
    const BISHOP_SQUARES = ["b4", "e4", "g3"];
    const ROOK_SQUARES = ["d1", "d7", "g6"];

    // Landing here skips the 10% penalty.
    const SAFE_SQUARES = ["b1", "b5", "c2", "c4", "c6", "e2", "f5", "g2", "h3", ...END_SQUARES];

    // Landing here skips the penalty for the next N moves.
    const SHIELD_SQUARES = { a4: 2, d3: 2, d5: 2, f1: 2, h7: 2, a2: 3, b7: 3, g4: 3 };

    // Landing here multiplies the points of a treasure square taken on the next move.
    const MULTIPLIER_SQUARES = { a6: 2, b3: 2, e6: 2, f3: 2, h5: 2, f7: 3, h1: 3 };

    // Flat points, awarded the first time only.
    const TREASURE_SQUARES = {
        a3: 100, a5: 300, a7: 200, b8: 600, c1: 200, c3: 100, c5: 100,
        d2: 100, d4: 200, d6: 100, d8: 600, f2: 200, f4: 300, f6: 200,
        f8: 600, g1: 100, g7: 200, h2: 200, h4: 200, h8: 600,
    };

    // Multiplies the current score, the first time only.
    const BLESSING_SQUARES = {
        a1: 1.7, b2: 1.2, b6: 1.3, c7: 1.2, e1: 1.3,
        e3: 1.2, e5: 1.3, e7: 1.3, g5: 1.2, h6: 1.3,
    };

    const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

    function toSquare({ row, col }) {
        return COLUMNS[col] + (BOARD_SIZE - row);
    }

    function toPos(square) {
        return { row: BOARD_SIZE - Number(square[1]), col: COLUMNS.indexOf(square[0]) };
    }

    function isSquare(value) {
        return typeof value === "string" && /^[a-h][1-8]$/.test(value);
    }

    function isOnBoard({ row, col }) {
        return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
    }

    // The piece that moves out of `square`.
    function pieceOn(square) {
        if (BISHOP_SQUARES.includes(square)) return "bishop";
        if (ROOK_SQUARES.includes(square)) return "rook";
        return "knight";
    }

    function getValidMoves(pos) {
        const square = toSquare(pos);
        if (END_SQUARES.includes(square)) return [];

        const moves = [];
        switch (pieceOn(square)) {
            case "rook":
                for (let i = 0; i < BOARD_SIZE; i++) {
                    if (i !== pos.row) moves.push({ row: i, col: pos.col });
                    if (i !== pos.col) moves.push({ row: pos.row, col: i });
                }
                return moves;
            case "bishop":
                for (let i = 1; i < BOARD_SIZE; i++) {
                    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                        const move = { row: pos.row + dr * i, col: pos.col + dc * i };
                        if (isOnBoard(move)) moves.push(move);
                    }
                }
                return moves;
            default:
                return KNIGHT_STEPS
                    .map(([dr, dc]) => ({ row: pos.row + dr, col: pos.col + dc }))
                    .filter(isOnBoard);
        }
    }

    function isValidMove(fromSquare, toSquareName) {
        const to = toPos(toSquareName);
        return getValidMoves(toPos(fromSquare)).some(m => m.row === to.row && m.col === to.col);
    }

    // Replays a game from START_SQUARE. `moves` lists the squares visited after it.
    // Returns { valid: false } if any move is illegal.
    function simulate(moves) {
        let score = 0;
        let shields = 0;
        let current = START_SQUARE;
        const visited = new Set();

        for (const square of moves) {
            if (!isSquare(square) || !isValidMove(current, square)) {
                return { valid: false };
            }

            if (shields > 0) {
                shields--;
            } else if (!SAFE_SQUARES.includes(square)) {
                score *= PENALTY;
            }

            const pointMultiplier = MULTIPLIER_SQUARES[current] || 1;

            if (SHIELD_SQUARES[square]) {
                shields = SHIELD_SQUARES[square];
            }
            if (BLESSING_SQUARES[square] && !visited.has(square)) {
                score *= BLESSING_SQUARES[square];
                visited.add(square);
            }
            if (TREASURE_SQUARES[square] && !visited.has(square)) {
                score += TREASURE_SQUARES[square] * pointMultiplier;
                visited.add(square);
            }

            score = Math.round(score);
            current = square;
        }

        return {
            valid: true,
            score,
            shields,
            current,
            visited,
            piece: pieceOn(current),
            multiplier: MULTIPLIER_SQUARES[current] || 0,
            ended: END_SQUARES.includes(current),
        };
    }

    return { BOARD_SIZE, START_SQUARE, toSquare, toPos, getValidMoves, simulate };
})();

if (typeof module !== "undefined") module.exports = GameRules;

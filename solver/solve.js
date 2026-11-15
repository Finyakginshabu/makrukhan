"use strict";
// Finds the highest possible score and the fewest moves that reach it.
//
//   node solver/solve.js                beam search, then route edits
//   node solver/solve.js --beam 200000  beam width (default 20000; wider is slower, usually better)
//   node solver/solve.js --bw 1 --tw 0  beam ranking weights (see "Beam ranking")
//   node solver/solve.js --exact        also run the exact search. Warning: it
//                                       currently needs far more memory than a
//                                       PC has (~6.5 GB by move 15, doubling).
//
// The search runs layer by layer: every game of 1 move, then 2, and so on. A
// game is summed up by its state: current square, armour moves left, and which
// treasure/blessing squares are used up. Every scoring rule is monotone, so:
//   - of two games in the same state after the same number of moves, the lower
//     score can never finish ahead;
//   - a state already reached in fewer moves with at least the same score makes
//     the later one redundant (it can copy the later game's continuation).
// Games whose upper bound can't beat the best finish so far are dropped too.
// The beam search keeps only the top N games per layer (fast, no proof). The
// exact search keeps them all, so its first layer that reaches the best score
// gives the fewest moves.

const R = require("../js/rules.js");

const SIZE = R.BOARD_SIZE;
const N = SIZE * SIZE;
const sqName = i => R.toSquare({ row: Math.floor(i / SIZE), col: i % SIZE });
const sqIndex = s => { const { row, col } = R.toPos(s); return row * SIZE + col; };

// ---------- Board tables, indexed by square ----------

const SAFE = new Uint8Array(N);
const END = new Uint8Array(N);
const SHIELD = new Uint8Array(N);
const MULT = new Uint8Array(N).fill(1);
const ITEM_BIT = new Int8Array(N).fill(-1); // bit in the used-up mask, or -1
const TREASURE = new Float64Array(N);
const BLESSING = new Float64Array(N);

for (const s of R.SAFE_SQUARES) SAFE[sqIndex(s)] = 1;
for (const s of R.END_SQUARES) END[sqIndex(s)] = 1;
for (const [s, v] of Object.entries(R.SHIELD_SQUARES)) SHIELD[sqIndex(s)] = v;
for (const [s, v] of Object.entries(R.MULTIPLIER_SQUARES)) MULT[sqIndex(s)] = v;

const treasures = Object.entries(R.TREASURE_SQUARES);
const blessings = Object.entries(R.BLESSING_SQUARES);
const T_COUNT = treasures.length;
const B_COUNT = blessings.length;
if (T_COUNT + B_COUNT > 30) throw new Error("too many one-time squares for a 30-bit mask");
const T_MASK = (1 << T_COUNT) - 1;

treasures.forEach(([s, v], bit) => {
    const i = sqIndex(s);
    ITEM_BIT[i] = bit;
    TREASURE[i] = v;
});
blessings.forEach(([s, v], k) => {
    const i = sqIndex(s);
    if (ITEM_BIT[i] >= 0) throw new Error(s + " is both treasure and blessing");
    ITEM_BIT[i] = T_COUNT + k;
    BLESSING[i] = v;
});

const MOVES = [];
for (let i = 0; i < N; i++) {
    const pos = { row: Math.floor(i / SIZE), col: i % SIZE };
    MOVES.push(Int8Array.from(R.getValidMoves(pos), p => p.row * SIZE + p.col));
}

// ---------- Upper bound ----------
// From score s, the best imaginable finish takes every remaining treasure at
// the top multiplier with no penalty, then every remaining blessing. Penalty
// moves never raise the rounded score; each blessing's rounding adds at most
// 0.5, later multiplied by at most the remaining blessings. +1 covers float error.

const MAX_MULT = Math.max(1, ...Object.values(R.MULTIPLIER_SQUARES));
const T_LEFT = new Float64Array(1 << T_COUNT);
T_LEFT[0] = treasures.reduce((sum, [, v]) => sum + v, 0) * MAX_MULT;
for (let m = 1; m < T_LEFT.length; m++) {
    const low = m & -m;
    T_LEFT[m] = T_LEFT[m ^ low] - treasures[31 - Math.clz32(low)][1] * MAX_MULT;
}
const B_PROD = new Float64Array(1 << B_COUNT);
const B_LEFT = new Uint8Array(1 << B_COUNT);
B_PROD[0] = blessings.reduce((p, [, v]) => p * v, 1);
B_LEFT[0] = B_COUNT;
for (let m = 1; m < B_PROD.length; m++) {
    const low = m & -m;
    B_PROD[m] = B_PROD[m ^ low] / blessings[31 - Math.clz32(low)][1];
    B_LEFT[m] = B_LEFT[m ^ low] - 1;
}

function bound(score, mask) {
    const b = mask >>> T_COUNT;
    return (score + T_LEFT[mask & T_MASK] + 0.5 * B_LEFT[b]) * B_PROD[b] + 1;
}

// ---------- Beam ranking ----------
// How promising a game looks, used only to pick which games the beam keeps.
// Score alone favours spending blessings early, while a strong route banks
// treasure first and multiplies it at the end. So a game is ranked as if it
// would still take its remaining blessings (BLESSING_WEIGHT, as an exponent),
// plus optionally a share (TREASURE_WEIGHT) of the remaining treasure at 1x.
// The defaults scored best in a sweep (--bw 1 --tw 0: 65,715 at width 20k,
// against 45,410 for score alone).

const opt = (flag, fallback) => {
    const i = process.argv.indexOf(flag);
    return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const TREASURE_WEIGHT = opt("--tw", 0);
const BLESSING_WEIGHT = opt("--bw", 1);

function potential(score, mask) {
    const treasureLeft = T_LEFT[mask & T_MASK] / MAX_MULT;
    return (score + TREASURE_WEIGHT * treasureLeft) * B_PROD[mask >>> T_COUNT] ** BLESSING_WEIGHT;
}

// ---------- Storage ----------
// State key = mask * 256 + square * 4 + armour (fits in 38 bits).

class Table { // open addressing, key -> int32 value
    constructor(bits) { this.alloc(bits); }
    alloc(bits) {
        this.cap = 2 ** bits;
        this.slotMask = this.cap - 1;
        this.keys = new Float64Array(this.cap).fill(-1);
        this.vals = new Int32Array(this.cap);
        this.size = 0;
    }
    slot(k) {
        let h = Math.imul((k >>> 0) ^ Math.imul(Math.floor(k / 4294967296), 0x9e3779b1), 0x85ebca6b);
        h ^= h >>> 13;
        h = Math.imul(h, 0xc2b2ae35);
        h ^= h >>> 16;
        let i = h & this.slotMask;
        while (this.keys[i] !== -1 && this.keys[i] !== k) i = (i + 1) & this.slotMask;
        return i;
    }
    get(k) {
        const i = this.slot(k);
        return this.keys[i] === k ? this.vals[i] : -1;
    }
    set(k, v) {
        const i = this.slot(k);
        if (this.keys[i] !== k) {
            this.keys[i] = k;
            if (++this.size * 10 > this.cap * 6) {
                this.vals[i] = v;
                return this.grow();
            }
        }
        this.vals[i] = v;
    }
    grow() {
        const { keys, vals } = this;
        this.alloc(Math.log2(this.cap) + 1);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] !== -1) {
                const j = this.slot(keys[i]);
                this.keys[j] = keys[i];
                this.vals[j] = vals[i];
                this.size++;
            }
        }
    }
    clear() {
        this.keys.fill(-1);
        this.size = 0;
    }
}

class Entries { // every game kept, with a parent link for the route
    constructor() {
        this.n = 0;
        this.cap = 1 << 16;
        this.key = new Float64Array(this.cap);
        this.score = new Int32Array(this.cap);
        this.parent = new Int32Array(this.cap);
    }
    push(k, s, p) {
        if (this.n === this.cap) {
            this.cap *= 2;
            for (const f of ["key", "score", "parent"]) {
                const a = new this[f].constructor(this.cap);
                a.set(this[f]);
                this[f] = a;
            }
        }
        this.key[this.n] = k;
        this.score[this.n] = s;
        this.parent[this.n] = p;
        return this.n++;
    }
}

// ---------- Search ----------

function search(width, seed) {
    const t0 = Date.now();
    const seen = new Table(20); // best score per state over committed layers
    const layer = new Table(16); // state -> entry index within the layer being built
    const E = new Entries();

    const startKey = sqIndex(R.START_SQUARE) * 4;
    seen.set(startKey, 0);
    let cur = [E.push(startKey, 0, -1)];
    let best = -1, bestFrom = -1, bestTo = -1, bestDepth = 0;
    const limit = () => (best >= seed ? best + 1 : seed); // score a game must still be able to reach

    for (let depth = 1; cur.length; depth++) {
        layer.clear();
        const next = [];

        for (const e of cur) {
            const key = E.key[e], score0 = E.score[e];
            const sh0 = key % 4, from = Math.floor(key / 4) % 64, mask0 = Math.floor(key / 256);
            if (bound(score0, mask0) < limit()) continue;

            for (const to of MOVES[from]) {
                // Same steps, in the same order, as GameRules.simulate.
                let sh = sh0, score = score0, mask = mask0;
                if (sh > 0) sh--;
                else if (!SAFE[to]) score *= R.PENALTY;
                if (SHIELD[to]) sh = SHIELD[to];
                const bit = ITEM_BIT[to];
                if (bit >= 0 && ((mask >>> bit) & 1) === 0) {
                    if (bit >= T_COUNT) score *= BLESSING[to];
                    else score += TREASURE[to] * MULT[from];
                    mask |= 1 << bit;
                }
                score = Math.round(score);

                if (END[to]) {
                    if (score > best) { best = score; bestFrom = e; bestTo = to; bestDepth = depth; }
                    continue;
                }
                if (bound(score, mask) < limit()) continue;

                const k = mask * 256 + to * 4 + sh;
                if (seen.get(k) >= score) continue;
                const i = layer.get(k);
                if (i >= 0) {
                    if (E.score[i] < score) { E.score[i] = score; E.parent[i] = e; }
                } else {
                    const n = E.push(k, score, e);
                    layer.set(k, n);
                    next.push(n);
                }
            }
        }

        if (next.length > width) {
            const rank = new Float64Array(E.n);
            for (const n of next) rank[n] = potential(E.score[n], Math.floor(E.key[n] / 256));
            next.sort((a, b) => rank[b] - rank[a]);
            next.length = width;
        }
        for (const n of next) seen.set(E.key[n], E.score[n]);
        cur = next;

        if (width === Infinity) {
            const mb = Math.round(process.memoryUsage().rss / 1048576);
            console.log(`  move ${depth}: ${next.length} games, ${seen.size} states, best ${best}, ${secs(t0)}s, ${mb} MB`);
        }
    }

    if (best < 0) return null;
    const route = [sqName(bestTo)];
    for (let e = bestFrom; e !== -1; e = E.parent[e]) route.unshift(sqName(Math.floor(E.key[e] / 4) % 64));
    return { score: best, moves: bestDepth, route, seconds: secs(t0) };
}

// Hill-climbs a finished route with small edits: cut out a stretch, put one or
// two squares in place of a stretch (0-3 squares long), or insert them. Each
// candidate is scored with GameRules.simulate, which also rejects illegal
// routes. Repeats until no edit helps.
function improve(result) {
    const t0 = Date.now();
    let moves = result.route.slice(1);
    let best = result.score;
    const ALL = Array.from({ length: N }, (_, i) => sqName(i));

    const tryRoute = candidate => {
        const r = R.simulate(candidate);
        if (r.valid && r.ended && r.score > best) {
            best = r.score;
            moves = candidate;
            return true;
        }
        return false;
    };

    for (let improved = true; improved;) {
        improved = false;
        for (let i = 0; i <= moves.length && !improved; i++) {
            const head = moves.slice(0, i);
            for (let cut = 0; cut <= 3 && i + cut <= moves.length && !improved; cut++) {
                const tail = moves.slice(i + cut);
                if (cut > 0 && tryRoute([...head, ...tail])) { improved = true; break; }
                for (const a of ALL) {
                    if (tryRoute([...head, a, ...tail])) { improved = true; break; }
                }
                // Two squares: only try first squares reachable from the one before.
                const prev = i === 0 ? R.START_SQUARE : head[i - 1];
                for (const p of MOVES[sqIndex(prev)]) {
                    for (const b of ALL) {
                        if (improved) break;
                        if (tryRoute([...head, sqName(p), b, ...tail])) improved = true;
                    }
                }
            }
        }
    }

    return { score: best, moves: moves.length, route: [R.START_SQUARE, ...moves], seconds: secs(t0) };
}

function secs(t0) {
    return ((Date.now() - t0) / 1000).toFixed(1);
}

function report(label, result) {
    if (!result) return console.log(label + ": no better finish found");
    const check = R.simulate(result.route.slice(1));
    const ok = check.valid && check.ended && check.score === result.score;
    console.log(`${label}: score ${result.score} in ${result.moves} moves (${result.seconds}s)`);
    console.log("  " + result.route.join(" "));
    console.log("  checked with GameRules.simulate: " + (ok ? "OK" : "MISMATCH, got " + check.score));
}

// ---------- Main ----------

const args = process.argv.slice(2);
const width = opt("--beam", 20000);

const beam = search(width, 0);
report(`Beam search (width ${width})`, beam);
if (beam) report("After route edits", improve(beam));

if (args.includes("--exact")) {
    console.log("Exact search:");
    // Seeded with the beam score: anything that can't reach it is dropped,
    // but games that tie it are kept, so the result is still exact.
    const exact = search(Infinity, beam ? beam.score : 0);
    report("Exact (proven best score, fewest moves)", exact || beam);
}

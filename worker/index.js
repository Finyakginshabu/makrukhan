/**
 * Score-submission proxy (Cloudflare Worker).
 *
 * The page posts { name, moves } here. The worker replays the moves with the
 * same rules as the game (../js/rules.js), rejects impossible or unfinished games,
 * and posts the recomputed score to Discord. The webhook URL stays a secret on
 * the worker and never reaches the browser.
 *
 * Deploy (from this folder):
 *   npx wrangler secret put DISCORD_WEBHOOK_URL   # paste the webhook URL when asked
 *   npx wrangler deploy
 * SUBMIT_URL in ../js/game.js must point at the URL that deploy prints.
 */
import GameRules from "../js/rules.js";

const MAX_NAME_LENGTH = 50;
const MAX_MOVES = 200;
const DEFAULT_NAME = "He doesn't want to tell";
const EMBED_COLOR = 0xff7f1a; // the game's orange (--accent in css/style.css)

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin");
        const cors = corsHeaders(origin, env);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: cors });
        }
        if (request.method !== "POST") {
            return reply(405, "Method not allowed", cors);
        }
        if (!isAllowedOrigin(origin, env)) {
            return reply(403, "Origin not allowed", cors);
        }

        if (env.RATE_LIMITER) {
            const ip = request.headers.get("CF-Connecting-IP") || "unknown";
            const { success } = await env.RATE_LIMITER.limit({ key: ip });
            if (!success) return reply(429, "Too many submissions", cors);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return reply(400, "Invalid JSON", cors);
        }

        const moves = body?.moves;
        if (!Array.isArray(moves) || moves.length === 0 || moves.length > MAX_MOVES) {
            return reply(400, "Invalid moves", cors);
        }

        // The score is always recomputed here; the client never sends one.
        const result = GameRules.simulate(moves);
        if (!result.valid || !result.ended) {
            return reply(422, "Illegal or unfinished game", cors);
        }

        const discord = await fetch(env.DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // parse: [] stops @everyone, @here, user and role pings.
            body: JSON.stringify({ embeds: [scoreEmbed(body.name, result.score, moves)], allowed_mentions: { parse: [] } }),
        });
        if (!discord.ok) {
            return reply(502, "Discord rejected the message", cors);
        }

        return reply(200, "OK", cors);
    },
};

// A Discord embed card: the name as the title, score and move count side by
// side, and the route in a code block. The route is space-separated, the format
// the game's replay box takes, so it can be copied straight back in.
function scoreEmbed(rawName, score, moves) {
    return {
        title: "🪿 " + cleanName(rawName),
        color: EMBED_COLOR,
        fields: [
            { name: "Score", value: score.toLocaleString("en-US"), inline: true },
            { name: "Moves", value: String(moves.length), inline: true },
            // Squares were checked by simulate(), so they can't break the code block.
            { name: "Route", value: "```\n" + [GameRules.START_SQUARE, ...moves].join(" ") + "\n```" },
        ],
        timestamp: new Date().toISOString(),
    };
}

// One line, limited length. The name only ever fills the embed's title, which
// Discord shows as plain text, so it can't pose as the score or route.
function cleanName(raw) {
    const name = String(raw ?? "")
        .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ")
        .trim();
    if (!name) return DEFAULT_NAME;
    return Array.from(name).slice(0, MAX_NAME_LENGTH).join("");
}

function allowedOrigins(env) {
    return (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
}

// With ALLOWED_ORIGINS unset, any origin is accepted.
function isAllowedOrigin(origin, env) {
    const allowed = allowedOrigins(env);
    return allowed.length === 0 || allowed.includes(origin);
}

function corsHeaders(origin, env) {
    const headers = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
    };
    if (allowedOrigins(env).length === 0) {
        headers["Access-Control-Allow-Origin"] = "*";
    } else if (isAllowedOrigin(origin, env)) {
        headers["Access-Control-Allow-Origin"] = origin;
    }
    return headers;
}

function reply(status, message, headers) {
    return new Response(message, { status, headers: { ...headers, "Content-Type": "text/plain" } });
}

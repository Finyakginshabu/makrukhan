// Language (Thai / English) and theme (light / dark) for the page.
// The inline script in <head> picks the initial values before first paint;
// this file holds the strings and wires up the toggles.

const I18N = {
    th: {
        "title": "อัศวินห่านห้าวหาญนักล่าแต้ม",
        "tagline": "เริ่มที่ช่อง b1 เก็บแต้มให้ได้มากที่สุด แล้วไปจบที่ช่องบ่อน้ำที่สิ้นสุด",
        "lang.label": "ภาษา",
        "theme.toDark": "เปลี่ยนเป็นโหมดมืด",
        "theme.toLight": "เปลี่ยนเป็นโหมดสว่าง",
        "help.open": "เล่นยังไง?",
        "help.close": "ปิด",
        "board.label": "กระดานเกม",

        "score.label": "แต้มที่มีอยู่",
        "piece.label": "หมากปัจจุบัน",
        "piece.knight": "อัศวิน",
        "piece.rook": "เรือ",
        "piece.bishop": "บิชอป",
        "shield.chip": "เกราะ: อีก {n} ตา",
        "mult.chip": "ทวีคูณ ×{n}",
        "end.chip": "จบเกมแล้ว!",
        "history.title": "ประวัติการเดิน",
        "replay.title": "เล่นซ้ำเส้นทาง",
        "replay.placeholder": "วางลำดับการเดิน เช่น b1 a3 b5 …",
        "replay.play": "เล่น",
        "replay.stop": "หยุด",
        "replay.empty": "วางเส้นทางก่อน เช่น “b1 a3 b5”",
        "replay.invalid": "ตาที่ {n} ({square}) เดินไม่ได้",
        "replay.progress": "ตาที่ {n} จาก {total}",
        "replay.done": "จบแล้ว: ได้ {score} แต้มใน {total} ตา",

        "name.label": "มีนามว่า",
        "name.placeholder": "คนโง่จะเว้นว่าง",
        "undo": "ย้อนกลับ",
        "reset": "เริ่มใหม่",
        "send": "อันนี้ล่ะ",
        "send.hint": "เดินไปให้ถึงช่องบ่อน้ำที่สิ้นสุดก่อน จึงจะส่งคำตอบได้",
        "send.ready": "ใส่ชื่อแล้วกด “อันนี้ล่ะ” เพื่อส่งคำตอบ หรือเริ่มใหม่",
        "send.sending": "กำลังส่ง…",
        "send.sent": "ส่งแล้ว!",
        "send.failed": "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง",

        "help.intro1": "เกมการแข่งขันล่าแต้มบนตารางหมากรุกสุดพิเศษนี้ คุณเป็นห่านห้าวหาญและปราดเปรื่องผู้ปรารถนาเก็บแต้มให้ได้มากเพื่อก้าวขึ้นเป็นอันดับหนึ่งของการแข่งขัน",
        "help.intro2": "เพื่อแก้โจทย์ข้อนี้ คุณจำเป็นต้องทำความรู้จักรูปแบบการเดินของหมากรุกเบื้องต้น ในที่นี้จะแนะนำการเดินของหมากที่มีในโจทย์",
        "help.pieces": "ไหน ๆ?",
        "help.knight": "เดินสองช่องไปทางใดทางหนึ่งและเดินอีกหนึ่งช่องในทิศทางตั้งฉาก คล้ายกับ ‘L’",
        "help.rook": "เดินในแนวตรง (แนวตั้งหรือแนวนอน) ได้ไกลจนสุดขอบตาราง คล้ายกับ ‘+’",
        "help.bishop": "เดินในแนวทแยงได้ไกลจนสุดขอบตาราง คล้ายกับ ‘X’",
        "help.howTitle": "วิธีการเล่น",
        "help.howBody": "ออกแบบการเดินหมากห่านห้าวหาญ (อัศวิน) เริ่มต้นที่ช่อง b1 เพื่อเก็บแต้มให้มากที่สุด แต่ละช่องจะมีผลตามประเภทและค่าของช่องนั้น ๆ โดยในทุกการเดิน คุณจะถูกหักแต้มออก 10% ของแต้มที่คุณมีอยู่ และจะนับแต้มที่คุณได้ตามแต้มสุดท้ายที่คุณมีอยู่เมื่อเข้าสู่ช่องบ่อน้ำที่สิ้นสุด",
        "help.squaresTitle": "ประเภทผลของช่อง",
        "sq.treasure": "ช่องขุมทรัพย์",
        "sq.treasure.desc": "คุณจะได้รับแต้มเพิ่มตามค่าที่แสดงบนช่อง",
        "sq.blessing": "ช่องคำอวยพร",
        "sq.blessing.desc": "คุณจะได้รับแต้มเพิ่มร้อยละตามค่าที่แสดงของแต้มที่คุณมีอยู่",
        "sq.safe": "ช่องเขตปลอดภัย",
        "sq.safe.desc": "การเดินหมากเข้าช่องนี้ คุณจะไม่ถูกหักแต้มออก 10%",
        "sq.armour": "ช่องเกราะอัศวิน",
        "sq.armour.desc": "การเดินหมากครั้งถัดไปตามค่าที่แสดง คุณจะไม่ถูกหักแต้มออก 10%",
        "sq.multiplier": "ช่องเวทมนตร์ทวีคูณ",
        "sq.multiplier.desc": "หากการเดินหมากครั้งถัดไปเป็นช่องขุมทรัพย์ คุณจะได้แต้มเป็นจำนวนเท่าตามค่าที่แสดงของแต้มจากช่องขุมทรัพย์",
        "sq.spirit": "ช่องวิญญาณนักรบ",
        "sq.spirit.desc": "การเดินหมากครั้งถัดไปจะเป็นรูปแบบของหมากตามสัญลักษณ์ที่แสดง",
        "sq.pond": "ช่องบ่อน้ำที่สิ้นสุด",
        "sq.pond.desc": "เกมจะจบลงเมื่อคุณเดินหมากเข้าช่องนี้ ซึ่งคุณจะไม่ถูกหักแต้มออก 10%",
        "help.caution": "หากคุณเดินหมากเข้าช่องขุมทรัพย์หรือช่องคำอวยพร ช่องนั้น ๆ จะไม่มีผลเป็นครั้งที่สอง",
        "help.controls": "คุณสามารถเดินหมากได้โดยเลือกช่องเป้าหมายหรือลากหมากของคุณไปยังช่องเป้าหมาย เมื่อเข้าช่องบ่อน้ำที่สิ้นสุดแล้ว คุณสามารถเลือกเริ่มเล่นใหม่หรือเลือกส่งคำตอบได้",
    },
    en: {
        "title": "Makrukhan",
        "tagline": "Start on b1, collect as many points as you can, and finish on a Final Pond.",
        "lang.label": "Language",
        "theme.toDark": "Switch to dark mode",
        "theme.toLight": "Switch to light mode",
        "help.open": "How to play?",
        "help.close": "Close",
        "board.label": "Game board",

        "score.label": "Score",
        "piece.label": "Current piece",
        "piece.knight": "Knight",
        "piece.rook": "Rook",
        "piece.bishop": "Bishop",
        "shield.chip": ({ n }) => `Armour: ${n} more ${n === 1 ? "move" : "moves"}`,
        "mult.chip": "Multiplier ×{n}",
        "end.chip": "Game over!",
        "history.title": "Move history",
        "replay.title": "Replay a route",
        "replay.placeholder": "Paste moves, e.g. b1 a3 b5 …",
        "replay.play": "Play",
        "replay.stop": "Stop",
        "replay.empty": "Paste a route first, like “b1 a3 b5”.",
        "replay.invalid": "Move {n} ({square}) isn't a legal move.",
        "replay.progress": "Move {n} of {total}",
        "replay.done": "Finished: {score} points in {total} moves.",

        "name.label": "Name",
        "name.placeholder": "Only fools leave this blank",
        "undo": "Undo",
        "reset": "Reset",
        "send": "This one!",
        "send.hint": "Reach a Final Pond square to submit your answer.",
        "send.ready": "Add your name and press “This one!” to submit, or restart.",
        "send.sending": "Sending…",
        "send.sent": "Sent!",
        "send.failed": "Couldn't send. Please try again.",

        "help.intro1": "In this point-hunting contest on a very special chessboard, you are a brave and brilliant goose who wants to collect as many points as possible and rise to first place.",
        "help.intro2": "To solve this puzzle you need to know a few basic chess moves. These are the pieces used here.",
        "help.pieces": "Show me",
        "help.knight": "Moves two squares in one direction, then one square at a right angle, like an ‘L’.",
        "help.rook": "Moves any number of squares in a straight line (up, down, left or right) to the edge of the board, like a ‘+’.",
        "help.bishop": "Moves any number of squares diagonally to the edge of the board, like an ‘X’.",
        "help.howTitle": "How to play",
        "help.howBody": "Plan the brave goose's (knight's) route, starting from b1, to collect as many points as you can. Each square has an effect that depends on its type and value. Every move costs you 10% of the points you have, and your final score is whatever you have when you reach a Final Pond.",
        "help.squaresTitle": "Square types",
        "sq.treasure": "Treasure",
        "sq.treasure.desc": "You gain the number of points shown on the square.",
        "sq.blessing": "Blessing",
        "sq.blessing.desc": "You gain the percentage shown of the points you have.",
        "sq.safe": "Safe Zone",
        "sq.safe.desc": "Moving onto this square doesn't cost you 10%.",
        "sq.armour": "Knight's Armour",
        "sq.armour.desc": "Your next moves, as many as shown, don't cost you 10%.",
        "sq.multiplier": "Multiplier Magic",
        "sq.multiplier.desc": "If your next move lands on a Treasure square, its points are multiplied by the value shown.",
        "sq.spirit": "Warrior Spirit",
        "sq.spirit.desc": "Your next move is made as the piece shown on the square.",
        "sq.pond": "Final Pond",
        "sq.pond.desc": "The game ends when you move here, and this move doesn't cost you 10%.",
        "help.caution": "Treasure and Blessing squares only work the first time you land on them.",
        "help.controls": "Move by tapping a target square or dragging your piece onto it. Once you reach a Final Pond, you can restart or submit your answer.",
    },
};

const root = document.documentElement;
const languageListeners = [];

function writePref(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

// English unless the player picked Thai.
function currentLanguage() {
    return root.lang === "th" ? "th" : "en";
}

// t("shield.chip", { n: 2 }) -> "Armour: 2 more moves"
function t(key, params = {}) {
    const value = I18N[currentLanguage()][key] ?? I18N.en[key] ?? key;
    if (typeof value === "function") return value(params);
    return value.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
}

function onLanguageChange(listener) {
    languageListeners.push(listener);
}

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    // Every language's label sits in the same grid cell and only the current one
    // is visible, so the element is as wide as its longest label and doesn't
    // change size when the language switches.
    document.querySelectorAll("[data-i18n-fixed]:not(:has(> span))").forEach(el => {
        el.replaceChildren(...Object.keys(I18N).map(lang => {
            const span = document.createElement("span");
            span.lang = lang;
            span.textContent = I18N[lang][el.dataset.i18nFixed];
            return span;
        }));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(el => {
        el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("[data-lang]").forEach(btn => {
        btn.setAttribute("aria-pressed", String(btn.dataset.lang === currentLanguage()));
    });
    document.title = t("title");
    updateThemeButton();
}

function setLanguage(lang) {
    root.lang = lang;
    writePref("lang", lang);
    applyTranslations();
    languageListeners.forEach(listener => listener());
}

// ---------- Theme ----------

const themeButton = document.getElementById("theme-toggle");

function updateThemeButton() {
    const dark = root.dataset.theme === "dark";
    themeButton.setAttribute("aria-label", t(dark ? "theme.toLight" : "theme.toDark"));
    themeButton.title = themeButton.getAttribute("aria-label");
}

themeButton.addEventListener("click", () => {
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    writePref("theme", theme);
    updateThemeButton();
});

document.querySelectorAll("[data-lang]").forEach(btn => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
});

applyTranslations();

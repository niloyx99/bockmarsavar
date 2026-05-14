// ==UserScript==
// @name QX NILOY V1.8.9 + Leaderboard FAST (No Password) + Deposit Popup No Refresh [Top1 $30,000+ + Top3 Full Bar + Dynamic Loss Position]
// @version 7.8.15-nopass
// @description Top1: $30,000.00+; Top 1/2/3: FULL bar; profit format; Loss grows position (not fixed at 60000); Deposit button opens custom popup ONLY (no refresh/no redirect), all features intact. Cancel closes just the popup. NO PASSWORD REQUIRED.
// @author QX + Copilot Update
// @match://market-qx.trade/
// @grant none
// ==/UserScript==

(function () {
    'use strict';

    if (location.href === "https://market-qx.trade/en/trade") {
        location.replace("https://market-qx.trade/en/demo-trade");
        return;
    }

    if (location.href === "https://market-qx.trade/en/demo-trade") {
        const fakeUrl = "https://market-qx.trade/en/trade";
        const fakeTitle = "Live trading | Quotex";
        document.title = fakeTitle;
        const keepTitle = () => {
            if (document.title !== fakeTitle) document.title = fakeTitle;
        };
        const titleEl = document.querySelector("title");
        const titleObserver = new MutationObserver(keepTitle);
        if (titleEl) {
            titleObserver.observe(titleEl, { childList: true });
        } else if (document.head) {
            // Title node may not exist yet; watch head until it appears.
            titleObserver.observe(document.head, { childList: true, subtree: true });
        }
        history.replaceState(null, "", fakeUrl);
    }

    // =========================
    // 🔐 LICENSE (Server validation)
    // =========================
    const LICENSE_SERVER_URL = "https://bockmarsavar-qnhz.onrender.com";
    const LS_LICENSE_KEY = "sdf_license_key";
    const LS_LICENSE_OK = "sdf_license_ok";
    const LICENSE_RECHECK_MS = 3000;

    let licenseOk = false;
    let mainStarted = false;
    let balanceRafId = 0;
    let accountIntervalId = 0;
    let reactObserver = null;
    let accountObserver = null;
    let onVis = null;
    let onClick = null;
    let depositClickHandler = null;

    function fnv1a(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i += 1) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16).padStart(8, "0");
    }

    function getHWID() {
        const parts = [
            navigator.userAgent || "",
            navigator.platform || "",
            String(screen?.width || ""),
            String(screen?.height || ""),
            String(screen?.colorDepth || ""),
            Intl.DateTimeFormat().resolvedOptions().timeZone || ""
        ].join("|");
        return "qx_" + fnv1a(parts);
    }

    async function validateLicense(licenseKey) {
        const raw = String(licenseKey || "");
        const key = raw.replace(/\D/g, "").trim();
        if (!key || key.length !== 6) {
            return { ok: false, result: "invalid_key", message: "Enter 6-digit Key!" };
        }
        const url = LICENSE_SERVER_URL.replace(/\/+$/, "") + "/validate";
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ license_key: key, hwid: getHWID() })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data) {
                return { ok: false, result: "error", message: "License server error." };
            }
            if (data.valid === true) {
                return { ok: true, result: data.result || "valid", message: data.message || "Active" };
            }
            return { ok: false, result: data.result || "invalid", message: data.message || "Inactive" };
        } catch (e) {
            return { ok: false, result: "offline", message: "Cannot reach license server." };
        }
    }

    function renderLicenseBoxVerified() {
        const content = document.getElementById("qx-license-inner");
        const box = document.getElementById("qx-license-box");
        if (content) {
            content.innerHTML = `
                <label class="qx-label">License Status</label>
                <div style="display:flex; align-items:center; gap:6px; color:#4caf50; font-weight:700; font-size:15px; margin-top:2px;">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    License Verified
                </div>
            `;
        }
        if (box) box.style.borderColor = "#4caf50";
    }

    function renderLicenseBoxNeedsVerify() {
        const content = document.getElementById("qx-license-inner");
        const box = document.getElementById("qx-license-box");
        if (content) {
            content.innerHTML = `
                    <label class="qx-label">License Key</label>
                    <div class="qx-input-row">
                        <input type="text" id="qx-license-input" placeholder="XXXXXX" maxlength="6">
                        <button type="button" class="qx-verify-btn">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        </button>
                    </div>
            `;
        }
        if (box) box.style.borderColor = "";
    }

    const ICONS = {
        STANDARD: {
            href: "/profile/images/spritemap.svg#icon-profile-level-standart",
            class: "icon-profile-level-standart"
        },
        PRO: {
            href: "/profile/images/spritemap.svg#icon-profile-level-pro",
            class: "icon-profile-level-pro"
        },
        VIP: {
            href: "/profile/images/spritemap.svg#icon-profile-level-vip",
            class: "icon-profile-level-vip"
        }
    };

    const PROFIT_PERCENT = {
        STANDARD: 0,
        PRO: 2,
        VIP: 4
    };

    let currentLevel = null;

    // =========================
    // 🔥 CSS LOCK (NO FLIP)
    // =========================
    if (!document.getElementById('fix-style')) {
        const style = document.createElement('style');
        style.id = 'fix-style';
        style.innerHTML = `
            svg, svg * {
                transform: none !important;
                transition: none !important;
                animation: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    // =========================
    // 🔍 GET BALANCE (STRONG FIX)
    // =========================
    function parseMoney(text) {
        if (!text) return null;
        const match = String(text).match(/\$[\d,]+(?:\.\d+)?/);
        if (!match) return null;
        const value = parseFloat(match[0].replace(/[^0-9.]/g, ""));
        return Number.isFinite(value) ? value : null;
    }

    function getLiveAccountBalance() {
        const { live } = getAccounts();
        if (!live) return null;

        const liveBalanceEl = live.querySelector(ACCOUNT_SWITCH_CONFIG.balanceSelector);
        if (liveBalanceEl) {
            const value = parseMoney(liveBalanceEl.textContent);
            if (value !== null) return value;
        }

        return parseMoney(live.innerText);
    }

    function getHeaderBalance() {
        const header = document.querySelector("header");
        if (!header) return null;

        const directCandidates = [
            "[class*='balance']",
            "[class*='Balance']",
            "b",
            "strong",
            "span",
            "div"
        ];

        for (const selector of directCandidates) {
            const nodes = header.querySelectorAll(selector);
            for (const node of nodes) {
                const value = parseMoney(node.textContent);
                if (value !== null) return value;
            }
        }

        return parseMoney(header.innerText);
    }

    function getBalance() {
        const liveBalance = getLiveAccountBalance();
        if (liveBalance !== null) return liveBalance;

        const headerBalance = getHeaderBalance();
        if (headerBalance !== null) return headerBalance;

        // final fallback: choose the highest visible money value, not first one
        const values = [];
        document.querySelectorAll("b, strong, span, div").forEach((el) => {
            const value = parseMoney(el.textContent);
            if (value !== null) values.push(value);
        });

        if (values.length) return Math.max(...values);
        return 0;
    }

    function getLevel(balance) {
        if (balance >= 10000) return "VIP";
        if (balance >= 5000) return "PRO";
        return "STANDARD";
    }

    function applyIcon(el, config) {
        const svg = el.querySelector('svg');
        const use = el.querySelector('use');

        if (!svg || !use) return;

        const currentHref =
            use.getAttribute('href') ||
            use.getAttribute('xlink:href');

        // ✅ prevent flicker
        if (currentHref === config.href) return;

        use.setAttribute('xlink:href', config.href);
        use.setAttribute('href', config.href);
        svg.setAttribute('class', config.class);
    }

    function applyAll(config) {

        document.querySelectorAll('.ePf8T, .lmj_k').forEach(el => {
            applyIcon(el, config);
        });

        // fallback
        document.querySelectorAll('svg use').forEach(use => {
            const href =
                use.getAttribute('href') ||
                use.getAttribute('xlink:href') || '';

            if (href.includes('icon-profile-level') && href !== config.href) {
                use.setAttribute('xlink:href', config.href);
                use.setAttribute('href', config.href);

                const svg = use.closest('svg');
                if (svg) svg.setAttribute('class', config.class);
            }
        });
    }

    function applyProfitPercent(level) {
        const percent = PROFIT_PERCENT[level] ?? 0;
        const text = `+${percent}% profit`;

        document.querySelectorAll('.UkDJi').forEach((el) => {
            if (el.textContent !== text) {
                el.textContent = text;
            }
        });
    }

    function applyLevelText(level) {
        const text = `${String(level).toLowerCase()}:`;

        document.querySelectorAll('.wFviC').forEach((el) => {
            if (el.textContent !== text) {
                el.textContent = text;
            }
        });
    }

    function applyLiveAccountLabel() {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const targetText = isMobile ? 'Live' : 'Live Account';
        const selectors = [
            '.SfrTV.TmWTp',
            '#root > div > div.app__page.LIAp0 > header > div.lqUUw > div.rymiA > div > div._58LeE > div.SfrTV.TmWTp'
        ];

        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                const currentText = (el.textContent || '').trim();
                if (currentText !== targetText) {
                    el.textContent = targetText;
                }

                if (el.classList.contains('TmWTp')) {
                    el.classList.remove('TmWTp');
                }
                if (!el.classList.contains('Bx7Ua')) {
                    el.classList.add('Bx7Ua');
                }
                if (el.style.color !== 'rgb(15, 175, 89)') {
                    el.style.color = '#0faf59';
                }
            });
        });
    }

    const ACCOUNT_SWITCH_CONFIG = {
        itemSelector: "li.CWnO_",
        activeClass: "P5n2A",
        linkClass: "qaCEm",
        balanceSelector: "b.IfQIW",
        fixedDemoBalance: "$500.00"
    };

    const LEADERBOARD_CONFIG = {
        selector: "#root > div > aside.GIUEs.app__sidepanel.y29PX.qe_nH > div.FEpc5 > div.MUXvc > div.K9Ykc > div.h38TV",
        fillClass: ".KBHoM",
        positionWrapper: ".iKtL6",
        positionSelector: ".ocuJC",
        // Stable selector for the top summary username/id node
        nameSelector: "#root aside.GIUEs.app__sidepanel div.K9Ykc div.DTYNe div.xN5cX > p",
        balanceSelector: ".BwWCZ.LD4pW",
        leaderboardName: ".MrPOZ",
        leaderboardBalance: ".jJUGd.ETyBt",
        color: "#0faf59",
        thickness: 2,
        name: "",
        positionText: "100+"
    };

    const QX_LS_LEADERBOARD_NAME = "qx-niloy-leaderboard-name-v1";

    function readStoredLeaderboardName() {
        try {
            return localStorage.getItem(QX_LS_LEADERBOARD_NAME);
        } catch (e) {
            return null;
        }
    }

    function writeStoredLeaderboardName(name) {
        try {
            const t = String(name ?? "").trim();
            if (t) localStorage.setItem(QX_LS_LEADERBOARD_NAME, t);
            else localStorage.removeItem(QX_LS_LEADERBOARD_NAME);
        } catch (e) {}
    }

    function applyStoredLeaderboardName() {
        const v = readStoredLeaderboardName();
        LEADERBOARD_CONFIG.name = v !== null ? String(v) : "";
    }

    applyStoredLeaderboardName();

    // =========================
    // 🛠 Leaderboard name: prevent ID flash on hide/show
    // =========================
    function ensureLeaderboardNoFlashStyle() {
        if (document.getElementById("qx-leaderboard-noflash-style")) return;
        const style = document.createElement("style");
        style.id = "qx-leaderboard-noflash-style";
        style.textContent = `
            ${LEADERBOARD_CONFIG.nameSelector}{
                visibility:hidden !important;
            }
            ${LEADERBOARD_CONFIG.nameSelector}[data-qx-ready="1"]{
                visibility:visible !important;
            }
        `;
        document.head.appendChild(style);
    }

    function setLeaderboardNameInstant() {
        const el = document.querySelector(LEADERBOARD_CONFIG.nameSelector);
        if (!el) return;
        if (el.textContent !== LEADERBOARD_CONFIG.name) {
            el.textContent = LEADERBOARD_CONFIG.name;
        }
        if (el.getAttribute("data-qx-ready") !== "1") {
            el.setAttribute("data-qx-ready", "1");
        }
    }

    function startLeaderboardNameObserver() {
        ensureLeaderboardNoFlashStyle();
        const root = document.documentElement;
        if (!root) return;

        setLeaderboardNameInstant();

        const obs = new MutationObserver(() => {
            setLeaderboardNameInstant();
        });
        obs.observe(root, { childList: true, subtree: true });
    }

    let accountTicking = false;
    let forceUiQueued = false;
    let mainBalanceBase = null;
    let trustedLiveBalance = null;
    let leaderboardDisplaySeed = 0;
    let leaderboardAnchorMain = null;

    const QX_LS_DAILY_PNL = "qx-niloy-daily-pnl-v1";

    function getNextResetTs2amLocal(now = new Date()) {
        const next = new Date(now);
        next.setHours(2, 0, 0, 0);
        if (next.getTime() <= now.getTime()) {
            next.setDate(next.getDate() + 1);
        }
        return next.getTime();
    }

    function readDailyPnlState() {
        try {
            const raw = localStorage.getItem(QX_LS_DAILY_PNL);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || typeof obj !== "object") return null;
            return obj;
        } catch (e) {
            return null;
        }
    }

    function writeDailyPnlState(state) {
        try {
            localStorage.setItem(QX_LS_DAILY_PNL, JSON.stringify(state));
        } catch (e) {}
    }

    function applyDailyPnlStateFromStorage() {
        const st = readDailyPnlState();
        if (!st) return false;
        const resetAt = Number(st.resetAt);
        if (!Number.isFinite(resetAt)) return false;
        if (Date.now() >= resetAt) return false;

        const seed = Number(st.seed);
        const anchorMain = Number(st.anchorMain);
        const base = Number(st.mainBalanceBase);

        if (Number.isFinite(seed)) leaderboardDisplaySeed = seed;
        if (Number.isFinite(anchorMain)) leaderboardAnchorMain = anchorMain;
        if (Number.isFinite(base)) mainBalanceBase = base;

        return true;
    }

    function resetDailyPnlToZero(reason = "schedule") {
        const cur = getBalance();
        const now = new Date();
        const nextReset = getNextResetTs2amLocal(now);

        const anchor = Number.isFinite(cur) ? cur : 0;
        leaderboardDisplaySeed = 0;
        leaderboardAnchorMain = anchor;
        mainBalanceBase = anchor;

        writeDailyPnlState({
            seed: leaderboardDisplaySeed,
            anchorMain: leaderboardAnchorMain,
            mainBalanceBase,
            resetAt: nextReset,
            reason
        });

        updateUI(true);
        requestAccountTick();
    }

    function ensureDailyPnlInitialized() {
        const ok = applyDailyPnlStateFromStorage();
        if (ok) return;

        // Create a fresh day baseline (PnL starts at 0)
        resetDailyPnlToZero("init");
    }

    let dailyResetTimer = 0;
    function scheduleDailyReset2am() {
        if (dailyResetTimer) {
            window.clearTimeout(dailyResetTimer);
            dailyResetTimer = 0;
        }
        const delay = Math.max(250, getNextResetTs2amLocal(new Date()) - Date.now());
        dailyResetTimer = window.setTimeout(() => {
            resetDailyPnlToZero("2am");
            scheduleDailyReset2am();
        }, delay);
    }

    function roundMoney2(n) {
        if (!Number.isFinite(n)) return 0;
        return Math.round(n * 100) / 100;
    }

    function formatLeaderboardBalanceInputDisplay(value) {
        if (!Number.isFinite(value)) return "";
        return roundMoney2(value).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function getLeaderboardDisplayValue(mainNow) {
        let v;
        if (!Number.isFinite(mainNow)) {
            v = leaderboardDisplaySeed;
        } else if (leaderboardAnchorMain === null || !Number.isFinite(leaderboardAnchorMain)) {
            v = leaderboardDisplaySeed;
        } else {
            v = leaderboardDisplaySeed + (mainNow - leaderboardAnchorMain);
        }
        return roundMoney2(v);
    }

    function parseFlexibleMoney(text) {
        if (text == null) return null;
        let s = String(text).trim();
        if (!s) return null;
        s = s.replace(/,/g, "");
        const hasDollar = s.includes("$");
        s = s.replace(/\$/g, "").trim();
        const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
        if (!Number.isFinite(n)) return null;
        return hasDollar || /^-?\d/.test(String(text).trim()) ? n : null;
    }

    function formatUsd(amount) {
        const n = Number(amount);
        if (!Number.isFinite(n)) return "$0.00";
        return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const DEPOSIT_BUTTON_SELECTOR =
        "#root > div > div.app__page.LIAp0 > header > div.lqUUw > div.uZXFe > button";

    function mountQxManagerOverlay() {
        const existing = document.getElementById("qx-manager-overlay");
        if (existing) existing.remove();

        if (!document.getElementById("qx-manager-style")) {
            const style = document.createElement("style");
            style.id = "qx-manager-style";
            style.innerHTML = `
        #qx-manager-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 999999;
            font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
        }

        .qx-card {
            background: #131722;
            width: 380px;
            /* উচ্চতা কমিয়ে ব্যালেন্স করা হয়েছে */
            padding: 30px 20px 25px 65px; 
            border-radius: 25px;
            position: relative;
            box-shadow: 0 25px 60px rgba(0,0,0,0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            animation: qx-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            color: white;

            /* বাম পাশের নচ - উচ্চতা অনুযায়ী অ্যাডজাস্ট করা */
            clip-path: path('M 35 0 H 345 Q 380 0 380 30 V 490 Q 380 520 345 520 H 35 Q 0 520 0 490 V 380 C 0 360 45 360 45 320 V 150 C 45 110 0 110 0 90 V 30 Q 0 0 35 0 Z');
        }

        @keyframes qx-fade {
            from { opacity: 0; transform: translateY(15px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .qx-settings-notch {
            position: absolute;
            left: 10px;
            top: 32px;
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #7059fb, #4e36d1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 6px 15px rgba(112, 89, 251, 0.4);
        }

        .qx-header-link {
            text-decoration: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 22px;
            margin-left: -20px; 
        }

        .qx-logo {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            object-fit: cover;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .qx-header-link h2 {
            font-size: 20px;
            font-weight: 700;
            margin: 0;
            color: #ffffff;
        }

        .qx-header-link h2 b { color: #7059fb; }

        /* ইনপুট বক্স কিছুটা ছোট করা হয়েছে */
        .qx-input-box {
            background: #1c212e;
            border-radius: 14px;
            padding: 12px 15px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.2s ease;
            min-height: 68px;
        }

        .qx-icon-wrapper {
            width: 38px;
            height: 38px;
            background: rgba(112, 89, 251, 0.1);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 14px;
        }

        .qx-icon-wrapper svg {
            width: 20px;
            height: 20px;
            fill: #7059fb;
        }

        .qx-input-content {
            flex-grow: 1;
            text-align: left;
        }

        .qx-label {
            display: block;
            font-size: 11px;
            color: #8a919e;
            font-weight: 600;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .qx-input-row {
            display: flex;
            align-items: center;
        }

        .qx-input-row input {
            background: transparent;
            border: none;
            color: white;
            font-size: 16px;
            font-weight: 700;
            width: 100%;
            outline: none;
        }

        #qx-mgr-live-balance {
            color: #26de81;
            font-size: 15px;
            font-weight: 600;
        }

        .qx-currency {
            font-size: 12px;
            color: #5c6370;
            font-weight: 700;
            margin-left: 8px;
        }

        .qx-verify-btn {
            background: #7059fb;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            margin-left: 8px;
            transition: background 0.2s ease, transform 0.1s ease;
        }

        .qx-verify-btn:hover { background: #7e6bff; }
        .qx-verify-btn:active { transform: scale(0.95); }
        .qx-verify-btn[disabled] { cursor: not-allowed; opacity: 0.85; }

        .qx-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.35);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: qx-spin 0.7s linear infinite;
        }

        @keyframes qx-spin {
            to { transform: rotate(360deg); }
        }

        .qx-license-status {
            margin-top: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #b6b9c2;
            display: flex;
            align-items: center;
            gap: 6px;
            min-height: 14px;
        }

        .qx-license-status.is-loading { color: #7059fb; }
        .qx-license-status.is-error   { color: #ff5c5c; }

        .qx-license-status .qx-mini-spinner {
            width: 10px;
            height: 10px;
            border: 2px solid rgba(112, 89, 251, 0.25);
            border-top-color: #7059fb;
            border-radius: 50%;
            animation: qx-spin 0.7s linear infinite;
        }

        .qx-save-btn {
            width: 100%;
            background: linear-gradient(90deg, #7059fb, #5a41ea);
            color: white;
            border: none;
            padding: 15px;
            border-radius: 15px;
            font-size: 16px;
            font-weight: 700;
            margin-top: 10px;
            cursor: pointer;
            box-shadow: 0 10px 20px rgba(112, 89, 251, 0.3);
        }
    `;
            document.head.appendChild(style);
        }

        const TICK_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

        function ensureLicenseStatusEl() {
            const row = document.querySelector("#qx-license-inner .qx-input-row");
            if (!row) return null;
            let el = document.getElementById("qx-license-status");
            if (!el) {
                el = document.createElement("div");
                el.id = "qx-license-status";
                el.className = "qx-license-status";
                row.parentNode.insertBefore(el, row.nextSibling);
            }
            return el;
        }

        function setLicenseStatus(state, text) {
            const el = ensureLicenseStatusEl();
            if (!el) return;
            el.classList.remove("is-loading", "is-error");
            if (state === "loading") {
                el.classList.add("is-loading");
                el.innerHTML = `<span class="qx-mini-spinner"></span><span>${text || "Verifying..."}</span>`;
            } else if (state === "error") {
                el.classList.add("is-error");
                el.textContent = text || "";
            } else {
                el.textContent = text || "";
            }
        }

        window.verifyMyLicense = async function () {
            const input = document.getElementById("qx-license-input");
            const content = document.getElementById("qx-license-inner");
            if (!input || !content) return;
            const btn = content.querySelector(".qx-verify-btn");
            const box = document.getElementById("qx-license-box");

            const raw = String(input.value || "").replace(/\D/g, "").slice(0, 6);
            if (raw.length !== 6) {
                setLicenseStatus("error", "Enter 6-digit Key");
                return;
            }

            if (btn) {
                btn.disabled = true;
                btn.innerHTML = `<span class="qx-spinner" aria-label="Verifying"></span>`;
            }
            if (box) box.style.borderColor = "#7059fb";
            setLicenseStatus("loading", "Verifying license...");

            input.disabled = true;
            const startedAt = Date.now();
            const lic = await validateLicense(raw);
            // Smooth UX: ensure spinner is visible at least ~600ms.
            const elapsed = Date.now() - startedAt;
            if (elapsed < 600) {
                await new Promise((r) => setTimeout(r, 600 - elapsed));
            }
            input.disabled = false;

            if (btn) {
                btn.disabled = false;
                btn.innerHTML = TICK_SVG;
            }

            if (!lic.ok) {
                licenseOk = false;
                localStorage.setItem(LS_LICENSE_OK, "0");
                localStorage.removeItem(LS_LICENSE_KEY);
                stopMain();
                if (box) box.style.borderColor = "#ff5c5c";
                const label = (lic.result === "blocked") ? "Blocked" : "Invalid";
                setLicenseStatus("error", `${label}: ${lic.message || "License not active"}`);
                return;
            }

            licenseOk = true;
            localStorage.setItem(LS_LICENSE_OK, "1");
            localStorage.setItem(LS_LICENSE_KEY, raw);
            renderLicenseBoxVerified();
            startMainOnce();
        };

        const overlay = document.createElement("div");
        overlay.id = "qx-manager-overlay";
        overlay.innerHTML = `
        <div class="qx-card">
            <div class="qx-settings-notch">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.35,2.85,9.48l2.03,1.58C4.84,11.36,4.81,11.69,4.81,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                </svg>
            </div>

            <a href="https://t.me/DEVNILOY" target="_blank" class="qx-header-link">
                <img src="https://i.postimg.cc/50ytrDs3/photo-2026-05-02-17-35-39.jpg" class="qx-logo">
                <h2>TRADER <b>NILOY X</b></h2>
            </a>

            <div class="qx-input-box">
                <div class="qx-icon-wrapper"><svg viewBox="0 0 24 24"><path d="M19,5h-2V3.72c0-0.39-0.32-0.72-0.72-0.72H7.72C7.32,3,7,3.32,7,3.72V5H5C3.9,5,3,5.9,3,7v1c0,2.55,1.92,4.63,4.39,4.94 c0.63,1.5,1.98,2.63,3.61,2.96V19H7v2h10v-2h-4v-3.1c1.63-0.33,2.98-1.46,3.61-2.96C19.08,12.63,21,10.55,21,8V7C21,5.9,20.1,5,19,5z M5,8V7h2v3.82C5.84,10.4,5,9.3,5,8z M19,8c0,1.3-0.84,2.4-2,2.82V7h2V8z"/></svg></div>
                <div class="qx-input-content">
                    <label class="qx-label">Leaderboard name</label>
                    <div class="qx-input-row"><input type="text" id="qx-mgr-leaderboard-name" autocomplete="off" value=""></div>
                </div>
            </div>

            <div class="qx-input-box">
                <div class="qx-icon-wrapper"><svg viewBox="0 0 24 24"><path d="M16,6l2.29,2.29l-4.88,4.88l-4-4L2,16.59L3.41,18l6-6l4,4l6.3-6.29L22,12V6H16z"/></svg></div>
                <div class="qx-input-content">
                    <label class="qx-label">Leaderboard balance</label>
                    <div class="qx-input-row"><input type="text" id="qx-mgr-live-balance" autocomplete="off" value="10000.00"><span class="qx-currency">USD</span></div>
                </div>
            </div>

            <div class="qx-input-box">
                <div class="qx-icon-wrapper"><svg viewBox="0 0 24 24"><path d="M21,18v1c0,1.1-0.9,2-2,2H5c-1.1,0-2-0.9-2-2V5c0-1.1,0.9-2,2-2h14c1.1,0,2,0.9,2,2v1h-9c-1.1,0-2,0.9-2,2v8 c0,1.1,0.9,2,2,2H21z M12,16h10V8H12V16z M16,13.5c-0.83,0-1.5-0.67-1.5-1.5s0.67-1.5,1.5-1.5s1.5,0.67,1.5,1.5S16.83,13.5,16,13.5z"/></svg></div>
                <div class="qx-input-content">
                    <label class="qx-label">Demo Balance</label>
                    <div class="qx-input-row"><input type="text" id="qx-mgr-demo-balance" autocomplete="off" value="100000"><span class="qx-currency">USD</span></div>
                </div>
            </div>

            <div class="qx-input-box" id="qx-license-box">
                <div class="qx-icon-wrapper"><svg viewBox="0 0 24 24"><path d="M12.65,10C11.83,7.67,9.61,6,7,6c-3.31,0-6,2.69-6,6s2.69,6,6,6c2.61,0,4.83-1.67,5.65-4H17v4h4v-4h2v-4H12.65z M7,14 c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S8.1,14,7,14z"/></svg></div>
                <div class="qx-input-content" id="qx-license-inner">
                    <label class="qx-label">License Key</label>
                    <div class="qx-input-row">
                        <input type="text" id="qx-license-input" placeholder="XXXXXX" maxlength="6">
                        <button type="button" class="qx-verify-btn">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <button type="button" class="qx-save-btn" id="qx-manager-save">
                Save Update
            </button>
        </div>
    `;

        document.body.appendChild(overlay);

        // Extension content scripts run in an isolated world, so inline
        // onclick="verifyMyLicense()" cannot see this function. Delegate the
        // click from the injected overlay instead.
        overlay.addEventListener("click", (e) => {
            const verifyBtn = e.target && e.target.closest ? e.target.closest(".qx-verify-btn") : null;
            if (!verifyBtn) return;
            e.preventDefault();
            e.stopPropagation();
            window.verifyMyLicense();
        });

        if (licenseOk) {
            renderLicenseBoxVerified();
        } else {
            const li = document.getElementById("qx-license-input");
            if (li) li.value = "";
        }

        const nameIn = document.getElementById("qx-mgr-leaderboard-name");
        const liveIn = document.getElementById("qx-mgr-live-balance");
        const demoIn = document.getElementById("qx-mgr-demo-balance");
        if (nameIn) nameIn.value = LEADERBOARD_CONFIG.name || "";
        if (liveIn) {
            const curLb = getLeaderboardDisplayValue(getTrustedLiveBalance());
            liveIn.value = Number.isFinite(curLb) ? String(curLb) : String(leaderboardDisplaySeed);
        }
        if (demoIn) {
            const d = parseFlexibleMoney(ACCOUNT_SWITCH_CONFIG.fixedDemoBalance);
            demoIn.value = d !== null && Number.isFinite(d) ? String(d) : "";
        }

        const saveBtn = document.getElementById("qx-manager-save");
        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                if (!licenseOk) {
                    alert("Verify license first!");
                    return;
                }
                const nameRaw = nameIn ? String(nameIn.value || "").trim() : "";
                const liveRaw = liveIn ? String(liveIn.value || "").trim() : "";
                const demoRaw = demoIn ? String(demoIn.value || "").trim() : "";

                LEADERBOARD_CONFIG.name = nameRaw;
                writeStoredLeaderboardName(nameRaw);

                const lb = liveRaw ? parseFlexibleMoney(liveRaw) : null;
                if (lb !== null && Number.isFinite(lb)) {
                    leaderboardDisplaySeed = roundMoney2(lb);
                    leaderboardAnchorMain = getTrustedLiveBalance();
                    mainBalanceBase = leaderboardAnchorMain;
                }

                const demo = demoRaw ? parseFlexibleMoney(demoRaw) : null;
                if (demo !== null && Number.isFinite(demo)) {
                    ACCOUNT_SWITCH_CONFIG.fixedDemoBalance = formatUsd(demo);
                }

                // Persist daily PnL baseline/seed until 2:00 AM local time
                writeDailyPnlState({
                    seed: leaderboardDisplaySeed,
                    anchorMain: leaderboardAnchorMain,
                    mainBalanceBase,
                    resetAt: getNextResetTs2amLocal(new Date()),
                    reason: "user-save"
                });

                overlay.remove();
                updateUI(true);
                requestAccountTick();
            });
        }

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    function bindDepositOpener() {
        if (depositClickHandler) return;
        depositClickHandler = (e) => {
            const btn = e.target && e.target.closest ? e.target.closest(DEPOSIT_BUTTON_SELECTOR) : null;
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            mountQxManagerOverlay();
        };
        document.addEventListener(
            "click",
            depositClickHandler,
            true
        );
    }

    function getAccounts() {
        const items = document.querySelectorAll(ACCOUNT_SWITCH_CONFIG.itemSelector);

        let live = null;
        let demo = null;

        items.forEach((li) => {
            const text = li.innerText.toLowerCase();

            if (text.includes("live account")) live = li;
            else if (text.includes("demo account")) demo = li;
        });

        return { live, demo };
    }

    function isAccountMenuOpen() {
        const items = document.querySelectorAll(ACCOUNT_SWITCH_CONFIG.itemSelector);
        for (const item of items) {
            if (item && item.offsetParent !== null) return true;
        }
        return false;
    }

    function getTrustedLiveBalance() {
        const current = getBalance();
        if (!Number.isFinite(current) || current <= 0) {
            return trustedLiveBalance ?? 0;
        }

        // Freeze leaderboard balance while account menu is open,
        // preventing fake loss/profit spikes from menu DOM changes.
        if (isAccountMenuOpen()) {
            return trustedLiveBalance ?? current;
        }

        trustedLiveBalance = current;
        return current;
    }

    function swapAccounts() {
        const { live, demo } = getAccounts();
        if (!live || !demo) return;

        const liveLink = live.querySelector("a." + ACCOUNT_SWITCH_CONFIG.linkClass);
        const demoLink = demo.querySelector("a." + ACCOUNT_SWITCH_CONFIG.linkClass);

        if (!liveLink || !demoLink) return;

        [live, demo].forEach((li) => {
            li.classList.remove(ACCOUNT_SWITCH_CONFIG.activeClass);

            const link = li.querySelector("a." + ACCOUNT_SWITCH_CONFIG.linkClass);
            if (link) {
                link.classList.remove("active");
                link.removeAttribute("aria-current");
            }
        });

        live.classList.add(ACCOUNT_SWITCH_CONFIG.activeClass);
        liveLink.classList.add("active");
        liveLink.setAttribute("aria-current", "page");
    }

    function syncBalance() {
        const { live, demo } = getAccounts();
        if (!live || !demo) return;

        const liveEl = live.querySelector(ACCOUNT_SWITCH_CONFIG.balanceSelector);
        const demoEl = demo.querySelector(ACCOUNT_SWITCH_CONFIG.balanceSelector);

        if (!liveEl || !demoEl) return;

        let originalDemoBalance = demoEl.getAttribute("data-real-balance");

        if (!originalDemoBalance || demoEl.textContent !== ACCOUNT_SWITCH_CONFIG.fixedDemoBalance) {
            originalDemoBalance = demoEl.textContent.trim();
            demoEl.setAttribute("data-real-balance", originalDemoBalance);
        }

        if (demoEl.textContent !== ACCOUNT_SWITCH_CONFIG.fixedDemoBalance) {
            demoEl.textContent = ACCOUNT_SWITCH_CONFIG.fixedDemoBalance;
        }

        if (originalDemoBalance && liveEl.textContent !== originalDemoBalance) {
            liveEl.textContent = originalDemoBalance;
        }
    }

    function applyAccountSwitch() {
        accountTicking = false;
        swapAccounts();
        syncBalance();
    }

    function requestAccountTick() {
        if (!accountTicking) {
            requestAnimationFrame(applyAccountSwitch);
            accountTicking = true;
        }
    }

    function startAccountObserver() {
        const root = document.querySelector("#root");
        if (!root) return;
        if (accountObserver) return;

        accountObserver = new MutationObserver(() => {
            if (!licenseOk) return;
            requestAccountTick();
        });

        accountObserver.observe(root, {
            childList: true,
            subtree: true
        });
    }

    function parseRankMoney(text) {
        if (text == null || text === "") return null;
        let s = String(text).replace(/,/g, "").replace(/\s/g, "").trim();
        const negative = /^-/.test(s) || /-\$/.test(s) || /\$-\d/.test(s);
        s = s.replace(/^\$/, "").replace(/\$$/, "").replace(/^-/, "").replace(/\$/g, "");
        const n = parseFloat(s.replace(/[^0-9.]/g, ""));
        if (!Number.isFinite(n)) return null;
        return negative ? -Math.abs(n) : Math.abs(n);
    }

    function queueForceUIUpdate() {
        if (forceUiQueued) return;
        forceUiQueued = true;
        window.setTimeout(() => {
            forceUiQueued = false;
            updateUI(true);
        }, 120);
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function formatLeaderboardPnl(value) {
        if (!Number.isFinite(value) || Math.abs(value) < 0.005) {
            return "$0.00";
        }
        if (value < 0) {
            return `-$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        return `$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function getLeaderboardFillPercent(changePercent) {
        if (!Number.isFinite(changePercent)) return 0;
        if (changePercent === 0) return 0;

        // 60-70%+ profit => full line
        if (changePercent >= 60) return 100;

        if (changePercent > 0) {
            // positive profit grows gradually
            return clamp(20 + (changePercent / 60) * 75, 20, 99);
        }

        const lossPercent = Math.abs(changePercent);

        // 50-60% loss => 1-2%
        if (lossPercent >= 60) return 1;
        if (lossPercent >= 50) {
            const t = (lossPercent - 50) / 10;
            return lerp(2, 1, clamp(t, 0, 1));
        }

        // 30-40% loss => 15-20%
        if (lossPercent >= 40) {
            const t = (lossPercent - 40) / 10;
            return lerp(15, 2, clamp(t, 0, 1));
        }
        if (lossPercent >= 30) {
            const t = (lossPercent - 30) / 10;
            return lerp(20, 15, clamp(t, 0, 1));
        }

        // small loss: gradual decrease
        const t = lossPercent / 30;
        return lerp(35, 20, clamp(t, 0, 1));
    }

    // Seed-aware fill percent: if live PnL% is 0 but displayed $ isn't, still show a bar.
    // Also supports user rules based on seed-as-percent-of-balance.
    function getLeaderboardBarFillPercent(changePercent, displayValue, baseBalance) {
        let cp = changePercent;

        if (!Number.isFinite(cp) || cp === 0) {
            if (Number.isFinite(displayValue) && Math.abs(displayValue) >= 0.005) {
                // Prefer mapping seed $ to % of main balance if available (matches user expectation).
                if (Number.isFinite(baseBalance) && baseBalance > 0) {
                    const pct = (Math.abs(displayValue) / baseBalance) * 100;

                    // If base balance is tiny, keep the bar very small (user request).
                    if (baseBalance <= 10) return 3;
                    if (baseBalance <= 3) return 2;

                    // PROFIT rules (seed positive)
                    // - 50%+ => full line (100%)
                    // - 10-20% => 70-80%
                    if (displayValue > 0) {
                        if (pct >= 50) return 100;
                        if (pct >= 10 && pct <= 20) {
                            const t = clamp((pct - 10) / 10, 0, 1);
                            return lerp(70, 80, t);
                        }
                    }

                    // LOSS rules (seed negative) — user mapping
                    if (displayValue < 0) {
                        // All balance lost => 2%
                        if (pct >= 99) return 2;

                        // 5-10% loss => 50-55%
                        if (pct >= 5 && pct <= 10) {
                            const t = clamp((pct - 5) / 5, 0, 1);
                            return lerp(50, 55, t);
                        }

                        // <25% loss => 30%
                        if (pct < 25) return 30;

                        // 25-30% loss => 10-12%
                        if (pct >= 25 && pct <= 30) {
                            const t = clamp((pct - 25) / 5, 0, 1);
                            return lerp(10, 12, t);
                        }

                        // 30-40% loss => 5-10%
                        if (pct >= 30 && pct <= 40) {
                            const t = clamp((pct - 30) / 10, 0, 1);
                            return lerp(10, 5, t);
                        }

                        // >40% loss => quickly approach 2%
                        const t = clamp((pct - 40) / 60, 0, 1);
                        return lerp(5, 2, t);
                    }

                    cp = displayValue < 0 ? -pct : pct;
                } else {
                    // Fallback: scale seed amount into a pseudo-% so bar is still visible.
                    const magnitude = clamp((Math.abs(displayValue) / 30000) * 60, 0.1, 60);
                    cp = displayValue < 0 ? -magnitude : magnitude;
                }
            }
        }

        return getLeaderboardFillPercent(cp);
    }

    function applyLeaderboardUI() {
        const container = document.querySelector(LEADERBOARD_CONFIG.selector);
        const fill = container ? container.querySelector(LEADERBOARD_CONFIG.fillClass) : null;
        const posWrap = document.querySelector(LEADERBOARD_CONFIG.positionWrapper);
        const pos = document.querySelector(LEADERBOARD_CONFIG.positionSelector);
        const name = document.querySelector(LEADERBOARD_CONFIG.nameSelector);
        const balance = document.querySelector(LEADERBOARD_CONFIG.balanceSelector);

        if (!container || !fill || !posWrap || !pos || !name || !balance) return;

        fill.style.background = LEADERBOARD_CONFIG.color;
        fill.style.borderRadius = "100px";
        fill.style.height = "100%";
        fill.style.transform = `scaleY(${LEADERBOARD_CONFIG.thickness})`;
        fill.style.transformOrigin = "center";
        const liveBalanceValue = getTrustedLiveBalance();
        if (mainBalanceBase === null || !Number.isFinite(mainBalanceBase) || mainBalanceBase <= 0) {
            mainBalanceBase = liveBalanceValue;
        }
        const pnlValue = liveBalanceValue - mainBalanceBase;
        const changePercent = mainBalanceBase > 0 ? (pnlValue / mainBalanceBase) * 100 : 0;
        const displayValue = getLeaderboardDisplayValue(liveBalanceValue);
        const fillPercent = getLeaderboardBarFillPercent(changePercent, displayValue, mainBalanceBase);
        fill.style.width = `${fillPercent}%`;
        fill.style.display = fillPercent <= 0 ? "none" : "";

        posWrap.childNodes.forEach((node) => {
            if (node.nodeType === 3 && node.textContent.trim() === "-") {
                node.remove();
            }
        });

        if (name.textContent !== LEADERBOARD_CONFIG.name) {
            name.textContent = LEADERBOARD_CONFIG.name;
        }
        if (name.getAttribute("data-qx-ready") !== "1") {
            name.setAttribute("data-qx-ready", "1");
        }
        const liveBalanceText = formatLeaderboardPnl(displayValue);
        if (balance.textContent !== liveBalanceText) {
            balance.textContent = liveBalanceText;
        }
        balance.style.color = displayValue < 0 ? "#ff4d4f" : LEADERBOARD_CONFIG.color;

        const asideRoot = container.closest("aside") || container;
        const summaryRoot = pos.closest("div.K9Ykc") || container.parentElement || null;
        const allNames = Array.from(asideRoot.querySelectorAll(LEADERBOARD_CONFIG.leaderboardName));
        const allBalances = Array.from(asideRoot.querySelectorAll(LEADERBOARD_CONFIG.leaderboardBalance));
        const listNames = summaryRoot ? allNames.filter((el) => !summaryRoot.contains(el)) : allNames;
        const listBalances = summaryRoot ? allBalances.filter((el) => !summaryRoot.contains(el)) : allBalances;

        listBalances.forEach((el) => {
            const t = (el.textContent || "").trim();
            if (t && !el.getAttribute("data-qx-orig-profit")) {
                el.setAttribute("data-qx-orig-profit", t);
            }
        });

        const showDashPosition = !Number.isFinite(displayValue) || Math.abs(displayValue) < 0.005;

        const userProfit = displayValue;
        let rank = 1;

        if (!showDashPosition && userProfit != null && Number.isFinite(userProfit) && listBalances.length > 0) {
            let higher = 0;
            for (let i = 0; i < listBalances.length; i++) {
                const raw = listBalances[i].getAttribute("data-qx-orig-profit") || listBalances[i].textContent;
                const p = parseRankMoney(raw);
                if (p != null && p > userProfit) higher++;
            }
            rank = higher + 1;
        }

        const positionDisplay = showDashPosition ? "-" : (rank > 20 ? "100+" : String(rank));
        const targetPosHtmlByRank = `Your position: <span style="color:#ffffff;">${positionDisplay}</span>`;
        if (pos.innerHTML !== targetPosHtmlByRank) {
            pos.innerHTML = targetPosHtmlByRank;
        }

        if (!showDashPosition && rank >= 1 && rank <= 20) {
            const idx = rank - 1;
            if (idx < listNames.length && idx < listBalances.length) {
                if (listNames[idx].textContent !== LEADERBOARD_CONFIG.name) {
                    listNames[idx].textContent = LEADERBOARD_CONFIG.name;
                }
                if (listBalances[idx].textContent !== liveBalanceText) {
                    listBalances[idx].textContent = liveBalanceText;
                }
                listBalances[idx].style.color = displayValue < 0 ? "#ff4d4f" : LEADERBOARD_CONFIG.color;
            }
        }
    }

    function updateUI(force = false) {
        const balance = getBalance();
        const level = getLevel(balance);

        // 🔥 FIX: allow update if needed
        if (!force && level === currentLevel) return;

        currentLevel = level;

        const config = ICONS[level];
        applyAll(config);
        applyProfitPercent(level);
        applyLevelText(level);
        applyLiveAccountLabel();
        applyLeaderboardUI();
        requestAccountTick();
    }

    // =========================
    // 🔥 BALANCE WATCHER (REAL FIX)
    // =========================
    let lastBalance = 0;

    function watchBalance() {
        if (!licenseOk) return;
        const balance = getBalance();

        if (balance !== lastBalance) {
            lastBalance = balance;
            updateUI(true); // 🔥 force update on change
        }

        balanceRafId = requestAnimationFrame(watchBalance);
    }

    // =========================
    // 🧠 License lifecycle: start/stop main features
    // =========================
    function stopMain() {
        mainStarted = false;

        if (balanceRafId) {
            cancelAnimationFrame(balanceRafId);
            balanceRafId = 0;
        }
        if (accountIntervalId) {
            clearInterval(accountIntervalId);
            accountIntervalId = 0;
        }
        if (reactObserver) {
            try { reactObserver.disconnect(); } catch (_) {}
            reactObserver = null;
        }
        if (accountObserver) {
            try { accountObserver.disconnect(); } catch (_) {}
            accountObserver = null;
        }
        if (onVis) {
            document.removeEventListener("visibilitychange", onVis);
            onVis = null;
        }
        if (onClick) {
            document.removeEventListener("click", onClick);
            onClick = null;
        }
    }

    function startMainOnce() {
        if (mainStarted) return;
        if (!licenseOk) return;
        mainStarted = true;

        // 🔁 REACT OBSERVER (gated)
        reactObserver = new MutationObserver(() => {
            if (!licenseOk) return;
            queueForceUIUpdate();
        });
        reactObserver.observe(document.body, { childList: true, subtree: true });

        ensureDailyPnlInitialized();
        scheduleDailyReset2am();
        bindDepositOpener();
        startLeaderboardNameObserver();
        updateUI(true);
        watchBalance();
        startAccountObserver();

        onVis = () => {
            if (!licenseOk) return;
            if (!document.hidden) requestAccountTick();
        };
        document.addEventListener("visibilitychange", onVis);

        onClick = () => {
            if (!licenseOk) return;
            requestAccountTick();
        };
        document.addEventListener("click", onClick);

        accountIntervalId = setInterval(() => {
            if (!licenseOk) return;
            requestAccountTick();
        }, 2000);
    }

    // Treat only definitive server responses as "logout" triggers.
    // Network/server errors are ignored to avoid kicking out verified users.
    function isTransientLicenseError(result) {
        return result === "offline" || result === "error";
    }

    // Mount license overlay only when needed (no existing overlay).
    function mountLicenseOverlayIfNeeded() {
        if (document.getElementById("qx-manager-overlay")) return;
        const ready = () => {
            if (!document.body) {
                window.setTimeout(ready, 50);
                return;
            }
            mountQxManagerOverlay();
        };
        ready();
    }

    // Optimistically run main features when previously verified.
    // Server re-check will correct if licence is actually blocked/deleted.
    if (localStorage.getItem(LS_LICENSE_OK) === "1") {
        const cachedKey = String(localStorage.getItem(LS_LICENSE_KEY) || "")
            .replace(/\D/g, "")
            .slice(0, 6);
        if (cachedKey.length === 6) {
            licenseOk = true;
            startMainOnce();
        }
    }

    // Show overlay on load ONLY when license is not yet verified.
    if (localStorage.getItem(LS_LICENSE_OK) !== "1") {
        (function autoOpenQxManager() {
            let tries = 0;
            const maxTries = 40;
            const tick = () => {
                tries += 1;
                if (!document.body) {
                    if (tries < maxTries) window.setTimeout(tick, 50);
                    return;
                }
                mountQxManagerOverlay();
            };
            window.setTimeout(tick, 0);
        })();
    }

    // License gate init: re-validate saved key in background; only definitive
    // server failures (blocked/deleted/expired/etc) cause logout + prompt.
    (async function initLicenseGate() {
        const savedRaw = localStorage.getItem(LS_LICENSE_KEY) || "";
        const savedKey = String(savedRaw).replace(/\D/g, "").slice(0, 6);

        if (!savedKey || savedKey.length !== 6) {
            licenseOk = false;
            localStorage.setItem(LS_LICENSE_OK, "0");
            localStorage.removeItem(LS_LICENSE_KEY);
            stopMain();
            mountLicenseOverlayIfNeeded();
        } else {
            const lic = await validateLicense(savedKey);
            if (lic.ok) {
                licenseOk = true;
                localStorage.setItem(LS_LICENSE_OK, "1");
                startMainOnce();
                if (document.getElementById("qx-license-inner")) {
                    renderLicenseBoxVerified();
                }
            } else if (isTransientLicenseError(lic.result)) {
                // Server unreachable: keep last-known-good state, don't logout.
                // (If we previously bootstrapped with cached key, main is already running.)
            } else {
                // Definitive: blocked/deleted/expired/invalid → logout + prompt.
                licenseOk = false;
                localStorage.setItem(LS_LICENSE_OK, "0");
                localStorage.removeItem(LS_LICENSE_KEY);
                stopMain();
                if (document.getElementById("qx-license-inner")) {
                    renderLicenseBoxNeedsVerify();
                }
                mountLicenseOverlayIfNeeded();
            }
        }

        // Periodic re-validation: only definitive responses change state.
        setInterval(async () => {
            const kraw = localStorage.getItem(LS_LICENSE_KEY) || "";
            const k = String(kraw).replace(/\D/g, "").slice(0, 6);
            if (!k || k.length !== 6) {
                if (licenseOk) {
                    licenseOk = false;
                    localStorage.setItem(LS_LICENSE_OK, "0");
                    stopMain();
                    if (document.getElementById("qx-license-inner")) {
                        renderLicenseBoxNeedsVerify();
                    }
                    mountLicenseOverlayIfNeeded();
                }
                return;
            }
            const res = await validateLicense(k);
            if (res.ok) {
                if (!licenseOk) {
                    licenseOk = true;
                    localStorage.setItem(LS_LICENSE_OK, "1");
                    startMainOnce();
                    if (document.getElementById("qx-license-inner")) {
                        renderLicenseBoxVerified();
                    }
                }
                return;
            }
            if (isTransientLicenseError(res.result)) {
                // Network/server hiccup: ignore, keep current state.
                return;
            }
            // Definitive negative: blocked/deleted/expired/etc → logout + prompt.
            if (licenseOk) {
                licenseOk = false;
                localStorage.setItem(LS_LICENSE_OK, "0");
                localStorage.removeItem(LS_LICENSE_KEY);
                stopMain();
                if (document.getElementById("qx-license-inner")) {
                    renderLicenseBoxNeedsVerify();
                }
                mountLicenseOverlayIfNeeded();
            }
        }, LICENSE_RECHECK_MS);
    })();

})();

//70
(function () {
    'use strict';

    const SELECTORS = [
        ".ylLrz",                 // main bonus banner
        "div[class*='ylLrz']",    // mobile variation
        ".cVZfw",                 // green background image
        "img[src*='welcome-banner-bg']" // fallback image selector
    ];

    // 🔥 Remove সব related element
    function removeBonusElements() {
        SELECTORS.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.style.display = "none";
                el.remove();
            });
        });
    }

    // 🚀 Multiple run (mobile + slow load fix)
    function startCleaner() {
        removeBonusElements();

        setTimeout(removeBonusElements, 500);
        setTimeout(removeBonusElements, 1500);
        setTimeout(removeBonusElements, 3000);
    }

    // 👀 Live observer (React fix)
    const observer = new MutationObserver(() => {
        removeBonusElements();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // 🎯 Load handling
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startCleaner);
    } else {
        startCleaner();
    }

    window.addEventListener("load", startCleaner);

})();
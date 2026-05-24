console.log("SCRIPT LOADED");
let balance = 10000;
let isBotRunning = true;
let openTrades = [];
let tradeHistory = [];
let wins = 0;
let losses = 0;
let totalTrades = 0;
let tradesThisHour =0;
let hourStartTime = Date.now();
let lastPrices = [];
let lastDirection = "WAIT";
let currentSignal = "null";
let currentConfidence = 0;
let tradeId = 0;
let price = 0;
let prices = [];
let ws;
let isAuthorized = false;
let isTradeOpen = true;
let lastTradeTime = 1;
let lastSignalTime = 0;
let riskPercent = 0.01;
let currentStake = 1;
let journal = [];
let startOfDayBalance = balance;
let lastConfidence = 0;
let maxConcurrentTrades = 2;
let sessionBoost = 1;
let FORCE_TRADE = true;
const pairs = ["R_100"];
let pairData = {};
let isProcessing = false;
let candle = {
    open: null,
    high: null,
    low: null,
    close: null,
    startTime: Date.now()
};
let aiMemory ={
    wins: 0,
    losses: 0
};
const MIN_CONFIDENCE = 50;
const SNIPER_MIN_CONFIDENCE =60;
const SNIPER_RSI_BUY = 40;
const SNIPER_RSI_SELL = 60;
const SIGNAL_COOLDOWN = 5000;
const MAX_DRAWDOWN_PERCENT = 0.2;
const MAX_TRADES_PER_HOUR = 10;
const CANDLE_DURATION = 60000;
const DAILY_TARGET = 30;
const VOLATILITY_THRESHOLD = 0.00002;
const SPIKE_THRESHOLD = 0.0002;
const ENTRY_DELAY = 3000;
const MAX_DAILY_LOSS = -20;
const TRADE_COOLDOWN = 60000;
const ctx = document.getElementById("priceChart").getContext("2d");

let priceChart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "R_100",
            data: [],
            borderWidth: 2,
            borderColor: "lime"
        }]
    },
    options: {
        responsive: true
    }
});
function checkDrawdown() {
    let drawdown = (startOfDayBalance - balance) / startOfDayBalance;

    if (drawdown >= MAX_DRAWDOWN_PERCENT) {
        alert("Max drawdown hit. Bot stopped.");
        log("Max drawdown reached!");
        isBotRunning = false;
    }
}
function isTradingSession(){
    let hour= new Date().getUTCHours();
    return (
        (hour >= 6 && hour <=10) ||
        (hour >= 13 && hour <= 17)
    );
}

function checkProfitTarget() {
    let profit = balance - startOfDayBalance;

    if (profit >= DAILY_TARGET) {
        alert("daily target reached.Bot stopped.");
        isBotRunning = false;
    }
}

function updateChart(price) {
    priceChart.data.labels.push("");

    priceChart.data.datasets[0].data.push(price);

    if (priceChart.data.labels.length > 50){
        priceChart.data.labels.shift();

        priceChart.data.datasets[0].data.shift();
    }
    priceChart.update();
}
//CONNECT FUNCTION (WEBSOCKET)
const app_id = "33kaJvpc4XCliIxToKk0M";

function loginDeriv() {

    const redirect =
    encodeURIComponent("https://forex-box.vercel.app");

    const url =
`https://oauth.deriv.com/oauth2/authorize?app_id=${app_id}&redirect_uri=${redirect}&response_type=token;`

    console.log(url);

    window.open(url, "_self");
}

window.onload = () => {

    console.log("PAGE LOADED");

    const hash = window.location.hash;

    console.log("HASH:", hash);

    const params =
    new URLSearchParams(hash.substring(1));

    const token =
    params.get("access_token");

    if (token) {

        console.log("✅ TOKEN:", token);

        connectDeriv(token);

    } else {

        console.log("❌ NO TOKEN FOUND");
    }
};

function connectDeriv(token) {

    ws = new WebSocket(
`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`
    );

    ws.onopen = () => {

        console.log("✅ WS CONNECTED");

        ws.send(JSON.stringify({
            authorize: token
        }));
    };

    ws.onmessage = (msg) => {

        console.log("📩", msg.data);
    };

    ws.onerror = (err) => {

        console.log("❌ WS ERROR", err);
    };
}
//connectDeriv();

function updatePerformance() {
    let profit = balance - startOfDayBalance;

    document.getElementById("stats").innerText =
        `Trades: ${totalTrades} 
Wins: ${wins} 
Losses: ${losses} 
Profit: $${profit.toFixed(2)}`;
} 

function checkTradeLimit() {
    let now = Date.now();

    //RESET EVERY HOUR
    if (now - hourStartTime >= 3600000) {
        tradesThisHour = 0;
        hourStartTime = now;
    }
    if (tradesThisHour >= MAX_TRADES_PER_HOUR){
        log("Trade limit reached. Cooling down...");
        return false;
    }
    return true;
}
function getTradingSession() {
    let hour = new Date().getUTCHours();

    if (hour >= 6 && hour <= 10) return "LONDON";
    if (hour >= 13 && hour <= 17) return "NEW_YORK";

    return "OFF";
}
function getSessionStrength() {
    let session = getTradingSession();

    if (session === "LONDON") return 1.2;
    if (session === "NEW_YORK") return 1.3;
    return 0.7;
}

// BALANCE ENGINE
function balanceModel(confidence) {

    let profit = balance - startOfDayBalance;

    // 🔹 Base risk
    let risk = riskPercent;

    // 🔹 Scale UP when winning
    if (profit > 20) {
        risk *= 1.3;
        log("🔥 Scaling UP (profit mode)");
    }

    // 🔹 Scale DOWN when losing
    if (profit < -10) {
        risk *= 0.5;
        log("⚠️ Scaling DOWN (drawdown mode)");
    }

    // 🔹 AI confidence boost
    if (confidence >= 80) risk *= 1.2;
    if (confidence < 60) risk *= 0.7;

    // 🔹 Hard safety cap
    if (risk > 0.02) risk = 0.02;
    if (risk < 0.003) risk = 0.003;

    let stake = balance * risk;

    return parseFloat(stake.toFixed(2));
}
function calculateStake(confidence) {
    let baseStake = 1;
    return Math.max(1, baseTake * (confidence / 100));
}

function protectProfit() {
    let profit = balance - startOfDayBalance;

    if (profit >= 20) {
        log("Daily profit locked");
        isBotRunning = false;
    }
}
//EQUITY PROTECTION
function equityProtection() {

    let profit = balance - startOfDayBalance;

    // 🔒 Lock profits
    if (profit >= 30) {
        log("🔒 Profit locked. Bot stopped.");
        isBotRunning = false;
    }

    // ❌ Hard stop loss
    if (profit <= -25) {
        log("❌ Max loss hit. Bot stopped.");
        isBotRunning = false;
    }
}

//ENTRY ZONE FUNCTION
function isGoodEntry(price, currentSignal) {
    let sma5 = calculateSMA(5);

    if (!sma5) return false;

    // BUY = pullback
    if (currentSignal === "BUY") {
        return price <= sma5;
    }

    // SELL = pullback
    if (currentSignal === "SELL") {
        return price >= sma5;
    }

    return false;
}

function detectLiquidityPool() {
    if (prices.length < 20) return null;

    let highs = prices.slice(-20);
    let lows = prices.slice(-20);

    return {
        liquidityHigh: Math.max(...highs),
        liquidityLow: Math.min(...lows)
    };
}
function detectFakeBreakout(price) {
    if (prices.length < 10) return null;

    let recentHigh = Math.max(...prices.slice(-10));
    let recentLow = Math.min(...prices.slice(-10));
    let prev = prices[prices.length - 2];

    // Fake breakout UP → SELL
    if (price > recentHigh && prev < recentHigh) {
        return "SELL";
    }

    // Fake breakout DOWN → BUY
    if (price < recentLow && prev > recentLow) {
        return "BUY";
    }

    return null;
}
// HIGHER TIMEFRAMETREND
function higherTimeframeTrend() {
    let sma50 = calculateSMA(50);
    let sma100 = calculateSMA(100);

    if (!sma50 || !sma100) return null;

    if (sma50 > sma100) return "UP";
    if (sma50 < sma100) return "DOWN";

    return "SIDEWAYS";
}


// 🔹 SUPPORT / RESISTANCE
function getSupportResistance() {
    if (prices.length < 30) return null;

    let recent = prices.slice(-30);

    return {
        support: Math.min(...recent),
        resistance: Math.max(...recent)
    };
}

// 🔹 FAKE BREAKOUT FILTER
function isFakeBreakout(price, levels) {
    if (!levels) return false;

    let { support, resistance } = levels;
    let last = prices[prices.length - 2];

    if (price > resistance && last < resistance) return true;
    if (price < support && last > support) return true;

    return false;
}

// 🔹 TRADE QUALITY FILTER
function isHighQualityTrade(confidence, structure) {
    if (confidence < 50) return false;
    if (structure === "RANGE") return false;
    return true;
}
function runBacktest(data) {
    let testBalance = 1000;

    data.forEach(price => {
        let sma5 = calculateSMA(5);
        let sma10 = calculateSMA(10);

        if (!sma5 || !sma10) return;

        if (sma5 > sma10) {
            testBalance += 1;
        } else {
            testBalance -= 1;
        }
    });

    console.log("Backtest Balance:", testBalance);
}
//  INDICATORS STRATEGY(CELLS EXACUTE TRADE)
function calculateSMA(period) {
    if (prices.length < period) return null;

    let sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}
function calculateRSI(period = 14) {
    if (prices.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
        let diff = prices[i] - prices[i - 1];

        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }

    let rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
}
function getTrend() {
    let sma20 = calculateSMA(20);
    let sma50 = calculateSMA(50);

    if (!sma20 || !sma50) return null;
    if(sma20 > sma50) return "UP";
    if (sma20 < sma50) return "DOWN";
    return "SIDEWAYS";
}


function isMarketSafe(price) {
    lastPrices.push(price);
    
    if (lastPrices.length > 10) {
        lastPrices.shift();
    }

    if (lastPrices.length < 10) return false;

    let max = Math.max(...lastPrices);
    let min = Math.min(...lastPrices);

    let volatility = max - min;
    if (volatility < VOLATILITY_THRESHOLD) return false;
    if (volatility > SPIKE_THRESHOLD) return false;
    return true;
}
function getVolatility() {

    if (!prices || prices.length < 20) return 0;
    
    let recent = prices.slice(-20);
    let max = recent[0];
    let min = recent[0];
    for (let i = 1; i < recent.length; i++) {
        if (recent[1] > max) max = recent[i];
        if (recent[i] < min) min = recent[i];
    }

    let vol = max - min;
    log("volatility: " + vol );

    return vol;
}
function isCleanMove(price) {

    if (prices.length < 5) return true;

    let last = prices[prices.length - 2];
    let diff = Math.abs(price - last);
    log("clean move: " + isCleanMove(price))

    return diff < 0.0015; // adjust per market
}
// ================= PRO MAX ENGINE =================

// 🔹 MARKET STRUCTURE
function detectMarketStructure() {
    if (prices.length < 20) return null;

    let recent = prices.slice(-20);
    let highs = [];
    let lows = [];

    for (let i = 1; i < recent.length - 1; i++) {
        if (recent[i] > recent[i - 1] && recent[i] > recent[i + 1]) {
            highs.push(recent[i]);
        }
        if (recent[i] < recent[i - 1] && recent[i] < recent[i + 1]) {
            lows.push(recent[i]);
        }
    }

    if (highs.length < 2 || lows.length < 2) return null;

    let lastHigh = highs[highs.length - 1];
    let prevHigh = highs[highs.length - 2];
    let lastLow = lows[lows.length - 1];
    let prevLow = lows[lows.length - 2];

    if (lastHigh > prevHigh && lastLow > prevLow) return "UPTREND";
    if (lastHigh < prevHigh && lastLow < prevLow) return "DOWNTREND";

    return "RANGE";
}

// ================= ULTIMATE ENGINE =================

// 🔹 LIQUIDITY SWEEP (STOP HUNT DETECTION)
function detectLiquiditySweep(price) {
    if (prices.length < 5) return false;

    let recentHigh = Math.max(...prices.slice(-5));
    let recentLow = Math.min(...prices.slice(-5));
    let last = prices[prices.length - 2];

    // Sweep above highs (fake breakout up)
    if (price > recentHigh && last < recentHigh) {
        return "SELL"; // reversal expected
    }

    // Sweep below lows (fake breakout down)
    if (price < recentLow && last > recentLow) {
        return "BUY"; // reversal expected
    }

    return null;
}

// 🔹 ORDER BLOCK DETECTION (SMART MONEY ZONE)
function detectOrderBlock() {
    if (prices.length < 10) return null;

    let recent = prices.slice(-10);

    let bullishOB = Math.min(...recent);
    let bearishOB = Math.max(...recent);

    return {
        bullish: bullishOB,
        bearish: bearishOB
    };
}

// 🔹 SMART ENTRY CONFIRMATION
function isSniperEntry(price, signal, structure, ob) {
    if (!ob) return false;

    // BUY at bullish order block
    if (signal === "BUY" && structure === "UPTREND") {
        return price <= ob.bullish * 1.001;
    }

    // SELL at bearish order block
    if (signal === "SELL" && structure === "DOWNTREND") {
        return price >= ob.bearish * 0.999;
    }

    return false;
}


//CANDLE SYSYTEM
function updateCandle(price) {
    let now = Date.now();

    if(!candle.open) {
        candle.open = price;
        candle.high = price;
        candle.low = price;
    }
    candle.high = Math.max(candle.high,price);
    candle.low = Math.min(candle.low,price);
    candle.close = price;
    // NEW CANDLE
    if (now - candle.startTime >= CANDLE_DURATION) {
        processCandle(candle);

        candle = {
            open: price,
            high: price,
            low: price,
            close: price,
            startTime: now
        };
    }
}
function confirmCandle(signal) {
    if (!candle.close || !candle.open) return false;

    if (signal === "BUY" && candle.close > candle.open) return true;
    if (signal === "SELL" && candle.close < candle.open) return true;

    return false;
}

function processCandle(c) {
    if (c.close > c.open){
        console.log("Bullish candle");
    }

    if (c.close < c.open) {
        console.log("Bearish candle");
    }
}
function processCandleData(candle) {
    let closePrice = candle.close;
     
    updateChart(closePrice);

    if (isBotRunning) {
        runStrategy(closePrice);
    }
}
//AI SIGNAL
function getAISignal(price) {

    let sma5 = calculateSMA(5);
    let sma10 = calculateSMA(10);
    let sma20 = calculateSMA(20);
    let rsi = calculateRSI(14);
    let structure = detectMarketStructure();
    let mtf = getMultiTimeframeTrend();

    if (!sma5 || !sma10 || !sma20 || !rsi){
        log("AI Waiting for enough data...");
    return null;
    }
    log("Prices length:", prices.length);

    let score = 0;

    if (price > sma20) score += 2;
    else score -= 2;

    if (sma5 > sma10) score += 2;
    else score -= 2;

    if (rsi > 50) score += 1;
    else score -= 1;

    let signal = "WAIT";
    log("AI Score:", score);
    if (score >= 2) signal = "BUY";
    if (score <= -2) signal = "SELL";

    let confidence = Math.min(Math.abs(score) * 20, 100);

    // ✅ ONLY UI UPDATE HERE
    updateAIstatus(signal, confidence, structure, mtf, rsi);

    return { signal, confidence };
}
function updateAIstatus(signal, confidence, structure, mtf, rsi) {

    let el = document.getElementById("aiStatus");
    if (!el) return;

    el.innerText =
`Signal: ${signal}
Confidence: ${confidence}%
Structure: ${structure}
MTF: ${mtf}
RSI: ${rsi}`;
}

function updateAIUI(signal, score){
    document.getElementById("aiSignal").innerText = signal || "WAIT";
    document.getElementById("aiScore").innerText = score;
}
function log(...messages) {
    let logBox = document.getElementById("logs");
    if (!logBox) return;

    let time = new Date().toLocaleTimeString();
    let fullMessage = messages.join(" ");

    logBox.innerHTML += `[${time}] ${fullMessage}<br>`;
    logBox.scrollTop = logBox.scrollHeight;
}
 //INSTITUTION MODE
 function getMultiTimeframeTrend() {

    let fast = calculateSMA(10);   // M1 feel
    let mid = calculateSMA(30);    // M5 feel
    let slow = calculateSMA(60);   // M15 feel

    if (!fast || !mid || !slow) return null;

    if (fast > mid && mid > slow) return "UP";
    if (fast < mid && mid < slow) return "DOWN";

    return "MIXED";
}
function institutionModeV4(price, pair) {

    let result = getAISignal(price);
    if (!result) return;

    let { signal, confidence } = result;

    log(`Signal: ${signal} | Confidence: ${confidence}`);

    if (signal !== "WAIT" && confidence >= 50) {
        log("🔥 TRADE TRIGGERED");
        executeTrade(signal, pair, confidence);
    }
    if (!isAuthorized) return;
}
 function runStrategy(price, pair) {

    let session = getTradingSession();
    if (session === "OFF") {
        log("⛔ Outside trading session");
        return;
    }

    // 🔹 VOLATILITY FILTER
    let vol = getVolatility();

    if (vol < VOLATILITY_THRESHOLD) {
        log("Market too slow");
        return;
    }

    if (vol > SPIKE_THRESHOLD) {
        log("Market too volatile");
        return;
    }

    // 🔹 CLEAN MOVE FILTER
    if (!isCleanMove(price)) {
        log("Fake spike detected");
        return;
    }

    // 🔹 AI SIGNAL
    let result = getAISignal(price);
    if (!result) {
        log("AI not ready");
        return;
    }

    let { signal, confidence } = result;
    lastConfidence = confidence;

    log(`Signal: ${signal} | Confidence: ${confidence}`);

    if (!signal) return;

    // 🔹 MULTI-TIMEFRAME ALIGNMENT
     mtf = getMultiTimeframeTrend();

    if (!mtf || mtf === "MIXED") {
        log("MTF not aligned");
        return;
    }

    if (mtf === "UP" && signal === "SELL") return;
    if (mtf === "DOWN" && signal === "BUY") return;

    // 🔹 STRUCTURE
    let structure = detectMarketStructure();

    if (!structure) {
        if (confidence >= 85) {
            log("⚡ High-confidence fallback trade");
            executeTrade(signal, pair, confidence);
        }
        return;
    }

    // 🔹 CANDLE CONFIRMATION
    if (!confirmCandle(signal)) {
        log("Waiting candle confirmation");
        return;
    }

    // 🔹 ENTRY ZONE
    if (!isGoodEntry(price, signal)) {
        log("Bad entry zone");
        return;
    }

    // 🔹 LIQUIDITY SWEEP (PRIORITY)
    let sweep = detectLiquiditySweep(price);
    if (sweep && confidence >= 70) {
        log("Liquidity sweep entry");
        executeTrade(sweep, pair, confidence);
        return;
    }

    // 🔹 SNIPER ENTRY
    let ob = detectOrderBlock();
    if (isSniperEntry(price, signal, structure, ob)) {
        log("Sniper entry confirmed");
        executeTrade(signal, pair, confidence);
        return;
    }

    log("No valid setup");
}
//RUN STRATEGY ends
 function executeTrade(direction, pair, confidence) {

    log(`🚀 EXECUTE: ${direction} ${pair} ${confidence}`);

    if (isTradeOpen) {
        log("❌ Blocked: Trade already open");
        return;
    }

    if (direction === "WAIT") return;

    if (!ws || ws.readyState !== 1) {
        log("❌ WS not ready");
        return;
    }

    let stake = calculateStake(confidence);
    let contractType = direction === "BUY" ? "CALL" : "PUT";

    lastDirection = direction;
    lastConfidence = confidence;

    ws.send(JSON.stringify({
        buy: 1,
        price: stake,
        parameters: {
            amount: stake,
            basis: "stake",
            contract_type: contractType,
            currency: "USD",
            duration: 1,
            duration_unit: "m",
            symbol: pair
        }
    }));

    log("📡 Trade request sent");
}


//MESSAGE HANDLER(THIS IS THE BRAIN)
function handleMessages(data) {
if (data.msg_type === "authorize") {
console.log("Authorized:", data);
}

    // ❌ ERROR HANDLING
    if (data.error) {
        log("❌ DERIV ERROR: " + data.error.message);
        return;
    }
    if (data.msg_type === "anthorize") {
        if (data.error) {
            console.log("AUTH ERROR:", data.error.message);
        } else {
            console.log("AUTH SUCCESS:", data.authorize.loginid);
        }
    }

    // ✅ AUTH SUCCESS → SUBSCRIBE
    if (data.msg_type === "authorize") {
        log("✅ Authorized");

        pairs.forEach(pair => {
            ws.send(JSON.stringify({
                ticks: pair,
                subscribe: 1
            }));
        });

        return;
    }

    // ✅ TICKS
   if (data.msg_type === "tick" && data.tick) {

    let pair = data.tick.symbol; // ✅ correct
    let price = Number(data.tick.quote);

    if (!pair || isNaN(price)) return;

    prices.push(price);
    if (prices.length > 100) prices.shift();

    log(`Tick: ${pair} → ${price}`);

    currentPair = pair;

    updateMarketTable(price, pair);
    updateChart(price);
    updateCandle(price);

    if (isBotRunning) {
        institutionModeV4(price, pair);
    }
}

    // ✅ BUY RESPONSE
    if (data.msg_type === "buy") {
        log("✅ BUY RESPONSE RECEIVED");

        isTradeOpen = true; // 🔒 LOCK

        ws.send(JSON.stringify({
            proposal_open_contract: 1,
            contract_id: data.buy.contract_id,
            subscribe: 1
        }));

        return;
    }

    // ✅ TRADE RESULT
    if (data.msg_type === "proposal_open_contract") {

        let contract = data.proposal_open_contract;

        if (contract?.is_sold) {

            let profit = contract.profit || 0;

            log(`📉 Trade closed. Profit: ${profit}`);

            isTradeOpen = false; // 🔓 UNLOCK

            // stats update
            balance += profit;
            totalTrades++;
            profit > 0 ? wins++ : losses++;

            updateBalanceUI();
            updateStatsUI();
        }

        return;
    }

}

function analyzePerformance(profit) {
    //AI aiMemory
    if (profit > 0) aiMemory.wins++;
    else aiMemory.losses++;

    //journal LOGIC
    if (journal.length < 10) return;

    let wins = journal.filter(t => t.result === "WIN").length;
    let winRate = (wins / journal.length) * 100;

    log(`WinRate: $ {winRate.toFixed(1)}%`);

    if (winRate < 50) {
        riskPercent = 0.005;
        log("Reducing  risk");
    } else if (winRate > 65) {
        riskPercent = 0.015;
        log("increasing risk");
        analyzePerformance(price);
    }
}
function balanceMode () {
    let profit = balance - startOfDayBalance
    // GROW aggressively when winning
    if (profit > 20) {
        riskPercent = 0.015;
        log("aggressive mode on");
    }
    // NORMAL MODE
    else if (percent > 0) {
        riskPercent = 0.01;
    }
    //Defensive mode
    else if (profit < -10) {
        riskPercent = -0.005;
        log("defensive mode ON");
    }

    //HARD PROTECTION
    if(profit < -20) {
        log("max daily loss hit");
        isBotRunning = false;
    }
}


//UI FUNCTION(BOTTOM)
 function updateBalanceUI() {
    document.getElementById("balanceCard").innerText = balance.toFixed(2);
    
 }

 function updateMarketTable(price, pair) {
    if (!price || isNaN(price)) return; // 🔥 STOP crash

    const table = document.getElementById("forexTable");

    let sma5 = calculateSMA(5);
    let sma10 = calculateSMA(10);
    let rsi = calculateRSI(14);

    table.innerHTML = `
    <tr>
        <td>Forex</td>
        <td>${pair}</td>
        <td>${Number(price).toFixed(5)}</td>
        <td>${sma5 ? sma5.toFixed(5) : "-"}</td>
        <td>${sma10 ? sma10.toFixed(5) : "-"}</td>
        <td>${currentSignal}</td>
        <td>${isTradeOpen ? "OPEN" : (currentSignal !== "WAIT" ? "READY" : "WAIT")}</td>
        <td>${rsi ? rsi.toFixed(2) : "-"}</td>
    </tr>
    `;
}

    function updateStatsUI(){
        let winRate = totalTrades > 0
        ? ((wins / totalTrades) * 100).toFixed(1): 0;

        document.getElementById("stats").innerText = 
        `Trades: ${totalTrades} | Wins: ${wins} | Losses: ${losses} | Win Rate: ${winRate}%`;
        //NEW DASHBOARD
        document.getElementById("balanceCard").innerText = balance.toFixed(2);
        document.getElementById("winRateCard").innerText = winRate + "%";
        document.getElementById("tradeCard").innerText = totalTrades;
    }

function checkRisk() {
    if (balance <= startOfDayBalance + MAX_DAILY_LOSS) {
        alert("MAX loss reached. bot stopped.");
        isBotRunning = false;
    }
}

function toggleBot() {
    isBotRunning = false;
document.getElementById("botStatus").innerText =
        "Bot: " + (isBotRunning ? "ON" : "OFF");
}
function resetAccount() {
    balance = 10000;
    wins = 0;
    losses = 0;
    totalTrades = 0;
    tradeHistory = [];
    openTrades = [];
    
    updateBalanceUI();
    updateStatsUI();

    log("Account reset");
}
// ✅ BUY FUNCTION
function buyTrade(pair, price) {
    let trade = {
        id: tradeId++,
        pair: pair,
        type: "BUY",
        entry: price,
        sl: price - 0.0020, // stop loss
        tp: price + 0.0020  // take profit
    };

    openTrades.push(trade);
    renderTrades(price);
}

// ✅ SELL FUNCTION
function sellTrade(pair, price) {
    let trade = {
        id: tradeId++,
        pair: pair,
        type: "SELL",
        entry: price,
        sl: price + 0.0020,
        tp: price - 0.0020
    };

    openTrades.push(trade);
    renderTrades(price);
}

// ✅ CLOSE TRADE
function closeTrade(id) {
    openTrades = openTrades.filter(trade => trade.id !== id);
    renderTrades();
}

// ✅ PnL CALCULATION
function calculatePnL(trade, price) {
    if (!price) return 0;

    let pnl = trade.type === "BUY"
        ? price - trade.entry
        : trade.entry - price;

    // 🔥 TRAILING STOP ACTIVATION
    if (pnl > 0.0015) {
        trade.sl = trade.type === "BUY"
            ? price - 0.0010
            : price + 0.0010;
    }

    return pnl;
}
//LOSS RECOVERY SYSTEM(anti blow)
function lossRecoveryMode() {
    if (losses >= 3) {
        log("⚠️ Recovery mode activated");

        riskPercent = 0.005; // reduce risk
        SIGNAL_COOLDOWN = 8000; // slow down trades
    } else {
        riskPercent = 0.01;
        SIGNAL_COOLDOWN = 5000;
    }
}

// ✅ RENDER TRADES
function renderTrades(currentPrice) {
    const tbody = document.querySelector("#tradesTable tbody");
    tbody.innerHTML ="";

 openTrades.forEach(trade => {

        // 🔹 TRAILING STOP (BOTH SIDES)
        if (trade.type === "BUY" && currentPrice > trade.entry + 0.001) {
            trade.sl = trade.entry; // breakeven
        }

        if (trade.type === "SELL" && currentPrice < trade.entry - 0.001) {
            trade.sl = trade.entry; // breakeven
        }

        let pnl = calculatePnL(trade, currentPrice);

        // 🔹 AUTO CLOSE
        if (trade.type === "BUY" && (currentPrice <= trade.sl || currentPrice >= trade.tp)) {
            closeTrade(trade.id);
            return;
        }

        if (trade.type === "SELL" && (currentPrice >= trade.sl || currentPrice <= trade.tp)) {
            closeTrade(trade.id);
            return;
        }

        const row = document.createElement("tr");

        row.innerHTML = `
        <td>${trade.pair}</td>
        <td>${trade.type}</td>
        <td>${trade.entry.toFixed(5)}</td>
        <td>${trade.sl.toFixed(5)}</td>
        <td>${trade.tp.toFixed(5)}</td>
        <td style="color:${pnl >= 0 ? 'lime' : 'red'}">
            ${pnl.toFixed(5)}
        </td>
        <td>
            <button onclick="closeTrade(${trade.id})">Close</button>
        </td>
        `;

        tbody.appendChild(row);
    });
}

window.onerror = function(message, source, lineno, colno, error) {
   console.error("Global Error:", message);
    log("ERROR: " + message);
}
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("startBtn").addEventListener("click", toggleBot);
    document.getElementById("resetBtn").addEventListener("click", resetAccount);
});
function emergencyStop() {
    if (losses >= 5) {
        log("Too many looses. Bot stopped."); isBotRunning;
    }
}
document.addEventListener("DOMContentLoaded",()=> {
    console.log("starting bot....");
    connectDeriv();
});






 
 
 
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- 🌟 設定：画像・音源フォルダ ---
const IMG_PATH = "images/";
const ASSET_PATH = "assets/";

// --- 基本変数 ---
let playerName = "名無し";
let isPlaying = false;
let isEndless = false;
let isHardMode = false;
let currentStage = null;
let animationId = null; 
let score = 0, hp = 100, skillGauge = 0, frameCount = 0;
let currentPhase = "start";

// --- 🌟 音声管理 ---
let isMuted = true; // 初期はミュート（オフ）
let currentBGM = null;

// --- 状態フラグ ---
let isEventActive = false, isMiniGame = false, isBonusMode = false, isChaosMode = false;
let isSlow = false, isShield = false, isFreeze = false, isDarkness = false;
let isDebateMode = false, isReverse = false, isLineDefense = false;

// --- ミニゲーム管理 ---
let debateClicks = 0; const DEBATE_MAX = 15;      
let nextWarningScore = 300, nextBonusScore = 400, nextMiniGameScore = 500, nextDebateScore = 600, nextChaosScore = 750, nextLineScore = 900;

// --- エフェクト配列 ---
let decoys = [], catBombs = [], moneyDecoys = [], punchEffects = [], oilParticles = [], lasers = []; 
let bullets = [], enemies = [];
let player = { x: 300, y: 700, width: 20, height: 20 };
let supportNPC = { x: 250, y: 700, dx: 2, dy: 1.5 }; 

// ----------------------------------------
// 1. システム管理 & サウンド管理
// ----------------------------------------

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const gameUI = document.getElementById("game-ui");
    if (screenId === null) { gameUI.classList.remove("hidden"); } 
    else { gameUI.classList.add("hidden"); const target = document.getElementById(screenId); if (target) target.classList.add("active"); }
}

function stopGame() {
    isPlaying = false;
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    if (currentBGM) { currentBGM.pause(); currentBGM = null; } // BGMも止める
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 🌟 サウンド切り替えボタン
const soundBtn = document.getElementById("sound-toggle-btn");
if (soundBtn) {
    soundBtn.addEventListener("click", () => {
        isMuted = !isMuted; // ON/OFFを反転
        const icon = document.getElementById("sound-icon");
        if (icon) {
            // アイコンの切り替え
            icon.className = isMuted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
            // 視覚的なフィードバック（色がつく）
            icon.style.color = isMuted ? "#fff" : "#0ff";
        }
        console.log("Sound muted:", isMuted); // 開発者ツールで確認用
    });
}
// 🌟 効果音（SE）再生関数
const sounds = {
    shoot: new Audio(ASSET_PATH + "shoot.mp3"),
    hit: new Audio(ASSET_PATH + "hit.mp3"),
    skill: new Audio(ASSET_PATH + "skill.mp3"),
    dead: new Audio(ASSET_PATH + "dead.mp3")
};

function playSE(type) {
    if (isMuted || !sounds[type]) return;
    sounds[type].currentTime = 0; // 再生位置を最初に戻す
    sounds[type].play().catch(() => {});
}

// ----------------------------------------
// 2. ボタンイベント
// ----------------------------------------

document.getElementById("start-btn").onclick = () => {
    const input = document.getElementById("player-name-input").value.trim();
    if (input) playerName = input;
    initStageSelect(); showScreen("stage-select-screen");
};
document.getElementById("back-to-title-btn").onclick = () => { stopGame(); showScreen("title-screen"); };
document.getElementById("back-to-select-btn").onclick = () => { stopGame(); initStageSelect(); showScreen("stage-select-screen"); };
document.getElementById("back-to-select-from-prof-btn").onclick = () => showScreen("stage-select-screen");
document.getElementById("quit-btn").onclick = () => { if(isPlaying) endGame(false); };

document.getElementById("start-battle-btn").onclick = () => { stopGame(); isEndless = false; isHardMode = false; startGame(currentStage); };
document.getElementById("start-endless-btn").onclick = () => { stopGame(); isEndless = true; isHardMode = false; startGame(currentStage); };
document.getElementById("start-hard-btn").onclick = () => { stopGame(); isEndless = true; isHardMode = true; startGame(currentStage); };

document.getElementById("share-btn").onclick = async () => {
    const mode = isHardMode ? "ハード" : (isEndless ? "エンドレス" : "ストーリー");
    // 🌟 #PsychoShooter を追加！
    const text = `とりの丘学園 心理シューティング\n「${currentStage.title}」を${mode}モードで${score}点！\n#とりの丘学園 #PsychoShooter`;
    if (navigator.share) { await navigator.share({ title: '結果シェア', text: text, url: window.location.href }); } 
    else { window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank'); }
};

function initStageSelect() {
    const container = document.getElementById("stage-buttons");
    container.innerHTML = ""; 
    GAME_DATA.stages.forEach(stage => {
        const btn = document.createElement("button");
        btn.innerHTML = `${stage.title}<br><small>${stage.main.name} & ${stage.support.name}</small>`;
        btn.onclick = () => showProfile(stage);
        container.appendChild(btn);
    });
}

function showProfile(stage) {
    currentStage = stage;
    document.getElementById("prof-stage-title").innerText = stage.title;
    document.getElementById("prof-main-class").innerText = stage.main.class || "M3";
    document.getElementById("prof-supp-class").innerText = stage.support.class || "M3";
    document.getElementById("prof-main-img").src = IMG_PATH + stage.main.img;
    document.getElementById("prof-main-fullname").innerText = stage.main.fullName;
    document.getElementById("prof-main-desc").innerText = stage.main.profile;
    document.getElementById("prof-supp-img").src = IMG_PATH + stage.support.img;
    document.getElementById("prof-supp-fullname").innerText = stage.support.fullName;
    document.getElementById("prof-supp-desc").innerText = stage.support.profile;
    showScreen("profile-screen");
}

function startGame(stage) {
    isPlaying = true; score = 0; skillGauge = 0; frameCount = 0; currentPhase = "start";
    hp = isHardMode ? 50 : 100;
    isEventActive = false; isMiniGame = false; isBonusMode = false; isDebateMode = false; isChaosMode = false; isLineDefense = false;
    isSlow = false; isShield = false; isFreeze = false; isDarkness = false; isReverse = false;
    bullets = []; enemies = []; decoys = []; catBombs = []; moneyDecoys = []; punchEffects = []; oilParticles = []; lasers = [];
    nextWarningScore = 300; nextBonusScore = 400; nextMiniGameScore = 500; nextDebateScore = 600; nextChaosScore = 750; nextLineScore = 900;

    const sm = document.getElementById("score-max");
    if(sm) sm.innerText = isEndless ? "" : "/1000";

    document.getElementById("main-chara-img").src = IMG_PATH + stage.main.img;
    document.getElementById("main-name").innerText = stage.main.name;
    document.getElementById("support-chara-img").src = IMG_PATH + stage.support.img;
    document.getElementById("support-name").innerText = stage.support.name;

    const container = document.getElementById("game-container");
    if(stage.id === "stage3") container.classList.add("soup-bg"); else container.classList.remove("soup-bg");

    // 🌟 BGM再生処理
    if (stage.bgm) {
        currentBGM = new Audio(ASSET_PATH + stage.bgm);
        currentBGM.loop = true;
        currentBGM.volume = 0.2;
        if (!isMuted) currentBGM.play().catch(() => {});
    }

    updateUI(); showScreen(null); gameLoop();
}

// ----------------------------------------
// 3. 特殊アクション (🥊⚡)
// ----------------------------------------

function firePunch() {
    // パンチのエフェクトを生成
    punchEffects.push({ x: supportNPC.x, y: canvas.height + 50, targetY: canvas.height/2, life: 80 });
    
    // 🌟 【修正】描画を待たずに、今画面にいる敵を即座に「消去」する！
    let killCount = 0;
    enemies = enemies.filter(e => {
        if (Math.abs(e.x - supportNPC.x) < 220) { // パンチの横幅
            killCount++;
            return false; // 生き残りリストに入れない＝消滅
        }
        return true;
    });
    score += killCount * 10;
    playSE("skill");
    updateUI();
}

function fireLaser() {
    lasers.push({ x: supportNPC.x, life: 40 });
    
    // 🌟 【修正】レーザーのライン上の敵を即座に消去
    let killCount = 0;
    enemies = enemies.filter(e => {
        if (Math.abs(e.x - supportNPC.x) < 80) { // レーザーの横幅
            killCount++;
            return false;
        }
        return true;
    });
    score += killCount * 5;
    playSE("skill");
    updateUI();
}
function fireCatBomb() {
    for (let i = 0; i < 40; i++) catBombs.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, life: 60 });
    enemies = []; score += 100;
}

document.getElementById("skill-btn").onclick = () => {
    if (skillGauge < 100) return;
    skillGauge = 0;
    const ds = currentStage.dialogues.skill;
    if(ds) {
        const d = ds[Math.floor(Math.random() * ds.length)];
        document.getElementById("speaker-name").innerText = d.speaker;
        document.getElementById("dialogue-text").innerText = d.text;
    }

    playSE("skill"); // 🌟 スキル発動音

    const type = currentStage.support.skillType;
    if (type === "clear") { enemies = []; score += 100; }
    else if (type === "heal") { hp = Math.min(100, hp + 40); }
    else if (type === "slow") { isSlow = true; setTimeout(() => isSlow = false, 7000); }
    else if (type === "shield") { isShield = true; setTimeout(() => isShield = false, 7000); }
    else if (type === "laser") { fireLaser(); }
    else if (type === "freeze") { isFreeze = true; setTimeout(() => isFreeze = false, 5000); }
    else if (type === "bomb") { fireCatBomb(); }
    else if (type === "punch") { firePunch(); }
    updateUI();
};

// --- 操作系 ---
window.addEventListener("keydown", (e) => { if (isDebateMode && e.code === "Space") debateClicks++; });
canvas.addEventListener("touchstart", (e) => { if (isDebateMode) { debateClicks++; e.preventDefault(); } }, { passive: false });

canvas.addEventListener("mousemove", (e) => {
    if (!isPlaying || isDebateMode) return;
    const rect = canvas.getBoundingClientRect();
    let tx = (e.clientX - rect.left) * (canvas.width / rect.width);
    let ty = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (isReverse) { player.x = canvas.width - tx; player.y = canvas.height - ty; } 
    else { player.x = tx; player.y = ty; }
});

canvas.addEventListener("touchmove", (e) => {
    if (!isPlaying || isDebateMode) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    let tx = (touch.clientX - rect.left) * (canvas.width / rect.width);
    let ty = (touch.clientY - rect.top) * (canvas.height / rect.height);
    if (isReverse) { player.x = canvas.width - tx; player.y = canvas.height - ty; } 
    else { player.x = tx; player.y = ty; }
}, { passive: false });

// ----------------------------------------
// 4. メインループ
// ----------------------------------------

function gameLoop() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    let difficulty = 1 + (score / 1500);
    if (isHardMode) difficulty *= 1.8;

    supportNPC.x += supportNPC.dx; supportNPC.y += supportNPC.dy;
    if (supportNPC.x < 10 || supportNPC.x > canvas.width - 10) supportNPC.dx *= -1;
    if (supportNPC.y < 100 || supportNPC.y > canvas.height - 100) supportNPC.dy *= -1;

    // --- ミニゲーム判定 ---
    const dbT = ["きゅうた", "かるめ", "りょうご", "のぶ", "れお", "たもつ", "さなえ", "さりこ"];
    let isT = dbT.includes(currentStage.main.name) || dbT.includes(currentStage.support.name);
    if (score >= nextDebateScore && isT && !isMiniGame && !isBonusMode && !isChaosMode) {
        isDebateMode = true; debateClicks = 0; nextDebateScore += 1200;
        setTimeout(() => { if (isDebateMode) { isDebateMode = false; hp -= 40; updateUI(); playSE("dead"); if (hp <= 0) endGame(false); } }, 8000);
    }
    if (isDebateMode) {
        ctx.fillStyle = "rgba(60, 0, 0, 0.9)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff"; ctx.font = "bold 25px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("⚠️ 矛盾を突け！ ⚠️", canvas.width/2, 200);
        ctx.font = "18px sans-serif"; ctx.fillText("スペース(PC) or タップ(スマホ) 連打！", canvas.width/2, 240);
        let prg = (debateClicks / DEBATE_MAX) * 300;
        ctx.fillStyle = "#222"; ctx.fillRect(canvas.width/2-150, canvas.height/2+50, 300, 20);
        ctx.fillStyle = "#0ff"; ctx.fillRect(canvas.width/2-150, canvas.height/2+50, prg, 20);
        if (debateClicks >= DEBATE_MAX) { isDebateMode = false; score += 150; enemies = []; updateUI(); }
        animationId = requestAnimationFrame(gameLoop); return;
    }

    if (score >= nextBonusScore && !isDebateMode && !isMiniGame && !isChaosMode) { isBonusMode = true; nextBonusScore += 1000; setTimeout(() => isBonusMode = false, 4000); }
    if (score >= nextMiniGameScore && !isDebateMode && !isBonusMode && !isChaosMode) { isMiniGame = true; nextMiniGameScore += 1500; setTimeout(() => {isMiniGame = false; score += 100; updateUI();}, 8000); }
    if (score >= nextChaosScore && !isDebateMode && !isBonusMode && !isMiniGame) { isChaosMode = true; nextChaosScore += 2000; setTimeout(() => isChaosMode = false, 5000); }
    if (score >= nextLineScore && !isDebateMode && !isBonusMode && !isMiniGame && !isChaosMode) { isLineDefense = true; nextLineScore += 2500; setTimeout(() => isLineDefense = false, 8000); }

    if (score >= nextWarningScore) {
        isEventActive = true; nextWarningScore += 800; setTimeout(() => { isEventActive = false; }, 5000);
        if (currentStage.id === "stage17") { isDarkness = true; setTimeout(() => { isDarkness = false; }, 10000); }
        if (currentStage.id === "stage19") { for(let i=0; i<30; i++) moneyDecoys.push({ x: Math.random()*canvas.width, y: -Math.random()*500, speed: 3+Math.random()*4 }); }
        if (isEndless && score > 2000 && Math.random() > 0.8) { isReverse = true; setTimeout(()=> isReverse = false, 5000); }
    }

    // --- 描画 (背景・エフェクト) ---
    if (isChaosMode) {
        ctx.save(); ctx.translate((Math.random()-0.5)*15, (Math.random()-0.5)*15);
        ctx.fillStyle = "rgba(100, 0, 100, 0.2)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f0f"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center"; ctx.fillText("⚡ CHAOS STORM ⚡", canvas.width/2, 200);
    }
    if (isBonusMode) { ctx.fillStyle = "rgba(255, 255, 200, 0.15)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "gold"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center"; ctx.fillText("✨ REST ✨", canvas.width/2, 200); }
    if (isMiniGame) { ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#fff"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center"; ctx.fillText("FOCUS!!", canvas.width/2, 200); }
    if (isFreeze) { ctx.fillStyle = "rgba(0, 150, 255, 0.3)"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "white"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText("❄️ 氷結中 ❄️", canvas.width/2, 200); }
    if (isLineDefense) { ctx.fillStyle = "rgba(255, 0, 0, 0.3)"; ctx.fillRect(0, canvas.height - 10, canvas.width, 10); ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; ctx.fillText("🛡️ 理性ライン死守！ 🛡️", canvas.width/2, 200); }

    // 🥊 ボクシング
    for (let i = punchEffects.length - 1; i >= 0; i--) {
        let p = punchEffects[i]; ctx.fillStyle = "#fff"; ctx.font = "150px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("🥊", p.x, p.y); p.y -= (p.y - p.targetY) * 0.1; p.life--; if (p.life <= 0) punchEffects.splice(i, 1);
    }
    // ⚡ レーザー
    for (let i = lasers.length - 1; i >= 0; i--) {
        let l = lasers[i]; ctx.fillStyle = "rgba(255, 255, 255, " + (l.life/40) + ")"; ctx.fillRect(l.x - 40, 0, 80, canvas.height);
        enemies.forEach(e => { if(Math.abs(e.x - l.x) < 50) { e.hp = 0; score += 2; } }); l.life--; if (l.life <= 0) lasers.splice(i, 1);
    }

    // ステージ固有ギミック
    if (currentStage.id === "stage3") { // 油
        ctx.fillStyle = "rgba(180, 140, 50, 0.5)"; ctx.beginPath(); ctx.moveTo(0, canvas.height);
        for(let i=0; i<=canvas.width; i+=20) ctx.lineTo(i, canvas.height - 60 + Math.sin(frameCount*0.06 + i*0.03)*15);
        ctx.lineTo(canvas.width, canvas.height); ctx.fill();
        if (frameCount % 4 === 0) oilParticles.push({ x: Math.random()*canvas.width, y: canvas.height, r: Math.random()*15+5, s: Math.random()*2+1 });
        oilParticles.forEach((p, pi) => { p.y -= p.s; p.x += Math.sin(frameCount*0.1 + pi)*2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fillStyle="rgba(255, 220, 0, 0.4)"; ctx.fill(); if (p.y < -50) oilParticles.splice(pi, 1); });
    }
    if (currentStage.id === "stage19") { // 金
        moneyDecoys.forEach((m, i) => { ctx.font = "30px sans-serif"; ctx.fillText("💴", m.x, m.y); m.y += m.speed; if (m.y > canvas.height + 50) moneyDecoys.splice(i, 1); });
    }
// 文字ギミック描画
    decoys.forEach((d, i) => { 
        if (d.isCage) {
            // 🌟 ゆいの愛の檻：描画
            ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
            ctx.lineWidth = 4;
            ctx.strokeRect(d.x, d.y, 120, 120);
            
            ctx.fillStyle = "red";
            ctx.font = "bold 14px sans-serif";
            ctx.fillText("愛の檻", d.x + 60, d.y + 20); // 🌟 文字を表示！

            // 檻の中に入っている時のペナルティ
            if (player.x > d.x && player.x < d.x + 120 && player.y > d.y && player.y < d.y + 120) {
                isReverse = true; // 操作反転！
                hp -= 0.1; // 🌟 持続ダメージ！
                ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
                ctx.fillRect(d.x, d.y, 120, 120); // 赤く光らせる
            }
        } else {
            ctx.fillStyle = d.color || `rgba(200,200,255,${d.life/100})`;
            ctx.font = "bold 28px sans-serif";
            ctx.fillText(d.text, d.x, d.y);
        }
        d.life--; 
        if (d.life <= 0) {
            decoys.splice(i, 1);
            if (d.isCage) isReverse = false; // 檻が消えたら反転も治る
        }
    });
    if (currentStage.id === "stage10" && frameCount % 30 === 0) decoys.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, text: "💎", life: 60, color: "rgba(200, 255, 255, 0.8)" });
    if (currentStage.id === "stage14" && score > 300 && frameCount % 40 === 0) decoys.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, text: "❓", life: 55, color: "rgba(255, 200, 0, 0.7)" });

    for (let i = catBombs.length - 1; i >= 0; i--) { ctx.font = "40px sans-serif"; ctx.fillText("🐱💥", catBombs[i].x, catBombs[i].y); catBombs[i].life--; if (catBombs[i].life <= 0) catBombs.splice(i, 1); }
    for (let i = decoys.length - 1; i >= 0; i--) { 
        let d = decoys[i];
        if (d.isCage) {
            ctx.strokeStyle = "red"; ctx.lineWidth = 5; ctx.strokeRect(d.x, d.y, 100, 100);
            if (player.x > d.x && player.x < d.x+100 && player.y > d.y && player.y < d.y+100) isReverse = true;
        } else { ctx.fillStyle = d.color || `rgba(200,200,255,${d.life/100})`; ctx.font = "bold 32px sans-serif"; ctx.fillText(d.text, d.x, d.y); }
        d.life--; if (d.life <= 0) decoys.splice(i, 1); 
    }

    // --- 射撃・敵処理 ---
    if (skillGauge < 100) { skillGauge += isHardMode ? 0.08 : 0.22; updateUI(); }
    
    if (!isBonusMode && frameCount % 15 === 0) {
        bullets.push({x: player.x, y: player.y, text: currentStage.playerWords[Math.floor(Math.random()*currentStage.playerWords.length)], color: "#fff", speed: -10});
        playSE("shoot"); // 🌟 射撃音
    }
    if (!isBonusMode && frameCount % 30 === 0) bullets.push({x: supportNPC.x, y: supportNPC.y, text: currentStage.support.words[Math.floor(Math.random()*currentStage.support.words.length)], color: currentStage.support.color, speed: -8});

    let spRate = isBonusMode ? 10 : (isChaosMode ? 4 : 35 / difficulty);
    if (!isFreeze && frameCount % Math.max(1, Math.floor(spRate)) === 0) {
        if (isBonusMode) {
            let t = Math.random() > 0.4 ? "⭐" : "💖";
            enemies.push({ x: Math.random()*canvas.width, y: -40, dx: 0, dy: 5, text: t, color: t==="💖"?"#f69":"#ff0", isBonus: true });
        } else {
            const w = currentStage.enemyWords[Math.floor(Math.random()*currentStage.enemyWords.length)];
            let ex, ey, dx, dy;
            const pat = currentStage.pattern;
            if (pat === "side") { ex = Math.random()>0.5?-60:canvas.width+60; ey=Math.random()*canvas.height*0.6; dx=ex<0?4*difficulty:-4*difficulty; dy=(Math.random()-0.5)*2; }
            else if (pat === "circle") { let a=Math.random()*Math.PI*2; ex=player.x+Math.cos(a)*400; ey=player.y+Math.sin(a)*400; dx=(player.x-ex)*0.015*difficulty; dy=(player.y-ey)*0.015*difficulty; }
            else if (pat === "spiral") { let a=frameCount*0.1; ex=canvas.width/2+Math.cos(a)*350; ey=canvas.height/2+Math.sin(a)*350; dx=(canvas.width/2-ex)*0.02; dy=(canvas.height/2-ey)*0.02; }
            else if (pat === "rush") { ex=Math.random()*canvas.width; ey=-60; dx=0; dy=8*difficulty; }
            else if (pat === "chase") { ex=Math.random()*canvas.width; ey=-60; dx=0; dy=2; }
            else { ex=Math.random()*canvas.width; ey=-60; dx=(Math.random()-0.5)*5; dy=3.5*difficulty; }
            if (isChaosMode) { dx *= 1.5; dy *= 1.5; }
            enemies.push({ x: ex, y: ey, dx: dx, dy: dy, text: w, color: currentStage.enemyColor });
        }
    }

    // プレイヤー描画
    if (isShield) { ctx.strokeStyle="#0ff"; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(player.x, player.y, 40, 0, Math.PI*2); ctx.stroke(); }
    if (isReverse) { ctx.fillStyle="#f0f"; ctx.font="14px sans-serif"; ctx.fillText("反転", player.x, player.y-30); }
    ctx.fillStyle = "#aaaaff"; ctx.beginPath(); ctx.arc(player.x, player.y, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = currentStage.support.color; ctx.beginPath(); ctx.arc(supportNPC.x, supportNPC.y, 8, 0, Math.PI*2); ctx.fill();

    bullets.forEach((b, bi) => { b.y += b.speed; ctx.fillStyle=b.color; ctx.font="16px bold sans-serif"; ctx.fillText(b.text, b.x, b.y); });
    bullets = bullets.filter(b => b.y > -50);

for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i]; 
        if (!isFreeze) {
            if (currentStage.pattern === "chase" && !e.isBonus) {
                // 🌟 【執着型ホーミング】 逃げてもUターンして追ってくる！
                let ax = player.x - e.x;
                let ay = player.y - e.y;
                let dist = Math.sqrt(ax * ax + ay * ay);
                
                if (dist > 0) {
                    // 加速度を上げて粘着質に（0.15）
                    e.dx += (ax / dist) * 0.15; 
                    e.dy += (ay / dist) * 0.15;
                }
                // 慣性（ブレーキ）をかけて旋回性能をアップ
                e.dx *= 0.96; 
                e.dy *= 0.96;
            }
            e.x += e.dx; e.y += e.dy; 
        }
        
        // 敵の言葉を描画
        ctx.fillStyle = e.color;
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(e.text, e.x, e.y);

        // --- 🌟 ボーナス回収判定 ---
        if (e.isBonus) {
            if (Math.abs(player.x - e.x) < 35 && Math.abs(player.y - e.y) < 35) {
                if (e.text === "💖") hp = Math.min(100, hp + 10); else score += 40;
                updateUI(); enemies.splice(i, 1); playSE("skill"); continue;
            }
        } else {
            // --- 🌟 当たり判定（弾vs敵） ---
            let wasHit = false;
            for (let j = bullets.length - 1; j >= 0; j--) {
                let b = bullets[j];
                if (Math.abs(b.x - e.x) < 60 && Math.abs(b.y - e.y) < 30) {
                    wasHit = true;
                    bullets.splice(j, 1); // 弾を消す
                    break;
                }
            }

            if (wasHit) {
                enemies.splice(i, 1); // 敵を消す
                score += 10;
                updateUI();
                playSE("hit");
                continue; 
            }

            // --- 🌟 理性ライン防衛判定 (これがないとミニゲームが機能しない！) ---
            if (isLineDefense && e.y > canvas.height - 10) {
                hp -= 5; 
                enemies.splice(i, 1); 
                updateUI(); 
                playSE("dead"); 
                if (hp <= 0) return endGame(false);
                continue;
            }

            // --- 🌟 プレイヤーとの衝突判定 ---
            if (Math.abs(player.x - e.x) < 25 && Math.abs(player.y - e.y) < 25) { 
                if (!isShield) {
                    hp -= isHardMode ? 25 : 12;
                    enemies.splice(i, 1);
                    updateUI();
                    playSE("dead");
                    if (hp <= 0) return endGame(false);
                } else {
                    enemies.splice(i, 1); // シールド中は消すだけ
                }
                continue;
            }
        }

        // --- 🌟 画面外消去処理 (これがないと重くなる！) ---
        if (e && (e.y > canvas.height + 150 || e.x < -150 || e.x > canvas.width + 150)) {
            enemies.splice(i, 1);
        }
    }

    if (isDarkness) {
        ctx.fillStyle = "black"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "destination-out";
        let gr = ctx.createRadialGradient(player.x, player.y, 20, player.x, player.y, 180);
        gr.addColorStop(0, "#fff"); gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(player.x, player.y, 180, 0, Math.PI*2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center"; 
        ctx.fillText("人が怖い…視界が塞がれる…", canvas.width/2, canvas.height / 2 + 50);
    }

    if (isChaosMode) ctx.restore();
    if (!isEndless && score >= 1000) return endGame(true);
    animationId = requestAnimationFrame(gameLoop);
}

// ----------------------------------------
// 5. UI更新・終了処理
// ----------------------------------------

function updateUI() {
    const h = document.getElementById("hp-bar"), s = document.getElementById("score-display"), b = document.getElementById("skill-bar"), bt = document.getElementById("skill-btn");
    if(h) h.style.width = `${Math.max(0, hp)}%`;
    if(s) s.innerText = score;
    if(b) b.style.width = `${Math.min(100, skillGauge)}%`;
    if(bt) bt.disabled = (skillGauge < 100);
}

function updateDialogue() {
    if (!isPlaying) return;
    let ph = (hp <= 30) ? "lowHP" : (frameCount > 2000 ? "mid" : "start");
    const ds = currentStage.dialogues[ph];
    if (ds) { const d = ds[Math.floor(Math.random()*ds.length)]; document.getElementById("speaker-name").innerText = d.speaker; document.getElementById("dialogue-text").innerText = d.text.replace(/{player}/g, playerName); }
}
setInterval(updateDialogue, 4200);

function endGame(isClear) {
    stopGame(); showScreen("result-screen");
    let ds = isClear ? currentStage.dialogues.win : currentStage.dialogues.lose;
    if (isEndless && score > 1000) ds = currentStage.dialogues.win;
    const d = ds[Math.floor(Math.random() * ds.length)];
    document.getElementById("result-title").innerHTML = isHardMode ? "死闘の果てに..." : (isEndless ? "限界到達！" : (isClear ? "昇華成功！" : "崩壊..."));
    document.getElementById("final-score").innerText = score;
    document.getElementById("result-speaker").innerText = d.speaker;
    document.getElementById("result-text").innerText = d.text.replace(/{player}/g, playerName);
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let playerName = "名無し";
let isPlaying = false;
let currentStage = null;
let animationId = null; // 🌟 nullで初期化
let score = 0, hp = 100, skillGauge = 0, frameCount = 0;
let currentPhase = "start";

// 🌟 新しい状態フラグ
let isEventActive = false;
let isMiniGame = false;
let isSlow = false;
let isShield = false;
let decoys = [];

let player = { x: 300, y: 700, width: 20, height: 20 };
let supportNPC = { x: 250, y: 700 }; // 🌟 追従ではなく独立した座標へ
let bullets = [], enemies = [];

// ----------------------------------------
// 画面切り替え（バグ修正版）
// ----------------------------------------

function showScreen(screenId) {
    // 全てのスクリーンを非表示
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    // ゲームUIの表示・非表示管理
    const gameUI = document.getElementById("game-ui");
    if (screenId === null) {
        gameUI.classList.remove("hidden");
    } else {
        gameUI.classList.add("hidden");
        const target = document.getElementById(screenId);
        if (target) target.classList.add("active");
    }
}

// ----------------------------------------
// ボタンイベント（確実にリセットするように修正）
// ----------------------------------------

document.getElementById("start-btn").onclick = () => {
    const input = document.getElementById("player-name-input").value.trim();
    if (input) playerName = input;
    initStageSelect();
    showScreen("stage-select-screen");
};

// 🌟 タイトルへ戻るボタン
document.getElementById("back-to-title-btn").onclick = () => {
    stopGame();
    showScreen("title-screen");
};

// 🌟 ステージ選択へ戻るボタン
document.getElementById("back-to-select-btn").onclick = () => {
    stopGame();
    initStageSelect();
    showScreen("stage-select-screen");
};

document.getElementById("back-to-select-from-prof-btn").onclick = () => {
    showScreen("stage-select-screen");
};

// ゲームを完全に停止させる関数
function stopGame() {
    isPlaying = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    // 残骸をクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

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
    document.getElementById("prof-main-class").innerText = stage.main.class;
    document.getElementById("prof-supp-class").innerText = stage.support.class;
    document.getElementById("prof-main-img").src = stage.main.img;
    document.getElementById("prof-main-fullname").innerText = stage.main.fullName;
    document.getElementById("prof-main-gender").innerText = stage.main.gender;
    document.getElementById("prof-main-desc").innerText = stage.main.profile;
    document.getElementById("prof-supp-img").src = stage.support.img;
    document.getElementById("prof-supp-fullname").innerText = stage.support.fullName;
    document.getElementById("prof-supp-gender").innerText = stage.support.gender;
    document.getElementById("prof-supp-desc").innerText = stage.support.profile;
    showScreen("profile-screen");
}

document.getElementById("start-battle-btn").onclick = () => {
    stopGame(); // 念のため二重起動防止
    startGame(currentStage);
};

function startGame(stage) {
    isPlaying = true; 
    score = 0; hp = 100; skillGauge = 0; frameCount = 0;
    isEventActive = false; isMiniGame = false; isSlow = false; isShield = false;
    bullets = []; enemies = []; decoys = [];
    currentPhase = "start";

    // ステージ3演出
    const container = document.getElementById("game-container");
    if(stage.id === "stage3") container.classList.add("soup-bg");
    else container.classList.remove("soup-bg");

    updateUI();
    showScreen(null); // ゲーム画面表示
    gameLoop();
}

// ----------------------------------------
// スキル
// ----------------------------------------

document.getElementById("skill-btn").onclick = () => {
    if (skillGauge < 100) return;
    skillGauge = 0;
    const dialogs = currentStage.dialogues.skill;
    const dialog = dialogs[Math.floor(Math.random() * dialogs.length)];
    document.getElementById("speaker-name").innerText = dialog.speaker;
    document.getElementById("dialogue-text").innerText = dialog.text;

    if (currentStage.support.skillType === "clear") {
        enemies = []; score += 50;
    } else if (currentStage.support.skillType === "heal") {
        hp = Math.min(100, hp + 45);
    } else if (currentStage.support.skillType === "slow") {
        isSlow = true; setTimeout(() => isSlow = false, 6000);
    } else if (currentStage.support.skillType === "shield") {
        isShield = true; setTimeout(() => isShield = false, 5000);
    } else if (currentStage.support.skillType === "laser") {
        // 🌟 新スキル：貫通レーザー
        fireLaser();
    }
    updateUI();
};
function fireLaser() {
    let laserWidth = 60;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(player.x - laserWidth/2, 0, laserWidth, player.y);
    
    // 直線上の敵をすべて倒す
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (Math.abs(enemies[i].x - player.x) < 50) {
            enemies.splice(i, 1);
            score += 15;
        }
    }
    updateUI();
}
// ----------------------------------------
// メインループ
// ----------------------------------------

function gameLoop() {
    if (!isPlaying) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;

    // 🌟 サポートキャラの新しい動き：軌道を描きながらランダムに浮遊
    // プレイヤーの周りを円形に回りつつ、距離も伸び縮みさせる
    let orbitAngle = frameCount * 0.04; 
    let orbitRadius = 70 + Math.sin(frameCount * 0.02) * 30; // 距離がフワフワ変わる
    supportNPC.x = player.x + Math.cos(orbitAngle) * orbitRadius;
    supportNPC.y = player.y + Math.sin(orbitAngle) * orbitRadius;

    // イベントチェック
    if ((score >= 300 && score < 400) || (score >= 700 && score < 800)) {
        isEventActive = true;
        ctx.fillStyle = "rgba(255, 0, 0, " + (Math.sin(frameCount/5)*0.2 + 0.1) + ")";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("WARNING!! 感情密度上昇", canvas.width/2, canvas.height/2);
        
        if (currentStage.id === "stage5" && frameCount % 60 === 0) {
            decoys.push({ x: 50 + Math.random()*200, y: 150 + Math.random()*300, text: "【要因分解中：Fe行方不明】", life: 100 });
        }
    } else { isEventActive = false; }

    // ミニゲーム
    if (score >= 500 && score < 510 && !isMiniGame) {
        isMiniGame = true;
        setTimeout(() => { isMiniGame = false; score += 50; }, 10000);
    }

    if (skillGauge < 100) { skillGauge += 0.2; updateUI(); }

    // 射撃
    if (frameCount % 15 === 0) bullets.push({ x: player.x, y: player.y, text: currentStage.playerWords[Math.floor(Math.random() * currentStage.playerWords.length)], color: "#fff", speed: -8 });
    if (frameCount % 30 === 0) bullets.push({ x: supportNPC.x, y: supportNPC.y, text: currentStage.support.words[Math.floor(Math.random() * currentStage.support.words.length)], color: currentStage.support.color, speed: -6 });

    // スポーン
    let spawnRate = isMiniGame ? 5 : (isEventActive ? 12 : (isSlow ? 60 : 35));
    if (frameCount % spawnRate === 0) {
        const word = currentStage.enemyWords[Math.floor(Math.random() * currentStage.enemyWords.length)];
        let ex, ey, dx, dy;
        if (isMiniGame) { ex = canvas.width/2; ey = canvas.height/2; dx = (Math.random()-0.5)*12; dy = (Math.random()-0.5)*12; }
        else if (currentStage.pattern === "side") { ex = Math.random() > 0.5 ? -40 : canvas.width + 40; ey = Math.random() * (canvas.height / 2); dx = ex < 0 ? 3 : -3; dy = 1.5; }
        else if (currentStage.pattern === "rush") { ex = Math.random() * canvas.width; ey = -40; dx = (Math.random()-0.5)*2; dy = 5; }
        else { ex = Math.random() * canvas.width; ey = -40; dx = (Math.random()-0.5)*4; dy = 2.8; }
        if (isSlow) { dx *= 0.3; dy *= 0.3; }
        enemies.push({ x: ex, y: ey, dx: dx, dy: dy, text: word, color: currentStage.enemyColor });
    }

    // 描画
    for (let d of decoys) { ctx.fillStyle = "rgba(153,204,255,0.8)"; ctx.font = "20px sans-serif"; ctx.fillText(d.text, d.x, d.y); d.life--; }
    decoys = decoys.filter(d => d.life > 0);

    ctx.font = "16px bold sans-serif"; ctx.textAlign = "center";
    if (isShield) { ctx.strokeStyle = "cyan"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(player.x, player.y, 25, 0, Math.PI*2); ctx.stroke(); }
    ctx.fillStyle = "#aaaaff"; ctx.beginPath(); ctx.arc(player.x, player.y, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = currentStage.support.color; ctx.beginPath(); ctx.arc(supportNPC.x, supportNPC.y, 8, 0, Math.PI*2); ctx.fill();

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.y += b.speed;
        ctx.fillStyle = b.color; ctx.fillText(b.text, b.x, b.y);
        if (b.y < -50) bullets.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (currentStage.pattern === "chase") { e.dx += (player.x - e.x) * 0.001; e.dy += (player.y - e.y) * 0.001; }
        e.x += e.dx; e.y += e.dy;
        ctx.shadowBlur = 5; ctx.shadowColor = e.color; ctx.fillStyle = e.color;
        ctx.fillText(e.text, e.x, e.y); ctx.shadowBlur = 0;

        for (let j = bullets.length - 1; j >= 0; j--) {
            if (Math.abs(bullets[j].x - e.x) < 50 && Math.abs(bullets[j].y - e.y) < 20) {
                bullets.splice(j, 1); enemies.splice(i, 1); score += 10; updateUI(); break;
            }
        }
        if (e && Math.abs(player.x - e.x) < 25 && Math.abs(player.y - e.y) < 25) {
            if (!isShield) { hp -= 10; updateUI(); enemies.splice(i, 1); if (hp <= 0) return endGame(false); }
            else { enemies.splice(i, 1); }
        }
        if (e && (e.y > canvas.height + 50 || e.x < -100 || e.x > canvas.width + 100)) enemies.splice(i, 1);
    }

    if (score >= 1000) return endGame(true);
    animationId = requestAnimationFrame(gameLoop);
}

// UI更新・マウスイベント
function updateUI() {
    document.getElementById("hp-bar").style.width = `${Math.max(0, hp)}%`;
    document.getElementById("score-display").innerText = score;
    document.getElementById("skill-bar").style.width = `${Math.min(100, skillGauge)}%`;
    document.getElementById("skill-btn").disabled = (skillGauge < 100);
}

function updateDialogue() {
    if (!isPlaying) return;
    if (hp <= 30) currentPhase = "lowHP";
    else if (frameCount > 1000) currentPhase = "mid"; 
    else currentPhase = "start";
    const dialogs = currentStage.dialogues[currentPhase];
    if (dialogs) {
        const dialog = dialogs[Math.floor(Math.random() * dialogs.length)];
        document.getElementById("speaker-name").innerText = dialog.speaker;
        document.getElementById("dialogue-text").innerText = dialog.text.replace(/{player}/g, playerName);
    }
}
setInterval(updateDialogue, 4000);

canvas.addEventListener("mousemove", (e) => {
    if (!isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    player.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    player.y = (e.clientY - rect.top) * (canvas.height / rect.height);
});

function endGame(isClear) {
    stopGame(); // 🌟 ここでループを止める
    const dialogs = isClear ? currentStage.dialogues.win : currentStage.dialogues.lose;
    const dialog = dialogs[0];
    document.getElementById("result-title").innerHTML = isClear ? '昇華成功！' : '崩壊…';
    document.getElementById("result-speaker").innerText = dialog.speaker;
    document.getElementById("result-text").innerText = dialog.text;
    showScreen("result-screen");
}
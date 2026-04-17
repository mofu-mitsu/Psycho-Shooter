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
    window.hasDebateOccurred = false;
    window.hasFocusModeOccurred = false;
    window.hasWarning1 = false;
    window.hasWarning2 = false;
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
// 🌟 新ミニゲーム用変数
let isDebateMode = false;   // 論破モード中か
let debateClicks = 0;       // 連打回数
const DEBATE_MAX = 15;      // クリアに必要な連打数
let hasDebateOccurred = false; // 1回のプレイで1度だけ発動させるフラグ
supportNPC.dx = 2;
supportNPC.dy = 1.5;
// スキル発動ロジック
document.getElementById("skill-btn").onclick = () => {
    if (skillGauge < 100) return;
    skillGauge = 0;
    const dialogs = currentStage.dialogues.skill;
    if (dialogs && dialogs.length > 0) {
        const dialog = dialogs[Math.floor(Math.random() * dialogs.length)];
        document.getElementById("speaker-name").innerText = dialog.speaker;
        document.getElementById("dialogue-text").innerText = dialog.text;
    }

    if (currentStage.support.skillType === "clear") {
        enemies = []; score += 50;
    } else if (currentStage.support.skillType === "heal") {
        hp = Math.min(100, hp + 45);
    } else if (currentStage.support.skillType === "slow") {
        isSlow = true; setTimeout(() => isSlow = false, 6000); 
    } else if (currentStage.support.skillType === "shield") {
        isShield = true; setTimeout(() => isShield = false, 5000); 
    } else if (currentStage.support.skillType === "laser") {
        fireLaser(); 
    } else if (currentStage.support.skillType === "freeze") {
        isFreeze = true; 
        setTimeout(() => isFreeze = false, 5000); 
    } else if (currentStage.support.skillType === "bomb") {
        fireCatBomb();
    }
    updateUI();
};


// --- 猫爆弾の演出用配列 ---
let catBombs = [];

function fireCatBomb() {
    // 画面のランダムな位置に猫をたくさん出現させる
    for (let i = 0; i < 30; i++) {
        catBombs.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            life: 60 // 60フレーム（約1秒）表示
        });
    }
    // 敵は全消去
    enemies = [];
    score += 50;
    updateUI();
}
window.addEventListener("keydown", (e) => {
    if (isDebateMode && e.code === "Space") {
        debateClicks++;
    }
});
canvas.addEventListener("touchstart", (e) => {
    if (isDebateMode) {
        debateClicks++;
        e.preventDefault(); // スワイプの誤爆防止
    } else {
        isDragging = true;
    }
}, { passive: false });
// 🌟 新しいフラグを追加しておく
let isFreeze = false;
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

    // --------------------------------------------------
    // 🌟 1. サポートキャラの全体ランダム移動（壁で跳ね返る）
    // --------------------------------------------------
    supportNPC.x += supportNPC.dx;
    supportNPC.y += supportNPC.dy;
    
    // 画面端で反射
    if (supportNPC.x < 0 || supportNPC.x > canvas.width) supportNPC.dx *= -1;
    // 下は少し余裕を持たせる（敵の出現位置には行かないように）
    if (supportNPC.y < 100 || supportNPC.y > canvas.height - 50) supportNPC.dy *= -1;
    
    // 時々ランダムに方向を少し変える（不規則な動き）
    if (frameCount % 60 === 0) {
        supportNPC.dx += (Math.random() - 0.5);
        supportNPC.dy += (Math.random() - 0.5);
        // 速度制限
        supportNPC.dx = Math.max(-3, Math.min(3, supportNPC.dx));
        supportNPC.dy = Math.max(-3, Math.min(3, supportNPC.dy));
    }


    // --------------------------------------------------
    // 🌟 2. 新ミニゲーム「論破モード」
    // --------------------------------------------------
    // 条件：スコアが600以上になり、まだ発動しておらず、対象キャラ（INTJ, INTPなど）であること
    const debateTargetNames = ["きゅうた", "かるめ", "りょうご", "のぶ"]; // 論破できそうなキャラ
    let isTargetChar = debateTargetNames.includes(currentStage.main.name) || debateTargetNames.includes(currentStage.support.name);

    if (score >= 600 && !hasDebateOccurred && isTargetChar && !isMiniGame) {
        isDebateMode = true;
        hasDebateOccurred = true; // 今回のプレイではもう出さない
        debateClicks = 0;
        
        setTimeout(() => {
            if (!isDebateMode) return; 
            isDebateMode = false;
            hp -= 30; // 失敗時の大ダメージ
            updateUI();
            if (hp <= 0) endGame(false);
        }, 8000); 
    }

    if (isDebateMode) {
        ctx.fillStyle = "rgba(100, 0, 0, 0.85)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "white"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("⚠️ 矛盾を突け！論破せよ！ ⚠️", canvas.width/2, 100);
        ctx.font = "20px sans-serif";
        ctx.fillText("スペースキー(PC) or 画面タップ 連打！", canvas.width/2, 140);
        
        ctx.fillStyle = "black";
        ctx.font = "bold 50px sans-serif";
        ctx.fillText("「非論理的だ！」", canvas.width/2, canvas.height/2);

        let barWidth = 300;
        let progress = (debateClicks / DEBATE_MAX) * barWidth;
        ctx.fillStyle = "#333";
        ctx.fillRect(canvas.width/2 - barWidth/2, canvas.height/2 + 50, barWidth, 30);
        ctx.fillStyle = "cyan";
        ctx.fillRect(canvas.width/2 - barWidth/2, canvas.height/2 + 50, progress, 30);

        if (debateClicks >= DEBATE_MAX) {
            isDebateMode = false;
            score += 60; 
            enemies = []; 
            updateUI();
        }

        animationId = requestAnimationFrame(gameLoop);
        return;
    }

    // --------------------------------------------------
    // 🌟 3. 精神統一ミニゲーム（スコア500到達時、1回のみ）
    // --------------------------------------------------
    // （前回の score >= 500 && score < 550 だとすり抜ける可能性があったためフラグ化）
    if (!window.hasFocusModeOccurred) window.hasFocusModeOccurred = false;
    if (score >= 500 && !window.hasFocusModeOccurred && !isDebateMode) {
        isMiniGame = true;
        window.hasFocusModeOccurred = true;
        setTimeout(() => { isMiniGame = false; score += 50; updateUI(); }, 10000);
    }
    
    if (isMiniGame) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "yellow"; ctx.font = "bold 25px sans-serif";
        ctx.fillText("精神統一モード：全消去せよ！", canvas.width/2, 100);
    }

    // --------------------------------------------------
    // 🌟 4. WARNING演出（スコア300と800で1回ずつ発生するように修正）
    // --------------------------------------------------
    if (!window.hasWarning1) window.hasWarning1 = false;
    if (!window.hasWarning2) window.hasWarning2 = false;

    if (score >= 300 && !window.hasWarning1) {
        isEventActive = true;
        setTimeout(() => { isEventActive = false; window.hasWarning1 = true; }, 5000); // 5秒間警告
    }
    if (score >= 800 && !window.hasWarning2) {
        isEventActive = true;
        setTimeout(() => { isEventActive = false; window.hasWarning2 = true; }, 5000); // 5秒間警告
    }

    if (isEventActive) {
        ctx.save();
        ctx.translate((Math.random()-0.5)*10, (Math.random()-0.5)*10); 
        ctx.fillStyle = "rgba(255, 0, 0, 0.15)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("WARNING!! 感情密度上昇", canvas.width/2, canvas.height/2);
        ctx.restore();

        if (currentStage.id === "stage5" && frameCount % 60 === 0) {
            decoys.push({ x: 50 + Math.random()*200, y: 100 + Math.random()*400, text: "【要因分解中：Fe行方不明】", life: 100 });
        }
    }

    // --------------------------------------------------
    // 🌟 5. スキル・演出描画
    // --------------------------------------------------
    if (isFreeze) {
        ctx.fillStyle = "rgba(0, 200, 255, 0.2)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("❄️ 氷結中 ❄️", canvas.width/2, 100);
    }

    for (let i = catBombs.length - 1; i >= 0; i--) {
        ctx.font = "30px sans-serif";
        ctx.fillText("🐱💥", catBombs[i].x, catBombs[i].y);
        catBombs[i].life--;
        if (catBombs[i].life <= 0) catBombs.splice(i, 1);
    }

    for (let i = decoys.length - 1; i >= 0; i--) {
        ctx.fillStyle = "rgba(153, 204, 255, " + (decoys[i].life/100) + ")";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(decoys[i].text, decoys[i].x, decoys[i].y);
        decoys[i].life--;
        if (decoys[i].life <= 0) decoys.splice(i, 1);
    }

    // --------------------------------------------------
    // 🌟 6. プレイヤーと敵の処理
    // --------------------------------------------------
    if (skillGauge < 100) { skillGauge += 0.2; updateUI(); }

    if (frameCount % 15 === 0) {
        bullets.push({ x: player.x, y: player.y, text: currentStage.playerWords[Math.floor(Math.random() * currentStage.playerWords.length)], color: "#fff", speed: -8 });
    }
    // 🌟 サポートキャラの弾は独立した座標(supportNPC)から発射される
    if (frameCount % 30 === 0) {
        bullets.push({ x: supportNPC.x, y: supportNPC.y, text: currentStage.support.words[Math.floor(Math.random() * currentStage.support.words.length)], color: currentStage.support.color, speed: -6 });
    }

    let spawnRate = isMiniGame ? 5 : (isEventActive ? 12 : (isSlow ? 70 : 35));
    if (!isFreeze && frameCount % spawnRate === 0) {
        const word = currentStage.enemyWords[Math.floor(Math.random() * currentStage.enemyWords.length)];
        let ex, ey, dx, dy;
        
        if (isMiniGame) {
            ex = canvas.width/2; ey = canvas.height/2;
            dx = (Math.random()-0.5)*12; dy = (Math.random()-0.5)*12;
        } else if (currentStage.pattern === "spiral") {
            let angle = frameCount * 0.1;
            ex = canvas.width/2 + Math.cos(angle) * 300; ey = canvas.height/2 + Math.sin(angle) * 300;
            dx = (canvas.width/2 - ex) * 0.015; dy = (canvas.height/2 - ey) * 0.015;
        } else if (currentStage.pattern === "side") {
            ex = Math.random() > 0.5 ? -40 : canvas.width + 40; ey = Math.random() * (canvas.height / 2);
            dx = ex < 0 ? 3 : -3; dy = 1.2;
        } else if (currentStage.pattern === "rush") {
            ex = Math.random() * canvas.width; ey = -40; dx = (Math.random()-0.5)*3; dy = 5;
        } else if (currentStage.pattern === "chase") {
            ex = Math.random() * canvas.width; ey = -40; dx = 0; dy = 1.5;
        } else {
            ex = Math.random() * canvas.width; ey = -40; dx = (Math.random()-0.5)*4; dy = 2.8;
        }

        if (isSlow) { dx *= 0.3; dy *= 0.3; }
        enemies.push({ x: ex, y: ey, dx: dx, dy: dy, text: word, color: currentStage.enemyColor });
    }

    ctx.font = "16px bold sans-serif"; ctx.textAlign = "center";
    if (isShield) {
        ctx.strokeStyle = "cyan"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(player.x, player.y, 25, 0, Math.PI*2); ctx.stroke();
    }

    ctx.fillStyle = "#aaaaff"; ctx.beginPath(); ctx.arc(player.x, player.y, 10, 0, Math.PI*2); ctx.fill();
    // 🌟 サポートキャラの描画（画面を飛び回っている）
    ctx.fillStyle = currentStage.support.color; ctx.beginPath(); ctx.arc(supportNPC.x, supportNPC.y, 8, 0, Math.PI*2); ctx.fill();

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.y += b.speed;
        ctx.fillStyle = b.color; ctx.fillText(b.text, b.x, b.y);
        if (b.y < -50) bullets.splice(i, 1);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        if (!isFreeze) {
            if (currentStage.pattern === "chase") {
                e.dx += (player.x - e.x) * 0.001; 
                e.dy += (player.y - e.y) * 0.001; 
            }
            e.x += e.dx; e.y += e.dy;
        }
        
        ctx.shadowBlur = 5; ctx.shadowColor = e.color; ctx.fillStyle = e.color;
        ctx.fillText(e.text, e.x, e.y); ctx.shadowBlur = 0;

        for (let j = bullets.length - 1; j >= 0; j--) {
            if (Math.abs(bullets[j].x - e.x) < 50 && Math.abs(bullets[j].y - e.y) < 20) {
                bullets.splice(j, 1); enemies.splice(i, 1); score += 10; updateUI(); break;
            }
        }
        
        if (e && Math.abs(player.x - e.x) < 25 && Math.abs(player.y - e.y) < 25) {
            if (!isShield) {
                hp -= 10; updateUI(); enemies.splice(i, 1);
                if (hp <= 0) return endGame(false);
            } else {
                enemies.splice(i, 1); 
            }
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

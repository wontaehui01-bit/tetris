'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Game Logic (Migrated from game.js)
    const canvas = document.getElementById('gameBoard');
    const ctx = canvas?.getContext('2d');
    const nextCanvas = document.getElementById('nextCanvas');
    const nextCtx = nextCanvas?.getContext('2d');

    if (!canvas || !ctx || !nextCanvas || !nextCtx) return;

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 35;

    // GOOGLE SHEETS SETTINGS
    const SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_URL;

    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
    nextCanvas.width = 4 * BLOCK_SIZE;
    nextCanvas.height = 4 * BLOCK_SIZE;

    const COLORS = [
        null,
        '#ffb7ce', // I: Pastel Pink
        '#b8d8be', // J: Pastel Green
        '#a2d2ff', // L: Pastel Blue
        '#ffde7d', // O: Pastel Yellow
        '#ffcf9f', // S: Pastel Orange
        '#e1bdfc', // T: Pastel Purple
        '#b4eefc'  // Z: Pastel Cyan
    ];

    const SHAPES = [
        [],
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
        [[2, 0, 0], [2, 2, 2], [0, 0, 0]], // J
        [[0, 0, 3], [3, 3, 3], [0, 0, 0]], // L
        [[4, 4], [4, 4]], // O
        [[0, 5, 5], [5, 5, 0], [0, 0, 0]], // S
        [[0, 6, 0], [6, 6, 6], [0, 0, 0]], // T
        [[7, 7, 0], [0, 7, 7], [0, 0, 0]]  // Z
    ];

    let board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    let score = 0;
    let lines = 0;
    let level = 1;
    let dropCounter = 0;
    let dropInterval = 1000;
    let lastTime = 0;
    let gameOver = false;
    let paused = true;
    let nextPiece = null;
    let startTime = 0;
    let totalTime = 0; // In milliseconds

    const player = {
        pos: { x: 0, y: 0 },
        piece: null,
        type: 0
    };

    function createPiece(type) {
        return {
            pos: { x: 0, y: 0 },
            shape: JSON.parse(JSON.stringify(SHAPES[type])),
            type: type
        };
    }

    function drawBlock(context, x, y, type, size = BLOCK_SIZE, isGhost = false) {
        const color = COLORS[type];
        if (!color) return;

        context.save();
        if (isGhost) {
            context.globalAlpha = 0.2;
            context.strokeStyle = color;
            context.lineWidth = 2;
            context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
        } else {
            // Main glass body
            context.globalAlpha = 0.6;
            context.fillStyle = color;
            context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

            // Highlight border
            context.globalAlpha = 0.9;
            context.strokeStyle = 'white';
            context.lineWidth = 0.5;
            context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);

            // Glass reflection line
            context.globalAlpha = 0.3;
            context.strokeStyle = 'white';
            context.beginPath();
            context.moveTo(x * size + 5, y * size + size - 8);
            context.lineTo(x * size + 5, y * size + 5);
            context.lineTo(x * size + size - 8, y * size + 5);
            context.stroke();
        }
        context.restore();
    }

    function drawBoard() {
        board.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawBlock(ctx, x, y, value);
                } else {
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            });
        });
    }

    function drawPiece(context, piece, size = BLOCK_SIZE) {
        if (!piece) return;
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawBlock(context, x + piece.pos.x, y + piece.pos.y, piece.type, size);
                }
            });
        });
    }

    function drawGhostPiece(context, piece) {
        if (!piece) return;
        const ghostPos = { ...piece.pos };
        while (!collide(board, { ...piece, pos: ghostPos })) {
            ghostPos.y++;
        }
        ghostPos.y--;

        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawBlock(context, x + ghostPos.x, y + ghostPos.y, piece.type, BLOCK_SIZE, true);
                }
            });
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        
        drawBoard();
        if (player.piece) {
            drawGhostPiece(ctx, player.piece);
            drawPiece(ctx, player.piece);
        }
        
        if (nextPiece) {
            const offset = {
                x: Math.floor((4 - nextPiece.shape[0].length) / 2),
                y: Math.floor((4 - nextPiece.shape.length) / 2)
            };
            const centeredPiece = { ...nextPiece, pos: offset };
            drawPiece(nextCtx, centeredPiece, BLOCK_SIZE);
        }
    }

    function collide(board, piece) {
        const m = piece.shape;
        const o = piece.pos;
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0) {
                    const targetY = y + o.y;
                    const targetX = x + o.x;
                    if (targetY >= ROWS || targetX < 0 || targetX >= COLS || (board[targetY] && board[targetY][targetX] !== 0)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function rotatePiece(matrix) {
        for (let y = 0; y < matrix.length; ++y) {
            for (let x = 0; x < y; ++x) {
                [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
            }
        }
        matrix.forEach(row => row.reverse());
    }

    function resetPlayer() {
        if (!nextPiece) {
            nextPiece = createPiece(Math.floor(Math.random() * (SHAPES.length - 1)) + 1);
        }
        player.piece = nextPiece;
        player.type = nextPiece.type;
        nextPiece = createPiece(Math.floor(Math.random() * (SHAPES.length - 1)) + 1);
        
        player.piece.pos.y = 0;
        player.piece.pos.x = Math.floor(COLS / 2) - Math.floor(player.piece.shape[0].length / 2);
        
        if (collide(board, player.piece)) {
            gameOver = true;
            paused = true;
            showOverlay('GAME OVER');
        }
    }

    function playerDrop() {
        player.piece.pos.y++;
        if (collide(board, player.piece)) {
            player.piece.pos.y--;
            merge();
            resetPlayer();
            clearLines();
            updateScore();
        }
        dropCounter = 0;
    }

    function merge() {
        player.piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    board[y + player.piece.pos.y][x + player.piece.pos.x] = player.type;
                }
            });
        });
    }

    function clearLines() {
        let linesCleared = 0;
        outer: for (let y = ROWS - 1; y >= 0; --y) {
            for (let x = 0; x < COLS; ++x) {
                if (board[y][x] === 0) continue outer;
            }
            const row = board.splice(y, 1)[0].fill(0);
            board.unshift(row);
            linesCleared++;
            y++;
        }
        if (linesCleared > 0) {
            lines += linesCleared;
            score += linesCleared * 100 * level;
            level = Math.floor(lines / 10) + 1;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
            
            if (lines >= 10) { // Mission target changed to 10 for better gameplay in Next.js version if you like, or keep at 3
                gameOver = true;
                paused = true;
                showOverlay('GOAL REACHED!');
            }
        }
    }

    async function fetchTop3() {
        const list = document.getElementById('top3-list');
        if (!list) return;
        
        if (!SCRIPT_URL || SCRIPT_URL.includes("여기에")) {
            list.innerHTML = "<div class='rank-item' style='font-size:10px; opacity:0.6;'>URL을 설정하면<br>랭킹이 표시됩니다.</div>";
            return;
        }
        
        try {
            const response = await fetch(SCRIPT_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            list.innerHTML = "";
            
            const validData = data.filter(p => {
                const t = p.time;
                if (typeof t === 'string' && t.includes('T')) return false;
                const sec = parseInt(t, 10);
                return !isNaN(sec) && sec > 0 && sec < 1000;
            });
            
            if (validData.length === 0) {
                list.innerHTML = "<div class='rank-item'>Be the first!</div>";
            } else {
                validData.forEach((p, i) => {
                    const timeValue = parseInt(p.time, 10) || 0;
                    list.innerHTML += `<div class='rank-item'><span>${i+1}. ${p.name}</span> <span>${timeValue}s</span></div>`;
                });
            }
        } catch (e) {
            console.error("Rank fetch error:", e);
            list.innerHTML = "<div class='rank-item' style='font-size:10px; color: #ff3f62;'>데이터를 불러올 수 없습니다.</div>";
        }
    }

    async function saveGameData(username, successSeconds) {
        if (!SCRIPT_URL) return;
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    successTime: successSeconds
                }),
            });
        } catch (error) {
            console.error("Save error:", error);
        }
    }

    function updateScore() {
        const scoreEl = document.getElementById('score');
        const linesEl = document.getElementById('lines-count');
        const levelEl = document.getElementById('level');
        const timeEl = document.getElementById('time');

        if (scoreEl) scoreEl.innerText = score;
        if (linesEl) linesEl.innerText = lines;
        if (levelEl) levelEl.innerText = level;
        
        const seconds = Math.floor(totalTime / 1000);
        if (timeEl) timeEl.innerText = `${seconds}s`;
    }

    function showOverlay(title) {
        const overlay = document.getElementById('overlay');
        const titleEl = document.getElementById('overlayTitle');
        const nameInputGroup = document.getElementById('nameInputGroup');
        const startBtn = document.getElementById('startBtn');
        const saveBtn = document.getElementById('saveRecordBtn');
        const mainBtn = document.getElementById('mainMenuBtn');

        if (!overlay || !titleEl) return;

        overlay.classList.remove('hidden');
        titleEl.innerText = title;

        if (title === 'GLASS TETRIS') {
            if (nameInputGroup) nameInputGroup.style.display = 'block';
            if (startBtn) startBtn.innerText = 'START GAME';
            if (saveBtn) saveBtn.style.display = 'none';
            if (mainBtn) mainBtn.style.display = 'none';
            fetchTop3(); 
        } else {
            if (nameInputGroup) nameInputGroup.style.display = 'none';
            if (startBtn) startBtn.innerText = 'RESTART';
            if (saveBtn) {
                saveBtn.style.display = 'block';
                saveBtn.disabled = false;
                saveBtn.innerText = 'SAVE RECORD';
            }
            if (mainBtn) mainBtn.style.display = 'block';
        }
        
        if (title === 'GAME OVER' || title === 'GOAL REACHED!') {
            fetchTop3(); 
            const timeVal = document.getElementById('time')?.innerText || '0s';
            titleEl.innerHTML = `${title}<br><span style="font-size: 16px; opacity: 0.6; letter-spacing: 1px;">MISSION TIME - ${timeVal}</span>`;
            
            const high = localStorage.getItem('tetrisHighScore') || 0;
            if (score > high) localStorage.setItem('tetrisHighScore', score);
            const highEl = document.getElementById('highScore');
            if (highEl) highEl.innerText = localStorage.getItem('tetrisHighScore') || score;
            document.getElementById('highScoreText')?.classList.remove('hidden');
        }
    }

    function startGame() {
        const nameInput = document.getElementById('username');
        const playerNameEl = document.getElementById('player-name-display');
        const playerName = nameInput?.value.trim() || 'Guest';
        if (playerNameEl) playerNameEl.innerText = playerName;
        
        if (nameInput?.parentElement) nameInput.parentElement.style.display = 'none';

        board = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
        score = 0;
        lines = 0;
        level = 1;
        dropInterval = 1000;
        gameOver = false;
        paused = false;
        nextPiece = null;
        startTime = Date.now();
        totalTime = 0;
        resetPlayer();
        updateScore();
        document.getElementById('overlay')?.classList.add('hidden');
        document.getElementById('highScoreText')?.classList.add('hidden');
        lastTime = performance.now();
        requestAnimationFrame(update);
    }

    let animationId;
    function update(time = 0) {
        if (paused) return;
        const deltaTime = time - lastTime;
        lastTime = time;
        
        totalTime += deltaTime;
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
        updateScore();
        draw();
        animationId = requestAnimationFrame(update);
    }

    const handleKeyDown = (event) => {
        if (gameOver) return;
        if (event.key === 'p' || event.key === 'P') {
            paused = !paused;
            const pauseBtn = document.getElementById('pauseBtn');
            if (!paused) {
                document.getElementById('overlay')?.classList.add('hidden');
                lastTime = performance.now();
                requestAnimationFrame(update);
                if (pauseBtn) pauseBtn.innerText = 'PAUSE';
            } else {
                showOverlay('PAUSED');
                if (pauseBtn) pauseBtn.innerText = 'RESUME';
            }
            return;
        }
        if (paused) return;

        if (event.keyCode === 37) { // Left
            player.piece.pos.x--;
            if (collide(board, player.piece)) player.piece.pos.x++;
        } else if (event.keyCode === 39) { // Right
            player.piece.pos.x++;
            if (collide(board, player.piece)) player.piece.pos.x--;
        } else if (event.keyCode === 40) { // Down
            playerDrop();
        } else if (event.keyCode === 38) { // Up
            const pos = player.piece.pos.x;
            rotatePiece(player.piece.shape);
            let offset = 1;
            while (collide(board, player.piece)) {
                player.piece.pos.x += offset;
                offset = -(offset + (offset > 0 ? 1 : -1));
                if (offset > player.piece.shape[0].length) {
                    rotatePiece(player.piece.shape); 
                    player.piece.pos.x = pos;
                    break;
                }
            }
        } else if (event.keyCode === 32) { // Space
            while (!collide(board, player.piece)) player.piece.pos.y++;
            player.piece.pos.y--;
            merge();
            resetPlayer();
            clearLines();
            updateScore();
            dropCounter = 0;
        }
        draw();
    };

    const handleStartClick = () => {
        if (gameOver) startGame();
        else if (paused && player.piece) {
            paused = false;
            document.getElementById('overlay')?.classList.add('hidden');
            lastTime = performance.now();
            requestAnimationFrame(update);
        } else {
            startGame();
        }
    };

    const handlePauseClick = () => {
        if (gameOver) return;
        paused = !paused;
        const pauseBtn = document.getElementById('pauseBtn');
        if (!paused) {
            document.getElementById('overlay')?.classList.add('hidden');
            lastTime = performance.now();
            requestAnimationFrame(update);
            if (pauseBtn) pauseBtn.innerText = 'PAUSE';
        } else {
            showOverlay('PAUSED');
            if (pauseBtn) pauseBtn.innerText = 'RESUME';
        }
    };

    const handleResetClick = () => {
        paused = true;
        showOverlay('GLASS TETRIS');
        const pauseBtn = document.getElementById('pauseBtn');
        if (pauseBtn) pauseBtn.innerText = 'PAUSE';
    };

    const handleSaveClick = () => {
        const finalSeconds = Math.floor(totalTime / 1000);
        const nameDisplay = document.getElementById('player-name-display');
        const playerName = nameDisplay?.innerText || 'Guest';
        const saveBtn = document.getElementById('saveRecordBtn');
        
        if (saveBtn) saveBtn.innerText = "SAVING...";
        saveGameData(playerName, finalSeconds).then(() => {
            if (saveBtn) {
                saveBtn.innerText = "SAVED!";
                saveBtn.disabled = true;
            }
            fetchTop3();
        });
    };

    const handleMainMenuClick = () => {
        paused = true;
        showOverlay('GLASS TETRIS');
    };

    // Event Listeners
    document.addEventListener('keydown', handleKeyDown);
    document.getElementById('startBtn')?.addEventListener('click', handleStartClick);
    document.getElementById('pauseBtn')?.addEventListener('click', handlePauseClick);
    document.getElementById('resetBtn')?.addEventListener('click', handleResetClick);
    document.getElementById('saveRecordBtn')?.addEventListener('click', handleSaveClick);
    document.getElementById('mainMenuBtn')?.addEventListener('click', handleMainMenuClick);

    // Initial draw
    draw();
    showOverlay('GLASS TETRIS');

    return () => {
        document.removeEventListener('keydown', handleKeyDown);
        cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <>
      <div className="background-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <main className="game-container">
        <div className="glass-sidebar left">
          <div className="stat-card">
            <h3>PLAYER</h3>
            <div id="player-name-display" className="stat-value" style={{ fontSize: '20px' }}>Guest</div>
          </div>
          <div className="stat-card">
            <h3>GOAL</h3>
            <div className="stat-value"><span id="lines-count">0</span>/3</div>
          </div>
          <div className="stat-card">
            <h3>SCORE</h3>
            <div id="score" className="stat-value">0</div>
          </div>
          <div className="stat-card">
            <h3>TIME</h3>
            <div id="time" className="stat-value">00:00</div>
          </div>
          <div className="stat-card">
            <h3>LEVEL</h3>
            <div id="level" className="stat-value">1</div>
          </div>
          <div className="stat-card actions-card">
            <h3>ACTIONS</h3>
            <div className="action-buttons">
              <button id="pauseBtn" className="action-btn">PAUSE</button>
              <button id="resetBtn" className="action-btn restart">RESET</button>
            </div>
          </div>
        </div>

        <div className="game-board-container">
          <canvas id="gameBoard"></canvas>
          <div id="overlay" className="overlay">
            <div className="overlay-content">
              <h2 id="overlayTitle">GLASS TETRIS</h2>
              <div id="nameInputGroup" className="input-group">
                <input type="text" id="username" placeholder="NAME" maxLength={10} />
              </div>
              
              <div className="overlay-buttons">
                <button id="saveRecordBtn" className="overlay-btn save-btn">SAVE RECORD</button>
                <button id="startBtn" className="overlay-btn">START GAME</button>
                <button id="mainMenuBtn" className="overlay-btn main-btn">MAIN MENU</button>
              </div>
              
              <p id="highScoreText" className="hidden">High Score: <span id="highScore">0</span></p>
              
              <div id="leaderboard" className="leaderboard">
                <h4>TOP 3</h4>
                <div id="top3-list">Loading...</div>
              </div>
            </div>
            <div className="credits">
              AI코딩을활용한창의적앱개발 경제학과 원태희
            </div>
          </div>
        </div>

        <div className="glass-sidebar right">
          <div className="stat-card next-piece-card">
            <h3>NEXT</h3>
            <div className="next-preview-container">
              <canvas id="nextCanvas"></canvas>
            </div>
          </div>
          <div className="controls-guide">
            <h3>CONTROLS</h3>
            <div className="control-item"><span>← →</span> Move</div>
            <div className="control-item"><span>↑</span> Rotate</div>
            <div className="control-item"><span>↓</span> Soft Drop</div>
            <div className="control-item"><span>Space</span> Hard Drop</div>
            <div className="control-item"><span>P</span> Pause</div>
          </div>
        </div>
      </main>
    </>
  );
}

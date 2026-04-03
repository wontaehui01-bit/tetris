const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 35;

// GOOGLE SHEETS SETTINGS
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx9VkzQ97kHw_OJ50mSxsGwtOxBmFabg421OUvFudzpnzSfIzIlDL1-RSOtsz-VB48m/exec";

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
        const finalTime = document.getElementById('time').innerText;
        const playerName = document.getElementById('player-name-display').innerText;
        
        showOverlay('GAME OVER');
        // saveGameData(playerName, finalTime).then(() => {
        //     fetchTop3(); // Auto-save disabled as per button request
        // });
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
        
        if (lines >= 3) {
            gameOver = true;
            paused = true;
            const finalTime = document.getElementById('time').innerText;
            const playerName = document.getElementById('player-name-display').innerText;
            
            showOverlay('GOAL REACHED!');
            // saveGameData(playerName, finalTime).then(() => {
            //     fetchTop3(); // Auto-save disabled as per button request
            // });
        }
    }
}

async function fetchTop3() {
    const list = document.getElementById('top3-list');
    
    if (!SCRIPT_URL || SCRIPT_URL.includes("여기에")) {
        list.innerHTML = "<div class='rank-item' style='font-size:10px; opacity:0.6;'>URL을 설정하면<br>랭킹이 표시됩니다.</div>";
        return;
    }
    
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        list.innerHTML = "";
        
        // Filter out corrupted legacy data (ISO strings or impossibly large numbers)
        const validData = data.filter(player => {
            const t = player.time;
            if (typeof t === 'string' && t.includes('T')) return false;
            const sec = parseInt(t, 10);
            return !isNaN(sec) && sec > 0 && sec < 1000;
        });
        
        if (validData.length === 0) {
            list.innerHTML = "<div class='rank-item'>Be the first!</div>";
        } else {
            validData.forEach((player, i) => {
                const timeValue = parseInt(player.time, 10) || 0;
                list.innerHTML += `<div class='rank-item'><span>${i+1}. ${player.name}</span> <span>${timeValue}s</span></div>`;
            });
        }
    } catch (e) {
        console.error("Rank fetch error:", e);
        list.innerHTML = "<div class='rank-item' style='font-size:10px; color: #ff3f62;'>데이터를 불러올 수 없습니다.<br>(URL 혹은 권한 확인)</div>";
    }
}

async function saveGameData(username, successSeconds) {
    if (!SCRIPT_URL || SCRIPT_URL.includes("여기에")) {
        console.log("Google Sheets URL not set.");
        return;
    }
    
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                successTime: successSeconds // Number of seconds
            }),
        });
    } catch (error) {
        console.error("Save error:", error);
    }
}

function updateScore() {
    document.getElementById('score').innerText = score;
    document.getElementById('lines-count').innerText = lines;
    document.getElementById('level').innerText = level;
    
    // Format timer to only show total seconds
    const seconds = Math.floor(totalTime / 1000);
    document.getElementById('time').innerText = `${seconds}s`;
}

function showOverlay(title) {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('overlayTitle').innerText = title;
    
    const nameInput = document.getElementById('username');
    const startBtn = document.getElementById('startBtn');
    const saveBtn = document.getElementById('saveRecordBtn');
    const mainBtn = document.getElementById('mainMenuBtn');

    if (title === 'GLASS TETRIS') {
        document.getElementById('nameInputGroup').style.display = 'block';
        startBtn.innerText = 'START GAME';
        saveBtn.style.display = 'none';
        mainBtn.style.display = 'none';
        fetchTop3(); 
    } else {
        document.getElementById('nameInputGroup').style.display = 'none';
        startBtn.innerText = 'RESTART';
        saveBtn.style.display = 'block';
        saveBtn.disabled = false; // Reset for new game
        mainBtn.style.display = 'block';
    }
    
    if (title === 'GAME OVER' || title === 'GOAL REACHED!') {
        fetchTop3(); 
        const m = document.getElementById('time').innerText;
        document.getElementById('overlayTitle').innerHTML = `${title}<br><span style="font-size: 16px; opacity: 0.6; letter-spacing: 1px;">MISSION TIME - ${m}</span>`;
        
        const high = localStorage.getItem('tetrisHighScore') || 0;
        if (score > high) localStorage.setItem('tetrisHighScore', score);
        document.getElementById('highScore').innerText = localStorage.getItem('tetrisHighScore') || score;
        document.getElementById('highScoreText').classList.remove('hidden');
    }
}

function startGame() {
    const nameInput = document.getElementById('username');
    const playerName = nameInput.value.trim() || 'Guest';
    document.getElementById('player-name-display').innerText = playerName;
    
    // Hide name input container during gameplay
    nameInput.parentElement.style.display = 'none';

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
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('highScoreText').classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(update);
}

function update(time = 0) {
    if (paused) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    
    // Update timer (only when not paused)
    totalTime += deltaTime;
    
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    updateScore();
    draw();
    requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
    if (gameOver) return;
    if (event.key === 'p' || event.key === 'P') {
        paused = !paused;
        if (!paused) {
            document.getElementById('overlay').classList.add('hidden');
            lastTime = performance.now();
            requestAnimationFrame(update);
            document.getElementById('pauseBtn').innerText = 'PAUSE';
        } else {
            showOverlay('PAUSED');
            document.getElementById('pauseBtn').innerText = 'RESUME';
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
                rotatePiece(player.piece.shape); // Rotate back
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
});

document.getElementById('startBtn').addEventListener('click', () => {
    if (gameOver) startGame();
    else if (paused && player.piece) {
        paused = false;
        document.getElementById('overlay').classList.add('hidden');
        lastTime = performance.now();
        requestAnimationFrame(update);
    } else {
        startGame();
    }
});

// Sidebar Buttons
document.getElementById('pauseBtn').addEventListener('click', () => {
    if (gameOver) return;
    paused = !paused;
    if (!paused) {
        document.getElementById('overlay').classList.add('hidden');
        lastTime = performance.now();
        requestAnimationFrame(update);
        document.getElementById('pauseBtn').innerText = 'PAUSE';
    } else {
        showOverlay('PAUSED');
        document.getElementById('pauseBtn').innerText = 'RESUME';
    }
});

document.getElementById('resetBtn').addEventListener('click', () => {
    paused = true;
    showOverlay('GLASS TETRIS');
    document.getElementById('pauseBtn').innerText = 'PAUSE';
});

// Overlay Action Buttons
document.getElementById('saveRecordBtn').addEventListener('click', () => {
    const finalSeconds = Math.floor(totalTime / 1000);
    const playerName = document.getElementById('player-name-display').innerText;
    const saveBtn = document.getElementById('saveRecordBtn');
    
    saveBtn.innerText = "SAVING...";
    saveGameData(playerName, finalSeconds).then(() => {
        saveBtn.innerText = "SAVED!";
        saveBtn.disabled = true;
        fetchTop3();
    });
});

document.getElementById('mainMenuBtn').addEventListener('click', () => {
    paused = true;
    showOverlay('GLASS TETRIS');
});

// Initial draw of the empty grid
draw();

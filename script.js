/**
 * BlockBlast 破解器 (8x8 + 視覺化回放 + 續解功能 + 5x5 方塊 + 拖動選取)
 */

// --- 配置參數 ---
const BOARD_SIZE = 8;
const PIECE_GRID_ROWS = 5; // 行 (長度/高度)
const PIECE_GRID_COLS = 5; // 列 (寬度)

// --- 狀態管理 ---
let boardGrid = createGrid(BOARD_SIZE);
let availablePieces = [
    createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS),
    createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS),
    createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS)
];

// --- 續解狀態 ---
let lastSolvedBoard = null;

// --- 拖動選取狀態 ---
let isDragging = false;
let dragMode = null; // 'fill' or 'clear'
let dragTarget = null; // 'board' or 'piece'
let dragPieceIndex = null;

// --- DOM 元素 ---
const boardEl = document.getElementById('board');
const piecesListEl = document.getElementById('pieces-list');
const outputLogEl = document.getElementById('output-log');
const btnContinue = document.getElementById('continue-button');
const playbackControls = document.getElementById('playback-controls');
const stepIndicator = document.getElementById('step-indicator');
const btnPrev = document.getElementById('prev-step');
const btnNext = document.getElementById('next-step');

// --- 輔助函數 ---
function createGrid(size) {
    // 用於創建方格棋盤 (8x8)
    return Array.from({ length: size }, () => Array(size).fill(false));
}

function createPieceGrid(rows, cols) {
    // 用於創建備用方塊網格 (5x5)
    return Array.from({ length: rows }, () => Array(cols).fill(false));
}

// ==========================================
// 1. 初始化與 UI 渲染
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    renderBoard(boardGrid);
    renderPieces();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('reset-button').addEventListener('click', resetAll);
    document.getElementById('solve-button').addEventListener('click', handleSolve);
    btnContinue.addEventListener('click', useLastResult);
    
    // 棋盤拖動事件
    boardEl.addEventListener('mousedown', handleBoardMouseDown);
    boardEl.addEventListener('mousemove', handleBoardMouseMove);
    boardEl.addEventListener('mouseup', handleDragEnd);
    boardEl.addEventListener('mouseleave', handleDragEnd);
    
    boardEl.addEventListener('touchstart', handleBoardTouchStart, { passive: false });
    boardEl.addEventListener('touchmove', handleBoardTouchMove, { passive: false });
    boardEl.addEventListener('touchend', handleDragEnd);
    
    // 方塊網格拖動事件
    piecesListEl.addEventListener('mousedown', handlePieceMouseDown);
    piecesListEl.addEventListener('mousemove', handlePieceMouseMove);
    piecesListEl.addEventListener('mouseup', handleDragEnd);
    piecesListEl.addEventListener('mouseleave', handleDragEnd);
    
    piecesListEl.addEventListener('touchstart', handlePieceTouchStart, { passive: false });
    piecesListEl.addEventListener('touchmove', handlePieceTouchMove, { passive: false });
    piecesListEl.addEventListener('touchend', handleDragEnd);
    
    btnPrev.addEventListener('click', () => PlaybackManager.prevStep());
    btnNext.addEventListener('click', () => PlaybackManager.nextStep());
}

function renderBoard(grid, previewMove = null) {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;

    grid.forEach((row, r) => {
        row.forEach((isFilled, c) => {
            const cell = document.createElement('div');
            let className = 'cell';
            if (isFilled) className += ' filled';
            if (previewMove && isCoordInShape(r, c, previewMove)) className += ' preview';
            cell.className = className;
            cell.dataset.row = r;
            cell.dataset.col = c;
            boardEl.appendChild(cell);
        });
    });
}

function isCoordInShape(r, c, moveData) {
    if (!moveData) return false;
    const { shape, row, col } = moveData;
    return shape.some(([dr, dc]) => (row + dr) === r && (col + dc) === c);
}

function renderPieces() {
    piecesListEl.innerHTML = '';
    availablePieces.forEach((pieceGrid, index) => {
        const container = document.createElement('div');
        container.className = 'piece-input-grid';
        container.dataset.pieceIndex = index;
        container.style.gridTemplateColumns = `repeat(${PIECE_GRID_COLS}, 1fr)`;

        pieceGrid.forEach((row, r) => {
            row.forEach((isFilled, c) => {
                const cell = document.createElement('div');
                cell.className = `piece-input-cell ${isFilled ? 'filled' : ''}`;
                cell.dataset.row = r;
                cell.dataset.col = c;
                container.appendChild(cell);
            });
        });
        piecesListEl.appendChild(container);
    });
}

// ==========================================
// 2. 拖動選取邏輯 (Drag Selection)
// ==========================================

// 棋盤拖動 - 鼠標
function handleBoardMouseDown(e) {
    if (PlaybackManager.isActive) PlaybackManager.stop();
    const cell = e.target.closest('.cell');
    if (!cell) return;
    
    e.preventDefault();
    isDragging = true;
    dragTarget = 'board';
    
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    
    dragMode = boardGrid[r][c] ? 'clear' : 'fill';
    applyBoardDrag(r, c);
}

function handleBoardMouseMove(e) {
    if (!isDragging || dragTarget !== 'board') return;
    
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cell');
    if (!cell) return;
    
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    applyBoardDrag(r, c);
}

// 棋盤拖動 - 觸控
function handleBoardTouchStart(e) {
    if (PlaybackManager.isActive) PlaybackManager.stop();
    const touch = e.touches[0];
    const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.cell');
    if (!cell) return;
    
    e.preventDefault();
    isDragging = true;
    dragTarget = 'board';
    
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    
    dragMode = boardGrid[r][c] ? 'clear' : 'fill';
    applyBoardDrag(r, c);
}

function handleBoardTouchMove(e) {
    if (!isDragging || dragTarget !== 'board') return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.cell');
    if (!cell) return;
    
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    applyBoardDrag(r, c);
}

function applyBoardDrag(r, c) {
    const shouldFill = dragMode === 'fill';
    if (boardGrid[r][c] !== shouldFill) {
        boardGrid[r][c] = shouldFill;
        const cell = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        if (cell) {
            if (shouldFill) {
                cell.classList.add('filled');
            } else {
                cell.classList.remove('filled');
            }
        }
    }
}

// 方塊網格拖動 - 鼠標
function handlePieceMouseDown(e) {
    if (PlaybackManager.isActive) PlaybackManager.stop();
    const cell = e.target.closest('.piece-input-cell');
    if (!cell) return;
    
    e.preventDefault();
    isDragging = true;
    dragTarget = 'piece';
    
    const container = cell.closest('.piece-input-grid');
    dragPieceIndex = +container.dataset.pieceIndex;
    
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    
    if (r >= PIECE_GRID_ROWS || c >= PIECE_GRID_COLS) return;
    
    dragMode = availablePieces[dragPieceIndex][r][c] ? 'clear' : 'fill';
    applyPieceDrag(dragPieceIndex, r, c);
}

function handlePieceMouseMove(e) {
    if (!isDragging || dragTarget !== 'piece') return;
    
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.piece-input-cell');
    if (!cell) return;
    
    const container = cell.closest('.piece-input-grid');
    const pIndex = +container.dataset.pieceIndex;
    
    if (pIndex !== dragPieceIndex) return;
    
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    
    if (r >= PIECE_GRID_ROWS || c >= PIECE_GRID_COLS) return;
    
    applyPieceDrag(pIndex, r, c);
}

// 方塊網格拖動 - 觸控
function handlePieceTouchStart(e) {
    if (PlaybackManager.isActive) PlaybackManager.stop();
    const touch = e.touches[0];
    const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.piece-input-cell');
    if (!cell) return;
    
    e.preventDefault();
    isDragging = true;
    dragTarget = 'piece';
    
    const container = cell.closest('.piece-input-grid');
    dragPieceIndex = +container.dataset.pieceIndex;
    
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    
    if (r >= PIECE_GRID_ROWS || c >= PIECE_GRID_COLS) return;
    
    dragMode = availablePieces[dragPieceIndex][r][c] ? 'clear' : 'fill';
    applyPieceDrag(dragPieceIndex, r, c);
}

function handlePieceTouchMove(e) {
    if (!isDragging || dragTarget !== 'piece') return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const cell = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.piece-input-cell');
    if (!cell) return;
    
    const container = cell.closest('.piece-input-grid');
    const pIndex = +container.dataset.pieceIndex;
    
    if (pIndex !== dragPieceIndex) return;
    
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    
    if (r >= PIECE_GRID_ROWS || c >= PIECE_GRID_COLS) return;
    
    applyPieceDrag(pIndex, r, c);
}

function applyPieceDrag(pIndex, r, c) {
    const shouldFill = dragMode === 'fill';
    if (availablePieces[pIndex][r][c] !== shouldFill) {
        availablePieces[pIndex][r][c] = shouldFill;
        const container = piecesListEl.querySelector(`[data-piece-index="${pIndex}"]`);
        const cell = container?.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        if (cell) {
            if (shouldFill) {
                cell.classList.add('filled');
            } else {
                cell.classList.remove('filled');
            }
        }
    }
}

// 結束拖動
function handleDragEnd() {
    isDragging = false;
    dragMode = null;
    dragTarget = null;
    dragPieceIndex = null;
}

// ==========================================
// 3. 重置與續解功能
// ==========================================

function resetAll() {
    PlaybackManager.stop();
    boardGrid = createGrid(BOARD_SIZE);
    availablePieces = [
        createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS),
        createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS),
        createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS)
    ];
    lastSolvedBoard = null;
    btnContinue.disabled = true;
    renderBoard(boardGrid);
    renderPieces();
    outputLogEl.textContent = "已重置。";
}

function useLastResult() {
    if (!lastSolvedBoard) {
        outputLogEl.textContent = "❌ 無法沿用：上一次破解沒有成功，或尚未進行破解。";
        return;
    }
    
    boardGrid = lastSolvedBoard.map(row => [...row]);
    availablePieces = [
        createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS),
        createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS),
        createPieceGrid(PIECE_GRID_ROWS, PIECE_GRID_COLS)
    ];
    
    PlaybackManager.stop();
    renderBoard(boardGrid);
    renderPieces();
    
    lastSolvedBoard = null;
    btnContinue.disabled = true;
    
    outputLogEl.textContent = "✅ 已沿用最終棋盤！請在右側繪製新方塊並再次破解。";
}

// ==========================================
// 4. 回放管理器 (Playback System)
// ==========================================
const PlaybackManager = {
    isActive: false,
    steps: [],
    currentStepIndex: 0,

    init: function(initialBoard, solverSolution, availablePiecesData) {
        this.isActive = true;
        this.currentStepIndex = 0;
        this.steps = [];

        let currentBoardSim = initialBoard.map(row => [...row]);
        
        solverSolution.moves.forEach((move) => {
            const pieceGrid = availablePiecesData[move.pieceIndex];
            const shape = BlockBlastSolver.parsePieceShape(pieceGrid);

            this.steps.push({
                board: currentBoardSim.map(row => [...row]),
                preview: { shape, row: move.row, col: move.col, pieceIndex: move.pieceIndex },
                description: `放置方塊 ${move.pieceIndex + 1}`
            });

            const result = BlockBlastSolver.applyMove(currentBoardSim, shape, move.row, move.col);
            currentBoardSim = result.newBoard;
        });

        this.steps.push({
            board: currentBoardSim,
            preview: null,
            description: "完成"
        });
        
        lastSolvedBoard = currentBoardSim.map(row => [...row]); 

        playbackControls.classList.remove('hidden');
        this.updateUI();
    },

    stop: function() {
        this.isActive = false;
        playbackControls.classList.add('hidden');
        document.querySelectorAll('.piece-input-grid').forEach(el => el.classList.remove('active-preview'));
        renderBoard(boardGrid);
    },

    nextStep: function() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            this.updateUI();
        }
    },

    prevStep: function() {
        if (this.currentStepIndex > 0) {
            this.currentStepIndex--;
            this.updateUI();
        }
    },

    updateUI: function() {
        const stepData = this.steps[this.currentStepIndex];
        const totalSteps = this.steps.length - 1; 

        renderBoard(stepData.board, stepData.preview);

        if (this.currentStepIndex === totalSteps) {
            stepIndicator.textContent = `🎉 完成`;
            btnContinue.disabled = false;
        } else {
            stepIndicator.textContent = `步驟 ${this.currentStepIndex + 1} / ${totalSteps}`;
            btnContinue.disabled = true;
        }

        btnPrev.disabled = this.currentStepIndex === 0;
        btnNext.disabled = this.currentStepIndex === totalSteps;
        
        document.querySelectorAll('.piece-input-grid').forEach(el => el.classList.remove('active-preview'));
        if (stepData.preview) {
             const activePieceEl = document.querySelector(`.piece-input-grid[data-piece-index='${stepData.preview.pieceIndex}']`);
             if (activePieceEl) activePieceEl.classList.add('active-preview');
        }
    }
};

// ==========================================
// 5. AI 核心演算法 (Solver)
// ==========================================

const BlockBlastSolver = {
    WEIGHTS: {
        LINES_CLEARED: 100, 
        EMPTY_CELL: 2,      
        HOLE_PENALTY: -5    
    },

    solve: function(board, pieces) {
        const activePieces = pieces
            .map((p, index) => ({ shape: this.parsePieceShape(p), originalIndex: index }))
            .filter(p => p.shape.length > 0);

        if (activePieces.length === 0) return { moves: [], score: 0 };
        return this.search(board, activePieces, [], 0);
    },

    search: function(currentBoard, remainingPieces, currentMoves, currentScore) {
        if (remainingPieces.length === 0) {
            return { moves: [...currentMoves], score: currentScore + this.evaluateBoard(currentBoard) };
        }

        let bestSolution = { moves: [], score: -Infinity };
        let canPlaceAny = false;

        for (let i = 0; i < remainingPieces.length; i++) {
            const pieceObj = remainingPieces[i];
            const otherPieces = remainingPieces.filter((_, idx) => idx !== i);
            const validPlacements = this.getValidPlacements(currentBoard, pieceObj.shape);

            for (const placement of validPlacements) {
                canPlaceAny = true;
                const { newBoard, linesCleared } = this.applyMove(currentBoard, pieceObj.shape, placement.r, placement.c);
                const moveScore = (linesCleared * this.WEIGHTS.LINES_CLEARED);
                const record = { pieceIndex: pieceObj.originalIndex, row: placement.r, col: placement.c, linesCleared };
                
                const result = this.search(newBoard, otherPieces, [...currentMoves, record], currentScore + moveScore);

                if (result.score > bestSolution.score) {
                    bestSolution = result;
                }
            }
        }

        if (!canPlaceAny && remainingPieces.length > 0) return { moves: [], score: -999999 };
        return bestSolution;
    },

    getValidPlacements: function(board, shapeCoords) {
        const moves = [];
        const size = board.length;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (this.canPlace(board, shapeCoords, r, c)) moves.push({ r, c });
            }
        }
        return moves;
    },

    canPlace: function(board, shapeCoords, startR, startC) {
        const size = board.length;
        for (const [dr, dc] of shapeCoords) {
            const nr = startR + dr;
            const nc = startC + dc;
            if (nr < 0 || nr >= size || nc < 0 || nc >= size) return false;
            if (board[nr][nc]) return false;
        }
        return true;
    },

    applyMove: function(board, shapeCoords, startR, startC) {
        const newBoard = board.map(row => [...row]);
        const size = newBoard.length;

        for (const [dr, dc] of shapeCoords) newBoard[startR + dr][startC + dc] = true;

        const rows = new Set(), cols = new Set();
        for (let r = 0; r < size; r++) if (newBoard[r].every(c => c)) rows.add(r);
        for (let c = 0; c < size; c++) if (newBoard.every(row => row[c])) cols.add(c);

        const linesCleared = rows.size + cols.size;
        if (linesCleared > 0) {
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (rows.has(r) || cols.has(c)) newBoard[r][c] = false;
                }
            }
        }
        return { newBoard, linesCleared };
    },

    evaluateBoard: function(board) {
        let emptyCount = 0;
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board[0].length; c++) {
                if (!board[r][c]) emptyCount++;
            }
        }
        return emptyCount * this.WEIGHTS.EMPTY_CELL;
    },

    parsePieceShape: function(grid) {
        const coords = [];
        for (let r = 0; r < PIECE_GRID_ROWS; r++) {
            for (let c = 0; c < PIECE_GRID_COLS; c++) {
                if (grid[r][c]) coords.push([r, c]);
            }
        }
        if (coords.length === 0) return [];
        const minR = Math.min(...coords.map(p => p[0]));
        const minC = Math.min(...coords.map(p => p[1]));
        return coords.map(([r, c]) => [r - minR, c - minC]);
    }
};

// ==========================================
// 6. 執行入口與主題設定
// ==========================================

function handleSolve() {
    PlaybackManager.stop();
    
    const currentBoard = boardGrid.map(row => [...row]);
    const piecesData = availablePieces.map(grid => grid.map(row => [...row]));

    outputLogEl.textContent = "🤔 正在計算最佳路徑...";

    setTimeout(() => {
        const start = performance.now();
        const solution = BlockBlastSolver.solve(currentBoard, piecesData);
        const time = (performance.now() - start).toFixed(2);

        if (solution.score < -900000) {
            outputLogEl.textContent = `❌ 無解！這些方塊無法全部放入。\n耗時: ${time}ms`;
            return;
        }
        
        if (solution.moves.length === 0) {
             outputLogEl.textContent = "請先在下方繪製至少一個方塊！";
             return;
        }

        let log = `✅ 找到最佳解 (分數: ${solution.score}, 耗時: ${time}ms)\n`;
        log += `👇 請使用上方按鈕檢視步驟 👇\n\n`;
        
        solution.moves.forEach((m, i) => {
            log += `#${i + 1}: 方塊 ${m.pieceIndex + 1}`;
            if (m.linesCleared) log += ` 🔥消除 ${m.linesCleared} 行`;
            log += `\n`;
        });
        
        outputLogEl.textContent = log;

        PlaybackManager.init(currentBoard, solution, piecesData);

    }, 50);
}

function initializeTheme() {
    const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-toggle').textContent = theme === 'light' ? '🌙 黑暗模式' : '☀️ 明亮模式';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-toggle').textContent = next === 'light' ? '🌙 黑暗模式' : '☀️ 明亮模式';
}
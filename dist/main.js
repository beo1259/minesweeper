import { Cell } from "./models/cell.js";
import { CellState } from "./models/cell-states.js";
import { BoardDimensions } from "./models/board-dimensions.js";
let board = [];
let previousBoardState = [];
let boardDimensions = new BoardDimensions(16, 16); // default to medium board
let isGameLost = false;
let isGameWon = false;
let isFirtClick = true;
let curHoveredCellDataset = null;
let currentlyXrayedCell = [];
var Difficulty;
(function (Difficulty) {
    Difficulty["Easy"] = "easy";
    Difficulty["Medium"] = "medium";
    Difficulty["Expert"] = "expert";
})(Difficulty || (Difficulty = {}));
const difficultyToDimensionsMap = new Map([
    [Difficulty.Easy, new BoardDimensions(9, 9)],
    [Difficulty.Medium, new BoardDimensions(16, 16)],
    [Difficulty.Expert, new BoardDimensions(30, 16)],
]);
const mineCountMap = new Map([
    [Difficulty.Easy, 10],
    [Difficulty.Medium, 40],
    [Difficulty.Expert, 99],
]);
window.onload = () => handleNewGame(getStoredDifficulty() ?? 'medium');
document.getElementById('easy-btn').addEventListener('click', () => handleNewGame('easy'));
document.getElementById('medium-btn').addEventListener('click', () => handleNewGame('medium'));
document.getElementById('expert-btn').addEventListener('click', () => handleNewGame('expert'));
document.getElementById('continue-btn').addEventListener('click', () => handleContinueGame());
const zoomSlider = document.getElementById('zoom-slider');
zoomSlider.oninput = () => {
    setZoom(zoomSlider.value);
};
document.addEventListener('keydown', (e) => {
    if (!shouldProcessInput())
        return;
    const hoveredRowAndColumn = getHoveredRowAndColumn();
    const k = e.key.toLowerCase();
    if (k === "f")
        handleOpenCellMain(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (k === "g")
        handleCellSecondary(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});
document.addEventListener('keyup', (e) => {
    if (e.key === " ") {
        startGame();
        return;
    }
    if (!shouldProcessInput())
        return;
    const hoveredRowAndColumn = getHoveredRowAndColumn();
    const k = e.key.toLowerCase();
    if (k === "f")
        handleCellMain(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});
document.addEventListener('mousedown', (e) => {
    if (!shouldProcessInput())
        return;
    const hoveredRowAndColumn = getHoveredRowAndColumn();
    if (e.button === 0)
        handleOpenCellMain(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (e.button === 2)
        handleCellSecondary(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});
document.addEventListener('mouseup', (e) => {
    if (!shouldProcessInput())
        return;
    const hoveredRowAndColumn = getHoveredRowAndColumn();
    if (e.button === 0)
        handleCellMain(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});
function getHoveredRowAndColumn() {
    return [parseInt(curHoveredCellDataset.row), parseInt(curHoveredCellDataset.col)];
}
function shouldProcessInput() {
    return !isGameLost && !isGameWon && curHoveredCellDataset?.row && curHoveredCellDataset?.col;
}
function handleNewGame(difficulty) {
    setZoom(getStoredZoom() ?? "50");
    localStorage.setItem('difficulty', difficulty);
    resetDifficultyUnderlines();
    document.getElementById(`${difficulty}-btn`).classList.add("soft-underline");
    boardDimensions = difficultyToDimensionsMap.get(difficulty);
    startGame();
}
function setZoom(strValue) {
    localStorage.setItem('zoom', strValue);
    const intValue = parseInt(strValue);
    document.getElementById('main-content').style.transform = `scale(${intValue / 50})`;
    zoomSlider.value = strValue;
    const zoomSliderDisplayValue = document.getElementById('zoom-slider-value');
    zoomSliderDisplayValue.textContent = `${strValue}%`;
}
function resetDifficultyUnderlines() {
    Object.values(Difficulty).forEach(d => {
        const difficultyBtn = document.getElementById(`${d}-btn`);
        difficultyBtn.classList.remove("soft-underline");
    });
}
function startGame() {
    isGameLost = false;
    isGameWon = false;
    isFirtClick = true;
    document.getElementById('game-state-msg').innerHTML = '';
    document.getElementById('continue-btn').style.display = 'none';
    initEmptyBoard();
}
function handleOpenCellMain(r, c) {
    const cell = board[r][c];
    if (!cell.isOpen) {
        return;
    }
    xrayNeighbours(r, c);
}
function xrayNeighbours(r, c) {
    if (currentlyXrayedCell.length === 2) {
        hidePreviouslyXrayedNeigbours();
    }
    const closedNeighbours = getNeighbours(r, c).filter(n => !n.isOpen && !n.isFlagged);
    for (const n of closedNeighbours) {
        getHtmlElementByCoords(n.r, n.c).className = `cell cell-0`;
    }
    currentlyXrayedCell = [r, c];
}
function hidePreviouslyXrayedNeigbours() {
    if (currentlyXrayedCell.length === 0) {
        return;
    }
    const currentR = currentlyXrayedCell[0];
    const currentC = currentlyXrayedCell[1];
    const closedNeighbours = getNeighbours(currentR, currentC).filter(n => !n.isOpen && !n.isFlagged);
    for (const n of closedNeighbours) {
        getHtmlElementByCoords(n.r, n.c).className = 'cell cell-closed';
    }
}
function handleCellMain(r, c) {
    previousBoardState = JSON.parse(JSON.stringify(board));
    hidePreviouslyXrayedNeigbours();
    const cell = board[r][c];
    if (cell.isFlagged) {
        return;
    }
    if (isFirtClick) {
        handleFirstClick(r, c);
    }
    checkIfGameLost(cell);
    if (isGameLost) {
        cell.isOpen = true;
        updateCell(cell);
    }
    checkIfGameWon();
    if (isGameWon) {
        showMineLocations();
        return;
    }
    if (cell.isOpen) {
        handleChord(cell);
        return;
    }
    if (cell.value === 0) {
        floodAndFill(cell.r, cell.c);
    }
    cell.isOpen = true;
    updateCell(cell);
}
function handleCellSecondary(r, c) {
    const cell = board[r][c];
    if (cell.isOpen) {
        return;
    }
    else if (cell.isFlagged) {
        cell.isFlagged = false;
    }
    else {
        cell.isFlagged = true;
    }
    updateCell(cell);
}
function checkIfGameLost(openedCell) {
    if (openedCell.cellState === CellState.Mine) {
        isGameLost = true;
        document.getElementById('game-state-msg').innerHTML = 'you lost;';
        document.getElementById('game-state-msg').className = 'txt lose-msg';
        document.getElementById('continue-btn').style.display = 'block';
    }
}
function checkIfGameWon() {
    let closedCellsCount = 0;
    board.forEach(row => row.forEach(cell => closedCellsCount += !cell.isOpen ? 1 : 0));
    if (closedCellsCount === mineCountMap.get(getStoredDifficulty())) {
        isGameWon = true;
        document.getElementById('game-state-msg').innerHTML = 'you won;';
        document.getElementById('game-state-msg').className = 'txt win-msg';
    }
}
function handleContinueGame() {
    board = previousBoardState;
    drawBoard();
    isGameLost = false;
    document.getElementById('game-state-msg').innerHTML = '';
    document.getElementById('game-state-msg').className = 'txt';
    document.getElementById('continue-btn').style.display = 'none';
}
function showMineLocations() {
    board.forEach(row => {
        for (const cell of row) {
            if (cell.cellState === CellState.Mine) {
                getHtmlElementByCoords(cell.r, cell.c).className = 'cell cell-mine';
            }
        }
    });
}
function handleChord(cell) {
    let surroundingFlagCells = getNeighbours(cell.r, cell.c).filter(n => n.isFlagged);
    if (cell.value !== surroundingFlagCells.length) {
        return;
    }
    let unflaggedNeighbours = getNeighbours(cell.r, cell.c).filter(n => !surroundingFlagCells.some(f => f.r === n.r && f.c === n.c));
    for (let n of unflaggedNeighbours) {
        n.isOpen = true;
        updateCell(n);
        if (n.value === 0) {
            floodAndFill(n.r, n.c);
        }
        checkIfGameLost(n);
        if (isGameLost) {
            return;
        }
        checkIfGameWon();
        if (isGameWon) {
            showMineLocations();
            return;
        }
    }
}
function floodAndFill(r, c) {
    let visited = new Set();
    let q = [[r, c]];
    while (q.length > 0) {
        const coords = q.shift();
        const key = `${coords[0]},${coords[1]}`;
        const cell = board[coords[0]][coords[1]];
        if (visited.has(key)) {
            continue;
        }
        else {
            visited.add(key);
        }
        const neighbours = getNeighbours(cell.r, cell.c);
        for (let n of neighbours) {
            if (n.cellState === CellState.Mine) {
                continue;
            }
            else {
                n.isOpen = true;
                updateCell(n);
                if (n.value === 0) {
                    q.push([n.r, n.c]);
                }
            }
        }
    }
}
function handleFirstClick(clickedRow, clickedCol) {
    initBoardOnClick(clickedRow, clickedCol);
    isFirtClick = false;
}
function initEmptyBoard() {
    board = [];
    for (let r = 0; r < boardDimensions.rows; r++) {
        board[r] = [];
        for (let c = 0; c < boardDimensions.columns; c++) {
            board[r][c] = new Cell(r, c, 0, CellState.Safe, false, false);
        }
    }
    drawBoard();
}
function initBoardOnClick(firstClickRow, firstClickCol) {
    const emptySquaresOnInit = [[firstClickRow, firstClickCol], ...getNeighbours(firstClickRow, firstClickCol).map(cell => [cell.r, cell.c])];
    const mineCoords = getMineCoordinatesOnInit(emptySquaresOnInit);
    for (let r = 0; r < boardDimensions.rows; r++) {
        board[r] = [];
        for (let c = 0; c < boardDimensions.columns; c++) {
            if (emptySquaresOnInit.some(coords => coords[0] === r && coords[1] === c)) {
                board[r][c] = new Cell(r, c, 0, CellState.Safe, false, false);
            }
            else if (mineCoords.some(coords => coords.r === r && coords.c === c)) {
                board[r][c] = new Cell(r, c, null, CellState.Mine, false, false);
            }
            else {
                board[r][c] = new Cell(r, c, 0, CellState.Safe, false, false);
            }
        }
    }
    for (let r = 0; r < boardDimensions.rows; r++) {
        for (let c = 0; c < boardDimensions.columns; c++) {
            if (!mineCoords.some(coords => coords.r === r && coords.c === c)) {
                let surroundingMineCount = getCellSurroundingMineCount(r, c, mineCoords);
                board[r][c] = new Cell(r, c, surroundingMineCount, CellState.Safe, false, false);
            }
        }
    }
    drawBoard();
}
function drawBoard() {
    let boardContainer = document.getElementById('board-container');
    boardContainer.innerHTML = '';
    boardContainer.style.setProperty('--cols', String(boardDimensions.columns));
    boardContainer.style.setProperty('--rows', String(boardDimensions.rows));
    boardContainer.addEventListener('contextmenu', (e) => e.preventDefault());
    for (let r = 0; r < boardDimensions.rows; r++) {
        for (let c = 0; c < boardDimensions.columns; c++) {
            var elem = document.createElement('div');
            boardContainer.appendChild(elem);
            elem.id = `cell_${r}_${c}`;
            elem.className = `cell ${getCellClassName(board[r][c])}`;
            elem.setAttribute('data-row', r.toString());
            elem.setAttribute('data-col', c.toString());
            elem.addEventListener('mouseover', (e) => onMouseOver(e));
            elem.addEventListener('mouseout', () => curHoveredCellDataset = null);
        }
    }
}
function getCellSurroundingMineCount(r, c, mineCoords) {
    let surroundingMineCount = 0;
    let neighbours = getNeighbours(r, c);
    for (let n of neighbours) {
        if (mineCoords.some(m => m.r === n.r && m.c === n.c)) {
            surroundingMineCount++;
        }
    }
    return surroundingMineCount;
}
function getMineCoordinatesOnInit(exemptCoords) {
    let mineCount = mineCountMap.get(getStoredDifficulty() ?? 'medium');
    const isExempt = (r, c) => exemptCoords.some(([er, ec]) => er === r && ec === c);
    const mines = [];
    for (let i = 0; i < mineCount; i++) {
        let r = Math.floor(Math.random() * boardDimensions.rows);
        let c = Math.floor(Math.random() * boardDimensions.columns);
        while (isExempt(r, c) || mines.some(m => m.r === r && m.c === c)) {
            r = Math.floor(Math.random() * boardDimensions.rows);
            c = Math.floor(Math.random() * boardDimensions.columns);
        }
        mines.push({ r: r, c: c });
    }
    return mines;
}
function getStoredDifficulty() {
    return localStorage.getItem('difficulty');
}
function getStoredZoom() {
    return localStorage.getItem('zoom');
}
function getNeighbours(r, c) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1],
    ];
    let neighbours = [];
    for (let dir of directions) {
        const targetRow = r + dir[0];
        const targetCol = c + dir[1];
        if (targetRow < 0 || targetRow > boardDimensions.rows - 1
            || targetCol < 0 || targetCol > boardDimensions.columns - 1) {
            continue;
        }
        neighbours.push(board[targetRow][targetCol]);
    }
    return neighbours;
}
function onMouseOver(mouseEvent) {
    const e = mouseEvent.target;
    curHoveredCellDataset = document.getElementById(e.id).dataset;
}
function getHtmlElementByCoords(r, c) {
    return document.getElementById(`cell_${r}_${c}`);
}
function getCellClassName(cell) {
    if (cell.isFlagged) {
        return 'cell-flag';
    }
    else if (!cell.isOpen) {
        return 'cell-closed';
    }
    else if (cell.cellState === CellState.Mine) {
        return cell.isOpen ? 'cell-mine-red' : 'cell-mine';
    }
    else {
        switch (cell.value) {
            case 0:
                return 'cell-0';
            case 1:
                return 'cell-1';
            case 2:
                return 'cell-2';
            case 3:
                return 'cell-3';
            case 4:
                return 'cell-4';
            case 5:
                return 'cell-5';
            case 6:
                return 'cell-6';
            case 7:
                return 'cell-7';
            case 8:
                return 'cell-8';
            default:
                throw new Error("Cell is invalid");
        }
    }
}
function updateCell(updatedCell) {
    if (updatedCell.isFlagged) {
        updatedCell.isOpen = false;
    }
    else if (updatedCell.isOpen) {
        updatedCell.isFlagged = false;
    }
    getHtmlElementByCoords(updatedCell.r, updatedCell.c).className = `cell ${getCellClassName(updatedCell)}`;
}

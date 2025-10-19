import { Cell } from './models/cell.js';
import { CellStateType } from './models/cell-states.js';
import { BoardDimensions } from './models/board-dimensions.js';
import { findViableMoves } from './solver.js';
import { SOLVED_SAFE_CLASSNAME, SOLVED_MINE_CLASSNAME, DEFAULT_CELL_CLASSNAMES, SOLVED_CELL_CLASSNAMES, CELL_FLAG_CLASSNAME, CELL_CLOSED_CLASSNAME, CELL_MINE_RED_CLASSNAME, CELL_MINE_CLASSNAME, CELL_0_CLASSNAME, CELL_1_CLASSNAME, CELL_2_CLASSNAME, CELL_3_CLASSNAME, CELL_4_CLASSNAME, CELL_5_CLASSNAME, CELL_6_CLASSNAME, CELL_7_CLASSNAME, CELL_8_CLASSNAME, SAMPLE_BOARD, LOWER_BOUND_BOARD_DIMENSION } from './utils/constants.js';
import { clamp, getCoordKey, randArrayEntry } from './utils/utils.js';

let board: Cell[][] = [];
let previousBoardState: Cell[][] = [];
let boardDimensions: BoardDimensions = new BoardDimensions(16, 16); // default to medium board

let isGameLost: boolean = false;
let isGameWon: boolean = false;
let isFirstClick: boolean = true;

let colCount: number | undefined; 
let rowCount: number | undefined; 
let mineCount: number | undefined; 

let curHoveredCellDataset: DOMStringMap | null = null;

let currentlyXrayedCell: number[] = [];

let shouldShowViableMoves: boolean = false;
let hasShownViableMoves: boolean = false;

let shouldIncrementTime: boolean = false;
let timerVal: number = 0;
let timerId: number = 0;

let isShowingHighScores: boolean = false;

enum DifficultyType {
    EASY = 'easy',
    MEDIUM = 'medium',
    EXPERT = 'expert',
}

const difficultyStringToEnumKeyMap: Map<string, DifficultyType> = new Map([
    ['easy', DifficultyType.EASY],
    ['medium', DifficultyType.MEDIUM],
    ['expert', DifficultyType.EXPERT],
])

const difficultyToDimensionsMap: Map<string, BoardDimensions> = new Map([
    [DifficultyType.EASY, new BoardDimensions(9, 9)],
    [DifficultyType.MEDIUM, new BoardDimensions(16, 16)],
    [DifficultyType.EXPERT, new BoardDimensions(30, 16)],
]);

const mineCountMap: Map<string, number> = new Map([
    [DifficultyType.EASY, 10],
    [DifficultyType.MEDIUM, 40],
    [DifficultyType.EXPERT, 99],
]);

window.onload = () => { 
    handleNewGame(getStoredDifficulty() ?? 'medium', false) 
};

document.addEventListener('click', (event) => {
    if (!isShowingHighScores) {
        return;
    }

    const clickX = event.clientX;
    const clickY = event.clientY;

    const highScoreModal = document.getElementById('high-scores-modal')!;
    const rect = highScoreModal.getBoundingClientRect();
    const modalX = rect.x;
    const modalY = rect.y;
    const modalHeight = rect.height;
    const modalWidth = rect.width;

    if (clickX >= modalX && clickX <= modalX + modalWidth && clickY >= modalY && clickY <= modalY + modalHeight) {
        return;
    }

    showOrHideHighScores(false);
}, true);

document.getElementById('easy-btn')!.addEventListener('click', () => handleNewGame('easy', true));
document.getElementById('medium-btn')!.addEventListener('click', () => handleNewGame('medium', true));
document.getElementById('expert-btn')!.addEventListener('click', () => handleNewGame('expert', true));

document.getElementById('new-game-btn')!.addEventListener('click', () => startGame());

document.getElementById('high-scores-btn')!.addEventListener('click', () => showOrHideHighScores(true));
document.getElementById('close-high-scores-btn')!.addEventListener('click', () => showOrHideHighScores(false));

const hintCheckbox = document.getElementById('hint-checkbox')! as HTMLInputElement;
hintCheckbox.addEventListener('click', () => { 
    shouldShowViableMoves = hintCheckbox.checked;
    checkIfShouldShowViableMoves(isFirstClick); 
});

document.getElementById('continue-btn')!.addEventListener('click', () => handleContinueGame());

const colsSlider = document.getElementById('cols-slider') as HTMLInputElement;
colsSlider.oninput = () => { 
    colsInput.value = colsSlider.value;
    onColInput(colsSlider.value);
};
const colsInput = document.getElementById('cols-input') as HTMLInputElement;
colsInput.oninput = () => { 
    colsInput.value = clamp(parseInt(colsInput.value), parseInt(colsSlider.min), parseInt(colsSlider.max)).toString();
    onColInput(colsInput.value);
};

const rowsSlider = document.getElementById('rows-slider') as HTMLInputElement;
rowsSlider.oninput = () => { 
    rowsInput.value = rowsSlider.value;
    onRowInput(rowsSlider.value);
};
const rowsInput = document.getElementById('rows-input') as HTMLInputElement;
rowsInput.oninput = () => { 
    rowsInput.value = clamp(parseInt(rowsInput.value), parseInt(rowsSlider.min), parseInt(rowsSlider.max)).toString();
    onRowInput(rowsInput.value);
}

const minesSlider = document.getElementById('mines-slider') as HTMLInputElement;
minesSlider.oninput = () => { 
    minesInput.value = minesSlider.value;
    onMineInput(minesSlider.value) 
};
const minesInput = document.getElementById('mines-input') as HTMLInputElement;
minesInput.oninput = () => { 
    minesInput.value = clamp(parseInt(minesInput.value), parseInt(minesSlider.min), Math.min(parseInt(minesSlider.max), getMaxMineCount())).toString();
    onMineInput(minesInput.value); 
}

function onRowInput(inputVal: string) {
    rowCount = parseInt(inputVal); 
    clampMineCount();
    handleNewGame(getStoredDifficulty()!, false)
}
function onColInput(inputVal: string) {
    colCount = parseInt(inputVal); 
    clampMineCount();
    handleNewGame(getStoredDifficulty()!, false)
}
function onMineInput(inputVal: string) {
    mineCount = parseInt(inputVal); 
    handleNewGame(getStoredDifficulty()!, false)
}
function setSliderValues() {
    clampMineCount();

    const colCountStr = colCount!.toString();
    colsSlider.value = colCountStr;
    colsInput.value = clamp(colCount!, parseInt(colsSlider.min), parseInt(colsSlider.max)).toString();

    const rowCountStr = rowCount!.toString();
    rowsSlider.value = rowCountStr;
    rowsInput.value = clamp(rowCount!, parseInt(rowsSlider.min), parseInt(rowsSlider.max)).toString();

    const mineCountStr = mineCount!.toString();
    minesSlider.value = mineCountStr;
    const maxMineCount = getMaxMineCount();
    const mineCountUpperBound = Number.isNaN(maxMineCount) ? 999 : maxMineCount;
    minesInput.value = clamp(mineCount!, parseInt(minesSlider.min), Math.min(parseInt(minesSlider.max), mineCountUpperBound)).toString();
}

window.addEventListener('resize', () => setZoom());

document.addEventListener('keydown', (e) => {
    if (!shouldProcessInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    const k = e.key.toLowerCase();
    if (k === 'f') handleOpenCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (k === 'g') handleCellSecondaryClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});

document.addEventListener('keyup', (e) => {
    if (e.key === ' ' && !isShowingHighScores) {
        startGame();
        return;
    }

    if (!shouldProcessInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    const k = e.key.toLowerCase();
    if (k === 'f') processCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]); 
});

document.addEventListener('mouseup', (e) => {
    if (!shouldProcessInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    if (e.button === 0) processCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]); 
});

document.addEventListener('mousedown', (e) => {
    if (!shouldProcessInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    if (e.button === 0) handleOpenCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (e.button === 2) handleCellSecondaryClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});

function showOrHideHighScores(shouldShow: boolean) {
    isShowingHighScores = shouldShow;
    setStylesOnHighScoresModelAction(shouldShow);
}

function setStylesOnHighScoresModelAction(isShowing: boolean) {
    const modal = document.getElementById('high-scores-modal')!;
    modal.style.display = isShowing ? 'block' : 'none';
    modal.style.pointerEvents = isShowing ? 'auto' : 'none';

    if (isShowing) {
        for (const difficulty of Object.values(DifficultyType)) {
            const highScore = getHighScore(difficulty);
            document.getElementById(`${difficulty}-high-score`)!.innerHTML = Number.isNaN(highScore) ? 'never completed' : `${highScore} seconds`
        }
    }

    const allElements = document.getElementsByTagName('*');
    for (const el of allElements) {
        if (el === modal || modal.contains(el) || (el as HTMLElement).contains(modal) || el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'HEAD') {
            continue;
        }

        const htmlEl = el as HTMLElement;

        if (isShowing) {
            htmlEl.style.opacity = '0.7';
            htmlEl.style.pointerEvents = 'none';
        } else {
            htmlEl.style.opacity = '1';
            htmlEl.style.pointerEvents = 'auto';
        }
    }
}

function processCellMainClick(r: number, c: number) {
    const wasFirstClick = isFirstClick
    handleCellMainClick(r, c);
    checkIfShouldShowViableMoves(wasFirstClick);
}

function getHoveredRowAndColumn() {
    return [parseInt(curHoveredCellDataset!.row!), parseInt(curHoveredCellDataset!.col!)];
}

function shouldProcessInput() {
    return !isShowingHighScores && !isGameLost && !isGameWon && curHoveredCellDataset?.row !== undefined && curHoveredCellDataset?.col !== undefined;
}

function handleNewGame(difficulty: string, didClickDifficulty: boolean) {
    setStoredDifficulty(difficultyStringToEnumKeyMap.get(difficulty)!);

    boardDimensions = difficultyToDimensionsMap.get(difficulty)!;
    if (didClickDifficulty || colCount === undefined || rowCount === undefined || mineCount === undefined) {
        colCount = boardDimensions.columns;
        rowCount = boardDimensions.rows;
        mineCount = mineCountMap.get(difficulty);
    }

    setZoom();
    startGame();
}

function getMaxMineCount() {
    let safeRowCount = Number.isNaN(rowCount) ? LOWER_BOUND_BOARD_DIMENSION : rowCount!;
    let safeColCount = Number.isNaN(colCount) ? LOWER_BOUND_BOARD_DIMENSION : colCount!;

    return safeRowCount * safeColCount - 1;
}

function clampMineCount() {
    const maxMineCount = getMaxMineCount();
    minesSlider.max = maxMineCount.toString();

    mineCount = clamp(mineCount!, 1, maxMineCount);
    minesSlider.value = mineCount.toString();
    minesInput.value = mineCount.toString();
}

function setZoom() {
    const maxHeight = getHeightBetweenTopAndBottom() - 60; 
    const maxWidth = window.innerWidth - 80; 

    const cellByHeight = maxHeight / rowCount!;
    const cellByWidth = maxWidth / colCount!;

    const cell = Math.floor(Math.min(cellByHeight, cellByWidth));

    document.documentElement.style.setProperty('--cell', `${cell}px`);
}

function getHeightBetweenTopAndBottom() {
    const topBar = document.getElementById('top-bar')!;
    const bottomBar = document.getElementById('bottom-bar')!

    const topBarBottom = topBar.getBoundingClientRect().bottom;
    const bottomBarTop = bottomBar.getBoundingClientRect().top;

    const gap = bottomBarTop - topBarBottom;

    return gap;
}

function resetDifficultyTypeUnderlines() {
    Object.values(DifficultyType).forEach(d => {
        const difficultyBtn = document.getElementById(`${d}-btn`)!;
        difficultyBtn.classList.remove('soft-underline');
    });
}

function startGame() {
    drawTitle();

    clearTimer();
    setTimerVal(0);

    isGameLost = false;
    isGameWon = false;
    isFirstClick = true;

    setSliderValues();
    initEmptyBoard();
    setNewGameStyles();

    if(shouldShowViableMoves) {
        findViableMoves(board, true);
    }
}


function initEmptyBoard() {
    board = [];

    for (let r = 0; r < rowCount!; r++) {
        board[r] = []
        for (let c = 0; c < colCount!; c++) {
            board[r][c] = new Cell(r, c, 0, CellStateType.SAFE, false, false);
        }
    }

    drawBoard();
}

function checkIfShouldShowViableMoves() {
    if (!shouldShowViableMoves) {
        hideViableMoves();
    } else {
        findViableMoves(board, !hasShownViableMoves);
        hasShownViableMoves = true;
    }
}

function hideViableMoves() {
    for (const row of board) {
        for (const cell of row) {
            const elem = getHtmlElementByCoords(cell.r, cell.c);
            elem?.classList.remove(SOLVED_SAFE_CLASSNAME, SOLVED_MINE_CLASSNAME);
        }
    }
}

function handleOpenCellMainClick(r: number, c: number) {
    const cell = board[r][c];
    if (!cell.isOpen) {
        return;
    }

    xrayNeighbours(r, c);
}

function xrayNeighbours(r: number, c: number) {
    if (currentlyXrayedCell.length === 2) {
        hidePreviouslyXrayedNeighbours()
    }

    const closedNeighbours = getNeighbours(r, c).filter(n => !n.isOpen && !n.isFlagged);
    for (const n of closedNeighbours) {
        assignCellDefaultClassName(n.r, n.c, 'cell-0');
    }

    currentlyXrayedCell = [r, c];
}

function hidePreviouslyXrayedNeighbours() {
    if (currentlyXrayedCell.length === 0) {
        return;
    }

    const currentR = currentlyXrayedCell[0];
    const currentC = currentlyXrayedCell[1];

    const closedNeighbours = getNeighbours(currentR, currentC).filter(n => !n.isOpen && !n.isFlagged);
    for (const n of closedNeighbours) {
        assignCellDefaultClassName(n.r, n.c, 'cell-closed');
    }
}

function cloneBoard(): Cell[][] {
  return board.map(row => row.map(
    c => new Cell(c.r, c.c, c.value, c.cellState, c.isOpen, c.isFlagged)
  ));
}

function handleCellMainClick(r: number, c: number): void {
    previousBoardState = cloneBoard();
    hidePreviouslyXrayedNeighbours();

    const cell = board[r][c];
    if (cell.isFlagged) {
        return;
    }

    if (isFirstClick) {
        handleFirstClick(r, c);

        if (checkIfGameWon()) { // game is won immediately if only one safe cell in board
            return;
        }
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

    
    if (checkIfGameLost(cell)) {
        return;
    }

    checkIfGameWon();
}

function handleCellSecondaryClick(r: number, c: number): void {
    const cell = board[r][c];
    if (cell.isOpen) {
        return;
    } else if (cell.isFlagged) {
        cell.isFlagged = false
        setFlagsLeft(getFlagsLeft() + 1);
    } else if (!cell.isFlagged && getFlagsLeft() > 0){
        cell.isFlagged = true;
        setFlagsLeft(getFlagsLeft() - 1);
    }

    updateCell(cell);
}

function checkIfGameLost(openedCell: Cell) {
    if (openedCell.cellState !== CellStateType.MINE) {
        return false;
    }

    shouldIncrementTime = false;
    isGameLost = true;

    document.getElementById('game-state-msg')!.innerHTML = 'you lost;&nbsp;';
    document.getElementById('game-state-msg')!.className = 'txt lose-msg';
    document.getElementById('continue-btn')!.style.display = 'block';
    //document.getElementById('board-container')!.style.filter = 'blur(1px)';
    document.getElementById('game-over-container')!.style.display = 'flex';
    document.getElementById('game-over-container')!.style.boxShadow = '10px 10px 0 red, -10px -10px 0 red';

    showMineLocations();
    return true;
}

function checkIfGameWon() {
    if (board.flat().filter(cell => !cell.isOpen).length !== mineCount!) { 
        return false; 
    }

    shouldIncrementTime = false;
    isGameWon = true;

    document.getElementById('game-state-msg')!.innerHTML = handleNewHighScore() ? `you won! new highscore ${timerVal} seconds!` : 'you won!';
    document.getElementById('game-state-msg')!.className = 'txt win-msg';
    //document.getElementById('board-container')!.style.filter = 'blur(1px)';
    document.getElementById('game-over-container')!.style.display = 'flex';
    document.getElementById('game-over-container')!.style.boxShadow = '10px 10px 0 gold, -10px -10px 0 gold';

    showMineLocations();
    return true;
}

function handleNewHighScore() {
    const difficulty = getNativeDifficultyByDimensions();
    if (difficulty === undefined) {
        return false;
    }

    const currentHighScore = getHighScore(difficulty);

    if (Number.isNaN(currentHighScore) || timerVal < currentHighScore) {
        setHighScore(difficulty, timerVal)
        return true;
    }

    return false;
}

function handleContinueGame() {
    shouldIncrementTime = true;

    board = previousBoardState;
    drawBoard();

    isGameLost = false;
    setNewGameStyles();

    if (shouldShowViableMoves) {
        findViableMoves(board, false);
    }
}

function setNewGameStyles() {
    document.getElementById('game-state-msg')!.innerHTML = '';
    document.getElementById('continue-btn')!.style.display = 'none';
    document.getElementById('board-container')!.style.filter = 'none';
    document.getElementById('continue-btn')!.style.display = 'none';
    document.getElementById('game-over-container')!.style.display = 'none';

    setFlagsLeft(mineCount!);

    resetDifficultyTypeUnderlines();
    handleDifficultyUnderline();
}

function handleDifficultyUnderline() {
    const difficulty = getNativeDifficultyByDimensions();

    if (difficulty !== undefined) {
        setStoredDifficulty(difficulty)
        document.getElementById(`${difficulty}-btn`)!.classList.add('soft-underline');
    }
}

function getNativeDifficultyByDimensions() {
    const difficultyStr = Array.from(difficultyToDimensionsMap).find(val => val[1].rows === rowCount! && val[1].columns === colCount!);
    if (difficultyStr !== undefined) {
        const difficultyType = difficultyStringToEnumKeyMap.get(difficultyStr[0])!;

        if (mineCountMap.get(difficultyType) === mineCount!) {
            return difficultyType;
        }
    }

    return undefined;
}

function setFlagsLeft(newValue: number) {
    document.getElementById('flags-left')!.innerHTML = newValue.toString();
}

function getFlagsLeft() {
    return parseInt(document.getElementById('flags-left')!.innerHTML); 
}

function showMineLocations() {
    board.forEach(row => {
        for (const cell of row) {
            if (cell.cellState === CellStateType.MINE && !cell.isOpen) {
                getHtmlElementByCoords(cell.r, cell.c)!.className = `cell ${CELL_MINE_CLASSNAME}`;
            }
        }
    })
}

function handleChord(cell: Cell) {
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

        if (checkIfGameLost(n)) {
            return;
        }

        if (checkIfGameWon()) {
            return;
        }
    }
}

function floodAndFill(r: number, c: number) {
    let visited: Set<string> = new Set();
    let q = [[r, c]];

    while (q.length > 0) {
        const coords = q.shift()!;

        const key = `${coords[0]},${coords[1]}`;
        const cell = board[coords[0]][coords[1]];
        if (visited.has(key)) {
            continue;
        } else {
            visited.add(key);
        }

        const neighbours = getNeighbours(cell.r, cell.c);
        for (let n of neighbours) {
            if (n.cellState === CellStateType.MINE) {
                continue;
            } else {
                n.isOpen = true;
                updateCell(n);

                if (n.value === 0) {
                    q.push([n.r, n.c]);
                }
            }
        }
    }
}

function handleFirstClick(clickedRow: number, clickedCol: number) {
    initBoardOnFirstClick(clickedRow, clickedCol);

    isFirstClick = false;

    startTimer();
}


function startTimer() {
    shouldIncrementTime = true;
    timerVal = 0;

    timerId = setInterval(() => {
        if (shouldIncrementTime) {
            timerVal++;
        }

        setTimerVal(timerVal);
    }, 1000);
}

function setTimerVal(value: number) {
    timerVal = value;

    // const minuteVal = Math.floor(timerVal / 60);
    // const secondVal = (timerVal % 60).toString().padStart(2, '0');

    //document.getElementById('timer')!.innerHTML = `${minuteVal.toString()}:${secondVal.toString()}`;
    document.getElementById('timer')!.innerHTML = timerVal.toString();
}


function clearTimer() {
    clearInterval(timerId);
    shouldIncrementTime = false;
}

function initBoardOnFirstClick(firstClickRow: number, firstClickCol: number): void {
    // board = JSON.parse(SAMPLE_BOARD);
    // drawBoard();
    // return;

    const firstClickNeighbours = getNeighbours(firstClickRow, firstClickCol).map(n => getCoordKey(n.r, n.c));
    const maxPossibleSafeSquares = Math.min(1 + firstClickNeighbours.length, (rowCount! * colCount!) - mineCount!); 

    const safeSquaresOnInit: Set<string> = new Set(
        [
            getCoordKey(firstClickRow, firstClickCol), 
            ...firstClickNeighbours
        ].slice(0, maxPossibleSafeSquares)
    ); 

    const mineCoordKeys = generateMineCoordinatesOnInit(safeSquaresOnInit);

    for (let r = 0; r < rowCount!; r++) {
        for (let c = 0; c < colCount!; c++) {
            const isMine = mineCoordKeys.has(getCoordKey(r, c));

            if (isMine) {
                board[r][c] = new Cell(r, c, null, CellStateType.MINE, false, false);
            } else {
                let surroundingMineCount = getCellSurroundingMineCount(r, c, mineCoordKeys);
                board[r][c] = new Cell(r, c, surroundingMineCount, CellStateType.SAFE, false, false);
            }
        }
    }

    const firstClickSquare = board[firstClickRow][firstClickCol];
    firstClickSquare.isOpen = true;
    updateCell(firstClickSquare);

    drawBoard();
}

function generateMineCoordinatesOnInit(exemptCoords: Set<string>) {
    const isExempt = (coordKey: string) => exemptCoords.has(coordKey);
    const getRandomCoord = (coordUpperBound: number)=> Math.floor(Math.random() * coordUpperBound!);

    const mines: Set<string> = new Set();
    for (let i = 0; i < mineCount!; i++) {
        let r = getRandomCoord(rowCount!);
        let c = getRandomCoord(colCount!);
        let coordKey = getCoordKey(r, c);

        while (isExempt(coordKey) || mines.has(coordKey)) {
            r = getRandomCoord(rowCount!);
            c = getRandomCoord(colCount!);
            coordKey = getCoordKey(r, c);
        }

        mines.add(coordKey);
    }

    return mines;
}

function getCellSurroundingMineCount(r: number, c: number, mineCoordKeys: Set<string>) {
    let surroundingMineCount = 0
    let neighbours = getNeighbours(r, c);

    for (let n of neighbours) {
        if (mineCoordKeys.has(getCoordKey(n.r, n.c))) {
            surroundingMineCount++;
        }
    }

    return surroundingMineCount;
}

function drawBoard(): void {
    let boardContainer = document.getElementById('board-container')!;
    boardContainer.innerHTML = '';
    boardContainer.style.setProperty('--cols', String(colCount));
    boardContainer.style.setProperty('--rows', String(rowCount));
    boardContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    for (let r = 0; r < rowCount!; r++) {
        for (let c = 0; c < colCount!; c++) {
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

function getStoredDifficulty() {
    return localStorage.getItem('difficulty')
}

function setStoredDifficulty(difficulty: DifficultyType) {
    localStorage.setItem('difficulty', difficulty);
}

function getNeighbours(r: number, c: number) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1],
    ];

    let neighbours: Cell[] = [];
    for (let dir of directions) {
        const targetRow = r + dir[0];
        const targetCol = c + dir[1];

        if (
            targetRow < 0 || targetRow > rowCount! - 1
            || targetCol < 0 || targetCol > colCount! - 1
        ) {
            continue;
        }

        neighbours.push(board[targetRow][targetCol]);
    }

    return neighbours;
}

function onMouseOver(mouseEvent: MouseEvent) {
    const e = mouseEvent.target as HTMLElement;
    curHoveredCellDataset = document.getElementById(e.id)!.dataset
}

function getHtmlElementByCoords(r: number, c: number) {
    return document.getElementById(`cell_${r}_${c}`)
}

function getCellClassName(cell: Cell): string {
    if (cell.isFlagged) {
        return CELL_FLAG_CLASSNAME;
    } else if (!cell.isOpen) {
        return CELL_CLOSED_CLASSNAME;
    } else if (cell.cellState === CellStateType.MINE) {
        return cell.isOpen ? CELL_MINE_RED_CLASSNAME : CELL_MINE_CLASSNAME;
    } else {
        switch (cell.value) {
            case 0:
                return CELL_0_CLASSNAME;
            case 1:
                return CELL_1_CLASSNAME;
            case 2:
                return CELL_2_CLASSNAME;
            case 3:
                return CELL_3_CLASSNAME;
            case 4:
                return CELL_4_CLASSNAME;
            case 5:
                return CELL_5_CLASSNAME;
            case 6:
                return CELL_6_CLASSNAME;
            case 7:
                return CELL_7_CLASSNAME; 
            case 8:
                return CELL_8_CLASSNAME;
            default:
                throw new Error('Cell is invalid');
        }
    }
}

function updateCell(updatedCell: Cell) {
    if (updatedCell.isFlagged) {
        updatedCell.isOpen = false;
    } else if (updatedCell.isOpen) {
        updatedCell.isFlagged = false;
        SOLVED_CELL_CLASSNAMES.forEach(className => getHtmlElementByCoords(updatedCell.r, updatedCell.c)!.classList.remove(className));
    }

    assignCellDefaultClassName(updatedCell.r, updatedCell.c, getCellClassName(updatedCell));
}

function assignCellDefaultClassName(r: number, c: number, classNameToAssign: string) {
    if (!DEFAULT_CELL_CLASSNAMES.includes(classNameToAssign)) {
        throw new Error('Invalid cell classname');
    }

    const elem = getHtmlElementByCoords(r, c)!;

    DEFAULT_CELL_CLASSNAMES.forEach(className => elem.classList.remove(className));
    elem.classList.add(classNameToAssign);
}

function getHighScore(difficulty: DifficultyType) {
    const storedHighScore = localStorage.getItem(`${difficulty}-high-score`);
    if (storedHighScore === null) {
        return NaN;
    }

    return parseInt(storedHighScore);
}

function setHighScore(difficulty: DifficultyType, score: number) {
    localStorage.setItem(`${difficulty}-high-score`, score.toString())
}

function drawTitle() {
    const el = document.getElementById('title')!;

    const title = ['m','i','n','e','s','w','e','e','p','e','r'];
    const spanElements = [];

    const colors = [
        '144, 197, 250', 
        '125, 192, 112', 
        '238, 127, 138',
        '224, 141, 248',
        '213, 172, 67',
        '128, 202, 203',
        '153, 153, 153',
        '209, 216, 223',
    ];

    const colorPickProbabilityMap: Map<string, number> = new Map(colors.map(c => [c, 1]));

    const usedColors = [];
    for (let i = 0; i < title.length; i++) {
        const randColor = randArrayEntry(colors);
        let colorToUse = randColor;

        while (i !== 0 && usedColors[usedColors.length - 1] === colorToUse) {
            colorToUse = randArrayEntry(colors);
        }

        usedColors.push(colorToUse);

        // const style = `color: rgb(${colorToUse}); text-shadow: 0 0 35px rgb(${colorToUse});`;
        const style = `color: rgb(${colorToUse});`;
        spanElements.push(`<span class='title-char' style='${style}'>${title[i]}</span>`)
    }

    el.innerHTML = spanElements.join('');
}

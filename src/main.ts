import { Cell } from './models/cell.js';
import { CellStateType } from './models/enums/cellStateType.js';
import { findViableMoves } from './solver.js';
import { DEFAULT_CELL_CLASSNAMES, SOLVED_CELL_CLASSNAMES, CELL_FLAG_CLASSNAME, CELL_CLOSED_CLASSNAME, CELL_MINE_RED_CLASSNAME, CELL_MINE_CLASSNAME, CELL_0_CLASSNAME, CELL_1_CLASSNAME, CELL_2_CLASSNAME, CELL_3_CLASSNAME, CELL_4_CLASSNAME, CELL_5_CLASSNAME, CELL_6_CLASSNAME, CELL_7_CLASSNAME, CELL_8_CLASSNAME, LOWER_BOUND_BOARD_DIMENSION, DIFFICULTY_TYPE_TO_DIMENSIONS_MAP, DIFFICULTY_TYPE_TO_MINE_COUNT_MAP, CELL_FLAG_WRONG_CLASSNAME } from './utils/constants.js';
import { clamp, getCoordKey, randArrayEntry } from './utils/utils.js';
import { DifficultyType } from './models/enums/difficultyType.js';
import { GameStateType } from './models/enums/gameStateType.js';
import { el_closeHighScoresBtn, el_continueBtn, el_highScoresBtn, el_newGameBtn, el_pauseBtn, el_hintCheckbox, el_colSlider, el_colInput, el_rowSlider, el_rowInput, el_mineSlider, el_mineInput, el_bottomBar, el_gameStateMsg, el_gameOverContainer, el_topBar, el_flagsLeft, el_gamePausedContainer, el_boardContainer, el_timerVal, el_title, el_highScoresModal, el_difficultyBtn, el_cell, el_difficultyHighScore } from './htmlElements.js';

// board state info
let board: Cell[][];
let previousBoardState: Cell[][];
const rowCount = () => { return el_rowInput.value ? parseInt(el_rowInput.value) : (board?.length ?? 0) };
const colCount = () => { return el_colInput.value ? parseInt(el_colInput.value) : (board?.[0]?.length ?? 0) };
let mineCount: number | undefined; 

// board html stuff (for removing/readding the board to the DOM on pause/unpause)
let boardElementRef: HTMLElement | null = null;
let boardPlaceholder: Comment | null = null;
let boardParent: Node | null = null;

// game state bools
let gameState: GameStateType = GameStateType.PLAYING;
let isBoardClean: boolean = true;

// timer stuff
let shouldIncrementTime: boolean = false;
let timerId: number = 0;

// misc
let curHoveredCellDataset: DOMStringMap | null = null;
let currentlyXrayedCell: number[] = [];
let hasShownViableMoves: boolean = false;

window.onload = () => applySettingsAndResetGame(false);

document.addEventListener('click', (event) => {
    if (!isShowingHighScores()) {
        return;
    }

    const clickX = event.clientX;
    const clickY = event.clientY;

    const highScoreModal = el_highScoresModal;
    const rect = highScoreModal.getBoundingClientRect();
    const modalX = rect.x;
    const modalY = rect.y;
    const modalHeight = rect.height;
    const modalWidth = rect.width;

    if (clickX >= modalX && clickX <= modalX + modalWidth && clickY >= modalY && clickY <= modalY + modalHeight) {
        return;
    }

    showOrHideModal(el_highScoresModal);
}, true);

el_difficultyBtn(DifficultyType.EASY).addEventListener('click', () => onDifficultyClick(DifficultyType.EASY));
el_difficultyBtn(DifficultyType.MEDIUM).addEventListener('click', () => onDifficultyClick(DifficultyType.MEDIUM));
el_difficultyBtn(DifficultyType.EXPERT).addEventListener('click', () => onDifficultyClick(DifficultyType.EXPERT));

el_newGameBtn.addEventListener('click', () => applySettingsAndResetGame(false));

el_highScoresBtn.addEventListener('click', () => { 
    for (const difficulty of Object.values(DifficultyType)) {
        const highScore = getHighScore(difficulty);
        el_difficultyHighScore(difficulty).innerHTML = Number.isNaN(highScore) ? 'never completed' : `${highScore} seconds`
    }

    showOrHideModal(el_highScoresModal);
});
el_closeHighScoresBtn.addEventListener('click', () => showOrHideModal(el_highScoresModal));

el_pauseBtn.addEventListener('click', () => handlePause());

el_hintCheckbox.addEventListener('click', () => { 
    checkIfShouldShowViableMoves(isBoardClean); 
});

el_continueBtn.addEventListener('click', () => handleContinueGame());

el_colSlider.oninput = () => { 
    el_colInput.value = el_colSlider.value;
    onColInput();
};
el_colInput.oninput = () => { 
    el_colInput.value = clamp(parseInt(el_colInput.value), parseInt(el_colSlider.min), parseInt(el_colSlider.max)).toString();
    onColInput();
};

el_rowSlider.oninput = () => { 
    el_rowInput.value = el_rowSlider.value;
    onRowInput();
};
el_rowInput.oninput = () => { 
    el_rowInput.value = clamp(parseInt(el_rowInput.value), parseInt(el_rowSlider.min), parseInt(el_rowSlider.max)).toString();
    onRowInput();
}

el_mineSlider.oninput = () => { 
    el_mineInput.value = el_mineSlider.value;
    onMineInput(el_mineSlider.value) 
};
el_mineInput.oninput = () => { 
    el_mineInput.value = clamp(parseInt(el_mineInput.value), parseInt(el_mineSlider.min), Math.min(parseInt(el_mineSlider.max), getMaxMineCount())).toString();
    onMineInput(el_mineInput.value); 
}

function onRowInput() {
    clampMineCount();
    applySettingsAndResetGame(false);
}
function onColInput() {
    clampMineCount();
    applySettingsAndResetGame(false);
}
function onMineInput(inputVal: string) {
    mineCount = parseInt(inputVal); 
    applySettingsAndResetGame(false);
}

function setDimensionInputValues(didClickDifficulty: boolean) {
    const difficulty = getStoredDifficulty() ?? 'medium';
    let cols = 0;
    let rows = 0;
    if (!didClickDifficulty && el_rowInput.value && el_colInput.value && el_mineInput.value) {
        rows = parseInt(el_rowInput.value);
        cols = parseInt(el_colInput.value);
        mineCount = parseInt(el_mineInput.value);
    } else {
        const dims = DIFFICULTY_TYPE_TO_DIMENSIONS_MAP.get(difficulty)!;
        rows = dims.rows;
        cols = dims.columns;
        mineCount = DIFFICULTY_TYPE_TO_MINE_COUNT_MAP.get(difficulty);
    }

    const colCountStr = cols.toString();
    el_colSlider.value = colCountStr;
    el_colInput.value = clamp(cols, parseInt(el_colSlider.min), parseInt(el_colSlider.max)).toString();

    const rowCountStr = rows.toString();
    el_rowSlider.value = rowCountStr;
    el_rowInput.value = clamp(rows, parseInt(el_rowSlider.min), parseInt(el_rowSlider.max)).toString();

    clampMineCount();

    el_mineSlider.value = mineCount!.toString();
    const maxMineCount = getMaxMineCount();
    const mineCountUpperBound = Number.isNaN(maxMineCount) ? 999 : maxMineCount;
    el_mineInput.value = clamp(mineCount!, parseInt(el_mineSlider.min), Math.min(parseInt(el_mineSlider.max), mineCountUpperBound)).toString();
}

window.addEventListener('resize', () => setZoom());

document.addEventListener('keydown', (e) => {
    if (!shouldProcessBoardInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    const k = e.key.toLowerCase();
    if (k === 'f') handleOpenCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (k === 'g') handleCellSecondaryClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});

document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();

    if (k === ' ' && !isShowingHighScores()) {
        applySettingsAndResetGame(false);
    } else if (k === 'p') {
        handlePause();
    } else if (shouldProcessBoardInput() && k === 'f') {
        el_hintCheckbox.blur();
        const hoveredRowAndColumn = getHoveredRowAndColumn();
        processCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]); 
    }
});

document.addEventListener('mouseup', (e) => {
    if (!shouldProcessBoardInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    if (e.button === 0) processCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]); 
});

document.addEventListener('mousedown', (e) => {
    if (!shouldProcessBoardInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    if (e.button === 0) handleOpenCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (e.button === 2) handleCellSecondaryClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});

function showOrHideModal(modal: HTMLElement) {
    const shouldShow = !modal.style.display || modal.style.display === 'none';

    modal.style.display = shouldShow ? 'block' : 'none';
    modal.style.pointerEvents = shouldShow ? 'auto' : 'none';

    const allElements = document.getElementsByTagName('*');
    for (const el of allElements) {

        const isModalElement = el === modal || modal.contains(el) || (el as HTMLElement).contains(modal);
        const isTooltipElement = el.className === 'tooltip-container' || el.className === 'tooltip-msg' || el.className === 'tooltip-trigger';
        const isRootElement = el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'HEAD';
        if (isModalElement || isTooltipElement || isRootElement) {
            continue;
        }

        const htmlEl = el as HTMLElement;

        if (shouldShow) {
            htmlEl.style.opacity = '0.7';
            htmlEl.style.pointerEvents = 'none';
        } else {
            htmlEl.style.opacity = '1';
            htmlEl.style.pointerEvents = 'auto';
        }
    }
}

function processCellMainClick(r: number, c: number) {
    const wasFirstClick = isBoardClean

    previousBoardState = cloneBoard();

    console.time('handleCellMainClick');
    handleCellMainClick(r, c);
    console.timeEnd('handleCellMainClick');

    checkIfShouldShowViableMoves(wasFirstClick);
}

function getHoveredRowAndColumn() {
    return [parseInt(curHoveredCellDataset!.row!), parseInt(curHoveredCellDataset!.col!)];
}

function shouldProcessBoardInput() {
    return !isGamePaused() && !isShowingHighScores() && gameState === GameStateType.PLAYING && curHoveredCellDataset?.row !== undefined && curHoveredCellDataset?.col !== undefined;
}

function onDifficultyClick(difficulty: DifficultyType) {
    setStoredDifficulty(difficulty);
    applySettingsAndResetGame(true);
}

function applySettingsAndResetGame(didClickDifficulty: boolean) {
    drawTitle(); // draw a new title each game
    setDimensionInputValues(didClickDifficulty);
    setZoom();
    handlePause(true);

    // timer stuff
    clearTimer();
    setTimerVal(0);

    // game state bools
    gameState = GameStateType.PLAYING;
    isBoardClean = true;

    // ui stuff
    initEmptyBoard();
    setNewGameStyles(false);

    if(el_hintCheckbox.checked) {
        findViableMoves(board, true);
    }
}

function getMaxMineCount() {
    let safeRowCount = Number.isNaN(rowCount()) ? LOWER_BOUND_BOARD_DIMENSION : rowCount();
    let safeColCount = Number.isNaN(colCount()) ? LOWER_BOUND_BOARD_DIMENSION : colCount();

    return safeRowCount * safeColCount - 1;
}

function clampMineCount() {
    const maxMineCount = getMaxMineCount();
    el_mineSlider.max = maxMineCount.toString();

    mineCount = clamp(mineCount!, 1, maxMineCount);
    el_mineSlider.value = mineCount.toString();
    el_mineInput.value = mineCount.toString();
}

function setZoom() {
    const maxHeight = getHeightBetweenTopAndBottom() - 60; 
    const maxWidth = window.innerWidth - 80; 

    const cellByHeight = maxHeight / rowCount();
    const cellByWidth = maxWidth / colCount();

    const cell = Math.floor(Math.min(cellByHeight, cellByWidth));

    document.documentElement.style.setProperty('--cell', `${cell}px`);
}

function getHeightBetweenTopAndBottom() {
    const topBarBottom = el_topBar.getBoundingClientRect().bottom;
    const bottomBarTop = el_bottomBar.getBoundingClientRect().top;

    const gap = bottomBarTop - topBarBottom;

    return gap;
}

function resetDifficultyTypeUnderlines() {
    Object.values(DifficultyType).forEach(d => {
        const difficultyBtn = el_difficultyBtn(d);
        difficultyBtn.classList.remove('soft-underline');
    });
}

function initEmptyBoard() {
    board = [];

    const rows = rowCount();
    const cols = colCount();
    for (let r = 0; r < rows; r++) {
        board[r] = []
        for (let c = 0; c < cols; c++) {
            board[r][c] = new Cell(r, c, 0, CellStateType.SAFE, false, false);
        }
    }

    drawBoard();
}

function checkIfShouldShowViableMoves(shouldClearCache: boolean) {
    if (!el_hintCheckbox.checked) {
        hideViableMoves();
    } else {
        findViableMoves(board, shouldClearCache);
        hasShownViableMoves = true;
    }
}

function hideViableMoves() {
    for (const row of board) {
        for (const cell of row) {
            removeViableMoveStyles(cell.r, cell.c);
        }
    }
}

function handleOpenCellMainClick(r: number, c: number) {
    if (!board[r][c].isOpen) {
        return;
    }

    xrayNeighbours(r, c);
}

function xrayNeighbours(r: number, c: number) {
    if (currentlyXrayedCell.length === 2) {
        hidePreviouslyXrayedNeighbours();
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
    hidePreviouslyXrayedNeighbours();

    const cell = board[r][c];
    if (cell.isFlagged) {
        return;
    }

    if (isBoardClean) {
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
    gameState = GameStateType.LOST;

    el_gameStateMsg.innerHTML = 'you lost;&nbsp;';
    el_gameStateMsg.className = 'txt lose-msg';
    el_continueBtn.style.display = 'block';
    el_gameOverContainer.style.display = 'flex';
    el_gameOverContainer.style.boxShadow = '10px 10px 0 red, -10px -10px 0 red';

    showMineLocations();
    return true;
}

function checkIfGameWon() {
    if (board.flat().filter(cell => !cell.isOpen).length !== mineCount!) { 
        return false; 
    }

    shouldIncrementTime = false;
    gameState = GameStateType.WON;

    el_gameStateMsg.innerHTML = handleNewHighScore() ? `you won! new highscore ${getTimerVal()} seconds!` : 'you won!';
    el_gameStateMsg.className = 'txt win-msg';
    el_gameOverContainer.style.display = 'flex';
    el_gameOverContainer.style.boxShadow = '10px 10px 0 gold, -10px -10px 0 gold';

    showMineLocations();
    return true;
}

function handleNewHighScore() {
    if (hasShownViableMoves) {
        return;
    }

    const difficulty = getNativeDifficultyByDimensions();
    if (difficulty === undefined) {
        return false;
    }

    const currentHighScore = getHighScore(difficulty);

    if (Number.isNaN(currentHighScore) || getTimerVal() < currentHighScore) {
        setHighScore(difficulty, getTimerVal())
        return true;
    }

    return false;
}

function handleContinueGame() {
    shouldIncrementTime = true;

    board = previousBoardState;
    drawBoard();

    gameState = GameStateType.PLAYING;
    setNewGameStyles(true);

    if (el_hintCheckbox.checked) {
        findViableMoves(board, false);
    }
}

function setNewGameStyles(isContinuingGame: boolean) {
    getBoardContainerElement().style.filter = 'none';
    el_gameStateMsg.innerHTML = '';
    el_continueBtn.style.display = 'none';
    el_gameOverContainer.style.display = 'none';
    if (!isContinuingGame) {
        setFlagsLeft(mineCount!);
    }
    resetDifficultyTypeUnderlines();
    handleDifficultyUnderline();
}

function handleDifficultyUnderline() {
    const difficulty = getNativeDifficultyByDimensions();

    if (difficulty !== undefined) {
        setStoredDifficulty(difficulty)
        el_difficultyBtn(difficulty).classList.add('soft-underline');
    }
}

function getNativeDifficultyByDimensions() {
    const difficultyStr = Array.from(DIFFICULTY_TYPE_TO_DIMENSIONS_MAP).find(val => val[1].rows === rowCount() && val[1].columns === colCount());
    if (difficultyStr !== undefined) {
        const difficultyType = difficultyStr[0] as DifficultyType;

        if (DIFFICULTY_TYPE_TO_MINE_COUNT_MAP.get(difficultyType) === mineCount!) {
            return difficultyType;
        }
    }

    return undefined;
}

function setFlagsLeft(newValue: number) {
    el_flagsLeft.innerHTML = newValue.toString();
}

function getFlagsLeft() {
    return parseInt(el_flagsLeft.innerHTML); 
}

function showMineLocations() {
    board.forEach(row => {
        for (const cell of row) {
            if (cell.isFlagged && cell.cellState !== CellStateType.MINE) {
                el_cell(cell.r, cell.c).className = CELL_FLAG_WRONG_CLASSNAME;
            } else if (cell.cellState === CellStateType.MINE && !cell.isOpen) {
                el_cell(cell.r, cell.c).className = CELL_MINE_CLASSNAME;
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
    let i = 0;

    const cellsToOpen: Cell[] = [];
    while (i < q.length) {
        const coords = q[i];
        i++;

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
                cellsToOpen.push(n);

                if (n.value === 0) {
                    q.push([n.r, n.c]);
                }
            }
        }
    }

    cellsToOpen.forEach(cell => {
        cell.isOpen = true;
        updateCell(cell);
    })
}

function handleFirstClick(clickedRow: number, clickedCol: number) {
    initBoardOnFirstClick(clickedRow, clickedCol);

    isBoardClean = false;

    startTimer();
}

function startTimer() {
    shouldIncrementTime = true;
    setTimerVal(0)

    timerId = setInterval(() => {
        let timerVal = getTimerVal();
        if (shouldIncrementTime) {
            timerVal++;
        }

        setTimerVal(timerVal);
    }, 1000);
}

function isGamePaused() {
    const el = el_gamePausedContainer;
    return el.style.display && el.style.display !== 'none';
}

function isShowingHighScores() {
    return el_highScoresModal.style.display && el_highScoresModal.style.display !== 'none';
}

function getBoardContainerElement() {
    return el_boardContainer ?? boardElementRef!;
}

function handlePause(isResettingGame: boolean = false) {
    if (gameState !== GameStateType.PLAYING || isShowingHighScores()) {
        return;
    }

    const boardContainer = getBoardContainerElement();

    const shouldPauseGame = !isGamePaused() && !isResettingGame;
    if (shouldPauseGame) {
        boardElementRef = boardContainer;
        boardParent = boardContainer.parentNode;
        boardPlaceholder = document.createComment('board placeholder');

        boardParent!.replaceChild(boardPlaceholder, boardElementRef);

        el_gamePausedContainer.style.display = 'flex';
        el_pauseBtn.innerText = 'play_arrow'
        shouldIncrementTime = false;
    } else {
        if (boardPlaceholder !== null) {
            boardPlaceholder!.replaceWith(boardElementRef!);
        }

        el_gamePausedContainer.style.display = 'none';
        el_pauseBtn.innerText = 'pause';
        shouldIncrementTime = true;
    }
}

function getTimerVal() {
    return parseInt(el_timerVal.innerText); 
}

function setTimerVal(value: number) {
    el_timerVal.innerHTML = value.toString();
}

function clearTimer() {
    clearInterval(timerId);
    shouldIncrementTime = false;
}

function initBoardOnFirstClick(firstClickRow: number, firstClickCol: number): void {
    const firstClickNeighbours = getNeighbours(firstClickRow, firstClickCol).map(n => getCoordKey(n.r, n.c));
    const maxPossibleSafeSquares = Math.min(1 + firstClickNeighbours.length, (rowCount() * colCount()) - mineCount!); 

    const safeSquaresOnInit: Set<string> = new Set(
        [
            getCoordKey(firstClickRow, firstClickCol), 
            ...firstClickNeighbours
        ].slice(0, maxPossibleSafeSquares)
    ); 

    const mineCoordKeys = generateMineCoordinatesOnInit(safeSquaresOnInit);

    const rows = rowCount();
    const cols = colCount();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
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
    const rows = rowCount();
    const cols = colCount();

    const mines: Set<string> = new Set();
    for (let i = 0; i < mineCount!; i++) {
        let r = getRandomCoord(rows);
        let c = getRandomCoord(cols);
        let coordKey = getCoordKey(r, c);

        while (isExempt(coordKey) || mines.has(coordKey)) {
            r = getRandomCoord(rows);
            c = getRandomCoord(cols);
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
    const rows = rowCount();
    const cols = colCount();

    let boardContainer = getBoardContainerElement();
    boardContainer.innerHTML = '';
    boardContainer.style.setProperty('--cols', String(colCount()));
    boardContainer.style.setProperty('--rows', String(rowCount()));
    boardContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            var elem = document.createElement('div');
            elem.id = `cell_${r}_${c}`;
            elem.className = getCellClassName(board[r][c]);
            boardContainer.appendChild(elem);

            elem.setAttribute('data-row', r.toString());
            elem.setAttribute('data-col', c.toString());

            elem.addEventListener('mouseover', (e) => onMouseOver(e));
            elem.addEventListener('mouseout', () => curHoveredCellDataset = null);
        }
    }
}

function getStoredDifficulty() {
    return (localStorage.getItem('difficulty') as DifficultyType) ?? undefined;
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
            targetRow < 0 || targetRow > rowCount() - 1
            || targetCol < 0 || targetCol > colCount() - 1
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
        removeViableMoveStyles(updatedCell.r, updatedCell.c);
    }

    assignCellDefaultClassName(updatedCell.r, updatedCell.c, getCellClassName(updatedCell));
}

function removeViableMoveStyles(r: number, c: number) {
    SOLVED_CELL_CLASSNAMES.forEach(className => { 
        const cellEl = el_cell(r, c);
        cellEl.classList.remove(className) 

        const solvedCellPTag = cellEl.getElementsByTagName('p')?.[0];
        if (solvedCellPTag) {
            solvedCellPTag.classList.remove(className);
            solvedCellPTag.innerText = '' ;
        }
    });
}

function assignCellDefaultClassName(r: number, c: number, classNameToAssign: string) {
    if (!DEFAULT_CELL_CLASSNAMES.includes(classNameToAssign)) {
        throw new Error('Invalid cell classname');
    }

    const elem = el_cell(r, c)!;
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
    const el = el_title;

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

    const usedColors = [];
    for (let i = 0; i < title.length; i++) {
        const randColor = randArrayEntry(colors);
        let colorToUse = randColor;

        while (i !== 0 && usedColors[usedColors.length - 1] === colorToUse) {
            colorToUse = randArrayEntry(colors);
        }

        usedColors.push(colorToUse);

        const style = `color: rgb(${colorToUse});`;
        spanElements.push(`<span class='title-char' style='${style}'>${title[i]}</span>`);
    }

    el.innerHTML = spanElements.join('');
}

function resetHighScores() {
    Object.values(DifficultyType).forEach(d => localStorage.setItem(`${d}-high-score`, ''));
}

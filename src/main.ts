import { Cell } from "./models/cell.js";
import { CellStates } from "./models/cell-states.js";
import { BoardDimensions } from "./models/board-dimensions.js";
import { cleanupSolverCache, findViableMoves } from "./solver.js";
import { SOLVED_SAFE_CLASSNAME, SOLVED_MINE_CLASSNAME, DEFAULT_CELL_CLASSNAMES, SOLVED_CELL_CLASSNAMES, CELL_FLAG_CLASSNAME, CELL_CLOSED_CLASSNAME, CELL_MINE_RED_CLASSNAME, CELL_MINE_CLASSNAME, CELL_0_CLASSNAME, CELL_1_CLASSNAME, CELL_2_CLASSNAME, CELL_3_CLASSNAME, CELL_4_CLASSNAME, CELL_5_CLASSNAME, CELL_6_CLASSNAME, CELL_7_CLASSNAME, CELL_8_CLASSNAME, SAMPLE_BOARD } from './constants.js';

let board: Cell[][] = [];
let previousBoardState: Cell[][] = [];
let boardDimensions: BoardDimensions = new BoardDimensions(16, 16); // default to medium board

let isGameLost: boolean = false;
let isGameWon: boolean = false;
let isFirtClick: boolean = true;

let columnCount: number | undefined; 
let rowCount: number | undefined; 
let mineCount: number | undefined; 

let curHoveredCellDataset: DOMStringMap | null = null;

let currentlyXrayedCell: number[] = [];

let hasShownHintForCurrentMove: boolean = true;
let shouldShowViableMoves: boolean = false;

let shouldIncrementTime: boolean = false;
let timerVal: number = 0;
let timerId: number = 0;

let isShowingHighScores: boolean = false;

enum Difficulties {
    EASY = "easy",
    MEDIUM = "medium",
    EXPERT = "expert",
}

const difficultyStringToEnumKeyMap: Map<string, Difficulties> = new Map([
    ["easy", Difficulties.EASY],
    ["medium", Difficulties.MEDIUM],
    ["expert", Difficulties.EXPERT],
])

const difficultyToDimensionsMap: Map<string, BoardDimensions> = new Map([
    [Difficulties.EASY, new BoardDimensions(9, 9)],
    [Difficulties.MEDIUM, new BoardDimensions(16, 16)],
    [Difficulties.EXPERT, new BoardDimensions(30, 16)],
]);

const mineCountMap: Map<string, number> = new Map([
    [Difficulties.EASY, 10],
    [Difficulties.MEDIUM, 40],
    [Difficulties.EXPERT, 99],
]);

window.onload = () => handleNewGame(getStoredDifficulty() ?? 'medium', false);

document.getElementById('easy-btn')!.addEventListener('click', () => handleNewGame('easy', true));
document.getElementById('medium-btn')!.addEventListener('click', () => handleNewGame('medium', true));
document.getElementById('expert-btn')!.addEventListener('click', () => handleNewGame('expert', true));

document.getElementById('space-btn')!.addEventListener('click', () => startGame());

document.getElementById('high-scores-btn')!.addEventListener('click', () => showOrHideHighScores(true));
document.getElementById('close-high-scores-btn')!.addEventListener('click', () => showOrHideHighScores(false));

const hintCheckbox = document.getElementById('hint-checkbox')! as HTMLInputElement;
hintCheckbox.addEventListener('click', () => { 
    shouldShowViableMoves = hintCheckbox.checked;
    checkIfShouldShowViableMoves(); 
});

document.getElementById('continue-btn')!.addEventListener('click', () => handleContinueGame());

const colsSlider = document.getElementById('cols-slider') as HTMLInputElement;
colsSlider.oninput = () => {
    document.getElementById('cols-slider-value')!.innerHTML = colsSlider.value;

    columnCount = parseInt(colsSlider.value); 

    handleNewGame(getStoredDifficulty()!, false)
    minesSlider.max = getMaxMineCount().toString();
};
const rowsSlider = document.getElementById('rows-slider') as HTMLInputElement;
rowsSlider.oninput = () => {
    document.getElementById('rows-slider-value')!.innerHTML = rowsSlider.value;
    rowCount = parseInt(rowsSlider.value); 
    handleNewGame(getStoredDifficulty()!, false)
    minesSlider.max = getMaxMineCount().toString();
};
const minesSlider = document.getElementById('mines-slider') as HTMLInputElement;
minesSlider.oninput = () => {
    document.getElementById('mines-slider-value')!.innerHTML = minesSlider.value;
    mineCount = parseInt(minesSlider.value); 
    handleNewGame(getStoredDifficulty()!, false)
};

window.addEventListener('resize', () => setZoom());

document.addEventListener('keydown', (e) => {
    if (!shouldProcessInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    const k = e.key.toLowerCase();
    if (k === "f") handleOpenCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (k === "g") handleCellSecondaryClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});

document.addEventListener('keyup', (e) => {
    if (e.key === " " && !isShowingHighScores) {
        startGame();
        return;
    }

    if (!shouldProcessInput()) return;

    const hoveredRowAndColumn = getHoveredRowAndColumn();

    const k = e.key.toLowerCase();
    if (k === "f") processCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]); 
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

function setStylesOnHighScoresModelAction(shouldShow: boolean) {
    const modal = document.getElementById('high-scores-modal')!;
    modal.style.display = shouldShow ? 'flex' : 'none';

    const allElements = document.getElementsByTagName('*');
    for (const el of allElements) {
        if (el === modal || modal.contains(el) || el.tagName === 'BODY' || el.tagName === 'HTML') {
            continue;
        }

        const htmlEl = el as HTMLElement;

        if (shouldShow) {
            htmlEl.style.opacity = '0.5';
            htmlEl.style.pointerEvents = 'none';
        } else {
            htmlEl.style.opacity = '1';
            htmlEl.style.pointerEvents = 'auto';
        }
    }

    if (shouldShow) {
        for (const difficulty of Object.values(Difficulties)) {
            const highScore = getHighScore(difficulty);
            console.log(highScore);
            document.getElementById(`${difficulty}-high-score`)!.innerHTML = Number.isNaN(highScore) ? 'never completed' : `${highScore} seconds`
        }
    }
}

function processCellMainClick(r: number, c: number) {
    handleCellMainClick(r, c);
    checkIfShouldShowViableMoves();
}

function getHoveredRowAndColumn() {
    return [parseInt(curHoveredCellDataset!.row!), parseInt(curHoveredCellDataset!.col!)];
}

function shouldProcessInput() {
    return !isShowingHighScores && !isGameLost && !isGameWon && curHoveredCellDataset?.row !== undefined && curHoveredCellDataset?.col !== undefined;
}

function handleNewGame(difficulty: string, didClickDifficulty: boolean) {
    localStorage.setItem('difficulty', difficulty);

    boardDimensions = difficultyToDimensionsMap.get(difficulty)!;
    if (didClickDifficulty || columnCount === undefined || rowCount === undefined || mineCount === undefined) {
        columnCount = boardDimensions.columns;
        rowCount = boardDimensions.rows;
        mineCount = mineCountMap.get(difficulty);
    }

    setZoom();
    startGame();
}

function getMaxMineCount() {
    return rowCount! * columnCount! - 10;
}

function setZoom() {
    const container = document.getElementById('board-container')!;

    const originalHeight = rowCount! * 44;
    //const originalWidth = columnCount! * 44;

    const maxHeight = getHeightBetweenTopAndBottom() - 90; 
    //const maxWidth = window.innerWidth - 320; 

    // const heightScale = maxHeight / originalHeight;
    // const widthScale = maxWidth / originalWidth;

    //const scaleFactor = Math.min(heightScale, widthScale);
    
    const scaleFactor = maxHeight / originalHeight;
    container.style.transform = `scale(${scaleFactor})`;
}

function getHeightBetweenTopAndBottom() {
    const topBarElem = document.getElementById('top-bar')!;
    const topBarHeight: number = topBarElem.offsetHeight;

    const bottomBarElem = document.getElementById('bottom-bar')!
    const bottomBarHeight: number = bottomBarElem.offsetHeight;

    return window.innerHeight - topBarHeight - bottomBarHeight;
}

function resetDifficultiesUnderlines() {
    Object.values(Difficulties).forEach(d => {
        const difficultyBtn = document.getElementById(`${d}-btn`)!;
        difficultyBtn.classList.remove("soft-underline");
    });
}

function startGame() {
    clearTimer();
    setTimerVal(0);

    isGameLost = false;
    isGameWon = false;
    isFirtClick = true;

    initEmptyBoard();
    setNewGameStyles();
    cleanupSolverCache();
}

function checkIfShouldShowViableMoves() {
    if (!areAnyCellsOpen()) return;

    if (!shouldShowViableMoves) {
        hideViableMoves();
    } else {
        findViableMoves(board);
        hasShownHintForCurrentMove = true;
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

function areAnyCellsOpen() {
    let atLeastOneCellOpen = false;
    for (const row of board) {
        for (const cell of row) {
            if (cell.isOpen)  {
                atLeastOneCellOpen = true;
                break;
            }
        }
        if (atLeastOneCellOpen) break;
    }

    return atLeastOneCellOpen;
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
        hidePreviouslyXrayedNeigbours()
    }

    const closedNeighbours = getNeighbours(r, c).filter(n => !n.isOpen && !n.isFlagged);
    for (const n of closedNeighbours) {
        assignCellDefaultClassName(n.r, n.c, 'cell-0');
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
        assignCellDefaultClassName(n.r, n.c, 'cell-closed');
    }
}

function handleCellMainClick(r: number, c: number): void {
    previousBoardState = JSON.parse(JSON.stringify(board));

    hidePreviouslyXrayedNeigbours();

    const cell = board[r][c];
    if (cell.isFlagged) {
        return;
    }

    hasShownHintForCurrentMove = false;

    if (isFirtClick) {
        handleFirstClick(r, c);
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

    checkIfGameLost(cell);
    if (isGameLost) {
        return;
    }

    checkIfGameWon();
    if (isGameWon) {
        showMineLocations();
    }
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

    updateCell(cell)
}

function checkIfGameLost(openedCell: Cell) {
    if (openedCell.cellState !== CellStates.MINE) {
        return;
    }

    shouldIncrementTime = false;
    isGameLost = true;
    document.getElementById('game-state-msg')!.innerHTML = 'you lost;&nbsp;';
    document.getElementById('game-state-msg')!.className = 'txt lose-msg';
    document.getElementById('continue-btn')!.style.display = 'block';
    document.getElementById('board-container')!.style.filter = 'blur(1px)';
    document.getElementById('game-over-container')!.style.display = 'flex';
    document.getElementById('game-over-container')!.style.boxShadow = '10px 10px 0 red, -10px -10px 0 red';
}

function checkIfGameWon() {
    let closedCellsCount = 0; 
    board.forEach(row => row.filter(cell => closedCellsCount += !cell.isOpen ? 1 : 0)); 
    if (closedCellsCount !== mineCount!) { 
        return; 
    }

    shouldIncrementTime = false;
    isGameWon = true;
    document.getElementById('game-state-msg')!.innerHTML = 'you won!';
    document.getElementById('game-state-msg')!.className = 'txt win-msg';
    document.getElementById('board-container')!.style.filter = 'blur(1px)';
    document.getElementById('game-over-container')!.style.display = 'flex';
    document.getElementById('game-over-container')!.style.boxShadow = '10px 10px 0 gold, -10px -10px 0 gold';

    checkIfShouldSetHighScore();
}

function checkIfShouldSetHighScore() {
    if (!isPlayingOnNativeDifficulty()) {
        return;
    }

    const difficulty = difficultyStringToEnumKeyMap.get(
        Array.from(difficultyToDimensionsMap.entries())
            .filter(entry => entry[1].rows === rowCount && entry[1].columns === columnCount)[0][0]
    );

    if (difficulty !== undefined) {
        const currentHighScore = getHighScore(difficulty);

        if (Number.isNaN(currentHighScore) || timerVal < currentHighScore) {
            setHighScore(difficulty, timerVal)
        }
    }
}

function handleContinueGame() {
    shouldIncrementTime = true;

    board = previousBoardState;
    drawBoard();

    isGameLost = false;
    setNewGameStyles();

    if (shouldShowViableMoves) {
        findViableMoves(board);
    }
}

function setNewGameStyles() {
    document.getElementById('game-state-msg')!.innerHTML = '';
    document.getElementById('continue-btn')!.style.display = 'none';
    document.getElementById('board-container')!.style.filter = 'none';
    document.getElementById('continue-btn')!.style.display = 'none';
    document.getElementById('game-over-container')!.style.display = 'none';


    setSliderValues();
    setFlagsLeft(mineCount!);

    resetDifficultiesUnderlines();
    handleDifficultyUnderline();
}

function isPlayingOnNativeDifficulty() {
    return Array.from(difficultyToDimensionsMap).some(val => val[1].rows === rowCount! && val[1].columns === columnCount!);
}

function handleDifficultyUnderline() {
    if (isPlayingOnNativeDifficulty()) {
        document.getElementById(`${localStorage.getItem('difficulty')!}-btn`)!.classList.add("soft-underline");
    }
}

function setFlagsLeft(newValue: number) {
    document.getElementById('flags-left')!.innerHTML = newValue.toString();
}

function getFlagsLeft() {
    return parseInt(document.getElementById('flags-left')!.innerHTML); 
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

function clearTimer() {
    clearInterval(timerId);
    shouldIncrementTime = false;
}

function setTimerVal(value: number) {
    timerVal = value;
    document.getElementById('timer')!.innerHTML = `${timerVal.toString()}s`;
}

function setSliderValues() {
    minesSlider.max = getMaxMineCount().toString();

    document.getElementById('cols-slider-value')!.innerHTML = columnCount!.toString();
    document.getElementById('rows-slider-value')!.innerHTML = rowCount!.toString();
    document.getElementById('mines-slider-value')!.innerHTML = mineCount!.toString();
    colsSlider.value = columnCount!.toString();
    rowsSlider.value = rowCount!.toString();
    minesSlider.value = mineCount!.toString();
}

function showMineLocations() {
    board.forEach(row => {
        for (const cell of row) {
            if (cell.cellState === CellStates.MINE) {
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
            if (n.cellState === CellStates.MINE) {
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
    initBoardOnClick(clickedRow, clickedCol);
    isFirtClick = false;

    startTimer();
}

function initEmptyBoard() {
    board = [];

    for (let r = 0; r < rowCount!; r++) {
        board[r] = []
        for (let c = 0; c < columnCount!; c++) {
            board[r][c] = new Cell(r, c, 0, CellStates.SAFE, false, false);
        }
    }

    drawBoard();
}

function initBoardOnClick(firstClickRow: number, firstClickCol: number): void {
    // board = JSON.parse(SAMPLE_BOARD);
    // drawBoard();
    // return;

    const safeSquaresOnInit = [[firstClickRow, firstClickCol], ...getNeighbours(firstClickRow, firstClickCol).map(cell => [cell.r, cell.c])];
    const mineCoords = generateMineCoordinatesOnInit(safeSquaresOnInit);

    for (let r = 0; r < rowCount!; r++) {
        board[r] = []
        for (let c = 0; c < columnCount!; c++) {
            if (safeSquaresOnInit.some(coords => coords[0] === r && coords[1] === c)) {
                board[r][c] = new Cell(r, c, 0, CellStates.SAFE, true, false);
            } else if (mineCoords.some(coords => coords.r === r && coords.c === c)) {
                board[r][c] = new Cell(r, c, null, CellStates.MINE, false, false);
            } else {
                board[r][c] = new Cell(r, c, 0, CellStates.SAFE, false, false);
            }
        }
    }

    for (let r = 0; r < rowCount!; r++) {
        for (let c = 0; c < columnCount!; c++) {
            if (!mineCoords.some(coords => coords.r === r && coords.c === c)) {
                let surroundingMineCount = getCellSurroundingMineCount(r, c, mineCoords);
                board[r][c] = new Cell(r, c, surroundingMineCount, CellStates.SAFE, false, false);
            }
        }
    }

    const firstClickSquare = board[firstClickRow][firstClickCol];
    firstClickSquare.isOpen = true;
    updateCell(firstClickSquare);

    drawBoard();
}

function drawBoard(): void {
    let boardContainer = document.getElementById('board-container')!;
    boardContainer.innerHTML = '';
    boardContainer.style.setProperty('--cols', String(columnCount));
    boardContainer.style.setProperty('--rows', String(rowCount));
    boardContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    for (let r = 0; r < rowCount!; r++) {
        for (let c = 0; c < columnCount!; c++) {
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

function getCellSurroundingMineCount(r: number, c: number, mineCoords: any[]) {
    let surroundingMineCount = 0
    let neighbours = getNeighbours(r, c);

    for (let n of neighbours) {
        if (mineCoords.some(m => m.r === n.r && m.c === n.c)) {
            surroundingMineCount++;
        }
    }

    return surroundingMineCount;
}

function generateMineCoordinatesOnInit(exemptCoords: number[][]) {
    const isExempt = (r: number, c: number) =>
        exemptCoords.some(([er, ec]) => er === r && ec === c);

    const mines: { r: number; c: number }[] = [];
    for (let i = 0; i < mineCount!; i++) {
        let r = Math.floor(Math.random() * rowCount!);
        let c = Math.floor(Math.random() * columnCount!);

        while (isExempt(r, c) || mines.some(m => m.r === r && m.c === c)) {
            r = Math.floor(Math.random() * rowCount!);
            c = Math.floor(Math.random() * columnCount!);
        }

        mines.push({ r: r, c: c });
    }

    return mines;
}

function getStoredDifficulty() {
    return localStorage.getItem('difficulty')
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
            || targetCol < 0 || targetCol > columnCount! - 1
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
    } else if (cell.cellState === CellStates.MINE) {
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
                throw new Error("Cell is invalid");
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
        throw new Error("Invalid cell classname");
    }

    const elem = getHtmlElementByCoords(r, c)!;

    DEFAULT_CELL_CLASSNAMES.forEach(className => elem.classList.remove(className));
    elem.classList.add(classNameToAssign);
}

function getHighScore(difficulty: Difficulties) {
    const storedHighScore = localStorage.getItem(`${difficulty}-high-score`);
    if (storedHighScore === null) {
        return NaN;
    }

    return parseInt(storedHighScore);
}

function setHighScore(difficulty: Difficulties, score: number) {
    localStorage.setItem(`${difficulty}-high-score`, score.toString())
}

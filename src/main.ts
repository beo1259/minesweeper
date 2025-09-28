import { Cell } from "./models/cell.js";
import { CellState } from "./models/cell-states.js";
import { BoardDimensions } from "./models/board-dimensions.js";

let board: Cell[][] = [];
let isGameOver: boolean = true;
let isFirtClick: boolean = true;
let curHoveredCellDataset: DOMStringMap | null = null;
let boardDimensions: BoardDimensions = new BoardDimensions(16, 16); // default to medium board

const difficultyMap: Map<string, BoardDimensions> = new Map([
    ['easy', new BoardDimensions(9, 9)],
    ['medium', new BoardDimensions(16, 16)],
    ['expert', new BoardDimensions(30, 16)],
]);

const mineCountMap: Map<string, number> = new Map([
    ['easy', 10],
    ['medium', 40],
    ['expert', 99],
]);

window.onload = function (): void {
    handleNewGame(getStoredDifficulty() ?? 'medium');
}

document.getElementById('easy-btn')!.addEventListener('click', () => handleNewGame('easy'));
document.getElementById('medium-btn')!.addEventListener('click', () => handleNewGame('medium'));
document.getElementById('expert-btn')!.addEventListener('click', () => handleNewGame('expert'));

document.addEventListener('keyup', (e) => {
    if (e.key === " ") {
        startGame();
        return;
    }
    if (isGameOver || !curHoveredCellDataset?.row || !curHoveredCellDataset?.col) return;

    const r = parseInt(curHoveredCellDataset!.row!);
    const c = parseInt(curHoveredCellDataset!.col!);

    const k = e.key.toLowerCase();
    if (k === "f") handleCellMain(r, c);
    else if (k === "g") handleCellSecondary(r, c);
})

document.addEventListener('mouseup', (e) => {
    if (isGameOver || !curHoveredCellDataset?.row || !curHoveredCellDataset?.col) return;

    const element = document.getElementById((e.target as HTMLElement).id);
    const r = parseInt(element!.dataset.row!);
    const c = parseInt(element!.dataset.col!);

    if (e.button === 0) handleCellMain(r, c);
    else if (e.button === 2) handleCellSecondary(r, c);
})

function handleNewGame(difficulty: string) {
    localStorage.setItem('difficulty', difficulty);
    boardDimensions = difficultyMap.get(difficulty)!;
    startGame();
}

function startGame() {
    isGameOver = false;
    isFirtClick = true;
    document.getElementById('status-msg')!.style.opacity = '0';
    initEmptyBoard();
}

function handleGameOver() {
    isGameOver = true;
    document.getElementById('status-msg')!.style.opacity = '1';
}

function handleCellMain(r: number, c: number): void {
    if (isFirtClick) {
        handleFirstClick(r, c);
    }

    const cell = board[r][c];

    if (cell.cellState === CellState.Mine) {
        handleGameOver();
    } else if (cell.isFlagged) {
        return;
    } else if (cell.isOpen) {
        handleChord(cell);
        return;
    }

    cell.isOpen = true;
    updateCell(cell);
    if (cell.value === 0) {
        floodAndFill(cell.r, cell.c);
    }
}

function handleFirstClick(clickedRow: number, clickedCol: number) {
    initBoardOnClick(clickedRow, clickedCol);
    isFirtClick = false;
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

        if (n.cellState === CellState.Mine) {
            handleGameOver();
            return;
        }
    }
}

function handleCellSecondary(r: number, c: number): void {
    const cell = board[r][c];
    if (cell.isOpen) {
        return;
    } else if (cell.isFlagged) {
        cell.isFlagged = false
    } else {
        cell.isFlagged = true;
    }

    updateCell(cell)
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
            if (n.cellState === CellState.Mine) {
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

function updateCell(updatedCell: Cell) {
    if (updatedCell.isFlagged) {
        updatedCell.isOpen = false;
    } else if (updatedCell.isOpen) {
        updatedCell.isFlagged = false;
    }

    let htmlCell = document.getElementById(`cell_${updatedCell.r}_${updatedCell.c}`);
    htmlCell!.className = `cell ${getCellClassName(updatedCell)}`;
}

function initEmptyBoard() {
    board = [];

    for (let r = 0; r < boardDimensions.rows; r++) {
        board[r] = []
        for (let c = 0; c < boardDimensions.columns; c++) {
            board[r][c] = new Cell(r, c, 0, CellState.Safe, false, false);
        }
    }

    drawBoard();
}

function initBoardOnClick(firstClickRow: number, firstClickCol: number): void {
    const emptySquaresOnInit = [[firstClickRow, firstClickCol], ...getNeighbours(firstClickRow, firstClickCol).map(cell => [cell.r, cell.c])];
    const mineCoords = getMineCoordinatesOnInit(emptySquaresOnInit);

    for (let r = 0; r < boardDimensions.rows; r++) {
        board[r] = []
        for (let c = 0; c < boardDimensions.columns; c++) {
            if (emptySquaresOnInit.some(coords => coords[0] === r && coords[1] === c)) {
                board[r][c] = new Cell(r, c, 0, CellState.Safe, false, false);
            } else if (mineCoords.some(coords => coords.r === r && coords.c === c)) {
                board[r][c] = new Cell(r, c, null, CellState.Mine, false, false);
            } else {
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

function drawBoard(): void {
    let boardContainer = document.getElementById('board-container')!;
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

function getMineCoordinatesOnInit(exemptCoords: number[][]) {
    let mineCount = mineCountMap.get(getStoredDifficulty() ?? 'medium')!;

    const isExempt = (r: number, c: number) =>
        exemptCoords.some(([er, ec]) => er === r && ec === c);

    const mines: { r: number; c: number }[] = [];
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
            targetRow < 0 || targetRow > boardDimensions.rows - 1
            || targetCol < 0 || targetCol > boardDimensions.columns - 1
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
        return 'cell-flag';
    } else if (!cell.isOpen) {
        return 'cell-closed';
    } else if (cell.cellState === CellState.Mine) {
        return cell.isOpen ? 'cell-mine-red' : 'cell-mine';
    } else {
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

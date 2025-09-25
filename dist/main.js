import { Cell } from "./models/cell.js";
import { CellState } from "./models/cell-states.js";
let board = [];
let curHoveredCellDataset = null;
window.onload = function () {
    initBoard(8, 8);
};
document.addEventListener('keyup', (e) => {
    const x = parseInt(curHoveredCellDataset.row);
    const y = parseInt(curHoveredCellDataset.col);
    const k = e.key.toLowerCase();
    if (k === "f")
        handleCellMain(x, y);
    else if (k === "g")
        handleCellSecondary(x, y);
});
document.addEventListener('mouseup', (e) => {
    const x = parseInt(curHoveredCellDataset.row);
    const y = parseInt(curHoveredCellDataset.col);
    if (e.button === 0)
        handleCellMain(x, y);
    else if (e.button === 2)
        handleCellSecondary(x, y);
});
export function handleCellMain(x, y) {
    const cell = board[x][y];
    if (cell.cellState === CellState.Flagged || cell.isOpen)
        return;
    cell.isOpen = true;
    let updatedCell = new Cell(x, y, cell.value, cell.cellState, true);
    updateCell(x, y, updatedCell);
}
export function handleCellSecondary(x, y) {
    let updatedCell = new Cell(x, y, 0, CellState.Flagged, true);
    updateCell(x, y, updatedCell);
}
function getCellByCoords(x, y) {
    return board[x][y];
}
function updateCell(x, y, updatedCell) {
    board[x][y] = updatedCell;
    let htmlCell = document.getElementById(`cell_${x}_${y}`);
    htmlCell.className = getCellClassName(updatedCell);
}
function initBoard(xSize, ySize) {
    initBoardMatrix(xSize, ySize);
    drawBoard(xSize, ySize);
}
function initBoardMatrix(xSize, ySize) {
    const mineCoords = getMineCoordinatesOnInit(xSize, ySize);
    for (let x = 0; x < xSize; x++) {
        board[x] = [];
        for (let y = 0; y < ySize; y++) {
            if (mineCoords.some(c => c[0] === x && c[1] === y)) {
                board[x][y] = new Cell(x, y, null, CellState.Mine, false);
            }
            else {
                board[x][y] = new Cell(x, y, null, CellState.Safe, false);
            }
        }
    }
}
function getMineCoordinatesOnInit(xSize, ySize) {
    let mineCount = getMineCountByBoardSize(xSize, ySize);
    let mines = [];
    for (let i = 0; i < mineCount; i++) {
        let randRowIndex = 0;
        let randColIndex = 0;
        while (!mines.some(m => m[0] === randRowIndex && m[1] === randColIndex)) {
            randRowIndex = Math.floor(Math.random() * ySize);
            randColIndex = Math.floor(Math.random() * xSize);
        }
        mines.push([randRowIndex, randColIndex]);
    }
    console.log(mines);
    return mines;
}
function onMouseOver(mouseEvent) {
    const e = mouseEvent.target;
    curHoveredCellDataset = document.getElementById(e.id).dataset;
}
function drawBoard(xSize, ySize) {
    let boardContainer = document.getElementById('board-container');
    boardContainer.style.setProperty('--cols', String(ySize));
    boardContainer.style.setProperty('--rows', String(xSize));
    boardContainer.addEventListener('contextmenu', (e) => e.preventDefault());
    for (let x = 0; x < xSize; x++) {
        for (let y = 0; y < ySize; y++) {
            var elem = document.createElement('div');
            boardContainer.appendChild(elem);
            elem.id = `cell_${x}_${y}`;
            elem.className = `cell ${getCellClassName(board[x][y])}`;
            elem.setAttribute('data-row', x.toString());
            elem.setAttribute('data-col', y.toString());
            elem.addEventListener('mouseover', (e) => onMouseOver(e));
            elem.addEventListener('mouseout', () => curHoveredCellDataset = null);
        }
    }
}
function getCellClassName(cell) {
    if (cell.cellState === CellState.Flagged) {
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
function getMineCountByBoardSize(xSize, ySize) {
    if (xSize === 8 && ySize === 8)
        return 10;
    if (xSize === 16 && ySize === 16)
        return 40;
    if (xSize === 30 && ySize === 16)
        return 99;
    else
        throw new Error("Invalid board size");
}

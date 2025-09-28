"use strict";
document.getElementById('easy-btn').addEventListener('click', () => handleNewGame('easy'));
document.getElementById('medium-btn').addEventListener('click', () => handleNewGame('medium'));
document.getElementById('expert-btn').addEventListener('click', () => handleNewGame('expert'));
document.addEventListener('keyup', (e) => {
    if (e.key === " ") {
        startGame();
        return;
    }
    if (isGameOver || !curHoveredCellDataset?.row || !curHoveredCellDataset?.col)
        return;
    const r = parseInt(curHoveredCellDataset.row);
    const c = parseInt(curHoveredCellDataset.col);
    const k = e.key.toLowerCase();
    if (k === "f")
        handleCellMain(r, c);
    else if (k === "g")
        handleCellSecondary(r, c);
});
document.addEventListener('mouseup', (e) => {
    if (isGameOver || !curHoveredCellDataset?.row || !curHoveredCellDataset?.col)
        return;
    const element = document.getElementById(e.target.id);
    const r = parseInt(element.dataset.row);
    const c = parseInt(element.dataset.col);
    if (e.button === 0)
        handleCellMain(r, c);
    else if (e.button === 2)
        handleCellSecondary(r, c);
});
function handleCellMain(r, c) {
    const cell = board[r][c];
    if (cell.isFlagged) {
        return;
    }
    if (isFirtClick) {
        handleFirstClick(r, c);
    }
    if (cell.cellState === CellState.Mine) {
        handleGameOver();
    }
    else if (cell.isOpen) {
        handleChord(cell);
        return;
    }
    cell.isOpen = true;
    updateCell(cell);
    if (cell.value === 0) {
        floodAndFill(cell.r, cell.c);
    }
}
function handleFirstClick(clickedRow, clickedCol) {
    initBoardOnClick(clickedRow, clickedCol);
    isFirtClick = false;
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
        if (n.cellState === CellState.Mine) {
            handleGameOver();
            return;
        }
    }
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

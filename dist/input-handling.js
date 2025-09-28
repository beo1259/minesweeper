"use strict";
document.getElementById('easy-btn')
    .addEventListener('click', () => startGame(9, 9));
document.getElementById('medium-btn')
    .addEventListener('click', () => startGame(16, 16));
document.getElementById('expert-btn')
    .addEventListener('click', () => startGame(30, 16));
document.addEventListener('keyup', (e) => {
    if (e.key === " ") {
        startGame(dimensions[0], dimensions[1]);
        return;
    }
    if (isGameOver || !curHoveredCellDataset?.row || !curHoveredCellDataset?.col)
        return;
    const x = parseInt(curHoveredCellDataset.row);
    const y = parseInt(curHoveredCellDataset.col);
    const k = e.key.toLowerCase();
    if (k === "f")
        handleCellMain(x, y);
    else if (k === "g")
        handleCellSecondary(x, y);
});
document.addEventListener('mouseup', (e) => {
    if (isGameOver || !curHoveredCellDataset?.row || !curHoveredCellDataset?.col)
        return;
    const element = document.getElementById(e.target.id);
    const x = parseInt(element.dataset.row);
    const y = parseInt(element.dataset.col);
    if (e.button === 0)
        handleCellMain(x, y);
    else if (e.button === 2)
        handleCellSecondary(x, y);
});

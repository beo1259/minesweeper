"use strict";
document.getElementById('easy-btn').addEventListener('click', () => handleNewGame('easy', true));
document.getElementById('medium-btn').addEventListener('click', () => handleNewGame('medium', true));
document.getElementById('expert-btn').addEventListener('click', () => handleNewGame('expert', true));
document.getElementById('space-btn').addEventListener('click', () => startGame());
const hintCheckbox = document.getElementById('hint-checkbox');
hintCheckbox.addEventListener('click', () => {
    shouldShowViableMoves = hintCheckbox.checked;
    checkIfShouldShowViableMoves();
});
document.getElementById('continue-btn').addEventListener('click', () => handleContinueGame());
const colsSlider = document.getElementById('cols-slider');
colsSlider.oninput = () => {
    document.getElementById('cols-slider-value').innerHTML = colsSlider.value;
    columnCount = parseInt(colsSlider.value);
    handleNewGame(getStoredDifficulty(), false);
    minesSlider.max = getMaxMineCount().toString();
};
const rowsSlider = document.getElementById('rows-slider');
rowsSlider.oninput = () => {
    document.getElementById('rows-slider-value').innerHTML = rowsSlider.value;
    rowCount = parseInt(rowsSlider.value);
    handleNewGame(getStoredDifficulty(), false);
    minesSlider.max = getMaxMineCount().toString();
};
const minesSlider = document.getElementById('mines-slider');
minesSlider.oninput = () => {
    document.getElementById('mines-slider-value').innerHTML = minesSlider.value;
    mineCount = parseInt(minesSlider.value);
    handleNewGame(getStoredDifficulty(), false);
};
window.addEventListener('resize', () => setZoom());
document.addEventListener('keydown', (e) => {
    if (!shouldProcessInput())
        return;
    const hoveredRowAndColumn = getHoveredRowAndColumn();
    const k = e.key.toLowerCase();
    if (k === "f")
        handleOpenCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (k === "g")
        handleCellSecondaryClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
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
        processCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});
document.addEventListener('mouseup', (e) => {
    if (!shouldProcessInput())
        return;
    const hoveredRowAndColumn = getHoveredRowAndColumn();
    if (e.button === 0)
        processCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});
document.addEventListener('mousedown', (e) => {
    if (!shouldProcessInput())
        return;
    const hoveredRowAndColumn = getHoveredRowAndColumn();
    if (e.button === 0)
        handleOpenCellMainClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
    else if (e.button === 2)
        handleCellSecondaryClick(hoveredRowAndColumn[0], hoveredRowAndColumn[1]);
});
function processCellMainClick(r, c) {
    handleCellMainClick(r, c);
    checkIfShouldShowViableMoves();
}

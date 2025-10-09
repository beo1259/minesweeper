import { PlayerKnownCell } from "./models/player-known-cell.js";
import { getNeighbours } from "./main.js";
let _backendBoard = []; // readonly, set at start of solve()
let knownBoard = [];
export function analyzeBoard(board) {
    _backendBoard = board;
    knownBoard = getPlayerKnownBoard(_backendBoard);
    resetClosedCellHighlights();
    solve();
}
function solve() {
    const frontier = []; // cells that: are closed, touched an open cell with value > 0
    const openNumberCells = []; // cells that: are open and have a value > 0
    setStartingKnowledge(frontier, openNumberCells);
    const frontierCellCoordKeys = new Set(frontier.map(c => getCoordKey(c.r, c.c)));
    const openNumberCellCoordKeys = new Set(openNumberCells.map(c => getCoordKey(c.r, c.c)));
    let visited = new Set();
    const curMineAssignmentState = new Map(Array.from(frontierCellCoordKeys).map(key => [key, false])); // true = mine, false = safe
    const validStates = [];
    function backtrack(curMineAssignmentState) {
        if (areAllNumberedCellsSatisfied(curMineAssignmentState, openNumberCellCoordKeys)) {
            validStates.push(curMineAssignmentState);
            curMineAssignmentState = new Map();
            visited = new Set();
            console.log('all numbers satisfied');
            return;
        }
        let canPlaceMine = false;
        let i = 0;
        while (!canPlaceMine) {
            console.log(frontierCellCoordKeys.size - 1 <= i, visited);
            // if we aren't out of bounds and haven't visited this cell yet, it is a candidate
            if (frontierCellCoordKeys.size - 1 >= i) {
                const cellKey = [...frontierCellCoordKeys][i];
                if (!visited.has([...frontierCellCoordKeys][i])) {
                    const cellCoords = getCoordTupleFromKey(cellKey);
                    if (isSafeToPlaceMineAtCell(cellCoords[0], cellCoords[1], curMineAssignmentState)) {
                        console.log('is safe to place mine at', cellKey);
                        curMineAssignmentState.set(cellKey, true);
                        canPlaceMine = true;
                        backtrack(curMineAssignmentState);
                    }
                    console.log('past safety check');
                    i++;
                }
            }
            else {
                return;
            }
        }
    }
    // for (const f of frontierCellCoordKeys) {
    //     curMineAssignmentState.set(f, true);
    //     backtrack(curMineAssignmentState);
    // }
    console.log(validStates);
}
function areAllNumberedCellsSatisfied(assignedMineCoordKeys, openNumberCellCoordKeys) {
    for (const numberCellKey of openNumberCellCoordKeys) {
        const coordTuple = getCoordTupleFromKey(numberCellKey);
        const r = coordTuple[0];
        const c = coordTuple[1];
        const assignedAround = getPlayerKnownNeighbours(r, c)
            .map(n => getCoordKey(n.r, n.c))
            .filter(nKey => assignedMineCoordKeys.has(nKey) && assignedMineCoordKeys.get(nKey))
            .length;
        if (assignedAround !== knownBoard[r][c].knownValue) {
            return false;
        }
    }
    return true;
}
function isSafeToPlaceMineAtCell(r, c, assignedMineCoordKeys) {
    const numberedNeighbours = getPlayerKnownNeighbours(r, c)
        .filter(n => n.knownValue !== null && n.knownValue > 0);
    for (const nn of numberedNeighbours) {
        const assignedAround = getPlayerKnownNeighbours(nn.r, nn.c)
            .map(n => getCoordKey(n.r, n.c))
            .filter(nKey => assignedMineCoordKeys.has(nKey) && assignedMineCoordKeys.get(nKey)).length;
        if (assignedAround + 1 > nn.knownValue) {
            return false;
        }
    }
    return true;
}
function getMineCellProbabilities(validMineAssignmentConfigurations) {
    const numberOfAppearancesByCoordKey = new Map();
    for (const config of validMineAssignmentConfigurations) {
        config.forEach(coordKey => {
            if (!numberOfAppearancesByCoordKey.has(coordKey)) {
                numberOfAppearancesByCoordKey.set(coordKey, 1);
            }
            else {
                numberOfAppearancesByCoordKey.set(coordKey, numberOfAppearancesByCoordKey.get(coordKey) + 1);
            }
        });
    }
    console.log("mine cell appearances:", numberOfAppearancesByCoordKey);
    const mineProbabilityByKey = new Map();
    numberOfAppearancesByCoordKey.forEach((appearances, coordKey) => {
        mineProbabilityByKey.set(coordKey, appearances / validMineAssignmentConfigurations.length);
    });
    return mineProbabilityByKey;
}
function setStartingKnowledge(frontierArr, openNumberCellsArr) {
    if (frontierArr.length !== 0 || openNumberCellsArr.length !== 0) {
        throw new Error("frontierArr & openNumberCellsArr should be empty");
    }
    for (const row of knownBoard) {
        for (const cell of row) {
            if (isPlayerKnowCellFrontierCell(cell, getPlayerKnownNeighbours(cell.r, cell.c))) {
                frontierArr.push(cell);
            }
            else if (isPlayerKnowCellOpenNumberCell(cell)) {
                openNumberCellsArr.push(cell);
            }
        }
    }
}
function setCertainMineCells(openNumberCells, frontierCellCoordKeys, currentlyAssignedMines) {
    if (currentlyAssignedMines.length !== 0) {
        throw new Error("currentlyAssignedMines should be empty");
    }
    for (const onc of openNumberCells) {
        const oncNeighbours = getPlayerKnownNeighbours(onc.r, onc.c);
        const neighbouringFrontierCells = oncNeighbours.filter(n => frontierCellCoordKeys.has(getCoordKey(n.r, n.c)));
        if (neighbouringFrontierCells.length === onc.knownValue) {
            for (const n of neighbouringFrontierCells) {
                currentlyAssignedMines.push(knownBoard[n.r][n.c]);
                highlightAsMine(n.r, n.c);
            }
        }
    }
}
function resetClosedCellHighlights() {
    knownBoard.forEach(row => {
        row.forEach(cell => {
            if (!cell.isOpen) {
                const currentClassName = document.getElementById(`cell_${cell.r}_${cell.c}`).className;
                if (!currentClassName.includes('cell-flag') && !currentClassName.includes('cell-mine')) {
                    document.getElementById(`cell_${cell.r}_${cell.c}`).className = 'cell cell-closed';
                }
            }
        });
    });
}
function highlightAsMine(r, c) {
    document.getElementById(`cell_${r}_${c}`).className = 'cell cell-mine-found';
}
function getCoordKey(r, c) {
    return `${r},${c}`;
}
function getCoordTupleFromKey(coordKey) {
    return coordKey.split(',').map(coord => parseInt(coord));
}
function getPlayerKnowCellFromCoordKey(coordKey) {
    const coords = getCoordTupleFromKey(coordKey);
    return knownBoard[coords[0], coords[1]];
}
function isPlayerKnowCellFrontierCell(cell, neighbours) {
    return !cell.isOpen && neighbours.some(n => n.knownValue > 0);
}
function isPlayerKnowCellOpenNumberCell(cell) {
    return cell.isOpen && cell.knownValue > 0;
}
function getPlayerKnownNeighbours(r, c) {
    return getNeighbours(r, c).map(n => getPlayerKnownCellFromCell(_backendBoard[n.r][n.c]));
}
function getPlayerKnownBoard(board) {
    const knownBoard = [];
    for (const row of board) {
        knownBoard.push([]);
        for (const cell of row) {
            const newRow = knownBoard[knownBoard.length - 1];
            newRow.push(getPlayerKnownCellFromCell(cell));
        }
    }
    return knownBoard;
}
function getPlayerKnownCellFromCell(cell) {
    return new PlayerKnownCell(cell.r, cell.c, cell.isOpen ? cell.value : null);
}

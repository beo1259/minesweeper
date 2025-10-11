import { PlayerKnownCell } from "./models/player-known-cell.js";
import { SOLVED_SAFE_CLASSNAME, SOLVED_MINE_CLASSNAME } from './constants.js';
let _backendBoard = []; // readonly, set at start of solve() - only access for setting the known board, and the style of a safe/mine cell
let knownBoard = [];
let rowCount = 0;
let columnCount = 0;
let cachedSolvedMines = new Set();
export function analyzeBoard(board, rows, columns) {
    _backendBoard = board;
    knownBoard = getPlayerKnownBoard(_backendBoard);
    rowCount = rows;
    columnCount = columns;
    resetClosedCellHighlights();
    solve();
}
export function cleanupSolverCache() {
    cachedSolvedMines = new Set();
}
function solve() {
    const frontier = []; // cells that: are closed, touched an open cell with value > 0
    const openNumberCells = []; // cells that: are open and have a value > 0
    setStartingKnowledge(frontier, openNumberCells);
    const frontierCellCoordKeys = new Set(frontier.map(c => getCoordKey(c.r, c.c)));
    const openNumberCellCoordKeys = new Set(openNumberCells.map(c => getCoordKey(c.r, c.c)));
    const curState = getDefaultState(frontierCellCoordKeys, openNumberCells); // true = mine, false = safe
    const validStates = [];
    const stateStatusMap = new Map();
    const stateDomains = new Map();
    function backtrack(curState) {
        const curStateStringKey = getMapAsStringKey(curState);
        const curStateStatus = stateStatusMap.get(curStateStringKey);
        if (curStateStatus === 'solved')
            return true;
        else if (curStateStatus === 'dead')
            return false;
        else if (curStateStatus === undefined) {
            stateStatusMap.set(curStateStringKey, 'unknown');
        }
        // base case: we've found a valid state
        if (areAllNumberedCellsSatisfied(curState, openNumberCellCoordKeys)) {
            stateStatusMap.set(curStateStringKey, 'solved');
            validStates.push(curState);
            return true;
        }
        const nextPossibleStates = getNextPossibleValidStates(curState, frontierCellCoordKeys, stateStatusMap);
        // if no next possible states, we don't want to keep exploring this state in susquent recurses
        if (nextPossibleStates.length === 0) {
            stateStatusMap.set(curStateStringKey, 'dead');
            return false;
        }
        let anySolved = false;
        for (const state of nextPossibleStates) {
            const possibleStateStringKey = getMapAsStringKey(state);
            const possibleStateStatus = stateStatusMap.get(possibleStateStringKey);
            // make sure we don't revisit already solved states
            if (possibleStateStatus === 'dead' || possibleStateStatus === 'solved') {
                continue;
            }
            if (backtrack(state)) {
                anySolved = true;
            }
        }
        // if any child states were solved from our current state, we mark this parent as solved
        if (anySolved) {
            stateStatusMap.set(curStateStringKey, 'solved');
            return true;
        }
        else {
            stateStatusMap.set(curStateStringKey, 'dead');
            return false;
        }
    }
    backtrack(curState);
    handleMineOdds(validStates);
}
function getNextPossibleValidStates(curState, frontierCellCoordKeys, stateStatusMap) {
    const curStateStatus = stateStatusMap.get(getMapAsStringKey(curState));
    if (curStateStatus !== undefined && (curStateStatus === 'dead' || curStateStatus === 'solved')) {
        return [];
    }
    const nextPossibleStates = [];
    for (const coordKey of frontierCellCoordKeys) {
        if (curState.get(coordKey) === true) {
            continue;
        }
        const coordTuple = getCoordTupleFromKey(coordKey);
        const r = coordTuple[0];
        const c = coordTuple[1];
        const curStateDeepCopy = new Map(curState);
        if (isSafeToPlaceMineAtCell(r, c, curState)) {
            curStateDeepCopy.set(coordKey, true);
            nextPossibleStates.push(curStateDeepCopy);
        }
    }
    return nextPossibleStates;
}
function getMapAsStringKey(map) {
    // create a canonical key that is sorted deterministically, only strings are keys, convert true/false to 1/0 so they arent involved in string sorting. We only want our coords as strings here.
    return Array.from(map.entries())
        .sort((a, b) => a[0]
        .localeCompare(b[0])).map(kv => `${kv[0]}=${kv[1] ? 1 : 0}`)
        .join(';')
        .toString();
}
function handleMineOdds(validStates) {
    const validMineStatesCoordsOnly = [];
    const validSafeStatesCoordsOnly = [];
    for (const state of validStates) {
        const mineCoords = new Set();
        const safeCoords = new Set();
        for (const [coordKey, isMine] of state.entries()) {
            if (isMine) {
                mineCoords.add(coordKey);
            }
            else {
                safeCoords.add(coordKey);
            }
        }
        validMineStatesCoordsOnly.push(mineCoords);
        validSafeStatesCoordsOnly.push(safeCoords);
    }
    const mineProbabilities = getCellProbabilities(validMineStatesCoordsOnly, 1);
    for (const [coordKey, mineProbability] of mineProbabilities.entries()) {
        if (mineProbability === 1) {
            const coordTuple = getCoordTupleFromKey(coordKey);
            highlightAsMine(coordTuple[0], coordTuple[1]);
            cachedSolvedMines.add(coordKey);
        }
    }
    const safeProbabilities = getCellProbabilities(validSafeStatesCoordsOnly, 0);
    for (const [coordKey, safeProbability] of safeProbabilities.entries()) {
        if (safeProbability === 1) {
            const coordTuple = getCoordTupleFromKey(coordKey);
            highlightAsSafe(coordTuple[0], coordTuple[1]);
        }
    }
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
function getCellProbabilities(validAssignments, mineOrSafe) {
    const numberOfAppearancesByCoordKey = new Map();
    for (const config of validAssignments) {
        config.forEach(coordKey => {
            if (!numberOfAppearancesByCoordKey.has(coordKey)) {
                numberOfAppearancesByCoordKey.set(coordKey, 1);
            }
            else {
                numberOfAppearancesByCoordKey.set(coordKey, numberOfAppearancesByCoordKey.get(coordKey) + 1);
            }
        });
    }
    const cellProbabilityByKey = new Map();
    numberOfAppearancesByCoordKey.forEach((appearances, coordKey) => {
        cellProbabilityByKey.set(coordKey, appearances / validAssignments.length);
    });
    return cellProbabilityByKey;
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
function getDefaultState(frontierCellCoordKeys, openNumberCells) {
    cacheImmediateMineCoords(frontierCellCoordKeys, openNumberCells);
    return new Map(Array.from(frontierCellCoordKeys).map(key => [key, cachedSolvedMines.has(key)]));
}
function cacheImmediateMineCoords(frontierCellCoordKeys, openNumberCells) {
    for (const cell of openNumberCells) {
        const frontierNeighbours = getPlayerKnownNeighbours(cell.r, cell.c)
            .filter(n => frontierCellCoordKeys.has(getCoordKey(n.r, n.c)));
        if (frontierNeighbours.length === cell.knownValue) {
            frontierNeighbours.forEach(n => cachedSolvedMines.add(getCoordKey(n.r, n.c)));
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
    document.getElementById(`cell_${r}_${c}`).classList.add(SOLVED_MINE_CLASSNAME);
}
function highlightAsSafe(r, c) {
    const cell = _backendBoard[r][c];
    if (cell.isOpen) {
        return;
    }
    document.getElementById(`cell_${r}_${c}`).classList.add(SOLVED_SAFE_CLASSNAME);
}
export function getCoordKey(r, c) {
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
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1],
    ];
    let neighbours = [];
    for (let dir of directions) {
        const targetRow = r + dir[0];
        const targetCol = c + dir[1];
        if (targetRow < 0 || targetRow > rowCount - 1
            || targetCol < 0 || targetCol > columnCount - 1) {
            continue;
        }
        neighbours.push(knownBoard[targetRow][targetCol]);
    }
    return neighbours;
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

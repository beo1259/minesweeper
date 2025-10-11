import { PlayerKnownCell } from "./models/player-known-cell.js";
import { Cell } from "./models/cell.js";
import { SOLVED_SAFE_CLASSNAME, SOLVED_MINE_CLASSNAME } from './constants.js';

let _backendBoard: Cell[][] = []; // readonly, set at start of solve() - only access for setting the known board, and the style of a safe/mine cell
let knownBoard: PlayerKnownCell[][] = [];

let rowCount: number = 0;
let columnCount: number = 0;

let cachedSolvedMines: Set<string> = new Set();

export function analyzeBoard(board: Cell[][], rows: number, columns: number) {
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
    const frontier: PlayerKnownCell[] = []; // cells that: are closed, touched an open cell with value > 0
    const openNumberCells: PlayerKnownCell[] = []; // cells that: are open and have a value > 0
    setStartingKnowledge(frontier, openNumberCells);

    const frontierCellCoordKeys: Set<string> = new Set(frontier.map(c => getCoordKey(c.r, c.c)));
    const openNumberCellCoordKeys: Set<string> = new Set(openNumberCells.map(c => getCoordKey(c.r, c.c)));

    const curState: Map<string, boolean> = getDefaultState(frontierCellCoordKeys, openNumberCells); // true = mine, false = safe
    const validStates: Map<string, boolean>[] = [];
    const stateStatusMap: Map<string, 'unknown'|'dead'|'solved'> = new Map();
    const stateDomains: Map<string, Set<string>> = new Map();

    function backtrack(curState: Map<string, boolean>) {
        const curStateStringKey = getMapAsStringKey(curState);
        const curStateStatus = stateStatusMap.get(curStateStringKey);

        if (curStateStatus === 'solved') return true
        else if (curStateStatus === 'dead') return false
        else if (curStateStatus === undefined) {
            stateStatusMap.set(curStateStringKey, 'unknown');
        } 

        // base case: we've found a valid state
        if (areAllNumberedCellsSatisfied(curState, openNumberCellCoordKeys)) {
            stateStatusMap.set(curStateStringKey, 'solved')
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

            if(backtrack(state)) {
                anySolved = true;
            }
        }

        // if any child states were solved from our current state, we mark this parent as solved
        if (anySolved) {
            stateStatusMap.set(curStateStringKey, 'solved');
            return true;
        } else {
            stateStatusMap.set(curStateStringKey, 'dead');
            return false;
        }
    }

    backtrack(curState);
    handleMineOdds(validStates);
}

function getNextPossibleValidStates(curState: Map<string, boolean>, frontierCellCoordKeys: Set<string>, stateStatusMap: Map<string, 'unknown'|'dead'|'solved'>) {
    const curStateStatus = stateStatusMap.get(getMapAsStringKey(curState));
    if (curStateStatus  !== undefined && (curStateStatus === 'dead' || curStateStatus === 'solved')) {
        return [];
    }

    const nextPossibleStates: Map<string, boolean>[] = [];

    for (const coordKey of frontierCellCoordKeys) {
        if (curState.get(coordKey) === true) {
            continue;
        }

        const coordTuple = getCoordTupleFromKey(coordKey);
        const r = coordTuple[0];
        const c = coordTuple[1];

        const curStateDeepCopy: Map<string, boolean> = new Map(curState);
        if (isSafeToPlaceMineAtCell(r, c, curState)) {
            curStateDeepCopy.set(coordKey, true);
            nextPossibleStates.push(curStateDeepCopy);
        }
    }

    return nextPossibleStates;
}

function getMapAsStringKey(map: Map<string, boolean>) {
    // create a canonical key that is sorted deterministically, only strings are keys, convert true/false to 1/0 so they arent involved in string sorting. We only want our coords as strings here.
    return Array.from(map.entries())
        .sort((a, b) => a[0]
        .localeCompare(b[0])).map(kv => `${kv[0]}=${kv[1] ? 1 : 0}`)
        .join(';')
        .toString();
}

function handleMineOdds(validStates: Map<string, boolean>[]) {
    const validMineStatesCoordsOnly: Set<string>[] = [];
    const validSafeStatesCoordsOnly: Set<string>[] = [];

    for (const state of validStates) {
        const mineCoords: Set<string> = new Set();
        const safeCoords: Set<string> = new Set();

        for (const [coordKey, isMine] of state.entries())  {
            if (isMine) {
                mineCoords.add(coordKey);
            } else {
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

function areAllNumberedCellsSatisfied(assignedMineCoordKeys: Map<string, boolean>, openNumberCellCoordKeys: Set<string>) {
    for (const numberCellKey of openNumberCellCoordKeys) {
        const coordTuple = getCoordTupleFromKey(numberCellKey);
        const r = coordTuple[0];
        const c = coordTuple[1];

        const assignedAround = getPlayerKnownNeighbours(r, c)
            .map(n => getCoordKey(n.r, n.c))
            .filter(nKey => assignedMineCoordKeys.has(nKey) && assignedMineCoordKeys.get(nKey))
            .length;

        if (assignedAround !== knownBoard[r][c].knownValue!) {
            return false;
        }
    }

    return true;
}

function isSafeToPlaceMineAtCell(r: number, c: number, assignedMineCoordKeys: Map<string, boolean>) {
    const numberedNeighbours = getPlayerKnownNeighbours(r, c)
        .filter(n => n.knownValue !== null && n.knownValue > 0);

    for (const nn of numberedNeighbours) {
        const assignedAround = getPlayerKnownNeighbours(nn.r, nn.c)
            .map(n => getCoordKey(n.r, n.c))
            .filter(nKey => assignedMineCoordKeys.has(nKey) && assignedMineCoordKeys.get(nKey)).length;

        if (assignedAround + 1 > nn.knownValue!) {
            return false;
        }
    }

    return true;
}

function getCellProbabilities(validAssignments: Set<string>[], mineOrSafe: 1 | 0) {
    const numberOfAppearancesByCoordKey: Map<string, number> = new Map();
    for (const config of validAssignments) {
        config.forEach(coordKey => {
            if (!numberOfAppearancesByCoordKey.has(coordKey)) {
                numberOfAppearancesByCoordKey.set(coordKey, 1);
            } else {
                numberOfAppearancesByCoordKey.set(coordKey, numberOfAppearancesByCoordKey.get(coordKey)! + 1);
            }
        });
    }

    const cellProbabilityByKey: Map<string, number> = new Map();
    numberOfAppearancesByCoordKey.forEach((appearances: number, coordKey: string) => {
        cellProbabilityByKey.set(coordKey, appearances / validAssignments.length);
    });

    return cellProbabilityByKey;
}

function setStartingKnowledge(frontierArr: PlayerKnownCell[], openNumberCellsArr: PlayerKnownCell[]) {
    if (frontierArr.length !== 0 || openNumberCellsArr.length !== 0) {
        throw new Error("frontierArr & openNumberCellsArr should be empty")
    }

    for (const row of knownBoard) {
        for (const cell of row) {
            if (isPlayerKnowCellFrontierCell(cell, getPlayerKnownNeighbours(cell.r, cell.c))) {
                frontierArr.push(cell);
            } else if (isPlayerKnowCellOpenNumberCell(cell)) {
                openNumberCellsArr.push(cell);
            }
        }
    }
}

function getDefaultState(frontierCellCoordKeys: Set<string>, openNumberCells: PlayerKnownCell[]) {
    cacheImmediateMineCoords(frontierCellCoordKeys, openNumberCells);
    return new Map(Array.from(frontierCellCoordKeys).map(key => [key, cachedSolvedMines.has(key)]))
}

function cacheImmediateMineCoords(frontierCellCoordKeys: Set<string>, openNumberCells: PlayerKnownCell[]) {
    for (const cell of openNumberCells) {
        const frontierNeighbours = getPlayerKnownNeighbours(cell.r, cell.c)
            .filter(n => frontierCellCoordKeys.has(getCoordKey(n.r, n.c)));

        if (frontierNeighbours.length === cell.knownValue) {
            frontierNeighbours.forEach(n => cachedSolvedMines.add(getCoordKey(n.r, n.c)))
        }
    }
}

function resetClosedCellHighlights() {
    knownBoard.forEach(row => {
        row.forEach(cell => {
            if (!cell.isOpen) {
                const currentClassName = document.getElementById(`cell_${cell.r}_${cell.c}`)!.className; 
                if (!currentClassName.includes('cell-flag') && !currentClassName.includes('cell-mine')) {
                    document.getElementById(`cell_${cell.r}_${cell.c}`)!.className = 'cell cell-closed';
                }
            }
        })
    })
}

function highlightAsMine(r: number, c: number) {
    document.getElementById(`cell_${r}_${c}`)!.classList.add(SOLVED_MINE_CLASSNAME);
}

function highlightAsSafe(r: number, c: number) {
    const cell = _backendBoard[r][c];

    if (cell.isOpen) {
        return;
    }

    document.getElementById(`cell_${r}_${c}`)!.classList.add(SOLVED_SAFE_CLASSNAME);
}

export function getCoordKey(r: number, c: number) {
    return `${r},${c}`;
}

function getCoordTupleFromKey(coordKey: string) {
    return coordKey.split(',').map(coord => parseInt(coord));
}

function getPlayerKnowCellFromCoordKey(coordKey: string) {
    const coords = getCoordTupleFromKey(coordKey);
    return knownBoard[coords[0], coords[1]];
}

function isPlayerKnowCellFrontierCell(cell: PlayerKnownCell, neighbours: PlayerKnownCell[]) {
    return !cell.isOpen && neighbours.some(n => n.knownValue! > 0);
}

function isPlayerKnowCellOpenNumberCell(cell: PlayerKnownCell) {
    return cell.isOpen && cell.knownValue! > 0;
}

function getPlayerKnownNeighbours(r: number, c: number) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1],
    ];

    let neighbours: PlayerKnownCell[] = [];
    for (let dir of directions) {
        const targetRow = r + dir[0];
        const targetCol = c + dir[1];

        if (
            targetRow < 0 || targetRow > rowCount! - 1
            || targetCol < 0 || targetCol > columnCount! - 1
        ) {
            continue;
        }

        neighbours.push(knownBoard[targetRow][targetCol]);
    }

    return neighbours;
}

function getPlayerKnownBoard(board: Cell[][]) {
    const knownBoard: PlayerKnownCell[][] = [];

    for (const row of board) {
        knownBoard.push([])
        for (const cell of row) {
            const newRow = knownBoard[knownBoard.length - 1];
            newRow.push(getPlayerKnownCellFromCell(cell));
        }
    }

    return knownBoard;
}

function getPlayerKnownCellFromCell(cell: Cell) {
    return new PlayerKnownCell(cell.r, cell.c, cell.isOpen ? cell.value : null);
}

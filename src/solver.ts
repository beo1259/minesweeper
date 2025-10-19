import { PlayerKnownCell } from './models/player-known-cell.js';
import { Cell } from './models/cell.js';
import { SOLVED_SAFE_CLASSNAME, SOLVED_MINE_CLASSNAME } from './utils/constants.js';
import { getMapAsCanonicalKey, areAnyCellsOpen, getCoordKey, getCoordTupleFromKey } from './utils/utils.js';

/*
 * This file contains the logic for solving a board's certain mine/safe cells.
 * --- 
 * Calling 'findViableMoves' on valid board state computes all of the guaranteed mine/safe cells for a given board state.
 * The solving algorithm uses the 'PlayerKnownCell' model rather than the 'Cell' model that is used to create the board.
 * ---
 * 'PlayerKnownCell' is a representation of a cell that only contains information that is known by the player.
 *  Therefore, all safe/mine cells found by the solver can be logically deduced by a player who only sees the board.
*/

let knownBoard: PlayerKnownCell[][] = [];

let cachedSolvedMines: Set<string> = new Set();
let cachedSolvedSafes: Set<string> = new Set();

export function findViableMoves(board: Cell[][], shouldClearCache: boolean) {
    if (shouldClearCache) {
        cachedSolvedMines = new Set();
        cachedSolvedSafes = new Set();
    }

    knownBoard = getPlayerKnownBoard(board);

    if (areAnyCellsOpen(knownBoard)) {
        solveForCurrentMove();
    } else {
        highlightAllAsSafe();
    }
}

function solveForCurrentMove() {
    const frontierCells: PlayerKnownCell[] = []; // cells that: are closed, touched an open cell with value > 0
    const openNumberCells: PlayerKnownCell[] = []; // cells that: are open and have a value > 0
    setStartingCellKnowledge(frontierCells, openNumberCells);

    const frontierCellCoordKeys: Set<string> = new Set(frontierCells.map(c => getCoordKey(c.r, c.c)));
    const openNumberCellCoordKeys: Set<string> = new Set(openNumberCells.map(c => getCoordKey(c.r, c.c)));

    const unusedFrontierCells: Set<string> = new Set(Array.from(frontierCellCoordKeys).filter(f => !cachedSolvedMines.has(f) && !cachedSolvedSafes.has(f)));

    const curState: Map<string, boolean> = getDefaultState(frontierCellCoordKeys, openNumberCells); // true = mine, false = safe
    const validStates: Map<string, boolean>[] = [];
    const stateStatusMap: Map<string, 'unknown'|'dead'|'solved'> = new Map();

    r_backtrack(curState, stateStatusMap, openNumberCellCoordKeys, validStates, unusedFrontierCells);
    handleMineOdds(validStates);
}

function r_backtrack(
    curState: Map<string, boolean>, // the state whose possibility branches will be traversed
    stateStatusMap: Map<string, 'unknown'|'dead'|'solved'>, // the status of each state that has been seen
    openNumberCellCoordKeys: Set<string>, // the coordinate key ('x,y') of each open numbered cell (> 0)
    validStates: Map<string, boolean>[], // all of the valid states that we've found (ie. states where all of the open numbered cells values' are satisfied) - always the leaves 
    unusedFrontierCells: Set<string>, // all of the frontier cells that we have determined to be 100% safe or 100% mine
) {
    const curStateStringKey = getMapAsCanonicalKey(curState);
    const curStateStatus = stateStatusMap.get(curStateStringKey);

    if (curStateStatus === 'solved') return true;
    else if (curStateStatus === 'dead') return false;
    else if (curStateStatus === undefined) {
        stateStatusMap.set(curStateStringKey, 'unknown');
    }

    // base case: we've found a valid state
    if (areAllNumberedCellsSatisfied(curState, openNumberCellCoordKeys)) {
        stateStatusMap.set(curStateStringKey, 'solved')
        validStates.push(curState);
        return true;
    }

    const nextPossibleStates = getNextPossibleValidStates(curState, unusedFrontierCells);
    // if no next possible states, we don't want to keep exploring this state in susquent recurses
    if (nextPossibleStates.length === 0) { 
        stateStatusMap.set(curStateStringKey, 'dead');
        return false;
    }

    let anySolved = false;
    for (const state of nextPossibleStates) {
        const possibleStateStringKey = getMapAsCanonicalKey(state);
        const possibleStateStatus = stateStatusMap.get(possibleStateStringKey);

        // make sure we don't revisit already solved states
        if (possibleStateStatus === 'dead' || possibleStateStatus === 'solved') {
            continue;
        }

        if(r_backtrack(state, stateStatusMap, openNumberCellCoordKeys, validStates, unusedFrontierCells)) {
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

function getNextPossibleValidStates(curState: Map<string, boolean>, unusedFrontierCells: Set<string>) {
    const nextPossibleStates: Map<string, boolean>[] = [];

    for (const coordKey of unusedFrontierCells) {
        if (curState.get(coordKey) === true) {
            continue;
        }

        const curStateDeepCopy: Map<string, boolean> = new Map(curState);

        const [r, c] = getCoordTupleFromKey(coordKey);

        if (isSafeToPlaceMineAtCell(r, c, curState)) {
            curStateDeepCopy.set(coordKey, true);
            nextPossibleStates.push(curStateDeepCopy);
        }
    }

    return nextPossibleStates;
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

    const mineProbabilities = getCellProbabilities(validMineStatesCoordsOnly);
    const safeProbabilities = getCellProbabilities(validSafeStatesCoordsOnly);
    const minesToHighlight: [number, number][] = [];
    const safesToHighlight: [number, number][] = [];

    for (const [coordKey, mineProbability] of mineProbabilities.entries()) {
        if (mineProbability === 1) {
            const [r, c] = getCoordTupleFromKey(coordKey);
            cachedSolvedMines.add(coordKey);
            minesToHighlight.push([r, c])
        }
    }

    for (const [coordKey, safeProbability] of safeProbabilities.entries()) {
        if (safeProbability === 1) {
            const [r, c] = getCoordTupleFromKey(coordKey);
            cachedSolvedSafes.add(coordKey);
            safesToHighlight.push([r, c])
        }
    }

    applyStyles(minesToHighlight, safesToHighlight)
}

function highlightAllAsSafe() {
    requestAnimationFrame(() => {
        for (const row of knownBoard) {
            for (const cell of row) {
                const el = cellEl(cell.r, cell.c);
                el.classList.add(SOLVED_SAFE_CLASSNAME);
            }
        }
    });
}

function applyStyles(minesToHighlight: [number, number][], safesToHighlight: [number, number][]) {
    requestAnimationFrame(() => {
        for (const [r, c] of minesToHighlight) { 
            const el = cellEl(r, c);
            el.classList.add(SOLVED_MINE_CLASSNAME) 
        };
        for (const [r, c] of safesToHighlight) { 
            const el = cellEl(r, c);
            el.classList.add(SOLVED_SAFE_CLASSNAME) 
        };
    });
} 

function cellEl(r: number, c: number) {
    return document.getElementById(`cell_${r}_${c}`)!;
}

function areAllNumberedCellsSatisfied(assignedMineCoordKeys: Map<string, boolean>, openNumberCellCoordKeys: Set<string>) {
    for (const numberCellKey of openNumberCellCoordKeys) {
        const [r, c] = getCoordTupleFromKey(numberCellKey);

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

// TODO - Forward check all neighbour frontier cells
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

function getCellProbabilities(validAssignments: Set<string>[]) {
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

function setStartingCellKnowledge(frontierArr: PlayerKnownCell[], openNumberCellsArr: PlayerKnownCell[]) {
    if (frontierArr.length !== 0 || openNumberCellsArr.length !== 0) {
        throw new Error('frontierArr & openNumberCellsArr should be empty')
    }

    for (const row of knownBoard) {
        for (const cell of row) {
            if (isPlayerKnownCellFrontierCell(cell, getPlayerKnownNeighbours(cell.r, cell.c))) {
                frontierArr.push(cell);
            } else if (isPlayerKnownCellOpenNumberCell(cell)) {
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

        // intial prune conditions
        if (frontierNeighbours.length === cell.knownValue) {
            frontierNeighbours.forEach(n => cachedSolvedMines.add(getCoordKey(n.r, n.c)))
        }
    }
}

function isPlayerKnownCellFrontierCell(cell: PlayerKnownCell, neighbours: PlayerKnownCell[]) {
    return !cell.isOpen && neighbours.some(n => n.knownValue! > 0);
}

function isPlayerKnownCellOpenNumberCell(cell: PlayerKnownCell) {
    return cell.isOpen && cell.knownValue! > 0;
}

function getPlayerKnownNeighbours(r: number, c: number) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1],
    ];

    const rowCount = knownBoard.length;
    const columnCount = knownBoard[0].length;

    let neighbours: PlayerKnownCell[] = [];
    for (let dir of directions) {
        const targetRow = r + dir[0];
        const targetCol = c + dir[1];

        if (
            targetRow < 0 || targetRow > rowCount - 1
            || targetCol < 0 || targetCol > columnCount - 1
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
            newRow.push(new PlayerKnownCell(cell.r, cell.c, cell.isOpen ? cell.value : null));
        }
    }

    return knownBoard;
}

import { Cell } from "./models/cell.js";
import { PlayerKnownCell } from "./models/player-known-cell.js";

export function getMapAsCanonicalKey(map: Map<string, boolean>) {
    // create a canonical key that is sorted deterministically, only strings are keys, convert true/false to 1/0 so they arent involved in string sorting. We only want our coords as strings here.
    return Array.from(map.entries())
        .sort((a, b) => a[0]
        .localeCompare(b[0])).map(kv => `${kv[0]}=${kv[1] ? 1 : 0}`)
        .join(';')
        .toString();
}

export function areAnyCellsOpen(board: Cell[][] | PlayerKnownCell[][]) {
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

export function getCoordKey(r: number, c: number) {
    return `${r},${c}`;
}

export function getCoordTupleFromKey(coordKey: string) {
    return coordKey.split(',').map(coord => parseInt(coord));
}


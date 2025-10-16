export function getMapAsCanonicalKey(map) {
    // create a canonical key that is sorted deterministically, only strings are keys, convert true/false to 1/0 so they arent involved in string sorting. We only want our coords as strings here.
    return Array.from(map.entries())
        .sort((a, b) => a[0]
        .localeCompare(b[0])).map(kv => `${kv[0]}=${kv[1] ? 1 : 0}`)
        .join(';')
        .toString();
}
export function areAnyCellsOpen(board) {
    let atLeastOneCellOpen = false;
    for (const row of board) {
        for (const cell of row) {
            if (cell.isOpen) {
                atLeastOneCellOpen = true;
                break;
            }
        }
        if (atLeastOneCellOpen)
            break;
    }
    return atLeastOneCellOpen;
}
export function getCoordKey(r, c) {
    return `${r},${c}`;
}
export function getCoordTupleFromKey(coordKey) {
    return coordKey.split(',').map(coord => parseInt(coord));
}
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
export function randArrayEntry(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

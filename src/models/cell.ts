import { CellStates } from "./cell-states.js";

export class Cell {
    r: number; // row
    c: number; // col
    value: number | null;
    cellState: CellStates;
    isOpen: boolean;
    isFlagged: boolean;

    constructor(r: number, c: number, value: number | null, cellState: CellStates, isOpen: boolean, isFlagged: boolean) {
        this.r = r;
        this.c = c;
        this.value = value;
        this.cellState = cellState;
        this.isOpen = isOpen;
        this.isFlagged = isFlagged;
    }
}


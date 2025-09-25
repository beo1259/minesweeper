import { CellState } from "./cell-states.js";

export class Cell {
    x: number;
    y: number;
    value: number | null;
    cellState: CellState;
    isOpen: boolean;

    constructor(x: number, y: number, value: number | null, cellState: CellState, isOpen: boolean) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.cellState = cellState;
        this.isOpen = isOpen;
    }
}


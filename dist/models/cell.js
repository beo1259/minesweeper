export class Cell {
    constructor(r, c, value, cellState, isOpen, isFlagged) {
        this.r = r;
        this.c = c;
        this.value = value;
        this.cellState = cellState;
        this.isOpen = isOpen;
        this.isFlagged = isFlagged;
    }
}

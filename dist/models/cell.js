export class Cell {
    constructor(x, y, value, cellState, isOpen) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.cellState = cellState;
        this.isOpen = isOpen;
    }
}

export class PlayerKnownCell {
    r: number; // row
    c: number; // col
    knownValue: number | null; // if value is null, the cell is unopened 
    isOpen: boolean;

    constructor(r: number, c: number, knownValue: number | null) {
        this.r = r;
        this.c = c;
        this.knownValue = knownValue;
        this.isOpen = knownValue !== null;
    }
}


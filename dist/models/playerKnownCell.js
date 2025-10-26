export class PlayerKnownCell {
    constructor(r, c, knownValue) {
        this.r = r;
        this.c = c;
        this.knownValue = knownValue;
        this.isOpen = knownValue !== null;
    }
}

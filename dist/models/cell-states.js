export var CellState;
(function (CellState) {
    CellState[CellState["Safe"] = 0] = "Safe";
    CellState[CellState["Mine"] = 1] = "Mine";
    CellState[CellState["Flagged"] = 2] = "Flagged";
})(CellState || (CellState = {}));

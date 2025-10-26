export var GameStateType;
(function (GameStateType) {
    GameStateType[GameStateType["PLAYING"] = 0] = "PLAYING";
    GameStateType[GameStateType["WON"] = 1] = "WON";
    GameStateType[GameStateType["LOST"] = 2] = "LOST";
})(GameStateType || (GameStateType = {}));

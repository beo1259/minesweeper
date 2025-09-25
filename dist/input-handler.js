import { handleCellOpened, handleCellFlagged } from "./main.js";
export function monitorInputs() {
    document.addEventListener("mousemove", (event) => {
        lastMousePosition = { clientX: event.clientX, clientY: event.clientY };
    });
    document.addEventListener('keyup', function (event) {
        const pressedKey = event.key;
        const { clientX, clientY } = lastMousePosition;
        const hoveredElement = document.elementFromPoint(clientX, clientY);
        if (hoveredElement === null) {
            return;
        }
        if (hoveredElement.id.startsWith('cell_')) {
            const x = parseInt(hoveredElement.dataset.row);
            const y = parseInt(hoveredElement.dataset.col);
            if (pressedKey.toLowerCase() === "f") {
                handleCellOpened(x, y);
            }
            else if (pressedKey.toLowerCase() === "g") {
                handleCellFlagged(x, y);
            }
        }
    });
}

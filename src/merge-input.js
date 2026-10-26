import { MERGE_WIDTH, MERGE_HEIGHT, aimMerge, dropMerge } from './merge.js';

export function mergeView(width, height) {
    const scale = Math.max(0.001, Math.min((width - 24) / MERGE_WIDTH, (height - 24) / MERGE_HEIGHT));
    const offsetX = (width - MERGE_WIDTH * scale) / 2;
    const offsetY = (height - MERGE_HEIGHT * scale) / 2;
    return {
        scale, offsetX, offsetY,
        x: value => offsetX + value * scale,
        y: value => offsetY + value * scale,
    };
}

export function setupMergeControls(canvas, { getGame, getSize, isInteractive, onChange = () => {} }) {
    let active = null;
    const listeners = [];
    const previousCursor = canvas.style.cursor;

    function listen(target, name, callback) {
        target.addEventListener(name, callback);
        listeners.push(() => target.removeEventListener(name, callback));
    }

    function position(event) {
        const rect = canvas.getBoundingClientRect();
        const { width, height } = getSize();
        const view = mergeView(width, height);
        return {
            x: ((event.clientX - rect.left) * width / Math.max(1, rect.width) - view.offsetX) / view.scale,
            y: ((event.clientY - rect.top) * height / Math.max(1, rect.height) - view.offsetY) / view.scale,
        };
    }

    function inside(point) {
        return point.x >= 0 && point.x <= MERGE_WIDTH && point.y >= 0 && point.y <= MERGE_HEIGHT;
    }

    function cancel() {
        const previous = active;
        active = null;
        if (previous && canvas.hasPointerCapture(previous.pointerId)) canvas.releasePointerCapture(previous.pointerId);
    }

    function currentGame() {
        const game = getGame();
        if (!isInteractive() || !game || game.phase !== 'playing') {
            cancel();
            return null;
        }
        if (active && active.game !== game) cancel();
        return game;
    }

    listen(canvas, 'pointerdown', event => {
        if (active || !event.isPrimary || event.button !== 0) return;
        const game = currentGame();
        const point = position(event);
        if (!game || !inside(point)) return;
        event.preventDefault();
        canvas.focus({ preventScroll: true });
        active = { pointerId: event.pointerId, game };
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor = 'crosshair';
        aimMerge(game, point.x);
        onChange();
    });

    listen(canvas, 'pointermove', event => {
        if (!event.isPrimary) return;
        const game = currentGame();
        if (!game || active && event.pointerId !== active.pointerId) return;
        canvas.style.cursor = 'crosshair';
        const point = position(event);
        if (!active && (event.pointerType !== 'mouse' || !inside(point))) return;
        if (active) event.preventDefault();
        aimMerge(game, point.x);
        onChange();
    });

    listen(canvas, 'pointerup', event => {
        if (!active || event.pointerId !== active.pointerId) return;
        const game = currentGame();
        if (!game || !active) return;
        const point = position(event);
        cancel();
        if (!inside(point)) return;
        event.preventDefault();
        aimMerge(game, point.x);
        dropMerge(game);
        onChange();
    });

    for (const name of ['pointercancel', 'lostpointercapture']) {
        listen(canvas, name, event => {
            if (active?.pointerId === event.pointerId) cancel();
        });
    }
    listen(window, 'blur', cancel);

    listen(canvas, 'keydown', event => {
        if (event.target !== canvas || event.ctrlKey || event.metaKey || event.altKey) return;
        if (!['ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(event.key)) return;
        const game = currentGame();
        if (!game) return;
        event.preventDefault();
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            aimMerge(game, game.aimX + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 28 : 14));
        } else {
            if (event.repeat) return;
            cancel();
            dropMerge(game);
        }
        onChange();
    });

    return {
        cancel,
        destroy() {
            cancel();
            listeners.forEach(remove => remove());
            canvas.style.cursor = previousCursor;
        },
    };
}

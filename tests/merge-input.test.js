import test from 'node:test';
import assert from 'node:assert/strict';
import { createMergeGame, advanceMerge, destroyMerge } from '../src/merge.js';
import { mergeView, setupMergeControls } from '../src/merge-input.js';

class TestCanvas extends EventTarget {
    style = {};
    captured = new Set();
    focused = false;
    getBoundingClientRect() { return { left: 30, top: 50, width: 800, height: 640 }; }
    focus() { this.focused = true; }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
    pointer(type, x, y, overrides = {}) {
        const event = new Event(type, { cancelable: true });
        Object.assign(event, { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y, ...overrides });
        this.dispatchEvent(event);
        return event;
    }
    key(key, overrides = {}) {
        const event = new Event('keydown', { cancelable: true });
        Object.assign(event, { key, repeat: false, ...overrides });
        this.dispatchEvent(event);
        return event;
    }
}

function fixture(run) {
    const originalWindow = globalThis.window;
    globalThis.window = new EventTarget();
    const games = [];
    const makeGame = () => {
        const game = createMergeGame(Array.from({ length: 11 }, (_, i) => ({ id: `member-${i}`, name: `Member ${i}` })), { random: () => 0 });
        games.push(game);
        return game;
    };
    let game = makeGame();
    let interactive = true;
    let changes = 0;
    const canvas = new TestCanvas();
    const controls = setupMergeControls(canvas, {
        getGame: () => game,
        getSize: () => ({ width: 800, height: 640 }),
        isInteractive: () => interactive,
        onChange: () => { changes++; },
    });
    const view = mergeView(800, 640);
    const pointer = (type, x, y = 200, overrides) => canvas.pointer(type, 30 + view.x(x), 50 + view.y(y), overrides);
    try {
        run({ canvas, controls, pointer, game, setInteractive: value => { interactive = value; }, restart: () => { game = makeGame(); return game; }, changes: () => changes });
    } finally {
        controls.destroy();
        games.forEach(destroyMerge);
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
    }
}

test('merge view centers the fixed board across desktop and mobile viewports', () => {
    for (const [width, height] of [[800, 640], [300, 440], [390, 660]]) {
        const view = mergeView(width, height);
        assert.ok(Math.abs(view.x(210) - width / 2) < 1e-9);
        assert.ok(Math.abs(view.y(310) - height / 2) < 1e-9);
        assert.ok(view.offsetX >= 12 - 1e-9);
        assert.ok(view.offsetY >= 12 - 1e-9);
    }
});

test('pointer aim uses board coordinates and ignores clicks in the letterbox', () => fixture(({ canvas, pointer, game, changes }) => {
    pointer('pointermove', 123);
    assert.ok(Math.abs(game.aimX - 123) < 1e-9);
    canvas.pointer('pointerdown', 35, 200);
    canvas.pointer('pointerup', 35, 200);
    assert.equal(game.bodies.length, 0);
    pointer('pointerdown', 185);
    pointer('pointerup', 185);
    assert.equal(game.bodies.length, 1);
    assert.ok(Math.abs(game.bodies[0].position.x - 185) < 1e-9);
    assert.equal(canvas.focused, true);
    assert.equal(canvas.captured.size, 0);
    assert.ok(changes() >= 3);
}));

test('touch drag drops on release and ignores secondary touches and right clicks', () => fixture(({ canvas, pointer, game }) => {
    pointer('pointerdown', 120, 200, { button: 2 });
    pointer('pointerup', 120);
    assert.equal(game.bodies.length, 0);
    pointer('pointerdown', 120, 200, { pointerType: 'touch' });
    pointer('pointermove', 300, 200, { pointerType: 'touch', pointerId: 2, isPrimary: false });
    pointer('pointerup', 300, 200, { pointerType: 'touch', pointerId: 2, isPrimary: false });
    assert.equal(game.bodies.length, 0);
    pointer('pointermove', 170, 200, { pointerType: 'touch' });
    assert.ok(Math.abs(game.aimX - 170) < 1e-9);
    pointer('pointerup', 170, 200, { pointerType: 'touch' });
    assert.equal(game.bodies.length, 1);
    assert.equal(canvas.captured.size, 0);
}));

test('cancel, outside release, pause, blur and a restarted round prevent accidental drops', () => fixture(({ canvas, controls, pointer, game, setInteractive, restart }) => {
    pointer('pointerdown', 200);
    pointer('pointercancel', 200);
    pointer('pointerup', 200);
    pointer('pointerdown', 200);
    pointer('pointerup', -20);
    pointer('pointerdown', 200);
    setInteractive(false);
    pointer('pointerup', 200);
    setInteractive(true);
    pointer('pointerdown', 200);
    window.dispatchEvent(new Event('blur'));
    pointer('pointerup', 200);
    pointer('pointerdown', 200);
    controls.cancel();
    pointer('pointerup', 200);
    assert.equal(game.bodies.length, 0);
    pointer('pointerdown', 200);
    const next = restart();
    pointer('pointerup', 200);
    assert.equal(next.bodies.length, 0);
    assert.equal(canvas.captured.size, 0);
}));

test('keyboard aiming and dropping respect cooldown, key repetition and paused state', () => fixture(({ canvas, game, setInteractive }) => {
    const initialX = game.aimX;
    assert.equal(canvas.key('ArrowLeft').defaultPrevented, true);
    assert.equal(game.aimX, initialX - 14);
    canvas.key('ArrowRight', { shiftKey: true });
    assert.equal(game.aimX, initialX + 14);
    canvas.key(' ');
    assert.equal(game.bodies.length, 1);
    canvas.key('Enter');
    assert.equal(game.bodies.length, 1);
    advanceMerge(game, 0.5);
    canvas.key(' ', { repeat: true });
    assert.equal(game.bodies.length, 1);
    canvas.key('Enter');
    assert.equal(game.bodies.length, 2);
    setInteractive(false);
    const pausedX = game.aimX;
    assert.equal(canvas.key('ArrowRight').defaultPrevented, false);
    assert.equal(game.aimX, pausedX);
    assert.equal(canvas.key('Tab').defaultPrevented, false);
    assert.equal(canvas.captured.size, 0);
}));

test('destroy releases capture and removes all input handlers', () => fixture(({ canvas, controls, pointer, game }) => {
    pointer('pointerdown', 180);
    controls.destroy();
    pointer('pointerup', 180);
    pointer('pointerdown', 210);
    pointer('pointerup', 210);
    canvas.key('Enter');
    assert.equal(game.bodies.length, 0);
    assert.equal(canvas.captured.size, 0);
}));

import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { setupInteractions } from '../src/ui.js';
import { containBody } from '../src/physics.js';

class TestCanvas extends EventTarget {
    style = {};
    captured = new Set();
    getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 360 }; }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
    pointer(type, x, y) {
        const event = new Event(type, { cancelable: true });
        Object.assign(event, { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y });
        this.dispatchEvent(event);
    }
}

test('dragging an avatar off-center generates rotation and releases safely outside the arena', () => {
    const originalWindow = globalThis.window;
    globalThis.window = new EventTarget();
    const engine = Matter.Engine.create();
    engine.gravity.y = 0;
    const body = Matter.Bodies.circle(150, 150, 32, { plugin: { userData: { id: 'member' } } });
    Matter.Composite.add(engine.world, body);
    const canvas = new TestCanvas();
    let selected = false;
    const interactions = setupInteractions(engine, canvas, {
        getSize: () => ({ width: 360, height: 360 }),
        isInteractive: () => true,
        onSelect: () => { selected = true; },
    });
    try {
        canvas.pointer('pointerdown', 170, 150);
        for (let tick = 1; tick <= 60; tick++) {
            canvas.pointer('pointermove', 170 + tick, 150 + tick * 2);
            Matter.Engine.update(engine, 1000 / 120);
            containBody(body, 360, 360);
        }
        assert.ok(Math.abs(body.angle) > 0.1, 'pulling at the edge must rotate the body');
        canvas.pointer('pointermove', 900, -500);
        for (let tick = 0; tick < 20; tick++) {
            Matter.Engine.update(engine, 1000 / 120);
            containBody(body, 360, 360);
        }
        canvas.pointer('pointerup', 900, -500);
        assert.equal(engine.world.constraints.length, 0);
        assert.equal(canvas.captured.size, 0);
        assert.equal(selected, false, 'a throw must not open the member profile');
        assert.ok(body.position.x >= body.circleRadius && body.position.x <= 360 - body.circleRadius);
        assert.ok(body.position.y >= body.circleRadius && body.position.y <= 360 - body.circleRadius);
    } finally {
        interactions.destroy();
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
    }
});

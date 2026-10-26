import Matter from 'matter-js';

export const MAX_SPEED = 12;
export const EDGE_GAP = 4;

export function floatLayout(count, width, height) {
    const columns = Math.max(1, Math.min(count || 1, Math.ceil(Math.sqrt(count * width / height))));
    const rows = Math.max(1, Math.ceil(count / columns));
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const radius = Math.max(1, Math.min(32, cellWidth / 2 - 8, cellHeight / 2 - 8));
    const positions = Array.from({ length: count }, (_, i) => ({
        x: (i % columns + 0.5) * cellWidth,
        y: (Math.floor(i / columns) + 0.5) * cellHeight,
    }));
    return { radius, positions };
}

export function setRadius(body, radius) {
    if (Math.abs(body.circleRadius - radius) > 0.001) {
        const scale = radius / body.circleRadius;
        Matter.Body.scale(body, scale, scale);
    }
}

// Wall collisions are the first line of defense. This also catches tunnelling,
// a drag outside the canvas, and bodies stranded by a viewport resize.
export function containBody(body, width, height, maxSpeed = MAX_SPEED) {
    const inset = body.circleRadius + EDGE_GAP;
    const minX = Math.min(inset, width / 2);
    const minY = Math.min(inset, height / 2);
    const maxX = Math.max(minX, width - inset);
    const maxY = Math.max(minY, height - inset);
    const oldX = Number.isFinite(body.position.x) ? body.position.x : width / 2;
    const oldY = Number.isFinite(body.position.y) ? body.position.y : height / 2;
    const x = Math.max(minX, Math.min(maxX, oldX));
    const y = Math.max(minY, Math.min(maxY, oldY));
    let vx = Number.isFinite(body.velocity.x) ? body.velocity.x : 0;
    let vy = Number.isFinite(body.velocity.y) ? body.velocity.y : 0;
    if (oldX < minX && vx < 0 || oldX > maxX && vx > 0) vx *= -0.85;
    if (oldY < minY && vy < 0 || oldY > maxY && vy > 0) vy *= -0.85;
    const speed = Math.hypot(vx, vy);
    if (speed > maxSpeed) {
        vx *= maxSpeed / speed;
        vy *= maxSpeed / speed;
    }
    if (x !== body.position.x || y !== body.position.y) Matter.Body.setPosition(body, { x, y });
    Matter.Body.setVelocity(body, { x: vx, y: vy });
    const angularVelocity = Number.isFinite(body.angularVelocity) ? body.angularVelocity : 0;
    Matter.Body.setAngularVelocity(body, Math.max(-0.12, Math.min(0.12, angularVelocity)));
}

export function createWalls(width, height) {
    const thickness = 100;
    const options = { isStatic: true, restitution: 0.9, render: { visible: false } };
    return [
        Matter.Bodies.rectangle(width / 2, -thickness / 2, width + thickness * 2, thickness, options),
        Matter.Bodies.rectangle(width / 2, height + thickness / 2, width + thickness * 2, thickness, options),
        Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height + thickness * 2, options),
        Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height + thickness * 2, options),
    ];
}

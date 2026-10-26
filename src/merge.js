import Matter from 'matter-js';

export const MERGE_WIDTH = 420;
export const MERGE_HEIGHT = 620;

const RADII = [15, 20, 26, 33, 41, 50, 60, 71, 83, 96, 110];
const STEP = 1 / 120;
const SPEED_LIMIT = 12;
const SPAWN_GRACE = 1.1;

function randomIndex(random, length) {
    const value = random();
    return Math.min(length - 1, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * length)));
}

function chooseLevel(game) {
    return randomIndex(game.random, Math.min(5, game.levels.length));
}

export function createMergeGame(members, { random = Math.random, images = new Map() } = {}) {
    const seen = new Set();
    const selected = members.filter(member => {
        if (!member || typeof member !== 'object') return false;
        const key = member.id || member.avatarUrl || member.name;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    for (let i = selected.length - 1; i > 0; i--) {
        const j = randomIndex(random, i + 1);
        [selected[i], selected[j]] = [selected[j], selected[i]];
    }
    const levels = selected.slice(0, RADII.length).map((member, index) => ({
        member, radius: RADII[index], image: images.get(member.id) || null,
    }));
    const engine = Matter.Engine.create({ positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = 1;
    const game = {
        engine, random, levels, bodies: [], effects: [],
        phase: levels.length ? 'playing' : 'over',
        currentLevel: 0, nextLevel: 0, aimX: MERGE_WIDTH / 2,
        score: 0, bestLevel: 0, elapsed: 0, cooldown: 0, spawnCooldown: 0.4,
        dangerElapsed: 0, dangerDuration: 2, dangerLine: 108,
        wallLeft: 12, wallRight: MERGE_WIDTH - 12, floorY: 602, spawnY: 54,
        pendingPairs: new Map(), accumulator: 0, destroyed: false,
    };
    const wallOptions = { isStatic: true, restitution: 0.1, friction: 0.3 };
    game.walls = [
        Matter.Bodies.rectangle(game.wallLeft - 20, MERGE_HEIGHT / 2 - 100, 40, MERGE_HEIGHT + 240, wallOptions),
        Matter.Bodies.rectangle(game.wallRight + 20, MERGE_HEIGHT / 2 - 100, 40, MERGE_HEIGHT + 240, wallOptions),
        Matter.Bodies.rectangle(MERGE_WIDTH / 2, game.floorY + 20, MERGE_WIDTH, 40, wallOptions),
    ];
    Matter.Composite.add(engine.world, game.walls);
    game.onCollision = event => {
        for (const pair of event.pairs) {
            const a = pair.bodyA;
            const b = pair.bodyB;
            const level = a.plugin.mergeLevel;
            if (Number.isInteger(level) && level === b.plugin.mergeLevel && level + 1 < levels.length) {
                game.pendingPairs.set(pair.id, [a, b]);
            }
        }
    };
    Matter.Events.on(engine, 'collisionStart collisionActive', game.onCollision);
    if (levels.length) {
        game.currentLevel = chooseLevel(game);
        game.nextLevel = chooseLevel(game);
    }
    return game;
}

export function aimMerge(game, x) {
    if (game.destroyed || !game.levels.length || !Number.isFinite(x)) return;
    const radius = game.levels[game.currentLevel].radius;
    game.aimX = Math.max(game.wallLeft + radius + 1, Math.min(game.wallRight - radius - 1, x));
}

function makeBody(game, level, x, y) {
    const entry = game.levels[level];
    const body = Matter.Bodies.circle(x, y, entry.radius, {
        restitution: 0.15,
        friction: 0.3,
        frictionStatic: 0.6,
        frictionAir: 0.007,
        slop: 0.04,
        plugin: { userData: entry.member, image: entry.image, mergeLevel: level, bornAt: game.elapsed },
    });
    game.bodies.push(body);
    Matter.Composite.add(game.engine.world, body);
    return body;
}

export function dropMerge(game) {
    if (game.destroyed || game.phase !== 'playing' || game.cooldown > 1e-7 || !game.levels.length) return null;
    aimMerge(game, game.aimX);
    const radius = game.levels[game.currentLevel].radius;
    // Wait for the mouth of the container to clear instead of creating
    // overlapping bodies that launch the pile out of the container.
    if (game.bodies.some(body => Math.hypot(body.position.x - game.aimX, body.position.y - game.spawnY)
        < radius + body.circleRadius + 2)) return null;
    const body = makeBody(game, game.currentLevel, game.aimX, game.spawnY);
    game.bestLevel = Math.max(game.bestLevel, game.currentLevel);
    game.currentLevel = game.nextLevel;
    game.nextLevel = chooseLevel(game);
    game.cooldown = game.spawnCooldown;
    aimMerge(game, game.aimX);
    return body;
}

function contain(game, body) {
    const radius = body.circleRadius;
    const oldX = Number.isFinite(body.position.x) ? body.position.x : MERGE_WIDTH / 2;
    const oldY = Number.isFinite(body.position.y) ? body.position.y : game.spawnY;
    const x = Math.max(game.wallLeft + radius, Math.min(game.wallRight - radius, oldX));
    const y = Math.min(game.floorY - radius, oldY);
    let vx = Number.isFinite(body.velocity.x) ? body.velocity.x : 0;
    let vy = Number.isFinite(body.velocity.y) ? body.velocity.y : 0;
    if (x !== oldX && (oldX < x && vx < 0 || oldX > x && vx > 0)) vx *= -0.15;
    if (oldY > y && vy > 0) vy *= -0.15;
    const speed = Math.hypot(vx, vy);
    if (speed > SPEED_LIMIT) { vx *= SPEED_LIMIT / speed; vy *= SPEED_LIMIT / speed; }
    if (x !== body.position.x || y !== body.position.y) Matter.Body.setPosition(body, { x, y });
    Matter.Body.setVelocity(body, { x: vx, y: vy });
    Matter.Body.setAngularVelocity(body, Math.max(-0.15, Math.min(0.15, Number.isFinite(body.angularVelocity) ? body.angularVelocity : 0)));
}

function mergeContacts(game) {
    const available = new Set(game.bodies);
    const consumed = new Set();
    for (const [a, b] of game.pendingPairs.values()) {
        if (!available.has(a) || !available.has(b) || consumed.has(a) || consumed.has(b)) continue;
        const level = a.plugin.mergeLevel + 1;
        consumed.add(a);
        consumed.add(b);
        Matter.Composite.remove(game.engine.world, [a, b]);
        const radius = game.levels[level].radius;
        const x = Math.max(game.wallLeft + radius, Math.min(game.wallRight - radius, (a.position.x + b.position.x) / 2));
        const y = Math.min(game.floorY - radius, (a.position.y + b.position.y) / 2);
        const merged = makeBody(game, level, x, y);
        Matter.Body.setVelocity(merged, { x: (a.velocity.x + b.velocity.x) / 2, y: Math.min(0, (a.velocity.y + b.velocity.y) / 2) });
        const points = (level + 1) * (level + 2) / 2;
        game.score += points;
        game.bestLevel = Math.max(game.bestLevel, level);
        game.effects.push({ x, y, radius, age: 0, points });
    }
    if (consumed.size) game.bodies = game.bodies.filter(body => !consumed.has(body));
    game.pendingPairs.clear();
}

function step(game) {
    game.elapsed += STEP;
    game.cooldown = Math.max(0, game.cooldown - STEP);
    game.bodies.forEach(body => contain(game, body));
    Matter.Engine.update(game.engine, STEP * 1000);
    mergeContacts(game);
    game.bodies.forEach(body => contain(game, body));
    game.effects = game.effects.filter(effect => (effect.age += STEP) < 0.65);
    const overflowing = game.bodies.some(body => game.elapsed - body.plugin.bornAt >= SPAWN_GRACE
        && body.position.y - body.circleRadius < game.dangerLine
        && Math.hypot(body.velocity.x, body.velocity.y) < 1.5);
    game.dangerElapsed = overflowing ? game.dangerElapsed + STEP : 0;
    if (game.dangerElapsed + 1e-7 >= game.dangerDuration) {
        game.dangerElapsed = game.dangerDuration;
        game.phase = 'over';
    }
}

export function advanceMerge(game, seconds) {
    if (game.destroyed || game.phase !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
    game.accumulator += Math.min(seconds, 10);
    while (game.accumulator + 1e-9 >= STEP && game.phase === 'playing') {
        step(game);
        game.accumulator = Math.max(0, game.accumulator - STEP);
    }
}

export function destroyMerge(game) {
    if (!game || game.destroyed) return;
    game.destroyed = true;
    game.phase = 'over';
    Matter.Events.off(game.engine, 'collisionStart collisionActive', game.onCollision);
    Matter.Composite.clear(game.engine.world, false);
    Matter.Engine.clear(game.engine);
    game.bodies = [];
    game.effects = [];
    game.pendingPairs.clear();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { containBody, createWalls, EDGE_GAP, floatLayout, MAX_SPEED, setRadius } from '../src/physics.js';
import { advanceRace, createRace, destroyRace, layoutRace, reframeCamera, RACE_SPEED_LIMIT, TRACK_HEIGHT } from '../src/race.js';

const makeBalls = (count = 19) => Array.from({ length: count }, (_, i) => Matter.Bodies.circle(50, 50, 32, {
    restitution: 0.9, plugin: { userData: { id: `member-${i}`, name: `Member ${i}` } },
}));

function assertInside(body, width, height) {
    const radius = body.circleRadius;
    assert.ok(body.position.x >= radius + EDGE_GAP - 1e-7);
    assert.ok(body.position.x <= width - radius - EDGE_GAP + 1e-7);
    assert.ok(body.position.y >= radius + EDGE_GAP - 1e-7);
    assert.ok(body.position.y <= height - radius - EDGE_GAP + 1e-7);
    assert.ok(Math.hypot(body.velocity.x, body.velocity.y) <= MAX_SPEED + 1e-7);
}

test('initial layouts keep every avatar separated and inside desktop and mobile arenas', () => {
    for (const [count, width, height] of [[19, 1000, 560], [19, 280, 440], [100, 320, 480], [0, 280, 440]]) {
        const { radius, positions } = floatLayout(count, width, height);
        for (let i = 0; i < positions.length; i++) {
            const body = Matter.Bodies.circle(positions[i].x, positions[i].y, radius);
            assertInside(body, width, height);
            for (let j = i + 1; j < positions.length; j++) {
                assert.ok(Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y) >= radius * 2);
            }
        }
    }
});

test('escaped bodies return fully into the arena and reflect outward velocity', () => {
    const body = makeBalls(1)[0];
    Matter.Body.setPosition(body, { x: -500, y: 1500 });
    Matter.Body.setVelocity(body, { x: -500, y: 900 });
    containBody(body, 320, 480);
    assertInside(body, 320, 480);
    assert.ok(body.velocity.x > 0);
    assert.ok(body.velocity.y < 0);
});

test('fast collisions and repeated viewport shrinks never lose an avatar', () => {
    const engine = Matter.Engine.create();
    engine.gravity.y = 0.8;
    const balls = makeBalls();
    Matter.Composite.add(engine.world, balls);
    let walls = [];
    for (const [width, height] of [[1200, 640], [320, 480], [900, 420], [240, 320]]) {
        Matter.Composite.remove(engine.world, walls);
        walls = createWalls(width, height);
        Matter.Composite.add(engine.world, walls);
        const layout = floatLayout(balls.length, width, height);
        balls.forEach((body, i) => {
            setRadius(body, layout.radius);
            Matter.Body.setPosition(body, { x: i * 150 - 100, y: i * 70 });
            Matter.Body.setVelocity(body, { x: i % 2 ? 500 : -500, y: 500 });
        });
        for (let tick = 0; tick < 600; tick++) {
            balls.forEach(body => containBody(body, width, height));
            Matter.Engine.update(engine, 1000 / 120);
            balls.forEach(body => {
                containBody(body, width, height);
                assertInside(body, width, height);
            });
        }
        assert.equal(Matter.Composite.allBodies(engine.world).length, balls.length + 4);
    }
});

function seededRandom(seed) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

function makeRace(count = 20, seed = 7) {
    const engine = Matter.Engine.create({ positionIterations: 8, velocityIterations: 8 });
    const balls = makeBalls(count);
    Matter.Composite.add(engine.world, balls);
    const race = createRace(engine, balls, 900, 560, seededRandom(seed));
    race.phase = 'countdown';
    return { race, engine, balls };
}

test('countdown holds the real starting gate and racers until release', () => {
    const { race, engine, balls } = makeRace();
    const positions = balls.map(body => ({ ...body.position }));
    advanceRace(race, 2);
    assert.equal(race.countdown, 1);
    assert.equal(race.elapsed, 0);
    assert.deepEqual(balls.map(body => body.position), positions);
    assert.ok(Matter.Composite.allBodies(engine.world).includes(race.gate));
    advanceRace(race, 1);
    assert.equal(race.phase, 'running');
    assert.ok(!Matter.Composite.allBodies(engine.world).includes(race.gate));
    advanceRace(race, 0.25);
    assert.ok(balls.every((body, i) => body.position.y > positions[i].y));
});

test('1, 20, 50 and 100 racers all fit above the gate without overlapping', () => {
    for (const count of [1, 20, 50, 100]) {
        const { race, balls } = makeRace(count);
        for (let i = 0; i < balls.length; i++) {
            const body = balls[i];
            assert.ok(body.position.y + body.circleRadius < race.gate.bounds.min.y);
            assert.ok(body.position.x - body.circleRadius > 0);
            assert.ok(body.position.x + body.circleRadius < race.worldWidth);
            for (let j = i + 1; j < balls.length; j++) {
                assert.ok(Math.hypot(body.position.x - balls[j].position.x, body.position.y - balls[j].position.y)
                    > body.circleRadius + balls[j].circleRadius);
            }
        }
        if (count === 20) assert.ok(balls.every(body => body.circleRadius === 17));
    }
});

test('gravity and actual obstacle collisions determine movement', () => {
    const { race, engine, balls } = makeRace(1);
    advanceRace(race, 3);
    Matter.Body.setPosition(balls[0], { x: 121, y: 425 });
    Matter.Body.setVelocity(balls[0], { x: 0, y: 2 });
    let collisions = 0;
    Matter.Events.on(engine, 'collisionStart', event => {
        collisions += event.pairs.filter(pair =>
            pair.bodyA === balls[0] || pair.bodyB === balls[0]).length;
    });
    advanceRace(race, 0.5);
    assert.ok(collisions > 0, 'avatar must actually collide with a Matter obstacle');
    assert.ok(Math.abs(balls[0].position.x - 121) > 1, 'pin deflects the avatar sideways');
    const paddle = race.obstacles.find(body => body.plugin.trackType === 'paddle');
    assert.ok(Math.abs(paddle.angle - 0.2) > 0.1, 'physical paddle rotates');
    assert.equal(race.results.length, 0);
});

test('new moving mechanisms change real collision geometry and deflect marbles', () => {
    for (const type of ['bumper', 'pendulum', 'slider']) {
        const { race, engine, balls } = makeRace(1);
        advanceRace(race, 3);
        const obstacle = race.obstacles.find(body => body.plugin.trackType === type);
        const top = [...obstacle.vertices].sort((a, b) => a.y - b.y)[0];
        const marble = balls[0];
        Matter.Body.setPosition(marble, {
            x: type === 'bumper' ? obstacle.position.x : top.x,
            y: obstacle.bounds.min.y - marble.circleRadius - 1,
        });
        Matter.Body.setVelocity(marble, { x: 0, y: 5 });
        const before = { x: obstacle.position.x, angle: obstacle.angle };
        let collisions = 0;
        Matter.Events.on(engine, 'collisionStart', event => {
            collisions += event.pairs.filter(pair =>
                pair.bodyA === obstacle && pair.bodyB === marble
                || pair.bodyB === obstacle && pair.bodyA === marble).length;
        });
        advanceRace(race, 0.8);
        assert.ok(collisions > 0, `${type} must physically collide with the marble`);
        assert.ok(Math.abs(obstacle.position.x - before.x) > 10, `${type} collision body must move`);
        if (type === 'pendulum') assert.ok(Math.abs(obstacle.angle - before.angle) > 0.1);
        assert.ok(Math.abs(marble.velocity.x) > 0.1, `${type} must deflect the marble`);
    }
});

test('extended track has 12 populated sections and moving gates keep a wide passage', () => {
    const { race } = makeRace(1);
    assert.ok(race.worldHeight >= 14000);
    assert.equal(race.finishY, race.worldHeight - 200);
    assert.equal(race.sections.length, 13);
    for (let i = 0; i < 12; i++) {
        assert.ok(race.obstacles.filter(body => body.position.y >= race.sections[i].y
            && body.position.y < race.sections[i + 1].y).length >= 2);
    }
    for (let step = 0; step < 180; step++) {
        advanceRace(race, 0.1);
        const sliders = race.obstacles.filter(body => body.plugin.trackType === 'slider');
        for (const left of sliders.filter(body => body.plugin.direction === 1)) {
            const right = sliders.find(body => body.plugin.direction === -1 && body.plugin.origin.y === left.plugin.origin.y);
            assert.ok(right.bounds.min.x - left.bounds.max.x >= 110, 'sliding gate must never seal the track');
        }
        for (const body of race.obstacles.filter(body => ['bumper', 'pendulum'].includes(body.plugin.trackType))) {
            assert.ok(body.bounds.min.x > 0 && body.bounds.max.x < race.worldWidth);
        }
    }
});

test('complete fields finish a long physical track across deterministic seeds', () => {
    for (const seed of [1, 7, 42, 2026]) {
        const { race } = makeRace(20, seed);
        let tick = 0;
        for (; tick < 150 * 120 && race.phase !== 'finished'; tick++) {
            advanceRace(race, 1 / 120);
            if (tick % 60 === 0) {
                for (const { body } of race.racers) {
                    assert.ok(body.position.x >= body.circleRadius);
                    assert.ok(body.position.x <= race.worldWidth - body.circleRadius);
                    assert.ok(body.position.y >= body.circleRadius);
                    assert.ok(body.position.y <= race.worldHeight - body.circleRadius);
                    assert.ok(Math.hypot(body.velocity.x, body.velocity.y) <= RACE_SPEED_LIMIT + 1e-7);
                }
            }
        }
        assert.equal(race.phase, 'finished', `seed ${seed} did not finish`);
        assert.equal(race.results.length, 20);
        assert.equal(new Set(race.results.map(entry => entry.id)).size, 20);
        assert.ok(race.results.every((entry, i) => entry.time > 0 && (i === 0 || entry.time >= race.results[i - 1].time)));
        assert.ok(race.racers.every(racer => racer.body.position.y >= race.finishY));
        const elapsed = race.elapsed;
        advanceRace(race, 10);
        assert.equal(race.elapsed, elapsed);
    }
});

test('resize changes only camera geometry, preserving physical positions and progress', () => {
    const { race } = makeRace();
    advanceRace(race, 7);
    const before = race.racers.map(racer => ({
        position: { ...racer.body.position }, velocity: { ...racer.body.velocity },
        radius: racer.body.circleRadius, progress: racer.progress,
    }));
    layoutRace(race, 280, 440);
    assert.deepEqual(race.racers.map(racer => ({
        position: racer.body.position, velocity: racer.body.velocity,
        radius: racer.body.circleRadius, progress: racer.progress,
    })), before);
    assert.equal(race.worldWidth, 720);
    assert.equal(race.worldHeight, TRACK_HEIGHT);
    assert.ok(race.viewHeight > 1000);
    assert.ok(race.cameraY >= 0);
});

test('close finishes use real crossing times instead of iteration order', () => {
    const { race, balls } = makeRace(2);
    advanceRace(race, 3);
    balls.forEach((body, i) => {
        Matter.Body.setPosition(body, { x: 100 + i * 100, y: race.finishY - (i ? 0.5 : 1) });
        Matter.Body.setVelocity(body, { x: 0, y: 4 });
    });
    advanceRace(race, 1 / 120);
    assert.equal(race.phase, 'finished');
    assert.equal(race.results[0].id, 'member-1');
    assert.ok(race.results[0].time < race.results[1].time);
});

test('camera can return from overview while paused or finished without advancing physics', () => {
    const { race } = makeRace();
    race.cameraMode = 'overview';
    advanceRace(race, 8);
    const elapsed = race.elapsed;
    race.cameraMode = 'leader';
    reframeCamera(race);
    assert.ok(race.cameraY > 0);
    assert.equal(race.elapsed, elapsed);
    race.cameraMode = 'overview';
    race.cameraY = 0;
    advanceRace(race, 150);
    assert.equal(race.phase, 'finished');
    assert.equal(race.cameraY, 0);
    race.cameraMode = 'leader';
    reframeCamera(race);
    assert.ok(race.cameraY > 0);
    assert.ok(race.finishY >= race.cameraY && race.finishY <= race.cameraY + race.viewHeight);
    layoutRace(race, 320, 640);
    assert.ok(race.finishY >= race.cameraY && race.finishY <= race.cameraY + race.viewHeight);
});

test('leaving race removes its track and restores collidable dynamic marbles', () => {
    const { race, engine, balls } = makeRace();
    advanceRace(race, 150);
    assert.equal(race.phase, 'finished');
    assert.ok(balls.every(body => body.isStatic));
    destroyRace(race);
    assert.equal(Matter.Composite.allBodies(engine.world).length, balls.length);
    assert.ok(balls.every(body => !body.isStatic && body.collisionFilter.mask === 0xFFFFFFFF && !body.isSensor));
    assert.ok(balls.every(body => body.restitution === 0.9));
});

test('empty race completes without invalid finish times', () => {
    const { race } = makeRace(0);
    advanceRace(race, 4);
    assert.equal(race.phase, 'finished');
    assert.equal(race.elapsed, 0);
    assert.deepEqual(race.results, []);
});

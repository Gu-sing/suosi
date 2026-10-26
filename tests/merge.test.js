import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { advanceMerge, aimMerge, createMergeGame, destroyMerge, dropMerge, MERGE_HEIGHT, MERGE_WIDTH } from '../src/merge.js';

const members = Array.from({ length: 19 }, (_, id) => ({ id: `member-${id}`, name: `Member ${id}`, avatarUrl: `avatars/${id}.png` }));
const makeGame = () => createMergeGame(members, { random: () => 0 });

function fixtureBody(game, level, x, y) {
    const body = Matter.Bodies.circle(x, y, game.levels[level].radius, {
        restitution: 0.15,
        plugin: { mergeLevel: level, userData: game.levels[level].member, bornAt: game.elapsed - 3 },
    });
    game.bodies.push(body);
    Matter.Composite.add(game.engine.world, body);
    return body;
}

test('each round selects unique shuffled members and strictly increasing sizes without changing input', () => {
    const original = [...members];
    const first = makeGame();
    const second = createMergeGame([...members, members[0]], { random: () => 0.8 });
    assert.equal(MERGE_WIDTH, 420);
    assert.equal(MERGE_HEIGHT, 620);
    assert.equal(first.levels.length, 11);
    assert.equal(new Set(second.levels.map(level => level.member.id)).size, 11);
    assert.deepEqual(members, original);
    assert.notDeepEqual(first.levels.map(level => level.member.id), second.levels.map(level => level.member.id));
    assert.ok(first.levels.every((level, index) => index === 0 || level.radius > first.levels[index - 1].radius));
    assert.notEqual(first.engine, second.engine);
});

test('empty and one-member rounds have valid terminal behavior', () => {
    const empty = createMergeGame([]);
    assert.equal(empty.phase, 'over');
    assert.equal(dropMerge(empty), null);
    advanceMerge(empty, 1);
    const single = createMergeGame([members[0]]);
    assert.equal(single.currentLevel, 0);
    assert.equal(single.nextLevel, 0);
    fixtureBody(single, 0, 180, 500);
    fixtureBody(single, 0, 208, 500);
    advanceMerge(single, 0.25);
    assert.equal(single.bodies.length, 2);
    assert.equal(single.score, 0);
});

test('dropping follows the preview, clamps aim, and observes cooldown and occupied mouth', () => {
    const game = createMergeGame(members, { random: () => 0.99 });
    assert.equal(game.currentLevel, 4);
    assert.equal(game.nextLevel, 4);
    aimMerge(game, -1000);
    const first = dropMerge(game);
    assert.ok(first);
    assert.equal(first.plugin.mergeLevel, 4);
    assert.ok(first.position.x - first.circleRadius >= game.wallLeft);
    assert.equal(dropMerge(game), null);
    advanceMerge(game, 0.45);
    aimMerge(game, 1000);
    assert.ok(dropMerge(game));
    assert.ok(game.bodies.every(body => body.position.x + body.circleRadius <= game.wallRight));
    const blocked = makeGame();
    fixtureBody(blocked, 0, blocked.aimX, blocked.spawnY);
    assert.equal(dropMerge(blocked), null);
    assert.equal(blocked.cooldown, 0);
});

test('real equal-level contacts merge once into the next member and award points', () => {
    const game = makeGame();
    const a = fixtureBody(game, 0, 180, 500);
    const b = fixtureBody(game, 0, 208, 500);
    advanceMerge(game, 1 / 120);
    assert.equal(game.bodies.length, 1);
    const merged = game.bodies[0];
    assert.equal(merged.plugin.mergeLevel, 1);
    assert.deepEqual(merged.plugin.userData, game.levels[1].member);
    assert.equal(merged.circleRadius, game.levels[1].radius);
    assert.equal(game.score, 3);
    assert.equal(game.bestLevel, 1);
    assert.equal(game.effects.length, 1);
    assert.ok(!Matter.Composite.allBodies(game.engine.world).includes(a));
    assert.ok(!Matter.Composite.allBodies(game.engine.world).includes(b));
    advanceMerge(game, 0.5);
    assert.equal(game.score, 3);
});

test('different members collide and settle without merging', () => {
    const game = makeGame();
    fixtureBody(game, 0, 180, 500);
    fixtureBody(game, 1, 212, 500);
    advanceMerge(game, 3);
    assert.equal(game.bodies.length, 2);
    assert.equal(game.score, 0);
    assert.ok(game.bodies.every(body => body.position.y + body.circleRadius <= game.floorY + 0.1));
});

test('three simultaneous contacts cannot consume a body twice', () => {
    const game = makeGame();
    fixtureBody(game, 0, 180, 500);
    fixtureBody(game, 0, 207, 500);
    fixtureBody(game, 0, 193.5, 477);
    advanceMerge(game, 1 / 120);
    assert.deepEqual(game.bodies.map(body => body.plugin.mergeLevel).sort(), [0, 1]);
    assert.equal(game.score, 3);
    assert.equal(Matter.Composite.allBodies(game.engine.world).length, game.walls.length + 2);
});

test('newly merged neighbors can chain on a subsequent physics step', () => {
    const game = makeGame();
    fixtureBody(game, 0, 150, 500);
    fixtureBody(game, 0, 178, 500);
    fixtureBody(game, 0, 240, 500);
    fixtureBody(game, 0, 268, 500);
    advanceMerge(game, 1 / 120);
    assert.equal(game.bodies.length, 2);
    assert.ok(game.bodies.every(body => body.plugin.mergeLevel === 1));
    Matter.Body.setPosition(game.bodies[0], { x: 190, y: 500 });
    Matter.Body.setPosition(game.bodies[1], { x: 228, y: 500 });
    advanceMerge(game, 1 / 120);
    assert.equal(game.bodies.length, 1);
    assert.equal(game.bodies[0].plugin.mergeLevel, 2);
    assert.equal(game.score, 12);
});

test('the largest tier stays finite and never merges into an undefined avatar', () => {
    const game = makeGame();
    const level = game.levels.length - 1;
    fixtureBody(game, level, 210, 270);
    fixtureBody(game, level, 210, 485);
    advanceMerge(game, 1);
    assert.equal(game.bodies.length, 2);
    assert.ok(game.bodies.every(body => body.plugin.mergeLevel === level && Number.isFinite(body.position.y)));
    assert.equal(game.score, 0);
});

test('new falling avatars do not lose at the danger line, while a settled overflow ends the round', () => {
    const safe = makeGame();
    dropMerge(safe);
    advanceMerge(safe, 3.5);
    assert.equal(safe.phase, 'playing');
    assert.equal(safe.dangerElapsed, 0);

    const game = makeGame();
    // A raised floor models a full pile, keeping the dropped avatar above the line.
    Matter.Composite.add(game.engine.world, Matter.Bodies.rectangle(210, 125, 390, 20, { isStatic: true }));
    dropMerge(game);
    advanceMerge(game, 1.05);
    assert.equal(game.dangerElapsed, 0, 'fresh drops have a grace period');
    advanceMerge(game, 1);
    assert.equal(game.phase, 'playing');
    assert.ok(game.dangerElapsed > 0);
    advanceMerge(game, 1.2);
    assert.equal(game.phase, 'over');
    assert.equal(game.dangerElapsed, game.dangerDuration);
    const position = { ...game.bodies[0].position };
    const elapsed = game.elapsed;
    assert.equal(dropMerge(game), null);
    advanceMerge(game, 5);
    assert.deepEqual(game.bodies[0].position, position);
    assert.equal(game.elapsed, elapsed);
});

test('a cleared danger line resets the countdown', () => {
    const game = makeGame();
    game.engine.gravity.y = 0;
    const body = fixtureBody(game, 0, 210, 100);
    advanceMerge(game, 1);
    assert.ok(game.dangerElapsed > 0.9);
    Matter.Body.setPosition(body, { x: 210, y: 300 });
    advanceMerge(game, 1 / 120);
    assert.equal(game.dangerElapsed, 0);
    assert.equal(game.phase, 'playing');
});

test('fast bodies remain inside the side walls and floor', () => {
    const game = makeGame();
    const body = fixtureBody(game, 0, -1000, 900);
    Matter.Body.setVelocity(body, { x: -300, y: 500 });
    advanceMerge(game, 0.1);
    assert.ok(body.position.x - body.circleRadius >= game.wallLeft - 1e-7);
    assert.ok(body.position.x + body.circleRadius <= game.wallRight + 1e-7);
    assert.ok(body.position.y + body.circleRadius <= game.floorY + 1e-7);
    assert.ok(Math.hypot(body.velocity.x, body.velocity.y) <= 12 + 1e-7);
});

test('destroy removes bodies and collision handlers and a fresh round resets all progress', () => {
    const game = makeGame();
    fixtureBody(game, 0, 180, 500);
    fixtureBody(game, 0, 208, 500);
    advanceMerge(game, 1 / 120);
    assert.equal(game.score, 3);
    destroyMerge(game);
    assert.equal(Matter.Composite.allBodies(game.engine.world).length, 0);
    assert.equal(game.bodies.length, 0);
    assert.equal(game.engine.events.collisionStart.length, 0);
    assert.equal(game.engine.events.collisionActive.length, 0);
    assert.equal(dropMerge(game), null);
    destroyMerge(game);
    const fresh = makeGame();
    assert.equal(fresh.score, 0);
    assert.equal(fresh.elapsed, 0);
    assert.equal(fresh.cooldown, 0);
    assert.equal(fresh.bodies.length, 0);
    assert.equal(fresh.phase, 'playing');
});

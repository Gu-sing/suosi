import Matter from 'matter-js';
import { containBody, createWalls, setRadius } from './physics.js';

export const TRACK_WIDTH = 720;
export const TRACK_HEIGHT = 15200;
export const RACE_SPEED_LIMIT = 18;
const MARBLE_RADIUS = 17;
const STEP_MS = 1000 / 120;

function trackBody(body, trackType, extra = {}) {
    body.plugin = { ...body.plugin, trackType, ...extra };
    return body;
}

function makeTrack() {
    const options = { isStatic: true, friction: 0.002, restitution: 0.45 };
    const obstacles = [];
    const pinRow = (y, offset = 0) => {
        for (let x = 118 + offset; x < TRACK_WIDTH - 65; x += 138) {
            obstacles.push(trackBody(Matter.Bodies.circle(x, y, 22, options), 'pin'));
        }
    };
    const ramp = (y, left) => obstacles.push(trackBody(Matter.Bodies.rectangle(
        left ? 215 : TRACK_WIDTH - 215, y, 480, 18,
        { ...options, angle: left ? 0.26 : -0.26 },
    ), 'ramp'));
    const paddle = (x, y, length, angularSpeed) => obstacles.push(trackBody(
        Matter.Bodies.rectangle(x, y, length, 20, { ...options, angle: 0.2 }),
        'paddle', { angularSpeed },
    ));
    const bumper = (x, y, amplitude, phase = 0) => obstacles.push(trackBody(
        Matter.Bodies.circle(x + amplitude * Math.sin(phase), y, 30, { ...options, restitution: 0.72 }),
        'bumper', { origin: { x, y }, amplitude, frequency: 0.75, phase },
    ));
    const pendulum = (x, y, length, phase = 0) => {
        const amplitude = 0.85;
        const theta = amplitude * Math.sin(phase);
        obstacles.push(trackBody(Matter.Bodies.rectangle(
            x + Math.sin(theta) * length / 2, y + Math.cos(theta) * length / 2,
            length, 20, { ...options, angle: Math.PI / 2 - theta },
        ), 'pendulum', { pivot: { x, y }, length, amplitude, frequency: 0.8, phase }));
    };
    const slidingGates = (y, phase = 0) => {
        for (const direction of [1, -1]) {
            const origin = { x: direction === 1 ? 125 : 595, y };
            const amplitude = 40;
            obstacles.push(trackBody(Matter.Bodies.rectangle(
                origin.x + direction * amplitude * Math.sin(phase), y, 280, 18,
                { ...options, angle: direction * 0.18 },
            ), 'slider', { origin, amplitude, frequency: 0.9, phase, direction }));
        }
    };

    // Each section contains working geometry; the extra distance is filled
    // with obstacles rather than empty falling time.
    pinRow(480);
    pinRow(635, 69);
    pinRow(790);
    ramp(1080, true);
    ramp(1500, false);
    bumper(360, 1780, 185);
    paddle(360, 2070, 250, 0.8);
    ramp(2440, true);
    slidingGates(2820);
    pinRow(3100);
    pinRow(3260, 69);
    pendulum(360, 3450, 240, 0.2);
    paddle(210, 4100, 210, -0.95);
    paddle(510, 4100, 210, 0.95);
    ramp(4500, true);
    ramp(4920, false);
    bumper(240, 5320, 120);
    bumper(480, 5580, 120, Math.PI);
    slidingGates(5860, 0.8);
    ramp(6440, true);
    ramp(6880, false);
    pinRow(7160, 30);
    pendulum(230, 7700, 250, 0.7);
    pendulum(490, 8170, 250, -0.7);
    pinRow(8560);
    paddle(360, 9000, 320, -0.85);
    slidingGates(9400, 1.5);
    pinRow(9700, 69);
    bumper(360, 10200, 190, 0.3);
    bumper(360, 10600, 165, Math.PI);
    pendulum(360, 11000, 280, 0.4);
    ramp(11680, true);
    ramp(12100, false);
    pinRow(12400);
    pinRow(12560, 69);
    slidingGates(12900, 0.5);
    paddle(210, 13430, 210, 0.9);
    paddle(510, 13430, 210, -0.9);
    pendulum(360, 13820, 240, -0.3);
    ramp(14200, true);
    ramp(14620, false);
    const gate = trackBody(Matter.Bodies.rectangle(360, 320, 720, 12, options), 'gate');
    obstacles.push(gate);
    return { obstacles, gate };
}

function resetMarble(body, radius) {
    Matter.Body.setStatic(body, false);
    body.collisionFilter = { category: 1, mask: 0xFFFFFFFF, group: 0 };
    body.isSensor = false;
    body.friction = 0.004;
    body.frictionStatic = 0.01;
    body.frictionAir = 0.0015;
    body.restitution = 0.48;
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);
    Matter.Body.setAngle(body, 0);
    setRadius(body, radius);
}

export function createRace(engine, balls, width, height, random = Math.random) {
    const { obstacles, gate } = makeTrack();
    const columns = Math.max(1, Math.ceil(Math.sqrt(balls.length * 640 / 240)));
    const rows = Math.max(1, Math.ceil(balls.length / columns));
    const cellWidth = 640 / columns;
    const cellHeight = 240 / rows;
    const radius = Math.max(2, Math.min(MARBLE_RADIUS, cellWidth / 2 - 5, cellHeight / 2 - 5));
    const slots = balls.map((_, i) => ({
        x: 40 + (i % columns + 0.5) * cellWidth,
        y: 50 + (Math.floor(i / columns) + 0.5) * cellHeight,
    }));
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const race = {
        phase: 'idle', countdown: 3, elapsed: 0,
        worldWidth: TRACK_WIDTH, worldHeight: TRACK_HEIGHT,
        startY: 320, finishY: TRACK_HEIGHT - 200, cameraY: 0, viewHeight: 0, cameraMode: 'leader',
        obstacles, gate, walls: createWalls(TRACK_WIDTH, TRACK_HEIGHT),
        sections: [
            { y: 360, label: '01 · 星点瀑布' },
            { y: 940, label: '02 · 回旋山道' },
            { y: 1640, label: '03 · 撞锤峡谷' },
            { y: 2660, label: '04 · 移动关卡' },
            { y: 3890, label: '05 · 双子风车' },
            { y: 5170, label: '06 · 往返弹跳' },
            { y: 6250, label: '07 · 之字漏斗' },
            { y: 7470, label: '08 · 摆锤走廊' },
            { y: 8820, label: '09 · 风车闸口' },
            { y: 10000, label: '10 · 交错机关' },
            { y: 11500, label: '11 · 连环弯道' },
            { y: 13200, label: '12 · 最后冲刺' },
            { y: TRACK_HEIGHT - 300, label: '终点就在前方' },
        ],
        racers: balls.map((body, i) => {
            resetMarble(body, radius);
            Matter.Body.setPosition(body, { x: slots[i].x + (random() - 0.5) * 8, y: slots[i].y });
            Matter.Body.setVelocity(body, { x: (random() - 0.5) * 1.2, y: 0 });
            return { body, finished: false, time: null, progress: 0, lastY: body.position.y, stuckFor: 0, nudges: 0 };
        }),
        ranking: [], results: [], remainingCountdown: 3, engine, random,
    };
    Matter.Composite.add(engine.world, [...race.walls, ...obstacles]);
    engine.gravity.x = 0;
    engine.gravity.y = 0.82;
    Matter.Engine.clear(engine);
    layoutRace(race, width, height);
    updateRanking(race);
    return race;
}

export function destroyRace(race) {
    if (!race?.engine) return;
    Matter.Composite.remove(race.engine.world, [...race.obstacles, ...race.walls]);
    race.racers.forEach(({ body }) => {
        Matter.Body.setStatic(body, false);
        body.collisionFilter = { category: 1, mask: 0xFFFFFFFF, group: 0 };
        body.isSensor = false;
        body.friction = 0.01;
        body.frictionStatic = 0.5;
        body.frictionAir = 0.002;
        body.restitution = 0.9;
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(body, 0);
    });
    Matter.Engine.clear(race.engine);
}

export function layoutRace(race, width, height) {
    race.viewHeight = height / (width / race.worldWidth);
    race.cameraY = Math.max(0, Math.min(race.cameraY, race.worldHeight - race.viewHeight));
    if (race.cameraMode === 'leader') reframeCamera(race);
}

function updateRanking(race) {
    race.ranking = [...race.racers].sort((a, b) => {
        if (a.finished && b.finished) return a.time - b.time;
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        return b.progress - a.progress;
    }).map(racer => {
        const member = racer.body.plugin.userData;
        return { id: member.id, name: member.name || member.id, progress: racer.progress, finished: racer.finished, time: racer.time };
    });
    race.results = race.ranking.filter(entry => entry.finished).map(({ id, name, time }) => ({ id, name, time }));
}

function cameraTarget(race) {
    const unfinished = race.racers.filter(racer => !racer.finished);
    const leaderY = unfinished.length ? Math.max(...unfinished.map(racer => racer.body.position.y)) : race.finishY;
    return Math.max(0, Math.min(race.worldHeight - race.viewHeight, leaderY - race.viewHeight * 0.38));
}

// Camera controls must work while paused or finished, when no physics step runs.
export function reframeCamera(race) {
    race.cameraY = cameraTarget(race);
}

function updateCamera(race, seconds) {
    if (race.cameraMode === 'overview') return;
    const target = cameraTarget(race);
    race.cameraY += (target - race.cameraY) * (1 - Math.exp(-seconds * 5));
}

function moveKinematic(body, position, angle, seconds) {
    const oldPosition = { ...body.position };
    const oldAngle = body.angle;
    Matter.Body.setPosition(body, position);
    Matter.Body.setVelocity(body, {
        x: (position.x - oldPosition.x) / seconds / 60,
        y: (position.y - oldPosition.y) / seconds / 60,
    });
    Matter.Body.setAngle(body, angle);
    Matter.Body.setAngularVelocity(body, (angle - oldAngle) / seconds / 60);
}

function moveObstacles(race, seconds) {
    for (const obstacle of race.obstacles) {
        const motion = obstacle.plugin;
        if (motion.trackType === 'paddle') {
            moveKinematic(obstacle, obstacle.position, obstacle.angle + motion.angularSpeed * seconds, seconds);
        } else if (motion.trackType === 'bumper' || motion.trackType === 'slider') {
            moveKinematic(obstacle, {
                x: motion.origin.x + (motion.direction || 1) * motion.amplitude
                    * Math.sin(race.elapsed * motion.frequency + motion.phase),
                y: motion.origin.y,
            }, obstacle.angle, seconds);
        } else if (motion.trackType === 'pendulum') {
            const theta = motion.amplitude * Math.sin(race.elapsed * motion.frequency + motion.phase);
            moveKinematic(obstacle, {
                x: motion.pivot.x + Math.sin(theta) * motion.length / 2,
                y: motion.pivot.y + Math.cos(theta) * motion.length / 2,
            }, Math.PI / 2 - theta, seconds);
        }
    }
}

function stepRace(race, milliseconds) {
    const seconds = milliseconds / 1000;
    const before = race.elapsed;
    race.elapsed += seconds;
    moveObstacles(race, seconds);
    const previousY = race.racers.map(racer => racer.body.position.y);
    for (const racer of race.racers) {
        if (racer.finished) continue;
        containBody(racer.body, race.worldWidth, race.worldHeight, RACE_SPEED_LIMIT);
        // A small physical kick dislodges a marble resting on a pin or caught
        // behind another marble. Its position/progress is never overwritten.
        if (racer.body.position.y > racer.lastY + 16) {
            racer.lastY = racer.body.position.y;
            racer.stuckFor = 0;
        } else racer.stuckFor += seconds;
        if (racer.stuckFor > 3.5) {
            Matter.Body.applyForce(racer.body, racer.body.position, {
                x: racer.body.mass * (race.random() > 0.5 ? 0.035 : -0.035),
                y: -racer.body.mass * 0.028,
            });
            racer.stuckFor = 0;
            racer.lastY = racer.body.position.y;
            racer.nudges++;
        }
    }
    Matter.Engine.update(race.engine, milliseconds);
    race.racers.forEach((racer, i) => {
        if (racer.finished) return;
        containBody(racer.body, race.worldWidth, race.worldHeight, RACE_SPEED_LIMIT);
        racer.progress = Math.max(0, Math.min(1, (racer.body.position.y - race.startY) / (race.finishY - race.startY)));
        if (racer.body.position.y >= race.finishY) {
            const travelled = racer.body.position.y - previousY[i];
            const fraction = travelled > 0 ? Math.max(0, Math.min(1, (race.finishY - previousY[i]) / travelled)) : 1;
            racer.time = before + seconds * fraction;
            racer.finished = true;
            racer.progress = 1;
            racer.body.collisionFilter.mask = 0;
            Matter.Body.setStatic(racer.body, true);
        }
    });
    updateRanking(race);
    updateCamera(race, seconds);
    if (race.racers.every(racer => racer.finished)) {
        race.phase = 'finished';
        race.elapsed = Math.max(0, ...race.racers.map(racer => racer.time));
        if (race.cameraMode === 'leader') reframeCamera(race);
    }
}

export function advanceRace(race, seconds) {
    if (race.phase !== 'countdown' && race.phase !== 'running') return;
    if (race.phase === 'countdown') {
        const duration = Math.min(seconds, race.remainingCountdown);
        race.remainingCountdown -= duration;
        seconds -= duration;
        race.countdown = Math.max(0, Math.ceil(race.remainingCountdown - 1e-8));
        if (race.remainingCountdown > 1e-8) return;
        race.phase = race.racers.length ? 'running' : 'finished';
        Matter.Composite.remove(race.engine.world, race.gate);
        race.obstacles = race.obstacles.filter(body => body !== race.gate);
    }
    while (race.phase === 'running' && seconds > 1e-10) {
        const step = Math.min(STEP_MS, seconds * 1000);
        stepRace(race, step);
        seconds -= step / 1000;
    }
}

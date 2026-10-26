import Matter from 'matter-js';
import { createCustomRenderer } from './render.js';
import { setupInteractions } from './ui.js';
import { containBody, createWalls, floatLayout, setRadius } from './physics.js';
import { advanceRace, createRace, destroyRace, layoutRace, reframeCamera } from './race.js';
import { advanceMerge, createMergeGame, destroyMerge } from './merge.js';
import { setupMergeControls } from './merge-input.js';

export async function initSimulation(canvas, { onStateChange = () => {}, onSelect = () => {} } = {}) {
    const baseUrl = import.meta.env.BASE_URL;
    const response = await fetch(`${baseUrl}members.json`);
    if (!response.ok) throw new Error(`成员数据加载失败（${response.status}）`);
    const members = await response.json();
    if (!Array.isArray(members)) throw new Error('成员数据格式有误');

    const engine = Matter.Engine.create({ positionIterations: 8, velocityIterations: 8 });
    engine.gravity.y = 0;
    const bounds = canvas.getBoundingClientRect();
    let width = Math.max(1, bounds.width);
    let height = Math.max(1, bounds.height);
    let mode = 'float';
    let paused = false;
    let gravity = false;
    let destroyed = false;
    let merge = null;
    let bestScore = 0;
    try { bestScore = Math.max(0, Number(localStorage.getItem('source-merge-best')) || 0); } catch { /* Storage may be unavailable. */ }
    if (!Number.isFinite(bestScore)) bestScore = 0;
    const images = new Map();
    let race = { phase: 'idle', countdown: 3, elapsed: 0, racers: [], obstacles: [], results: [], ranking: [], cameraMode: 'leader' };
    let walls = createWalls(width, height);
    Matter.Composite.add(engine.world, walls);

    const initial = floatLayout(members.length, width, height);
    const balls = members.map((member, index) => {
        const ball = Matter.Bodies.circle(initial.positions[index].x, initial.positions[index].y, initial.radius, {
            restitution: 0.9,
            friction: 0.01,
            frictionAir: 0.002,
            plugin: { userData: member, image: null },
        });
        if (member.avatarUrl) {
            const image = new Image();
            images.set(member.id, image);
            image.onload = () => { if (!destroyed) ball.plugin.image = image; };
            image.src = /^(?:https?:|data:|\/)/.test(member.avatarUrl) ? member.avatarUrl : `${baseUrl}${member.avatarUrl}`;
        }
        return ball;
    });
    Matter.Composite.add(engine.world, balls);

    const getState = () => ({ mode, width, height, paused, gravity, memberCount: members.length, race, merge });
    const saveMergeBest = () => {
        if (merge) {
            if (merge.score > bestScore) {
                bestScore = merge.score;
                try { localStorage.setItem('source-merge-best', String(bestScore)); } catch { /* The round still works without storage. */ }
            }
            merge.bestScore = bestScore;
        }
    };
    const publish = () => {
        if (destroyed) return;
        saveMergeBest();
        onStateChange(getState());
    };
    const renderer = createCustomRenderer(engine, canvas, getState);
    const interactions = setupInteractions(engine, canvas, {
        getSize: () => ({ width, height }),
        isInteractive: () => mode === 'float' && !paused,
        onSelect,
    });
    const mergeControls = setupMergeControls(canvas, {
        getGame: () => merge,
        getSize: () => ({ width, height }),
        isInteractive: () => mode === 'merge' && !paused && merge?.phase === 'playing',
        onChange: publish,
    });

    function scatter() {
        interactions.cancel();
        const layout = floatLayout(balls.length, width, height);
        const slots = [...layout.positions];
        for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        balls.forEach((ball, index) => {
            setRadius(ball, layout.radius);
            Matter.Body.setPosition(ball, slots[index]);
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 1.4;
            Matter.Body.setVelocity(ball, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
            Matter.Body.setAngularVelocity(ball, 0);
            Matter.Body.setAngle(ball, 0);
            containBody(ball, width, height);
        });
    }

    function resize() {
        if (destroyed) return;
        const rect = canvas.getBoundingClientRect();
        const nextWidth = Math.max(1, rect.width);
        const nextHeight = Math.max(1, rect.height);
        interactions.cancel();
        mergeControls.cancel();
        const previousWidth = width;
        const previousHeight = height;
        width = nextWidth;
        height = nextHeight;
        if (mode === 'race') {
            layoutRace(race, width, height);
        } else if (mode === 'float') {
            Matter.Composite.remove(engine.world, walls);
            walls = createWalls(width, height);
            Matter.Composite.add(engine.world, walls);
            const { radius } = floatLayout(balls.length, width, height);
            balls.forEach(ball => {
                setRadius(ball, radius);
                Matter.Body.setPosition(ball, {
                    x: ball.position.x / previousWidth * width,
                    y: ball.position.y / previousHeight * height,
                });
                containBody(ball, width, height);
            });
        }
        renderer.resize(width, height);
        publish();
    }

    scatter();
    renderer.resize(width, height);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('resize', resize);
    const fixedStep = 1000 / 120;
    let previousTime = null;
    let accumulator = 0;
    let lastPublish = 0;
    let animationFrame;
    function frame(now) {
        if (destroyed) return;
        const elapsed = previousTime === null ? 0 : Math.min(64, now - previousTime);
        previousTime = now;
        if (!paused && !document.hidden) {
            accumulator += elapsed;
            while (accumulator >= fixedStep) {
                if (mode === 'float') {
                    balls.forEach(ball => containBody(ball, width, height));
                    Matter.Engine.update(engine, fixedStep);
                    balls.forEach(ball => containBody(ball, width, height));
                } else if (mode === 'race') {
                    advanceRace(race, fixedStep / 1000);
                } else {
                    advanceMerge(merge, fixedStep / 1000);
                }
                accumulator -= fixedStep;
            }
            if (mode !== 'float' && now - lastPublish >= 100) {
                publish();
                lastPublish = now;
            }
        } else accumulator = 0;
        animationFrame = requestAnimationFrame(frame);
    }
    const resetClock = () => { previousTime = null; accumulator = 0; };
    document.addEventListener('visibilitychange', resetClock);
    animationFrame = requestAnimationFrame(frame);
    publish();

    function prepareRace() {
        saveMergeBest();
        destroyMerge(merge);
        merge = null;
        destroyRace(race);
        Matter.Composite.remove(engine.world, walls);
        race = createRace(engine, balls, width, height);
    }

    function prepareMerge() {
        saveMergeBest();
        destroyMerge(merge);
        destroyRace(race);
        race = { phase: 'idle', countdown: 3, elapsed: 0, racers: [], obstacles: [], results: [], ranking: [], cameraMode: 'leader' };
        Matter.Composite.remove(engine.world, walls);
        merge = createMergeGame(members, { images });
        merge.bestScore = bestScore;
    }

    function setMode(nextMode) {
        if (!['float', 'race', 'merge'].includes(nextMode) || nextMode === mode) return;
        interactions.cancel();
        mergeControls.cancel();
        mode = nextMode;
        paused = false;
        resetClock();
        if (mode === 'race') prepareRace();
        else if (mode === 'merge') prepareMerge();
        else {
            saveMergeBest();
            destroyMerge(merge);
            merge = null;
            destroyRace(race);
            race = { phase: 'idle', countdown: 3, elapsed: 0, racers: [], obstacles: [], results: [], ranking: [], cameraMode: 'leader' };
            Matter.Composite.remove(engine.world, walls);
            walls = createWalls(width, height);
            Matter.Composite.add(engine.world, walls);
            engine.gravity.y = gravity ? 0.8 : 0;
            scatter();
            Matter.Engine.clear(engine);
        }
        publish();
    }

    return {
        getState,
        getMembers: () => [...members],
        setMode,
        startRace() {
            interactions.cancel();
            mergeControls.cancel();
            mode = 'race';
            paused = false;
            prepareRace();
            race.phase = balls.length ? 'countdown' : 'finished';
            resetClock();
            publish();
        },
        startMerge() {
            interactions.cancel();
            mergeControls.cancel();
            mode = 'merge';
            paused = false;
            prepareMerge();
            resetClock();
            publish();
        },
        setCameraMode(value) {
            if (mode !== 'race' || value !== 'leader' && value !== 'overview') return;
            race.cameraMode = value;
            if (value === 'leader') reframeCamera(race);
            publish();
        },
        shuffle() {
            if (mode !== 'float') return;
            scatter();
            publish();
        },
        setPaused(value) {
            paused = Boolean(value);
            interactions.cancel();
            mergeControls.cancel();
            resetClock();
            publish();
        },
        toggleGravity() {
            if (mode !== 'float') return;
            gravity = !gravity;
            engine.gravity.y = gravity ? 0.8 : 0;
            publish();
        },
        reset() {
            interactions.cancel();
            mergeControls.cancel();
            paused = false;
            gravity = false;
            if (mode === 'race') {
                prepareRace();
                race.phase = balls.length ? 'countdown' : 'finished';
            } else if (mode === 'merge') {
                prepareMerge();
            } else {
                engine.gravity.y = 0;
                scatter();
            }
            resetClock();
            publish();
        },
        destroy() {
            saveMergeBest();
            destroyed = true;
            cancelAnimationFrame(animationFrame);
            observer.disconnect();
            window.removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', resetClock);
            interactions.destroy();
            mergeControls.destroy();
            destroyMerge(merge);
            renderer.destroy();
            Matter.Composite.clear(engine.world, false);
            Matter.Engine.clear(engine);
        },
    };
}

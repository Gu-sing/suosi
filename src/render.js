import Matter from 'matter-js';
import { mergeView } from './merge-input.js';

const COLORS = ['#0969da', '#1f883d', '#8250df', '#9a6700', '#bc4c00', '#0969da'];
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Consolas, monospace';

function shorten(ctx, value, maxWidth) {
    const text = String(value || 'Source member');
    if (ctx.measureText(text).width <= maxWidth) return text;
    const characters = Array.from(text);
    while (characters.length > 1 && ctx.measureText(`${characters.join('')}…`).width > maxWidth) characters.pop();
    return `${characters.join('')}…`;
}

function roundedRect(ctx, x, y, width, height, radius = 5) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
}

export function createCustomRenderer(engine, canvas, getState) {
    const ctx = canvas.getContext('2d');
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let frame;
    let destroyed = false;

    function resize(nextWidth, nextHeight) {
        width = Math.max(1, nextWidth);
        height = Math.max(1, nextHeight);
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function background() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#f6f8fa';
        ctx.fillRect(0, 0, width, height);
    }

    function drawGrid(step = 32, offsetY = 0) {
        ctx.save();
        ctx.fillStyle = '#e5e9ef';
        for (let x = 16; x < width; x += step) {
            for (let y = ((offsetY % step) + step) % step; y < height; y += step) {
                ctx.fillRect(x, y, 1, 1);
            }
        }
        ctx.restore();
    }

    function drawAvatar(body, index, x, y, radius, { leader = false, labels = true, race = false, finished = false } = {}) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !radius) return;
        if (y + radius < -26 || y - radius > height + 26 || x + radius < 0 || x - radius > width) return;
        const color = body.plugin.color || COLORS[index % COLORS.length];
        const name = String(body.plugin.userData?.name || body.plugin.userData?.id || 'Source');
        const image = body.plugin.image;
        const hovered = body.plugin.hovered && !race;
        ctx.save();
        ctx.translate(x, y);
        if (leader) {
            ctx.beginPath();
            ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#1f883d';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.save();
        ctx.clip();
        // Rotate the avatar with its body, then restore before drawing its name.
        ctx.rotate(body.angle);
        ctx.fillStyle = color;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
        if (image?.complete && image.naturalWidth > 0) {
            const size = Math.min(image.naturalWidth, image.naturalHeight);
            ctx.drawImage(image,
                (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size,
                -radius, -radius, radius * 2, radius * 2);
        } else if (radius >= 5) {
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `600 ${Math.max(8, radius * 0.75)}px ${FONT}`;
            ctx.fillText(Array.from(name)[0].toUpperCase(), 0, radius * 0.03);
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, radius - 0.65), 0, Math.PI * 2);
        ctx.strokeStyle = hovered ? '#0969da' : finished ? '#1f883d' : '#d1d9e0';
        ctx.lineWidth = hovered ? 2.5 : radius < 5 ? 0.75 : 1.5;
        ctx.stroke();

        if (labels) {
            ctx.font = `500 ${race ? 10 : 11}px ${FONT}`;
            const label = shorten(ctx, name, width < 420 ? 72 : 96);
            const labelWidth = ctx.measureText(label).width + 10;
            const labelHeight = 18;
            const labelX = Math.min(width - labelWidth - 5, Math.max(5, x - labelWidth / 2)) - x;
            const labelY = y + radius + labelHeight + 5 > height ? -radius - labelHeight - 4 : radius + 4;
            roundedRect(ctx, labelX, labelY, labelWidth, labelHeight, 3);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.93)';
            ctx.fill();
            ctx.fillStyle = leader ? '#1a7f37' : '#1f2328';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, labelX + labelWidth / 2, labelY + labelHeight / 2);
        }
        ctx.restore();
    }

    function raceView(race) {
        const overview = race.cameraMode === 'overview';
        const worldWidth = race.worldWidth;
        const worldHeight = race.worldHeight;
        const scale = overview ? Math.min(width / worldWidth, height / worldHeight) : width / worldWidth;
        const offsetX = (width - worldWidth * scale) / 2;
        const cameraY = overview ? 0 : race.cameraY || 0;
        const offsetY = overview ? (height - worldHeight * scale) / 2 : 0;
        return {
            scale, overview, offsetX, offsetY, cameraY, worldWidth, worldHeight,
            x: x => offsetX + x * scale,
            y: y => offsetY + (y - cameraY) * scale,
        };
    }

    function drawObstacle(body, view) {
        if (view.y(body.bounds.max.y) < -4 || view.y(body.bounds.min.y) > height + 4) return;
        const type = body.plugin.trackType;
        const moving = ['paddle', 'bumper', 'pendulum', 'slider'].includes(type);
        ctx.save();
        ctx.beginPath();
        if (body.circleRadius) {
            ctx.arc(view.x(body.position.x), view.y(body.position.y), body.circleRadius * view.scale, 0, Math.PI * 2);
        } else {
            body.vertices.forEach((vertex, index) => {
                const x = view.x(vertex.x);
                const y = view.y(vertex.y);
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
        }
        ctx.fillStyle = moving ? '#ddf4ff' : type === 'gate' ? '#dafbe1' : type === 'pin' ? '#e5e9ef' : '#d1d9e0';
        ctx.strokeStyle = moving ? '#0969da' : type === 'gate' ? '#1f883d' : type === 'pin' ? '#8c959f' : '#59636e';
        ctx.lineWidth = view.overview ? 0.6 : 1.25;
        ctx.fill();
        ctx.stroke();
        if (moving && !view.overview) {
            const pivot = type === 'pendulum' ? body.plugin.pivot : body.position;
            ctx.beginPath();
            ctx.arc(view.x(pivot.x), view.y(pivot.y), 3 * view.scale, 0, Math.PI * 2);
            ctx.fillStyle = '#0969da';
            ctx.fill();
        }
        ctx.restore();
    }

    function drawTrack(race, view) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(view.offsetX, view.offsetY, view.worldWidth * view.scale, view.worldHeight * view.scale);
        ctx.strokeStyle = '#d1d9e0';
        ctx.lineWidth = 1;
        ctx.strokeRect(view.offsetX + 0.5, view.offsetY - view.cameraY * view.scale, view.worldWidth * view.scale - 1, view.worldHeight * view.scale);

        // Depth marks and section names describe the course; collision geometry
        // below comes exclusively from the live Matter bodies.
        ctx.font = `10px ${MONO}`;
        ctx.fillStyle = '#59636e';
        ctx.textBaseline = 'middle';
        for (let depth = 500; depth < view.worldHeight; depth += 500) {
            const y = view.y(depth);
            if (y < 0 || y > height) continue;
            ctx.strokeStyle = '#e5e9ef';
            ctx.beginPath();
            ctx.moveTo(view.x(0), y);
            ctx.lineTo(view.x(view.overview ? 60 : 12), y);
            ctx.stroke();
            ctx.textAlign = view.overview ? 'right' : 'left';
            ctx.fillText(String(depth), view.overview ? view.offsetX - 10 : view.x(18), y);
        }
        ctx.font = `500 11px ${FONT}`;
        for (const section of race.sections || []) {
            const y = view.y(section.y);
            if (y < 15 || y > height - 12) continue;
            ctx.textAlign = 'left';
            ctx.fillStyle = '#59636e';
            const x = view.overview ? view.x(view.worldWidth) + 13 : 18;
            ctx.fillText(section.label, x, y);
        }

        const start = view.y((race.startY || 180) - 70);
        if (start >= 12 && start < height - 10 && !view.overview) {
            ctx.textAlign = 'center';
            ctx.fillStyle = '#59636e';
            ctx.font = `500 10px ${MONO}`;
            ctx.fillText('START', width / 2, Math.max(18, start - 40));
        }
        const finish = view.y(race.finishY || view.worldHeight - 200);
        if (finish > -20 && finish < height + 20) {
            const square = view.overview ? 3 : 10;
            const left = view.x(18);
            const right = view.x(view.worldWidth - 18);
            for (let x = left, column = 0; x < right; x += square, column++) {
                for (let row = 0; row < 2; row++) {
                    ctx.fillStyle = (column + row) % 2 ? '#1f883d' : '#dafbe1';
                    ctx.fillRect(x, finish + row * square, Math.min(square, right - x), square);
                }
            }
            ctx.font = `600 11px ${MONO}`;
            ctx.fillStyle = '#1a7f37';
            ctx.textAlign = view.overview ? 'left' : 'center';
            ctx.fillText('FINISH', view.overview ? right + 12 : width / 2, view.overview ? finish + 3 : finish - 16);
        }
        ctx.restore();
        (race.obstacles || []).forEach(body => drawObstacle(body, view));
    }

    function drawMinimap(race, view, leaderId) {
        if (view.overview || height < 180) return;
        const mapWidth = 24;
        const mapHeight = Math.min(280, height - 100);
        const x = width - 38;
        const y = 52;
        const scaleY = mapHeight / view.worldHeight;
        ctx.save();
        roundedRect(ctx, x - 5, y - 18, mapWidth + 10, mapHeight + 27, 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();
        ctx.strokeStyle = '#d1d9e0';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = `9px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#59636e';
        ctx.fillText('赛道', x + mapWidth / 2, y - 6);
        ctx.strokeStyle = '#d1d9e0';
        ctx.strokeRect(x, y, mapWidth, mapHeight);
        for (const section of race.sections || []) {
            const lineY = y + section.y * scaleY;
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.lineTo(x + mapWidth, lineY);
            ctx.stroke();
        }
        for (const racer of race.racers || []) {
            const memberId = racer.body.plugin.userData?.id;
            ctx.fillStyle = memberId === leaderId ? '#1a7f37' : racer.finished ? '#1f883d' : '#0969da';
            const dotX = x + Math.max(2, Math.min(mapWidth - 2, racer.body.position.x / view.worldWidth * mapWidth));
            const dotY = y + Math.max(1, Math.min(mapHeight - 1, racer.body.position.y * scaleY));
            ctx.fillRect(dotX - 1, dotY - 1, 2, 2);
        }
        const visibleHeight = Math.min(view.worldHeight, height / view.scale);
        const frameY = y + view.cameraY * scaleY;
        const frameHeight = Math.min(mapHeight, visibleHeight * scaleY);
        ctx.fillStyle = 'rgba(9, 105, 218, 0.08)';
        ctx.fillRect(x, frameY, mapWidth, frameHeight);
        ctx.strokeStyle = '#59636e';
        ctx.strokeRect(x, frameY, mapWidth, frameHeight);
        ctx.restore();
    }

    function statusBadge(text, accent = '#59636e') {
        ctx.save();
        ctx.font = `500 12px ${FONT}`;
        const label = shorten(ctx, text, width - 72);
        const badgeWidth = ctx.measureText(label).width + 26;
        const x = (width - badgeWidth) / 2;
        roundedRect(ctx, x, 14, badgeWidth, 30, 5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
        ctx.fill();
        ctx.strokeStyle = '#d1d9e0';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = accent;
        ctx.fillText(label, width / 2, 29);
        ctx.restore();
    }

    function drawRace(state) {
        const race = state.race;
        if (!race?.worldWidth) return;
        const view = raceView(race);
        drawTrack(race, view);
        const lead = race.ranking?.find(entry => !entry.finished) || race.ranking?.[0];
        const leaderId = lead?.id;
        (race.racers || []).forEach((racer, index) => {
            const body = racer.body;
            const leader = race.phase === 'running' && body.plugin.userData?.id === leaderId;
            drawAvatar(body, index, view.x(body.position.x), view.y(body.position.y),
                Math.max(view.overview ? 2 : 1, body.circleRadius * view.scale), {
                    race: true,
                    leader,
                    finished: racer.finished,
                    labels: !view.overview,
                });
        });
        drawMinimap(race, view, leaderId);
        if (state.paused) statusBadge('已暂停', '#9a6700');
        else if (race.phase === 'countdown') statusBadge(`准备出发 · ${Math.max(1, Math.ceil(race.countdown))}`, '#1a7f37');
        else if (race.phase === 'finished') {
            const winner = race.results?.[0];
            statusBadge(winner ? `比赛结束 · 冠军 ${winner.name}` : '比赛结束', '#1a7f37');
        }
    }

    function drawMerge(state) {
        const game = state.merge;
        if (!game) return;
        const view = mergeView(width, height);
        const danger = game.dangerElapsed > 0;
        ctx.save();
        ctx.translate(view.offsetX, view.offsetY);
        ctx.scale(view.scale, view.scale);
        roundedRect(ctx, 0, 0, 420, 620, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#e6ebf0';
        ctx.lineWidth = 1;
        ctx.stroke();
        roundedRect(ctx, game.wallLeft, game.dangerLine, game.wallRight - game.wallLeft, game.floorY - game.dangerLine, 8);
        ctx.fillStyle = danger ? '#fff5f3' : '#f8fbf9';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(game.wallLeft, game.dangerLine);
        ctx.lineTo(game.wallLeft, game.floorY - 8);
        ctx.quadraticCurveTo(game.wallLeft, game.floorY, game.wallLeft + 8, game.floorY);
        ctx.lineTo(game.wallRight - 8, game.floorY);
        ctx.quadraticCurveTo(game.wallRight, game.floorY, game.wallRight, game.floorY - 8);
        ctx.lineTo(game.wallRight, game.dangerLine);
        ctx.strokeStyle = '#82b994';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.moveTo(game.wallLeft + 2, game.dangerLine);
        ctx.lineTo(game.wallRight - 2, game.dangerLine);
        ctx.strokeStyle = danger ? '#cf222e' : '#d4a72c';
        ctx.lineWidth = danger ? 2 : 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = danger ? '#cf222e' : '#9a6700';
        ctx.font = `500 11px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(danger ? `即将满出 · ${Math.max(0, game.dangerDuration - game.dangerElapsed).toFixed(1)} s` : '警戒线', game.wallRight - 7, game.dangerLine + 18);
        if (game.phase === 'playing' && game.levels.length) {
            const radius = game.levels[game.currentLevel].radius;
            let targetY = game.floorY;
            for (const body of game.bodies) {
                const dx = Math.abs(body.position.x - game.aimX);
                const combinedRadius = body.circleRadius + radius;
                if (dx < combinedRadius) targetY = Math.min(targetY, body.position.y - Math.sqrt(combinedRadius ** 2 - dx ** 2));
            }
            ctx.beginPath();
            ctx.moveTo(game.aimX, game.spawnY + radius + 7);
            ctx.lineTo(game.aimX, Math.max(game.spawnY + radius + 7, targetY));
            ctx.setLineDash([3, 6]);
            ctx.strokeStyle = '#82b994';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
            if (!game.bodies.length) {
                ctx.textAlign = 'center';
                ctx.fillStyle = '#1f883d';
                ctx.font = `600 18px ${FONT}`;
                ctx.fillText('从一个小头像开始', 210, 290);
                ctx.fillStyle = '#59636e';
                ctx.font = `12px ${FONT}`;
                ctx.fillText('移动瞄准，点击或松手投下', 210, 318);
                ctx.fillText('两个相同头像相碰，就会变大', 210, 340);
            }
        }
        ctx.restore();

        const drawMergeAvatar = (body, level, preview = false) => {
            const x = view.x(body.position.x);
            const y = view.y(body.position.y);
            const radius = body.circleRadius * view.scale;
            ctx.save();
            if (preview && game.cooldown > 0) ctx.globalAlpha = 0.45;
            drawAvatar(body, level, x, y, radius, { labels: false });
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = level === game.levels.length - 1 ? '#1f883d' : '#8cbca0';
            ctx.lineWidth = Math.max(1, (level === game.levels.length - 1 ? 3 : 1.5) * view.scale);
            ctx.stroke();
            if (radius >= 12) {
                const badgeRadius = Math.min(10, radius * 0.4);
                ctx.beginPath();
                ctx.arc(x, y + radius - badgeRadius * 0.6, badgeRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.font = `600 ${Math.max(8, badgeRadius)}px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#116329';
                ctx.fillText(String(level + 1), x, y + radius - badgeRadius * 0.6);
            }
            ctx.restore();
        };
        for (const body of game.bodies) drawMergeAvatar(body, body.plugin.mergeLevel);
        if (game.phase === 'playing' && game.levels.length) {
            const level = game.levels[game.currentLevel];
            drawMergeAvatar({ position: { x: game.aimX, y: game.spawnY }, circleRadius: level.radius, angle: 0, plugin: { userData: level.member, image: level.image } }, game.currentLevel, true);
        }
        for (const effect of game.effects) {
            const progress = Math.min(1, effect.age / 0.6);
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.beginPath();
            ctx.arc(view.x(effect.x), view.y(effect.y), effect.radius * view.scale * (1 + progress * 0.45), 0, Math.PI * 2);
            ctx.strokeStyle = '#4aa568';
            ctx.lineWidth = 3 * (1 - progress) * view.scale;
            ctx.stroke();
            ctx.font = `600 ${16 * view.scale}px ${FONT}`;
            ctx.fillStyle = '#116329';
            ctx.textAlign = 'center';
            ctx.fillText(`+${effect.points}`, view.x(effect.x), view.y(effect.y - effect.radius - progress * 30));
            ctx.restore();
        }
        if (game.phase === 'over' || state.paused) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.84)';
            roundedRect(ctx, view.x(40), view.y(245), 340 * view.scale, 100 * view.scale, 10);
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1f2328';
            ctx.font = `600 ${22 * view.scale}px ${FONT}`;
            ctx.fillText(state.paused ? '已暂停' : '本局结束', view.x(210), view.y(285));
            ctx.font = `${13 * view.scale}px ${FONT}`;
            ctx.fillStyle = '#59636e';
            ctx.fillText(state.paused ? '点击播放按钮继续合成' : `获得 ${game.score} 分 · 再开一局，换一组新朋友`, view.x(210), view.y(317));
            ctx.restore();
        }
    }

    function draw() {
        if (destroyed) return;
        if (pixelRatio !== Math.min(window.devicePixelRatio || 1, 2)) resize(width, height);
        const state = getState();
        background();
        if (state.mode === 'race') drawRace(state);
        else if (state.mode === 'merge') drawMerge(state);
        else {
            drawGrid();
            const bodies = Matter.Composite.allBodies(engine.world).filter(body => body.circleRadius && body.plugin.userData);
            bodies.forEach((body, index) => drawAvatar(body, index, body.position.x, body.position.y, body.circleRadius));
            if (state.paused) statusBadge('已暂停', '#9a6700');
        }
        frame = window.requestAnimationFrame(draw);
    }

    const bounds = canvas.getBoundingClientRect();
    resize(bounds.width, bounds.height);
    frame = window.requestAnimationFrame(draw);
    return {
        resize,
        destroy() {
            destroyed = true;
            window.cancelAnimationFrame(frame);
        },
    };
}

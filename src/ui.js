import Matter from 'matter-js';
import { EDGE_GAP } from './physics.js';

export function assetUrl(path) {
    if (typeof path !== 'string' || !path.trim()) return '';
    const value = path.trim();
    if (/^(?:https?:\/\/|\/)/i.test(value)) return value;
    if (/^data:image\/(?:png|jpeg|gif|webp);/i.test(value)) return value;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
    return `${import.meta.env.BASE_URL}${value.replace(/^\.\//, '')}`;
}

export function setupInteractions(engine, canvas, { getSize, isInteractive, onSelect }) {
    let active = null;
    let hovered = null;
    const listeners = [];
    const previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    function listen(target, name, callback) {
        target.addEventListener(name, callback);
        listeners.push(() => target.removeEventListener(name, callback));
    }

    function position(event) {
        const rect = canvas.getBoundingClientRect();
        const { width, height } = getSize();
        return {
            x: (event.clientX - rect.left) * width / Math.max(1, rect.width),
            y: (event.clientY - rect.top) * height / Math.max(1, rect.height),
        };
    }

    function hit(point) {
        const bodies = Matter.Composite.allBodies(engine.world)
            .filter(body => !body.isStatic && body.plugin.userData);
        return Matter.Query.point(bodies, point).at(-1) || null;
    }

    function setHover(body) {
        if (hovered === body) return;
        if (hovered) hovered.plugin.hovered = false;
        hovered = body;
        if (hovered) hovered.plugin.hovered = true;
        canvas.style.cursor = active ? 'grabbing' : hovered ? 'grab' : 'default';
    }

    function cancel() {
        const previous = active;
        active = null;
        if (previous) {
            Matter.Composite.remove(engine.world, previous.constraint);
            if (canvas.hasPointerCapture(previous.pointerId)) {
                canvas.releasePointerCapture(previous.pointerId);
            }
        }
        setHover(null);
        canvas.style.cursor = 'default';
    }

    function trackMovement(event) {
        const dx = event.clientX - active.startX;
        const dy = event.clientY - active.startY;
        active.maxDistanceSquared = Math.max(active.maxDistanceSquared, dx * dx + dy * dy);
    }

    listen(canvas, 'pointerdown', event => {
        if (active || !event.isPrimary || event.button !== 0 || !isInteractive()) return;
        const point = position(event);
        const body = hit(point);
        if (!body) return;
        event.preventDefault();
        const constraint = Matter.Constraint.create({
            pointA: { ...point },
            bodyB: body,
            pointB: { x: point.x - body.position.x, y: point.y - body.position.y },
            length: 0,
            stiffness: 0.18,
            damping: 0.12,
            render: { visible: false },
        });
        active = {
            pointerId: event.pointerId,
            body,
            constraint,
            startX: event.clientX,
            startY: event.clientY,
            maxDistanceSquared: 0,
        };
        Matter.Composite.add(engine.world, constraint);
        canvas.setPointerCapture(event.pointerId);
        setHover(body);
        canvas.style.cursor = 'grabbing';
    });

    listen(canvas, 'pointermove', event => {
        if (!isInteractive()) {
            cancel();
            return;
        }
        const point = position(event);
        if (!active) {
            if (event.pointerType !== 'touch') setHover(hit(point));
            return;
        }
        if (event.pointerId !== active.pointerId) return;
        event.preventDefault();
        trackMovement(event);
        const { width, height } = getSize();
        const radius = active.body.circleRadius + EDGE_GAP;
        const clamp = (value, size) => size < radius * 2 ? size / 2 : Math.min(size - radius, Math.max(radius, value));
        // Matter rotates pointB with the body. Keep the grabbed point attached
        // while clamping the resulting center inside the arena.
        const anchor = active.constraint.pointB;
        active.constraint.pointA.x = clamp(point.x - anchor.x, width) + anchor.x;
        active.constraint.pointA.y = clamp(point.y - anchor.y, height) + anchor.y;
    });

    listen(canvas, 'pointerup', event => {
        if (!active || event.pointerId !== active.pointerId) return;
        trackMovement(event);
        const selected = active.body;
        const point = position(event);
        const { width, height } = getSize();
        const isClick = active.maxDistanceSquared < 36 && isInteractive()
            && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
        cancel();
        if (isClick) onSelect(selected.plugin.userData);
    });
    listen(canvas, 'pointercancel', event => {
        if (active?.pointerId === event.pointerId) cancel();
    });
    listen(canvas, 'lostpointercapture', event => {
        if (active?.pointerId === event.pointerId) cancel();
    });
    listen(canvas, 'pointerleave', () => { if (!active) setHover(null); });
    listen(window, 'blur', cancel);

    return {
        cancel,
        destroy() {
            cancel();
            listeners.forEach(remove => remove());
            canvas.style.touchAction = previousTouchAction;
        },
    };
}

function safeHttpUrl(value) {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
        return null;
    }
}

export function createMemberModal() {
    const dialog = document.getElementById('member-dialog');
    const avatar = document.getElementById('m-avatar');
    const initial = document.getElementById('m-initial');
    const close = document.getElementById('m-close');
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right
            || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });

    function showFallback() {
        avatar.hidden = true;
        initial.hidden = false;
    }
    avatar.addEventListener('error', showFallback);
    avatar.addEventListener('load', () => {
        avatar.hidden = false;
        initial.hidden = true;
    });

    function addLink(container, label, href) {
        if (!href) return;
        const link = document.createElement('a');
        link.textContent = `${label} ↗`;
        link.href = href;
        link.rel = 'noopener noreferrer';
        container.append(link);
    }

    return {
        open(member) {
            const name = String(member.name || member.id || 'Source member');
            document.getElementById('m-name').textContent = name;
            document.getElementById('m-bio').textContent = member.bio || '这个人很神秘，暂时还没有留下自我介绍。';
            initial.textContent = Array.from(name)[0].toUpperCase();
            avatar.alt = `${name} 的头像`;
            showFallback();
            const source = assetUrl(member.avatarUrl);
            if (source) avatar.src = source;
            else avatar.removeAttribute('src');

            const tags = document.getElementById('m-tags');
            tags.replaceChildren();
            for (const value of Array.isArray(member.tags) ? member.tags : []) {
                const tag = document.createElement('span');
                tag.className = 'tag';
                tag.textContent = String(value);
                tags.append(tag);
            }
            const social = document.getElementById('m-social');
            social.replaceChildren();
            const github = member.social?.github;
            const githubUrl = typeof github === 'string' && /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(github.trim())
                ? `https://github.com/${github.trim()}` : safeHttpUrl(github);
            addLink(social, 'GitHub', githubUrl);
            addLink(social, '个人主页', safeHttpUrl(member.social?.blog));
            if (!dialog.open) dialog.showModal();
        },
    };
}

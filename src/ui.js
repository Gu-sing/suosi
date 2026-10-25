import Matter from 'matter-js';

export function setupInteractions(engine, canvas) {
    const Mouse = Matter.Mouse;
    const MouseConstraint = Matter.MouseConstraint;

    // 1. 设置鼠标控制 (让球可以被拖拽)
    const mouse = Mouse.create(canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: { stiffness: 0.1, render: { visible: false } }
    });
    Matter.Composite.add(engine.world, mouseConstraint);

    // 2. 监听点击 (改为 mouseup 以避免拖拽粘连问题，并区分点击和拖拽)
    let startPoint = { x: 0, y: 0 };

    Matter.Events.on(mouseConstraint, 'mousedown', (event) => {
        startPoint = { x: event.mouse.position.x, y: event.mouse.position.y };
    });

    Matter.Events.on(mouseConstraint, 'mouseup', (event) => {
        const endPoint = event.mouse.position;
        // 计算移动距离
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 如果移动距离很小，视为点击
        if (distance < 5) {
            const bodies = Matter.Composite.allBodies(engine.world);
            const clickedBody = Matter.Query.point(bodies, endPoint)[0];

            if (clickedBody && clickedBody.plugin.userData) {
                openModal(clickedBody.plugin.userData);
            }
        }
    });
    
    // 解决滚轮和触摸的默认行为冲突
    mouseConstraint.mouse.element.removeEventListener("mousewheel", mouseConstraint.mouse.mousewheel);
    mouseConstraint.mouse.element.removeEventListener("DOMMouseScroll", mouseConstraint.mouse.mousewheel);
}

function openModal(data) {
    const modal = document.getElementById('modal');
    document.getElementById('m-name').innerText = data.name || 'Unknown';
    document.getElementById('m-bio').innerText = data.bio || '...';
    document.getElementById('m-avatar').src = data.avatarUrl;
    
    // 简单的标签渲染
    const tagsHtml = (data.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    document.getElementById('m-tags').innerHTML = tagsHtml;

    modal.classList.remove('hidden');

    document.getElementById('m-close').onclick = () => {
        modal.classList.add('hidden');
    };
}
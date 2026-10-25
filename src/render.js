import Matter from 'matter-js';

export function createCustomRenderer(engine, canvas) {
    const ctx = canvas.getContext('2d');
    const logo = new Image();
    logo.src = `${import.meta.env.BASE_URL}images/Source.jpg`;
    logo.onerror = () => console.error(`Failed to load page logo: ${logo.src}`);
    
    // 自适应窗口大小
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // 渲染循环
    (function loop() {
        window.requestAnimationFrame(loop);

        const width = canvas.width;
        const height = canvas.height;
        const logoHeight = Math.min(220, height * 0.3);

        // 1. 清空背景 (极客黑)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        if (logo.complete && logo.naturalWidth > 0) {
            const logoWidth = logoHeight * logo.naturalWidth / logo.naturalHeight;
            ctx.drawImage(
                logo,
                (width - logoWidth) / 2,
                (height - logoHeight) / 2 - 100,
                logoWidth,
                logoHeight
            );
        }

        // 绘制背景文字
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#04060d'; 
        
        ctx.font = 'bold 50px sans-serif';
        ctx.fillText('Welcome to Source of USTB', width / 2, height / 2 + logoHeight / 2);
        
        ctx.font = '27px sans-serif';
        ctx.fillText('2026 fall registration', width / 2, height / 2 + logoHeight / 2 + 50);
        ctx.restore();

        // 2. 获取所有物体
        const bodies = Matter.Composite.allBodies(engine.world);

        ctx.beginPath();
        
        for (let body of bodies) {
            if (body.isStatic) continue; // 墙壁不画

            const { x, y } = body.position;
            const radius = body.circleRadius; 

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(body.angle);

            // 画圆并剪裁
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            ctx.closePath();
            
            ctx.save();
            ctx.clip(); // <--- 关键：把图片切成圆的

            // 绘制图片
            if (body.plugin.image) {
                // 图片铺满圆
                ctx.drawImage(body.plugin.image, -radius, -radius, radius * 2, radius * 2);
            } else {
                // 没图片的默认色
                ctx.fillStyle = '#4CAF50';
                ctx.fill();
            }
            ctx.restore(); // 恢复剪裁前

            // 绘制边框
            ctx.strokeStyle = '#ff5500';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore(); // 恢复位移/旋转前
        }
    })();
}
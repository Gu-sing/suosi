import Matter from 'matter-js';
import { createCustomRenderer } from './render.js';
import { setupInteractions } from './ui.js';

export async function initSimulation(canvas) {
    // 1. 基础设置
    const Engine = Matter.Engine,
          Runner = Matter.Runner,
          Composite = Matter.Composite,
          Bodies = Matter.Bodies;

    const engine = Engine.create();
    engine.gravity.y = 0; // 无重力，太空漂浮感

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 2. 创建边界墙 (不可见，但存在)
    const wallOpts = { isStatic: true, render: { visible: false } };
    const thick = 100;
    const walls = [
        Bodies.rectangle(width/2, -thick, width*2, thick*2, wallOpts), // Top
        Bodies.rectangle(width/2, height+thick, width*2, thick*2, wallOpts), // Bottom
        Bodies.rectangle(width+thick, height/2, thick*2, height*2, wallOpts), // Right
        Bodies.rectangle(-thick, height/2, thick*2, height*2, wallOpts), // Left
    ];
    Composite.add(engine.world, walls);

    // 3. 加载数据并生成球体
    const baseUrl = import.meta.env.BASE_URL;
    const dataUrl = baseUrl.endsWith('/') ? `${baseUrl}members.json` : `${baseUrl}/members.json`;
    
    const res = await fetch(dataUrl);
    const members = await res.json();
    
    const balls = members.map((m) => {
        const radius = 35; // 头像半径
        const x = Math.random() * (width - 100) + 50;
        const y = Math.random() * (height - 100) + 50;

        const ball = Bodies.circle(x, y, radius, {
            restitution: 0.9, // 弹性
            frictionAir: 0.01,
            plugin: {
                // 将数据绑定到物理体上，供渲染和交互使用
                userData: m,
                image: null // 初始为空，加载完成后更新
            }
        });

        // 异步加载图片，不阻塞物理世界生成
        if (m.avatarUrl) {
            const img = new Image();
            if (!m.avatarUrl.startsWith('/') && !m.avatarUrl.startsWith('http')) {
                 img.src = baseUrl + m.avatarUrl;
            } else {
                 img.src = m.avatarUrl;
            }
            img.onload = () => {
                ball.plugin.image = img;
            };
        }
        
        // 初始推力
        Matter.Body.setVelocity(ball, {
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10
        });

        return ball;
    });

    Composite.add(engine.world, balls);

    // 4. 启动自定义渲染循环
    createCustomRenderer(engine, canvas);

    // 5. 启动物理模拟 Runner
    const runner = Runner.create();
    Runner.run(runner, engine);

    // 6. 绑定交互 (点击事件)
    setupInteractions(engine, canvas);
}
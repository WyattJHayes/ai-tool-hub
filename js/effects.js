/**
 * Dynamic Background Effects — particle system + mouse-follow glow
 */

const PARTICLE_COUNT = 50;
const COLORS = ['#6366f1', '#8b5cf6'];

function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'particleCanvas';
    document.body.insertBefore(canvas, document.body.firstChild);

    if (typeof window.CanvasRenderingContext2D === 'undefined') {
        canvas.remove();
        return () => {};
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        canvas.remove();
        return () => {};
    }
    let particles = [];
    let animId;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: 1 + Math.random() * 2,
            vx: (0.1 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1),
            vy: (0.1 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            opacity: 0.3 + Math.random() * 0.3,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.opacity;
            ctx.fill();

            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
        }
        ctx.globalAlpha = 1;
        animId = requestAnimationFrame(draw);
    }
    draw();

    return () => cancelAnimationFrame(animId);
}

function initCursorGlow() {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);

    document.addEventListener('mousemove', (e) => {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
        glow.classList.add('active');
    });

    document.addEventListener('mouseleave', () => {
        glow.classList.remove('active');
    });
}

export function initEffects() {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    initParticles();
    initCursorGlow();
}

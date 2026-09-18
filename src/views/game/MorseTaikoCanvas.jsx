import React, { useRef, useEffect, useState } from 'react';

/**
 * 莫尔斯太鼓达人单轨 Canvas 渲染引擎
 * - 解决椭圆畸变：画布物理分辨率严格自适应容器实际尺寸 (1:1 正比例正圆)
 * - 速度完全由 WPM 唯一决定 (不再有任何独立流速概念)
 */
export default function MorseTaikoCanvas({
  gameState, // { chart, currentTime, notes }
  inputActiveState, // { straightDown }
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 260 });

  const particlesRef = useRef([]);
  const hitFloatingTextsRef = useRef([]);

  // 判定圈固定 X 轴位置 (距离左侧 150px)
  const targetX = 150;

  // 1:1 物理像素监听 (彻底杜绝 CSS 拉伸导致的椭圆变形)
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height)
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 击中粒子与文字效果
  useEffect(() => {
    if (!gameState?.lastHitEvent) return;
    const { grade, offset } = gameState.lastHitEvent;

    const particleCount = grade === 'PERFECT' ? 24 : (grade === 'GREAT' ? 14 : 6);
    const color = grade === 'PERFECT' ? '#fbbf24' : (grade === 'GREAT' ? '#38bdf8' : '#94a3b8');

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 2;
      particlesRef.current.push({
        x: targetX,
        y: dimensions.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 0.035 + 0.02,
        size: Math.random() * 4 + 2,
        color
      });
    }

    hitFloatingTextsRef.current.push({
      text: grade,
      subText: `${offset > 0 ? '+' : ''}${offset}ms`,
      x: targetX,
      y: dimensions.height / 2 - 55,
      life: 1.0,
      color
    });
  }, [gameState?.lastHitEvent, dimensions.height]);

  // 动画主循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      const { chart, currentTime, notes = [] } = gameState || {};
      const { width, height } = dimensions;
      const laneY = height / 2;
      const isInputActive = inputActiveState?.straightDown;

      // 从当前时钟获取物理移动速率 (px/ms)
      const pixelsPerMs = chart?.pixelsPerMs || 0.2;

      // 1. 绘制背景与雷达轨道
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, width, height);

      // 轨道底槽 (高度固定 110px)
      const laneHeight = 110;
      const laneTop = laneY - laneHeight / 2;
      
      const grad = ctx.createLinearGradient(0, laneTop, 0, laneTop + laneHeight);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
      grad.addColorStop(0.5, 'rgba(30, 41, 59, 0.6)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, laneTop, width, laneHeight);

      // 轨道上下边线
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, laneTop);
      ctx.lineTo(width, laneTop);
      ctx.moveTo(0, laneTop + laneHeight);
      ctx.lineTo(width, laneTop + laneHeight);
      ctx.stroke();

      // 中心辅助准线
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(0, laneY);
      ctx.lineTo(width, laneY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. 绘制左侧判定圈 (绝对正圆，半径 38px)
      ctx.save();
      
      // 垂直瞄准基准线
      ctx.strokeStyle = isInputActive ? 'rgba(245, 158, 11, 0.4)' : 'rgba(71, 85, 105, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(targetX, laneTop);
      ctx.lineTo(targetX, laneTop + laneHeight);
      ctx.stroke();

      // 外光环 (正圆)
      ctx.beginPath();
      ctx.arc(targetX, laneY, 40, 0, Math.PI * 2);
      ctx.strokeStyle = isInputActive ? '#fbbf24' : '#64748b';
      ctx.lineWidth = isInputActive ? 4 : 2;
      if (isInputActive) {
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 16;
      }
      ctx.stroke();

      // 内芯圆 (正圆)
      ctx.beginPath();
      ctx.arc(targetX, laneY, isInputActive ? 30 : 32, 0, Math.PI * 2);
      ctx.fillStyle = isInputActive ? 'rgba(251, 191, 36, 0.25)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = isInputActive ? '#fef3c7' : '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 中心十字准星
      ctx.strokeStyle = isInputActive ? '#f59e0b' : '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(targetX - 7, laneY);
      ctx.lineTo(targetX + 7, laneY);
      ctx.moveTo(targetX, laneY - 7);
      ctx.lineTo(targetX, laneY + 7);
      ctx.stroke();

      ctx.restore();

      // 3. 绘制滚动的音符 (严格 PARIS 几何比例)
      if (currentTime && notes.length > 0) {
        notes.forEach(note => {
          const noteX = targetX + (note.hitTime - currentTime) * pixelsPerMs;
          const noteLength = Math.max(36, note.duration * pixelsPerMs);

          if (noteX > width + 100 || noteX + noteLength < -60) return;

          const isDah = note.type === 'DAH';

          ctx.save();
          if (note.isHit) {
            ctx.globalAlpha = 0.18;
          }

          if (isDah) {
            // 【长划音符 - 赛博青蓝圆角光条】
            const barWidth = noteLength;
            const barHeight = 46;
            const barX = noteX;
            const barY = laneY - barHeight / 2;

            const isHolding = note.isHolding;
            ctx.shadowColor = isHolding ? '#fbbf24' : '#0284c7';
            ctx.shadowBlur = isHolding ? 18 : 8;

            const dahGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
            if (isHolding) {
              dahGrad.addColorStop(0, '#fef08a');
              dahGrad.addColorStop(0.5, '#f59e0b');
              dahGrad.addColorStop(1, '#b45309');
            } else {
              dahGrad.addColorStop(0, '#38bdf8');
              dahGrad.addColorStop(1, '#0284c7');
            }
            ctx.fillStyle = dahGrad;

            ctx.beginPath();
            ctx.roundRect(barX, barY, barWidth, barHeight, 23);
            ctx.fill();

            // 亮白/金黄边框
            ctx.shadowBlur = 0;
            ctx.lineWidth = isHolding ? 3 : 2;
            ctx.strokeStyle = isHolding ? '#fffbeb' : '#e0f2fe';
            ctx.stroke();

            // 划符号
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 22px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('—', barX + barWidth / 2, laneY + 1);
          } else {
            // 【点音符 - 饱满正圆球，绝对正圆】
            const radius = 23;

            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 8;

            const ditGrad = ctx.createRadialGradient(
              noteX - 4, laneY - 4, 2,
              noteX, laneY, radius
            );
            ditGrad.addColorStop(0, '#fecdd3');
            ditGrad.addColorStop(0.3, '#f43f5e');
            ditGrad.addColorStop(1, '#be123c');
            ctx.fillStyle = ditGrad;

            ctx.beginPath();
            ctx.arc(noteX, laneY, radius, 0, Math.PI * 2);
            ctx.fill();

            // 亮白边框
            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffe4e6';
            ctx.stroke();

            // 点符号
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 26px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('•', noteX, laneY - 1);
          }

          // 字符提示
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#f1f5f9';
          ctx.font = 'bold 15px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(note.char, noteX + (isDah ? noteLength / 2 : 0), laneY - 34);

          ctx.restore();
        });
      }

      // 4. 粒子系统
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. 打击文字
      for (let i = hitFloatingTextsRef.current.length - 1; i >= 0; i--) {
        const t = hitFloatingTextsRef.current[i];
        t.y -= 0.8;
        t.life -= 0.024;

        if (t.life <= 0) {
          hitFloatingTextsRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.min(1, t.life * 1.6);
        ctx.textAlign = 'center';
        
        ctx.fillStyle = t.color;
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 10;
        ctx.fillText(t.text, t.x, t.y);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(t.subText, t.x, t.y + 15);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, inputActiveState, dimensions]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[220px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#060a12] relative"
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        className="block"
      />
    </div>
  );
}

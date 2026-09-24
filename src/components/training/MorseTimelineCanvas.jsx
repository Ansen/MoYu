import React, { useRef, useEffect, useState, useCallback } from 'react';
import audioPlayer from '../../utils/audioPlayer';
import { useI18n } from '../../i18n';

/**
 * 60FPS 双轨示波器 Canvas 组件 (MorseTimelineCanvas)
 * 1. 纯色彩区分：目标轨（上轨）与用户跟发轨（下轨）全画幅平铺
 * 2. 完美适配 Light Mode 与 Dark Mode
 * 3. 动态平滑居中滚动：以当前播放进度线 (Playhead) 为视觉锚点
 * 4. 高分屏 (Retina/4K) 矢量清晰度优化 (ResizeObserver 驱动，消除逐帧显存重分配)
 * 5. 二分视口剔除算法 (O(log N + K))，超长篇章零卡顿
 * 6. 自驱 60FPS 声卡物理时钟引擎，解耦 React 父树重渲染
 */
export default function MorseTimelineCanvas({
  targetTimeline,
  userEvents = [],
  currentTime = 0,
  isPlaying = false,
  isPaused = false,
  isFinished = false,
  mode = 'live', // 'live' | 'blind' | 'silent'
  height = 46
}) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasDimensionsRef = useRef({ width: 0, height: 0, dpr: 1 });

  // 监听主题变化
  const [isDark, setIsDark] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark');
      setIsDark(dark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // 检查当前是否有未抬起的按键（按下状态）
  const lastEvent = userEvents.length > 0 ? userEvents[userEvents.length - 1] : null;
  const isPressing = lastEvent && (lastEvent.state || '').toUpperCase() === 'DOWN';

  // 监听容器尺寸调整 Canvas 物理像素（仅在实际缩放/窗口拉伸时执行，杜绝 60FPS 显存重建）
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width);
      const h = height;
      if (w <= 0) return;

      if (
        canvasDimensionsRef.current.width !== w ||
        canvasDimensionsRef.current.height !== h ||
        canvasDimensionsRef.current.dpr !== dpr
      ) {
        canvasDimensionsRef.current = { width: w, height: h, dpr };
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [height]);

  // 核心绘制函数：接受显式当前时间戳 (renderTimeMs)
  const drawAtTime = useCallback((timeToRender) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height: currentH, dpr } = canvasDimensionsRef.current;
    if (width <= 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 色板配置 (Theme Palette)
    const colors = isDark ? {
      bg: '#121212',
      grid: '#222222',
      divider: '#2a2a2a',
      playhead: '#38bdf8',
      playheadGlow: 'rgba(56, 189, 248, 0.35)',
      targetPulse: '#06b6d4',
      userPulseGood: '#10b981',
      userPulseActive: '#34d399',
      placeholder: '#282828'
    } : {
      bg: '#f8fafc',
      grid: '#e2e8f0',
      divider: '#cbd5e1',
      playhead: '#2563eb',
      playheadGlow: 'rgba(37, 99, 235, 0.25)',
      targetPulse: '#4338ca',
      userPulseGood: '#059669',
      userPulseActive: '#10b981',
      placeholder: '#e2e8f0'
    };

    // 1. 高速清屏填充
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, currentH);

    // 2. 绘制上下轨道分界线
    const halfH = currentH / 2;
    ctx.strokeStyle = colors.divider;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, halfH);
    ctx.lineTo(width, halfH);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. 设定时间视窗与物理映射：显示 4000ms (4秒)
    const windowDurationMs = 4000;
    const pxPerMs = width / windowDurationMs;
    const playheadX = width * 0.2; // 播放基准线居于左侧 20%，留出 80% 视野前瞻

    const curTime = Math.max(0, timeToRender);
    const windowStartMs = curTime - (playheadX / pxPerMs);
    const windowEndMs = curTime + ((width - playheadX) / pxPerMs);

    // 4. 批量绘制垂直时间网格 (单次 Path 提交)
    const firstGridTime = Math.floor(windowStartMs / 500) * 500;
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = colors.grid;
    ctx.beginPath();
    for (let t = firstGridTime; t <= windowEndMs; t += 500) {
      if (t < 0) continue;
      const x = playheadX + (t - curTime) * pxPerMs;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, currentH);
    }
    ctx.stroke();

    const pulseH = 3;
    const pulseRadius = 1;

    // 5. 绘制上轨：目标脉冲 (Target Track)
    // 盲发模式下若未结束则隐藏；一旦结束 (isFinished) 或非盲模式，立刻解盲展示！
    const targetPulses = targetTimeline?.pulses || [];
    const isBlindMode = mode === 'blind' && !isFinished;

    if (!isBlindMode) {
      const topTrackY = Math.round(halfH / 2 - pulseH / 2);
      ctx.fillStyle = colors.targetPulse;

      // 二分查找第一个可见脉冲，彻底消除万字长文遍历卡顿
      let startIdx = 0;
      let low = 0;
      let high = targetPulses.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (targetPulses[mid].end >= windowStartMs) {
          startIdx = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }

      for (let i = startIdx; i < targetPulses.length; i++) {
        const p = targetPulses[i];
        if (p.start > windowEndMs) break; // 超出右边界立刻退出循环

        const xStart = playheadX + (p.start - curTime) * pxPerMs;
        const pWidth = Math.max(3, p.duration * pxPerMs);

        if (xStart + pWidth >= 0 && xStart <= width) {
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(xStart, topTrackY, pWidth, pulseH, pulseRadius);
          } else {
            ctx.rect(xStart, topTrackY, pWidth, pulseH);
          }
          ctx.fill();
        }
      }
    } else {
      // 盲发进行中占位
      ctx.fillStyle = colors.placeholder;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      const blindText = isPlaying
        ? t('training.scope.blindActive', '🙈 盲跟发模式进行中（目标波形已隐藏，结束即可查看复盘）')
        : t('training.scope.blindReady', '🙈 盲跟发模式已就绪（目标波形已隐藏，凭听觉同步跟发）');
      ctx.fillText(blindText, width / 2, halfH / 2 + 4);
    }

    // 6. 绘制下轨：用户打键脉冲 (User Transmit Track)
    const bottomTrackY = Math.round(halfH + halfH / 2 - pulseH / 2);

    let curDown = null;
    let curDownTimestamp = 0;
    const userPulses = [];

    for (let i = 0; i < userEvents.length; i++) {
      const ev = userEvents[i];
      const t = Number(ev.time !== undefined ? ev.time : (ev.timestamp || 0));
      const state = (ev.state || '').toUpperCase();
      if (state === 'DOWN') {
        curDown = t;
        curDownTimestamp = Number(ev.timestamp || 0);
      } else if (state === 'UP' && curDown !== null) {
        const pulseDur = (ev.duration !== undefined && ev.duration > 0)
          ? Number(ev.duration)
          : Math.max(10, t - curDown);
        userPulses.push({
          start: curDown,
          end: curDown + pulseDur,
          duration: pulseDur
        });
        curDown = null;
        curDownTimestamp = 0;
      }
    }

    // 当前未抬起的实时生长按键
    if (curDown !== null) {
      const now = performance.now();
      const realDur = curDownTimestamp > 0 
        ? Math.max(8, Math.round(now - curDownTimestamp))
        : Math.max(8, curTime - curDown);
      userPulses.push({
        start: curDown,
        end: curDown + realDur,
        duration: realDur,
        isActive: true
      });
    }

    for (let i = 0; i < userPulses.length; i++) {
      const p = userPulses[i];
      if (p.end < windowStartMs) continue;
      if (p.start > windowEndMs) break;

      const xStart = playheadX + (p.start - curTime) * pxPerMs;
      const pWidth = Math.max(3, p.duration * pxPerMs);

      if (xStart + pWidth >= 0 && xStart <= width) {
        ctx.fillStyle = p.isActive ? colors.userPulseActive : colors.userPulseGood;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(xStart, bottomTrackY, pWidth, pulseH, pulseRadius);
        } else {
          ctx.rect(xStart, bottomTrackY, pWidth, pulseH);
        }
        ctx.fill();
      }
    }

    // 7. 绘制垂直播放时间线 (Playhead)
    ctx.shadowColor = colors.playheadGlow;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = colors.playhead;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, currentH);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 顶部小指示三角
    ctx.fillStyle = colors.playhead;
    ctx.beginPath();
    ctx.moveTo(playheadX - 4, 0);
    ctx.lineTo(playheadX + 4, 0);
    ctx.lineTo(playheadX, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, [targetTimeline, userEvents, isPlaying, isFinished, mode, isDark, t]);

  // 自驱 60FPS 动画引擎：在播放中或按压中直接由 Canvas RAF 循环驱动，彻底解耦 React 父树重渲染！
  useEffect(() => {
    let animId;
    if (isPlaying && !isPaused) {
      const loop = () => {
        const prog = audioPlayer.getPlaybackProgress();
        const t = prog.timeMs || 0;
        drawAtTime(t);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    } else if (isPressing) {
      const loop = () => {
        drawAtTime(currentTime);
        animId = requestAnimationFrame(loop);
      };
      animId = requestAnimationFrame(loop);
    } else {
      drawAtTime(currentTime);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, isPaused, isPressing, currentTime, drawAtTime]);

  return (
    <div ref={containerRef} className="w-full relative overflow-hidden rounded-xl border border-slate-200 dark:border-[#2b2b2b] shadow-inner bg-slate-50 dark:bg-[#121212]">
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: `${height}px`, display: 'block' }} 
      />
    </div>
  );
}

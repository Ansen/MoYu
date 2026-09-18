import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * 专业级横向双通道点划示波器 (Dual-Channel Morse Oscilloscope)
 * 核心特性：
 * 1. 纯正逻辑分析仪/示波器电平波形 (CH1 标准连续波脉冲 vs CH2 用户真实按压脉冲)；
 * 2. 具备生理听发反应时间延迟补偿 (Sync Offset Calibration)，使下轨与上轨严格垂直对齐；
 * 3. 示波器暗绿磷光分划网格 (Graticule Grid) 与微电波质感；
 * 4. 自由练报支持：即使未播放报底，单独敲键也能平滑走纸并检测点划比；
 * 5. 脉冲内部精准标明实测毫秒与 T 倍数，颜色根据吻合度自动分级 (绿/黄/红)。
 */
export default function MorseWaterfallCanvas({
  standardNotes = [],
  userNotes = [],
  currentPositionMs = 0,
  currentPressingNote = null,
  unitT = 100,
  isPlaying = false,
  isPaused = false,
  syncOffsetMs = 180, // 跟发听觉反应延迟补偿 (默认 180ms，使下轨波形与上轨精准垂直对齐)
  onSeekPosition = null
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [pixelsPerMs, setPixelsPerMs] = useState(0.24); // 走纸速度比例
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartPosMsRef = useRef(0);

  // 滚轮缩放时间刻度
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setPixelsPerMs(prev => {
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      return Math.max(0.1, Math.min(0.65, prev * factor));
    });
  }, []);

  // 鼠标拖拽查看时间轴
  const handleMouseDown = useCallback((e) => {
    if (isPlaying && !isPaused) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartPosMsRef.current = currentPositionMs;
  }, [isPlaying, isPaused, currentPositionMs]);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    const deltaMs = deltaX / pixelsPerMs;
    const nextMs = Math.max(0, dragStartPosMsRef.current - deltaMs);
    if (onSeekPosition) onSeekPosition(nextMs);
  }, [pixelsPerMs, onSeekPosition]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // 自适应 Canvas 物理像素
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      const rect = containerRef.current.getBoundingClientRect();
      if (canvasRef.current && rect.width > 0 && rect.height > 0) {
        canvasRef.current.width = Math.floor(rect.width);
        canvasRef.current.height = Math.floor(rect.height);
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 60fps 示波器渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 准星采样点 X 坐标 (固定在约 32% 处)
    const playheadX = Math.floor(width * 0.32);

    // 1. 示波器荧光管深黑绿底色
    ctx.fillStyle = '#04070a';
    ctx.fillRect(0, 0, width, height);

    // 2. 示波器坐标网格 (Graticule Grid)
    ctx.save();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.lineWidth = 1;
    const GRID_SIZE = 40;
    for (let x = 0; x < width; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // 布局两个通道轨道与基线
    const RULER_H = 22;
    const TRACK_H = (height - RULER_H) / 2;

    const CH1_BASE_Y = RULER_H + TRACK_H * 0.78; // 上轨基准低电平线
    const CH2_BASE_Y = RULER_H + TRACK_H + TRACK_H * 0.78; // 下轨基准低电平线
    const PULSE_HEIGHT = Math.min(48, TRACK_H * 0.52); // 高电平脉冲高度

    // 通道分割线
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, RULER_H + TRACK_H);
    ctx.lineTo(width, RULER_H + TRACK_H);
    ctx.stroke();
    ctx.restore();

    // 绘制低电平基线 (绿色弱光基准线)
    ctx.save();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CH1_BASE_Y);
    ctx.lineTo(width, CH1_BASE_Y);
    ctx.moveTo(0, CH2_BASE_Y);
    ctx.lineTo(width, CH2_BASE_Y);
    ctx.stroke();
    ctx.restore();

    // 3. 顶部时间刻度标尺
    ctx.fillStyle = '#060b10';
    ctx.fillRect(0, 0, width, RULER_H);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER_H);
    ctx.lineTo(width, RULER_H);
    ctx.stroke();

    const visibleStartMs = Math.floor(currentPositionMs - playheadX / pixelsPerMs);
    const visibleEndMs = Math.ceil(currentPositionMs + (width - playheadX) / pixelsPerMs);

    const timeStepMs = unitT >= 100 ? 500 : 250;
    const firstStep = Math.floor(visibleStartMs / timeStepMs) * timeStepMs;

    ctx.font = '10px monospace';
    ctx.fillStyle = '#10b981';

    for (let t = firstStep; t <= visibleEndMs; t += timeStepMs) {
      if (t < 0) continue;
      const x = playheadX + (t - currentPositionMs) * pixelsPerMs;
      const isSecond = t % 1000 === 0;

      ctx.strokeStyle = isSecond ? '#10b981' : 'rgba(16, 185, 129, 0.4)';
      ctx.beginPath();
      ctx.moveTo(x, RULER_H - (isSecond ? 8 : 4));
      ctx.lineTo(x, RULER_H);
      ctx.stroke();

      if (isSecond) {
        ctx.fillText(`${(t / 1000).toFixed(1)}s`, x + 3, RULER_H - 10);
      }
    }

    // 4. 通道标识角标 (专业示波器 HUD)
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.95)';
    ctx.fillText('CH-1: [标准连续波参考脉冲] (STANDARD REFERENCE)', 16, RULER_H + 18);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
    ctx.fillText(`CH-2: [用户发报实时电平] (USER MORSE INPUT) // 延迟补偿: ${syncOffsetMs}ms`, 16, RULER_H + TRACK_H + 18);
    ctx.restore();

    /**
     * 绘制正规的逻辑示波电平方波脉冲 (Digital/RF Pulse)
     */
    const drawPulse = (startX, endX, baseY, highY, strokeColor, fillColor, label = null, subLabel = null) => {
      const w = endX - startX;
      if (w <= 0) return;

      const r = Math.min(3, w * 0.2); // 柔和微小圆角

      ctx.save();
      // 脉冲发光辉光
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(startX, baseY);
      ctx.lineTo(startX, highY + r);
      ctx.quadraticCurveTo(startX, highY, startX + r, highY);
      ctx.lineTo(endX - r, highY);
      ctx.quadraticCurveTo(endX, highY, endX, highY + r);
      ctx.lineTo(endX, baseY);
      ctx.closePath();

      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // 脉冲内部标签
      if (label && w > 12) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, startX + w / 2, (highY + baseY) / 2);
      }

      // 脉冲顶部副标签 (如字符名 '4', '8' 或倍数 '3.0T')
      if (subLabel) {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(subLabel, startX, highY - 5);
      }

      ctx.restore();
    };

    // 5. 渲染【上轨 CH-1：标准报底电平脉冲】
    const CH1_HIGH_Y = CH1_BASE_Y - PULSE_HEIGHT;

    standardNotes.forEach(note => {
      if (note.endMs < visibleStartMs || note.startMs > visibleEndMs) return;

      const x1 = playheadX + (note.startMs - currentPositionMs) * pixelsPerMs;
      const x2 = playheadX + (note.endMs - currentPositionMs) * pixelsPerMs;
      const isNowActive = currentPositionMs >= note.startMs && currentPositionMs <= note.endMs;
      const isDah = note.type === 'DAH';

      const strokeColor = isNowActive
        ? '#38bdf8'
        : (isDah ? '#0ea5e9' : '#0284c7');
      const fillColor = isNowActive
        ? 'rgba(56, 189, 248, 0.55)'
        : (isDah ? 'rgba(14, 165, 233, 0.35)' : 'rgba(2, 132, 199, 0.3)');

      const charLabel = note.symbolIndex === 0 ? note.char : null;
      const pulseLabel = isDah ? '—' : '•';

      drawPulse(x1, x2, CH1_BASE_Y, CH1_HIGH_Y, strokeColor, fillColor, pulseLabel, charLabel);

      // 如果这是该字符的起始音符，在脉冲下方标出字符跨度范围
      if (note.symbolIndex === 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, CH1_BASE_Y + 4);
        ctx.lineTo(x1, CH1_BASE_Y + 9);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 6. 渲染【下轨 CH-2：用户拍发真实电平脉冲】(应用生理听发延迟补偿平移)
    const CH2_HIGH_Y = CH2_BASE_Y - PULSE_HEIGHT;

    userNotes.forEach(userNote => {
      // 核心：应用 syncOffsetMs 补偿，使下轨波形在视觉上平移对齐到上轨对应的标准音符上！
      const compensatedStartMs = userNote.startMs - syncOffsetMs;
      const compensatedEndMs = userNote.endMs - syncOffsetMs;

      if (compensatedEndMs < visibleStartMs || compensatedStartMs > visibleEndMs) return;

      const x1 = playheadX + (compensatedStartMs - currentPositionMs) * pixelsPerMs;
      const x2 = playheadX + (compensatedEndMs - currentPositionMs) * pixelsPerMs;
      const isDah = userNote.userType === 'DAH';

      let strokeColor = '#10b981'; // 绿: 吻合优良
      let fillColor = 'rgba(16, 185, 129, 0.35)';

      if (userNote.status === 'WARN') {
        strokeColor = '#f59e0b'; // 黄: 偏长/偏短
        fillColor = 'rgba(245, 158, 11, 0.35)';
      } else if (userNote.status === 'BAD') {
        strokeColor = '#ef4444'; // 红: 点划判反
        fillColor = 'rgba(239, 68, 68, 0.35)';
      }

      const durRatio = (userNote.duration / unitT).toFixed(1);
      const labelText = `${Math.round(userNote.duration)}ms (${durRatio}T)`;

      drawPulse(x1, x2, CH2_BASE_Y, CH2_HIGH_Y, strokeColor, fillColor, labelText, null);

      // 在上下两轨对应音符之间绘制垂直对齐虚线与时序误差
      if (userNote.matchedStd) {
        const stdMidX = playheadX + (((userNote.matchedStd.startMs + userNote.matchedStd.endMs) / 2) - currentPositionMs) * pixelsPerMs;
        const userMidX = (x1 + x2) / 2;

        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(userMidX, CH2_HIGH_Y);
        ctx.lineTo(stdMidX, CH1_BASE_Y);
        ctx.stroke();
        ctx.setLineDash([]);

        // 标出时序相位差
        const offset = Math.round(userNote.offsetMs - syncOffsetMs);
        if (Math.abs(offset) > 12) {
          ctx.font = '9px monospace';
          ctx.fillStyle = offset > 0 ? '#fbbf24' : '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(`${offset > 0 ? '+' : ''}${offset}ms`, (userMidX + stdMidX) / 2, (CH1_BASE_Y + CH2_HIGH_Y) / 2);
        }
        ctx.restore();
      }
    });

    // 7. 用户实时按住未松手的电平脉冲 (Real-time Keying)
    if (currentPressingNote) {
      const compensatedStartMs = currentPressingNote.startMs - syncOffsetMs;
      const x1 = playheadX + (compensatedStartMs - currentPositionMs) * pixelsPerMs;
      const x2 = playheadX + (0 - syncOffsetMs) * pixelsPerMs; // 当前正在延伸的位置

      const curDur = Math.round(currentPositionMs - currentPressingNote.startMs);
      const isDah = curDur >= 1.9 * unitT;

      drawPulse(
        x1,
        x2,
        CH2_BASE_Y,
        CH2_HIGH_Y,
        '#f59e0b',
        'rgba(245, 158, 11, 0.65)',
        `${curDur}ms`,
        null
      );

      // 电平跳起指示红火花
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x2, CH2_HIGH_Y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. 发光准星时间线 (Playhead Cursor)
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // 顶部采样三角指针
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(playheadX - 5, 0);
    ctx.lineTo(playheadX + 5, 0);
    ctx.lineTo(playheadX, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

  }, [standardNotes, userNotes, currentPositionMs, currentPressingNote, pixelsPerMs, unitT, syncOffsetMs]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden rounded-xl border border-slate-800 shadow-2xl bg-[#04070a]"
      title="滚轮缩放时间密度，暂停时可左右拖拽复盘"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* 缩放指示器 */}
      <div className="absolute bottom-2 right-3 text-[10px] font-mono text-emerald-500/80 bg-[#061017]/80 px-2 py-0.5 rounded border border-emerald-900/40 pointer-events-none flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>OSC TIMEBASE: {Math.round(pixelsPerMs * 1000)} px/s</span>
      </div>
    </div>
  );
}

import React, { useRef, useEffect } from 'react';

/**
 * 高保真短波电台机械指针表头 (Analog S / PWR Meter)
 * 采用物理惯性阻尼算法模拟真实机电表头指针弹跳：
 * - 接收 (RX)：指针随电码起振灵动跳动至 S9+15dB
 * - 发射 (TX)：指针猛烈弹跳至 100W 满偏
 */
export default function AnalogRadioMeter({ isRxActive = false, isTxActive = false }) {
  const canvasRef = useRef(null);
  const needleAngleRef = useRef(-45); // 当前指针角度 (-45° 到 +45°)
  const targetAngleRef = useRef(-45);
  const needleVelocityRef = useRef(0);
  const reqAnimRef = useRef(null);

  // 根据当前状态计算目标角度
  useEffect(() => {
    if (isTxActive) {
      // 发射状态：猛烈打表到 100W (+35° ~ +40°)
      targetAngleRef.current = 36 + Math.random() * 4;
    } else if (isRxActive) {
      // 接收状态：信号表跳到 S9+ (+12° ~ +18°)
      targetAngleRef.current = 15 + Math.random() * 3;
    } else {
      // 底噪静息状态：回落至 S1~S2 (-38° 左右)
      targetAngleRef.current = -38 + Math.random() * 1.5;
    }
  }, [isRxActive, isTxActive]);

  // 物理阻尼指针动画循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    const pivotX = width / 2;
    const pivotY = height + 18; // 指针旋转中心在下方
    const needleLen = height * 0.95;

    const render = () => {
      // 1. 物理弹簧阻尼模型 (Spring-Damper)
      const k = 0.22; // 弹力系数
      const damping = 0.72; // 阻尼系数
      const force = (targetAngleRef.current - needleAngleRef.current) * k;
      needleVelocityRef.current = (needleVelocityRef.current + force) * damping;
      needleAngleRef.current += needleVelocityRef.current;

      // 2. 表头背景 (微弧度复古米黄/琥珀荧光背光)
      ctx.clearRect(0, 0, width, height);

      // 表盘内胆渐变
      const bgGrad = ctx.createRadialGradient(pivotX, height * 0.4, 10, pivotX, height * 0.4, width * 0.7);
      bgGrad.addColorStop(0, '#fef9c3'); // 暖米黄微光
      bgGrad.addColorStop(0.7, '#fef08a');
      bgGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.roundRect(4, 4, width - 8, height - 8, 8);
      ctx.fill();

      // 内阴影边框
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. 绘制刻度弧线 (S 表与 PWR 表)
      ctx.save();
      const arcRadius = needleLen * 0.88;

      // S 标尺刻度
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, arcRadius, (-90 - 42) * Math.PI / 180, (-90 + 42) * Math.PI / 180);
      ctx.stroke();

      // 红色过载/大功率区域刻度
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, arcRadius, (-90 + 10) * Math.PI / 180, (-90 + 42) * Math.PI / 180);
      ctx.stroke();

      // 刻度文字
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';

      // 刻度线与标签
      const marks = [
        { deg: -40, label: '1' },
        { deg: -30, label: '3' },
        { deg: -20, label: '5' },
        { deg: -10, label: '7' },
        { deg: 0, label: '9' },
        { deg: 15, label: '+20' },
        { deg: 30, label: '+40' },
        { deg: 40, label: '+60dB' }
      ];

      marks.forEach(m => {
        const rad = (-90 + m.deg) * Math.PI / 180;
        const x1 = pivotX + Math.cos(rad) * (arcRadius - 5);
        const y1 = pivotY + Math.sin(rad) * (arcRadius - 5);
        const x2 = pivotX + Math.cos(rad) * arcRadius;
        const y2 = pivotY + Math.sin(rad) * arcRadius;

        ctx.strokeStyle = m.deg > 5 ? '#dc2626' : '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const tx = pivotX + Math.cos(rad) * (arcRadius - 12);
        const ty = pivotY + Math.sin(rad) * (arcRadius - 12);
        ctx.fillStyle = m.deg > 5 ? '#b91c1c' : '#334155';
        ctx.fillText(m.label, tx, ty);
      });

      // 表头核心字样
      ctx.font = '900 9px monospace';
      ctx.fillStyle = '#1e293b';
      ctx.fillText('SIGNAL / PWR', pivotX, height * 0.46);
      ctx.font = '7px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('HF TRANSCEIVER 100W', pivotX, height * 0.58);
      ctx.restore();

      // 4. 绘制物理金属指针 (Needle)
      ctx.save();
      const currentRad = (-90 + needleAngleRef.current) * Math.PI / 180;
      const tipX = pivotX + Math.cos(currentRad) * needleLen;
      const tipY = pivotY + Math.sin(currentRad) * needleLen;

      // 指针阴影
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.strokeStyle = '#b91c1c'; // 经典红色细指针
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // 指针轴承盖
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 5. 表头外层高光与倒角玻璃反光 (Glass Reflection)
      ctx.save();
      const glassGrad = ctx.createLinearGradient(0, 0, width, height);
      glassGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
      glassGrad.addColorStop(0.3, 'rgba(255,255,255,0.05)');
      glassGrad.addColorStop(0.7, 'rgba(0,0,0,0.05)');
      glassGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.roundRect(4, 4, width - 8, height - 8, 8);
      ctx.fill();
      ctx.restore();

      reqAnimRef.current = requestAnimationFrame(render);
    };

    reqAnimRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(reqAnimRef.current);
  }, []);

  return (
    <div className="relative w-44 h-28 rounded-xl bg-[#0f172a] p-1.5 shadow-2xl border border-slate-700/80 flex items-center justify-center shrink-0">
      <canvas
        ref={canvasRef}
        width={164}
        height={100}
        className="w-full h-full block rounded-lg overflow-hidden"
      />
      {/* 表头左上角背光指示灯 */}
      <div className="absolute top-2.5 left-3 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isTxActive ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-emerald-500 shadow-[0_0_6px_#10b981]'}`}></span>
        <span className="text-[8px] font-mono font-black text-slate-800 tracking-wider">
          {isTxActive ? 'TX-PWR' : 'S-METER'}
        </span>
      </div>
    </div>
  );
}

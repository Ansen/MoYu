import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, ArrowLeft, Shield, Sparkles, RefreshCw } from 'lucide-react';
import DiagnosticModal from './DiagnosticModal.jsx';
import { getUnitElementMs, TELEGRAM_GROUP_MODES, generateRandomTelegramText } from '../../utils/morseGame/clock.js';
import { getCharMorseCode } from '../../utils/morseCode.js';
import { morseAudio } from '../../utils/morseGame/audioEngine.js';
import { evaluateHit, generateDiagnosticReport } from '../../utils/morseGame/judgeEngine.js';
import { MorseInputEngine } from '../../utils/morseGame/inputEngine.js';
import { GENERATOR_MODE } from '../../utils/morse/structuredRandom.js';

export default function ZTypeGameView({ onBackToLobby }) {
  // 核心配置
  const [wpm, setWpm] = useState(12);
  const [groupMode, setGroupMode] = useState(GENERATOR_MODE.NUMBERS);
  const [demoSoundEnabled, setDemoSoundEnabled] = useState(true);
  const [firingMode, setFiringMode] = useState('MISSILE'); // 'MISSILE' (字符飞弹对撞) | 'LASER' (即时激光速射)

  // 战斗状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [wave, setWave] = useState(1);
  const [shieldHp, setShieldHp] = useState(100); // 玩家护盾
  const [diagnosticReport, setDiagnosticReport] = useState(null);

  // 字符飞弹模式下的即时输入状态（供 UI 动态高亮）
  const [inputCharBuffer, setInputCharBuffer] = useState(''); // 比如当前按了 "• —"

  // 手键状态指示
  const [inputActiveState, setInputActiveState] = useState({ straightDown: false });

  // 引用
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const reqAnimRef = useRef(null);
  const inputEngineRef = useRef(null);
  const straightPressRecordRef = useRef({ pressTimestamp: 0 });

  // 游戏实体引用 (避免闭包过期)
  const enemiesRef = useRef([]);
  const lasersRef = useRef([]);
  const missilesRef = useRef([]); // 实体字符飞弹队列
  const particlesRef = useRef([]);
  const starsRef = useRef([]);
  const screenShakeRef = useRef(0); // 碰撞震颤幅度
  const currentBufferSymbolsRef = useRef([]); // 字符飞弹模式下正在拼装的点划符号 ['DIT', 'DAH']
  const lockedEnemyIdRef = useRef(null);
  const testedNotesRef = useRef([]); // 用于战后统计
  const gameStatsRef = useRef({ score: 0, maxCombo: 0 });

  // 初始化星空
  const initStars = (width, height) => {
    const stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.8,
        speed: Math.random() * 0.8 + 0.3,
        alpha: Math.random() * 0.6 + 0.3
      });
    }
    starsRef.current = stars;
  };

  // 生成一波敌舰 (由标准分组报驱动)
  const spawnEnemyWave = useCallback((width) => {
    const rawText = generateRandomTelegramText(groupMode, 3);
    const groups = rawText.split(' ');
    const newEnemies = [];

    groups.forEach((grp, gIdx) => {
      // 拆解该组的每个字符及其莫尔斯点划
      const charsData = grp.split('').map(ch => {
        const code = getCharMorseCode(ch) || '';
        return {
          char: ch,
          symbols: code.split('').map(s => ({
            symbol: s,
            type: s === '-' ? 'DAH' : 'DIT',
            isDestroyed: false
          })),
          isDone: false
        };
      });

      // 敌舰初始坐标 (横向错开分布在屏幕上方)
      const slotWidth = width / (groups.length + 1);
      const enemyX = slotWidth * (gIdx + 1) + (Math.random() * 40 - 20);
      const enemyY = -50 - gIdx * 70; // 纵向梯次下落

      newEnemies.push({
        id: `enemy_${Date.now()}_${gIdx}`,
        text: grp,
        charsData,
        x: enemyX,
        y: enemyY,
        width: 140,
        height: 60,
        speed: 0.35 + (wpm / 40) * 0.2, // 下落速度与 WPM 联动
        isDead: false
      });
    });

    enemiesRef.current = newEnemies;
  }, [groupMode, wpm]);

  // 结束游戏并结算
  const finishGame = useCallback((isVictory = false) => {
    setIsPlaying(false);
    morseAudio.stopDemoTone();
    morseAudio.stopPlayerTone();
    if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);

    const report = generateDiagnosticReport(
      testedNotesRef.current,
      gameStatsRef.current.score,
      gameStatsRef.current.maxCombo,
      wpm
    );
    setDiagnosticReport(report);
  }, [wpm]);

  // 开始新游戏
  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    const width = canvas ? canvas.width : 900;
    const height = canvas ? canvas.height : 500;

    initStars(width, height);
    enemiesRef.current = [];
    lasersRef.current = [];
    missilesRef.current = [];
    particlesRef.current = [];
    testedNotesRef.current = [];
    currentBufferSymbolsRef.current = [];
    setInputCharBuffer('');
    lockedEnemyIdRef.current = null;
    screenShakeRef.current = 0;

    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setWave(1);
    setShieldHp(100);
    setDiagnosticReport(null);
    gameStatsRef.current = { score: 0, maxCombo: 0 };

    morseAudio.initContext();
    spawnEnemyWave(width);
    setIsPlaying(true);
  }, [spawnEnemyWave]);

  // 寻找当前锁定或最危急的目标
  const getCurrentTarget = () => {
    const enemies = enemiesRef.current.filter(e => !e.isDead);
    if (!enemies.length) return null;

    // 如果之前锁定的敌舰还在，继续锁定它
    let target = enemies.find(e => e.id === lockedEnemyIdRef.current);
    if (!target) {
      // 否则锁定 Y 坐标最大 (距离地面最近最危险) 的敌舰
      enemies.sort((a, b) => b.y - a.y);
      target = enemies[0];
      lockedEnemyIdRef.current = target.id;
    }

    // 寻找该敌机当前待摧毁的下一个字符及点划符号
    for (const chData of target.charsData) {
      if (chData.isDone) continue;
      for (const sym of chData.symbols) {
        if (!sym.isDestroyed) {
          return {
            enemy: target,
            charData: chData,
            symbol: sym
          };
        }
      }
    }
    return null;
  };

  // 生成爆炸火花粒子
  const spawnExplosion = (x, y, color = '#f59e0b', count = 25) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02,
        size: Math.random() * 4 + 2,
        color
      });
    }
  };

  // 手键按下
  const handlePressDown = useCallback((timestamp) => {
    if (!isPlaying) return;
    straightPressRecordRef.current = { pressTimestamp: timestamp };
  }, [isPlaying]);

  // 手键松开：判定拍发类型并开火（支持字符飞弹对撞 & 即时激光双模式）
  const handlePressUp = useCallback((timestamp) => {
    if (!isPlaying) return;
    const { pressTimestamp } = straightPressRecordRef.current;
    if (!pressTimestamp) return;

    const holdDuration = timestamp - pressTimestamp;
    const unitT = getUnitElementMs(wpm);
    const firedType = holdDuration >= 1.9 * unitT ? 'DAH' : 'DIT';

    const canvas = canvasRef.current;
    const shipX = canvas ? canvas.width / 2 : 450;
    const shipY = canvas ? canvas.height - 45 : 450;

    const targetInfo = getCurrentTarget();

    // 1. 若当前场上无目标
    if (!targetInfo) {
      lasersRef.current.push({
        x1: shipX, y1: shipY,
        x2: shipX, y2: 0,
        color: firedType === 'DAH' ? '#38bdf8' : '#f43f5e',
        life: 1.0,
        isDah: firedType === 'DAH'
      });
      straightPressRecordRef.current = { pressTimestamp: 0 };
      return;
    }

    const { enemy, charData, symbol } = targetInfo;
    const targetCharIndex = enemy.charsData.indexOf(charData);
    const charOffset = (targetCharIndex - (enemy.text.length - 1) / 2) * 28;
    const targetX = enemy.x + charOffset;
    const targetY = enemy.y + 10;

    // 记录音符用于战后诊断
    const noteRecord = {
      isHit: true,
      type: symbol.type,
      actualDuration: holdDuration,
      timeOffset: 0
    };

    // ==========================================
    // 模式 A：字符实体飞弹对撞模式 (Char Missile)
    // ==========================================
    if (firingMode === 'MISSILE') {
      const curIndex = currentBufferSymbolsRef.current.length;
      const expectedSym = charData.symbols[curIndex];

      if (expectedSym && firedType === expectedSym.type) {
        // 当前点划符号拍发正确！
        currentBufferSymbolsRef.current.push(firedType);
        const bufferStr = currentBufferSymbolsRef.current.map(t => (t === 'DAH' ? '—' : '•')).join(' ');
        setInputCharBuffer(bufferStr);

        // 船头聚能火花
        spawnExplosion(shipX, shipY - 20, firedType === 'DAH' ? '#38bdf8' : '#fb7185', 6);
        noteRecord.hitResult = 'PERFECT';
        testedNotesRef.current.push(noteRecord);

        // 检查该字符的所有点划是否已经拍发完整
        if (currentBufferSymbolsRef.current.length === charData.symbols.length) {
          // 完整拼装出字符！凝聚发射【高能字符实体飞弹】
          missilesRef.current.push({
            id: `missile_${Date.now()}_${Math.random()}`,
            char: charData.char,
            startX: shipX,
            startY: shipY - 20,
            x: shipX,
            y: shipY - 20,
            targetEnemy: enemy,
            targetCharData: charData,
            targetCharIndex: targetCharIndex,
            progress: 0,
            speed: 0.08, // 约12-14帧呼啸飞越战场并对撞
            trail: []
          });

          // 清空输入缓冲区准备拼装下一字符
          currentBufferSymbolsRef.current = [];
          setInputCharBuffer('');
        }
      } else {
        // 拍发错误！
        morseAudio.playMissEffect();
        noteRecord.hitResult = 'MISS';
        testedNotesRef.current.push(noteRecord);

        // 船头产生故障电弧与烟雾，清空缓冲区
        spawnExplosion(shipX, shipY - 20, '#ef4444', 8);
        currentBufferSymbolsRef.current = [];
        setInputCharBuffer('');
        setCombo(0);
      }
    } 
    // ==========================================
    // 模式 B：即时激光速射模式 (Instant Laser)
    // ==========================================
    else {
      // 添加射击激光光束
      lasersRef.current.push({
        x1: shipX, y1: shipY,
        x2: targetX, y2: targetY,
        color: firedType === 'DAH' ? '#38bdf8' : '#f43f5e',
        life: 1.0,
        isDah: firedType === 'DAH'
      });

      if (firedType === symbol.type) {
        // 命中当前点划！
        symbol.isDestroyed = true;
        morseAudio.playPerfectHitEffect();
        spawnExplosion(targetX, targetY, firedType === 'DAH' ? '#38bdf8' : '#fb7185', 10);

        noteRecord.hitResult = 'PERFECT';
        testedNotesRef.current.push(noteRecord);

        // 加分与连击
        const hitPoints = firedType === 'DAH' ? 150 : 80;
        setScore(prev => {
          const next = prev + hitPoints;
          gameStatsRef.current.score = next;
          return next;
        });
        setCombo(prev => {
          const next = prev + 1;
          setMaxCombo(m => {
            const maxVal = Math.max(m, next);
            gameStatsRef.current.maxCombo = maxVal;
            return maxVal;
          });
          return next;
        });

        // 检查当前字符是否消灭
        if (charData.symbols.every(s => s.isDestroyed)) {
          charData.isDone = true;
        }

        // 检查当前敌舰是否消灭
        if (enemy.charsData.every(c => c.isDone)) {
          enemy.isDead = true;
          spawnExplosion(enemy.x, enemy.y, '#f59e0b', 40);
          lockedEnemyIdRef.current = null;

          const remaining = enemiesRef.current.filter(e => !e.isDead);
          if (remaining.length === 0) {
            setWave(w => w + 1);
            setScore(s => s + 500);
            setTimeout(() => {
              if (canvasRef.current) spawnEnemyWave(canvasRef.current.width);
            }, 800);
          }
        }
      } else {
        // 拍发错误
        morseAudio.playMissEffect();
        noteRecord.hitResult = 'MISS';
        testedNotesRef.current.push(noteRecord);
        setCombo(0);
        spawnExplosion(targetX, targetY, '#64748b', 6);
      }
    }

    straightPressRecordRef.current = { pressTimestamp: 0 };
  }, [isPlaying, wpm, firingMode, spawnEnemyWave]);

  // 统一按键事件挂载
  useEffect(() => {
    const engine = new MorseInputEngine({
      mode: 'STRAIGHT',
      onEvent: (event) => {
        const { type, timestamp } = event;
        if (type === 'STRAIGHT_DOWN' || type === 'DIT_DOWN') {
          setInputActiveState({ straightDown: true });
          morseAudio.startPlayerTone();
          handlePressDown(timestamp);
        } else if (type === 'STRAIGHT_UP' || type === 'DIT_UP') {
          setInputActiveState({ straightDown: false });
          morseAudio.stopPlayerTone();
          handlePressUp(timestamp);
        }
      }
    });

    engine.attach();
    inputEngineRef.current = engine;

    return () => {
      engine.detach();
      morseAudio.destroy();
    };
  }, [handlePressDown, handlePressUp]);

  // 动画与碰撞主循环
  useEffect(() => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const shipX = width / 2;
      const shipY = height - 40;

      // 屏幕震颤处理
      ctx.save();
      if (screenShakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        ctx.translate(shakeX, shakeY);
        screenShakeRef.current *= 0.86;
        if (screenShakeRef.current < 0.2) screenShakeRef.current = 0;
      }

      // 1. 深邃星空背景
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, width, height);

      // 渲染下落星光
      ctx.fillStyle = '#94a3b8';
      starsRef.current.forEach(star => {
        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
        ctx.globalAlpha = star.alpha;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });
      ctx.globalAlpha = 1.0;

      // 2. 敌舰移动与渲染
      const currentTargetInfo = getCurrentTarget();
      const lockedId = currentTargetInfo?.enemy?.id;

      enemiesRef.current.forEach(enemy => {
        if (enemy.isDead) return;

        // 缓慢向下逼近
        enemy.y += enemy.speed;

        // 触底撞击判定
        if (enemy.y > height - 70) {
          enemy.isDead = true;
          screenShakeRef.current = 12;
          spawnExplosion(enemy.x, enemy.y, '#ef4444', 35);
          morseAudio.playMissEffect();
          setShieldHp(prev => {
            const next = Math.max(0, prev - 25);
            if (next <= 0) finishGame(false);
            return next;
          });
          return;
        }

        const isLocked = enemy.id === lockedId;
        const eX = enemy.x;
        const eY = enemy.y;

        ctx.save();
        
        // 锁定目标高光框
        if (isLocked) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(eX - enemy.width / 2 - 8, eY - 25, enemy.width + 16, 50);
          ctx.setLineDash([]);
        }

        // 敌舰舰体 (科幻扁平装甲)
        ctx.fillStyle = isLocked ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = isLocked ? '#f59e0b' : '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(eX - enemy.width / 2, eY - 20, enemy.width, 42, 8);
        ctx.fill();
        ctx.stroke();

        // 敌舰头顶字符与点划序列
        let curCharOffset = eX - (enemy.text.length * 28) / 2 + 14;

        enemy.charsData.forEach((cData, cIdx) => {
          const isCharDone = cData.isDone;
          const isCharLocked = isLocked && currentTargetInfo?.charData === cData;

          // 若当前字符正在被字符飞弹或点划瞄准，绘制瞄准光标
          if (isCharLocked) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(curCharOffset - 11, eY - 18, 22, 34);
          }

          // 字符文本
          ctx.fillStyle = isCharDone ? '#475569' : (isCharLocked ? '#fbbf24' : '#f8fafc');
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(cData.char, curCharOffset, eY - 2);

          // 点划符号序列 (显示在该字符下方)
          let symX = curCharOffset - (cData.symbols.length * 7) / 2;
          cData.symbols.forEach((sym, sIdx) => {
            const isSymDone = sym.isDestroyed;
            // 如果在字符飞弹拼装中，已输入的符号显示为绿色高亮
            const isBufferMatched = isCharLocked && firingMode === 'MISSILE' && sIdx < currentBufferSymbolsRef.current.length;

            ctx.fillStyle = isSymDone
              ? '#334155'
              : (isBufferMatched
                  ? '#10b981'
                  : (sym.type === 'DAH' ? '#38bdf8' : '#f43f5e'));
            
            if (sym.type === 'DAH') {
              ctx.fillRect(symX, eY + 8, 9, 3);
              symX += 11;
            } else {
              ctx.beginPath();
              ctx.arc(symX + 2, eY + 9, 2.5, 0, Math.PI * 2);
              ctx.fill();
              symX += 7;
            }
          });

          curCharOffset += 28;
        });

        ctx.restore();
      });

      // 3. 渲染与物理更新实体字符飞弹 (Missiles)
      for (let i = missilesRef.current.length - 1; i >= 0; i--) {
        const m = missilesRef.current[i];
        
        // 计算目标字符当前在空中的精确坐标
        let destX = m.startX;
        let destY = 0;
        if (!m.targetEnemy.isDead) {
          const cOffset = (m.targetCharIndex - (m.targetEnemy.text.length - 1) / 2) * 28;
          destX = m.targetEnemy.x + cOffset;
          destY = m.targetEnemy.y - 2;
        }

        m.progress += m.speed;
        m.x = m.startX + (destX - m.startX) * m.progress;
        m.y = m.startY + (destY - m.startY) * m.progress;

        // 推进尾焰记录
        m.trail.push({ x: m.x, y: m.y, size: Math.random() * 3 + 2 });
        if (m.trail.length > 7) m.trail.shift();

        // 绘制尾焰粒子
        ctx.save();
        m.trail.forEach((t, tIdx) => {
          ctx.globalAlpha = (tIdx / m.trail.length) * 0.8;
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();

        // 绘制飞弹能量实体 (带字符光标)
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.95)';
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-15, -15, 30, 30, 6);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.char, 0, 1);
        ctx.restore();

        // 碰撞瞬间判定
        if (m.progress >= 1.0) {
          screenShakeRef.current = 7;
          spawnExplosion(destX, destY, '#f59e0b', 25);
          spawnExplosion(destX, destY, '#38bdf8', 15);
          morseAudio.playPerfectHitEffect();

          m.targetCharData.isDone = true;
          m.targetCharData.symbols.forEach(s => s.isDestroyed = true);

          // 得分与连击加成
          setScore(prev => {
            const next = prev + 300;
            gameStatsRef.current.score = next;
            return next;
          });
          setCombo(prev => {
            const next = prev + 1;
            setMaxCombo(cm => {
              const mv = Math.max(cm, next);
              gameStatsRef.current.maxCombo = mv;
              return mv;
            });
            return next;
          });

          // 检查整舰是否全毁
          if (m.targetEnemy.charsData.every(c => c.isDone)) {
            m.targetEnemy.isDead = true;
            spawnExplosion(m.targetEnemy.x, m.targetEnemy.y, '#f59e0b', 45);
            lockedEnemyIdRef.current = null;

            const remaining = enemiesRef.current.filter(e => !e.isDead);
            if (remaining.length === 0) {
              setWave(w => w + 1);
              setScore(s => s + 800);
              setTimeout(() => {
                if (canvasRef.current) spawnEnemyWave(canvasRef.current.width);
              }, 800);
            }
          }

          missilesRef.current.splice(i, 1);
        }
      }

      // 4. 渲染玩家激光光束 (即时激光模式)
      for (let i = lasersRef.current.length - 1; i >= 0; i--) {
        const l = lasersRef.current[i];
        l.life -= 0.08;
        if (l.life <= 0) {
          lasersRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = l.life;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = l.isDah ? 5 : 2.5;
        ctx.shadowColor = l.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
        ctx.restore();
      }

      // 5. 渲染爆炸粒子
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

      // 6. 渲染玩家飞船
      ctx.save();
      const isFiring = inputActiveState.straightDown;

      // 引擎喷焰
      if (isFiring) {
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(shipX - 6, shipY + 12);
        ctx.lineTo(shipX + 6, shipY + 12);
        ctx.lineTo(shipX, shipY + 24);
        ctx.fill();
      }

      // 飞船三角机体
      ctx.fillStyle = '#0ea5e9';
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(shipX, shipY - 18);
      ctx.lineTo(shipX + 16, shipY + 12);
      ctx.lineTo(shipX, shipY + 6);
      ctx.lineTo(shipX - 16, shipY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 字符飞弹模式下：飞船头顶的聚能点划光晕
      if (firingMode === 'MISSILE' && currentBufferSymbolsRef.current.length > 0) {
        const buffSymbols = currentBufferSymbolsRef.current;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(shipX - 35, shipY - 48, 70, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        let bX = shipX - (buffSymbols.length * 10) / 2 + 5;
        buffSymbols.forEach(symType => {
          ctx.fillStyle = symType === 'DAH' ? '#38bdf8' : '#fb7185';
          if (symType === 'DAH') {
            ctx.fillRect(bX - 5, shipY - 39, 10, 3);
            bX += 13;
          } else {
            ctx.beginPath();
            ctx.arc(bX, shipY - 37, 3, 0, Math.PI * 2);
            ctx.fill();
            bX += 9;
          }
        });
      }

      ctx.restore(); // 还原可能存在的 screenShake 变换

      reqAnimRef.current = requestAnimationFrame(render);
    };

    reqAnimRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(reqAnimRef.current);
  }, [isPlaying, finishGame, inputActiveState]);

  // 自适应 Canvas 分辨率
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

  // 获取当前目标提示
  const currentTargetInfo = getCurrentTarget();
  const nextSymbolHint = currentTargetInfo
    ? (currentTargetInfo.symbol.type === 'DAH' ? '长划 (—) 按满松手' : '短点 (•) 轻击松手')
    : '寻找目标中...';

  return (
    <div className="flex-1 h-full flex flex-col bg-[#060a12] text-slate-100 select-none overflow-hidden">
      
      {/* 1. 顶部控制栏 */}
      <header className="h-14 px-6 border-b border-slate-800/80 bg-[#090e1a]/95 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="返回大厅"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></span>
            <span className="text-sm font-black tracking-wider text-slate-100 whitespace-nowrap">太空电码歼灭战 (ZType)</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs">
          {/* 分组报选择 */}
          <div className="flex items-center gap-1.5 bg-slate-800/70 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400 whitespace-nowrap">波次敌舰:</span>
            <select
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value)}
              disabled={isPlaying}
              className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer text-xs"
            >
              {TELEGRAM_GROUP_MODES.map(m => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100 font-medium">
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* WPM */}
          <div className="flex items-center gap-2 bg-slate-800/70 px-3 py-1.5 rounded-lg border border-slate-700/60">
            <span className="text-slate-400">字速:</span>
            <span className="text-cyan-400 font-mono font-bold w-6 text-right">{wpm}</span>
            <input
              type="range"
              min="8"
              max="25"
              step="1"
              value={wpm}
              disabled={isPlaying}
              onChange={(e) => setWpm(Number(e.target.value))}
              className="w-16 accent-cyan-500 cursor-pointer h-1.5"
            />
            <span className="text-[10px] text-slate-500 font-mono">WPM</span>
          </div>

          {/* 攻击模式切换开关 */}
          <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60">
            <button
              onClick={() => setFiringMode('MISSILE')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                firingMode === 'MISSILE'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="拼装完整字符点划，飞船凝聚实体字符飞弹呼啸对撞敌舰"
            >
              <span>🔠 字符飞弹对撞</span>
            </button>
            <button
              onClick={() => setFiringMode('LASER')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                firingMode === 'LASER'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="单点单划即刻激射高能激光束，极速连击"
            >
              <span>⚡ 即时激光速射</span>
            </button>
          </div>

          {/* 发报声音 */}
          <button
            onClick={() => setDemoSoundEnabled(!demoSoundEnabled)}
            className={`p-2 rounded-lg border transition ${
              demoSoundEnabled ? 'bg-slate-800 text-cyan-400 border-cyan-500/30' : 'bg-slate-800/40 text-slate-500 border-slate-700/40'
            }`}
            title="发报音效"
          >
            {demoSoundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {/* 开始/重来按钮 */}
          <button
            onClick={startGame}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition whitespace-nowrap"
          >
            {isPlaying ? <RotateCcw size={14} /> : <Play size={14} />}
            {isPlaying ? '重新迎击' : '出击迎敌'}
          </button>
        </div>
      </header>

      {/* 2. 主战斗 Canvas 区域 */}
      <main className="flex-1 p-4 flex flex-col max-w-6xl w-full mx-auto min-h-0 relative">
        
        {/* 顶部战斗 HUD 数据浮层 */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-900/60 border border-slate-800/80 rounded-xl backdrop-blur-md shrink-0 mb-3">
          
          {/* 左侧：当前目标锁定与下个符号提示 */}
          <div className="flex items-center gap-3">
            <div className="text-[10px] text-slate-400 uppercase font-bold">TARGET LOCKED</div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black font-mono text-amber-400">
                {currentTargetInfo?.charData?.char || '—'}
              </span>
              <span className="text-xs text-slate-300 font-bold bg-slate-800/80 px-2.5 py-0.5 rounded border border-slate-700">
                👉 {firingMode === 'MISSILE' 
                      ? (inputCharBuffer ? `已拍发: ${inputCharBuffer} (继续输入对应点划)` : `请拍发该字符电码: ${nextSymbolHint}`)
                      : nextSymbolHint
                    }
              </span>
            </div>
          </div>

          {/* 中间：连击与波次 */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-[10px] text-slate-500 font-bold">WAVE / 波次</div>
              <div className="text-lg font-black font-mono text-cyan-400">{wave}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-slate-500 font-bold">COMBO / 连击</div>
              <div className="text-lg font-black font-mono text-amber-400">{combo}</div>
            </div>
          </div>

          {/* 右侧：护盾 HP 与得分 */}
          <div className="flex items-center gap-6">
            <div className="w-28 space-y-1">
              <div className="flex justify-between text-[10px] font-bold">
                <span className="text-slate-400 flex items-center gap-1"><Shield size={10} /> SHIELD</span>
                <span className={shieldHp < 30 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}>{shieldHp}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-150 rounded-full ${
                    shieldHp < 30 ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                  }`}
                  style={{ width: `${shieldHp}%` }}
                />
              </div>
            </div>

            <div className="text-right min-w-[70px]">
              <div className="text-[10px] text-slate-500 font-bold">SCORE</div>
              <div className="text-xl font-black text-slate-100 font-mono">
                {score.toLocaleString()}
              </div>
            </div>
          </div>

        </div>

        {/* Canvas 战场视口 */}
        <div ref={containerRef} className="flex-1 w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-[#060a12] relative min-h-[300px]">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* 3. 底部手键单键状态条 */}
        <footer className="h-10 px-5 mt-3 bg-slate-900/50 border border-slate-800/70 rounded-xl flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-0.5 rounded-md border transition-all ${
              inputActiveState.straightDown
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                inputActiveState.straightDown ? 'bg-amber-400 animate-ping' : 'bg-slate-500'
              }`}></span>
              <span className="font-bold text-xs">
                {firingMode === 'MISSILE' ? '字符能量炮:' : '即时激光炮:'}
              </span>
              <span className="font-mono text-[11px] text-amber-300">
                {inputActiveState.straightDown ? '按压蓄能中...' : '待命'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {firingMode === 'MISSILE'
                ? '【字符飞弹模式】：短按点(•)、长按划(—)，按满字符所需点划后呼啸发射实体字符飞弹爆裂撞击！'
                : '【即时激光模式】：短按轻击发射点子弹(•)，按满 3T 轰出高能长划激光束(—)'
              }
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>按键:</span>
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono font-bold">空格 Space</kbd>
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono font-bold">J 键</kbd>
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono font-bold">鼠标左键</kbd>
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono font-bold">CH552G 电键</kbd>
          </div>
        </footer>

      </main>

      {/* 战后诊断弹窗 */}
      <DiagnosticModal
        report={diagnosticReport}
        onRestart={startGame}
        onClose={() => setDiagnosticReport(null)}
      />

    </div>
  );
}

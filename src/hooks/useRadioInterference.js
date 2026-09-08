import { useState, useEffect, useCallback } from 'react';
import radioInterference from '../utils/radioInterference';

const DEFAULT_MODES = {
  noise: true, // 底噪 (QRN)
  qsb: true,   // 衰落 (QSB)
  qrh: true,   // 频漂 (QRH)
  qrm: true    // 邻台 (QRM)
};

/**
 * 短波通联干扰仿真 React 响应式 Hook
 * 
 * 1. 自动与 localStorage 持久化绑定（默认 0 强度，无干扰）；
 * 2. 支持底噪 (Noise/QRN)、衰落 (QSB)、频漂 (QRH)、邻台 (QRM) 四种干扰方式的独立启闭；
 * 3. 自动响应主播放器播放/暂停生命周期（平滑淡入/淡出）；
 * 4. 0 侵入原有 audioPlayer 引擎。
 */
export function useRadioInterference(isPlaying = false, morseFreq = 600, currentText = '') {
  const [interferenceLevel, setInterferenceLevelState] = useState(() => {
    const saved = localStorage.getItem('pref_morse_interference');
    const num = Number(saved);
    return (!isNaN(num) && num >= 0 && num <= 100) ? num : 0;
  });

  const [interferenceModes, setInterferenceModesState] = useState(() => {
    try {
      const saved = localStorage.getItem('pref_morse_interference_modes');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_MODES, ...parsed };
      }
    } catch {}
    return { ...DEFAULT_MODES };
  });

  // 更新干扰总强度并持久化
  const setInterferenceLevel = useCallback((val) => {
    const num = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    setInterferenceLevelState(num);
    localStorage.setItem('pref_morse_interference', num.toString());
    radioInterference.setLevel(num);
  }, []);

  // 切换或批量更新干扰模式 (底噪 / QSB / QRH / QRM)
  const setInterferenceModes = useCallback((modesOrUpdater) => {
    setInterferenceModesState((prev) => {
      const next = typeof modesOrUpdater === 'function' ? modesOrUpdater(prev) : { ...prev, ...modesOrUpdater };
      localStorage.setItem('pref_morse_interference_modes', JSON.stringify(next));
      radioInterference.setModes(next);
      return next;
    });
  }, []);

  const toggleInterferenceMode = useCallback((key) => {
    setInterferenceModes((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, [setInterferenceModes]);

  // 监听干扰等级变更并通知底层引擎
  useEffect(() => {
    radioInterference.setLevel(interferenceLevel);
  }, [interferenceLevel]);

  // 监听模式变更并同步
  useEffect(() => {
    radioInterference.setModes(interferenceModes);
  }, [interferenceModes]);

  // 监听侧音频率变更并动态微调 CW 窄带中频滤波器
  useEffect(() => {
    radioInterference.setFrequency(morseFreq);
  }, [morseFreq]);

  // 监听当前正文变更并同步给干扰引擎 (供 QRM 提取上下文电码片段)
  useEffect(() => {
    if (typeof currentText === 'string') {
      radioInterference.setCurrentText(currentText);
    }
  }, [currentText]);

  // 联动主播放器的播放状态
  useEffect(() => {
    radioInterference.syncPlaybackState(isPlaying);
    return () => {
      // 组件卸载或离开时安全重置干扰状态，休眠调度器并恢复基线
      radioInterference.syncPlaybackState(false);
    };
  }, [isPlaying]);

  return {
    interferenceLevel,
    setInterferenceLevel,
    interferenceModes,
    setInterferenceModes,
    toggleInterferenceMode
  };
}

export default useRadioInterference;

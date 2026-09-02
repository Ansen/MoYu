import { useState, useEffect, useCallback } from 'react';
import audioPlayer, { AUDIO_STATE } from '../utils/audioPlayer';

/**
 * 企业级音频播放中枢 React 响应式 Hook (MorseAudio Hook)
 * 1. 彻底实现单一状态源 (SSOT) 绑定，UI 无需自行推演维护双轨状态
 * 2. 自动响应底层硬件与调度事件 (自然播完、切章停止、系统休眠恢复、Marker 触发)
 * 3. 向上提供极简高内聚的控制指令 (toggle / play / pause / resume / seek / stop)
 */
export function useMorseAudio() {
  const [snapshot, setSnapshot] = useState(() => audioPlayer.getSnapshot());

  useEffect(() => {
    // 自动订阅底层音频中枢的真实状态跃迁
    const unsubscribe = audioPlayer.subscribe((newSnapshot) => {
      setSnapshot(newSnapshot);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toggle = useCallback((textProvider, options) => {
    return audioPlayer.toggle(textProvider, options);
  }, []);

  const play = useCallback((text, options) => {
    return audioPlayer.play(text, options);
  }, []);

  const pause = useCallback(() => {
    audioPlayer.pause();
  }, []);

  const resume = useCallback(() => {
    return audioPlayer.resume();
  }, []);

  const seek = useCallback((index, text, options) => {
    return audioPlayer.seek(index, text, options);
  }, []);

  const stop = useCallback(() => {
    audioPlayer.stop();
  }, []);

  const updateConfig = useCallback((config) => {
    audioPlayer.updateConfig(config);
  }, []);

  const setOutputVolume = useCallback((vol) => {
    audioPlayer.setOutputVolume(vol);
  }, []);

  const warmUp = useCallback(() => {
    return audioPlayer.ensureReady();
  }, []);

  return {
    state: snapshot.state,
    isPlaying: snapshot.isPlaying,
    isPaused: snapshot.isPaused,
    activeMarker: snapshot.activeMarker,
    volume: snapshot.volume,
    config: snapshot.config,
    // 状态工具便捷计算
    isIdle: snapshot.state === AUDIO_STATE.IDLE || snapshot.state === AUDIO_STATE.STOPPED,
    isWarming: snapshot.state === AUDIO_STATE.WARMING,
    // 控制接口
    toggle,
    play,
    pause,
    resume,
    seek,
    stop,
    warmUp,
    updateConfig,
    setOutputVolume,
    // 底层原始引用
    player: audioPlayer
  };
}

export default useMorseAudio;

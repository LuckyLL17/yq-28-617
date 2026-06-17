import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioAnalysis {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
  spectrum: Float32Array;
  beatDetected: boolean;
  energyHistory: number[];
}

export type AudioSourceType = 'microphone' | 'file' | 'none';

const FFT_SIZE = 2048;
const SMOOTHING = 0.85;
const ENERGY_HISTORY_SIZE = 43;
const BEAT_THRESHOLD = 1.3;

export function useAudioAnalyzer() {
  const [sourceType, setSourceType] = useState<AudioSourceType>('none');
  const [isPlaying, setIsPlaying] = useState(false);
  const [analysis, setAnalysis] = useState<AudioAnalysis>({
    bass: 0,
    mid: 0,
    treble: 0,
    volume: 0,
    spectrum: new Float32Array(FFT_SIZE / 2),
    beatDetected: false,
    energyHistory: [],
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const energyHistoryRef = useRef<number[]>([]);
  const beatCooldownRef = useRef(0);
  const gainNodeRef = useRef<GainNode | null>(null);

  const [volume, setVolume] = useState(1);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = FFT_SIZE;
      analyserRef.current.smoothingTimeConstant = SMOOTHING;
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    return {
      audioContext: audioContextRef.current,
      analyser: analyserRef.current!,
      gainNode: gainNodeRef.current!,
    };
  }, []);

  const cleanupCurrentSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // ignore
      }
      sourceNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
      audioElementRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }

    setIsPlaying(false);
    beatCooldownRef.current = 0;
    energyHistoryRef.current = [];
  }, []);

  const analyzeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const timeData = new Float32Array(bufferLength);

    const analyze = () => {
      analyser.getFloatFrequencyData(dataArray);
      analyser.getFloatTimeDomainData(timeData);

      const normalizedSpectrum = new Float32Array(bufferLength);
      let totalEnergy = 0;
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;

      const bassEnd = Math.floor(bufferLength * 0.1);
      const midEnd = Math.floor(bufferLength * 0.5);

      for (let i = 0; i < bufferLength; i++) {
        const normalized = Math.max(0, (dataArray[i] + 100) / 100);
        normalizedSpectrum[i] = normalized;
        totalEnergy += normalized;

        if (i < bassEnd) {
          bassSum += normalized;
        } else if (i < midEnd) {
          midSum += normalized;
        } else {
          trebleSum += normalized;
        }
      }

      const bass = bassSum / bassEnd;
      const mid = midSum / (midEnd - bassEnd);
      const treble = trebleSum / (bufferLength - midEnd);
      const avgEnergy = totalEnergy / bufferLength;

      let waveSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        waveSum += Math.abs(timeData[i]);
      }
      const rmsVolume = waveSum / bufferLength;

      energyHistoryRef.current.push(avgEnergy);
      if (energyHistoryRef.current.length > ENERGY_HISTORY_SIZE) {
        energyHistoryRef.current.shift();
      }

      const history = energyHistoryRef.current;
      const avgHistory = history.reduce((a, b) => a + b, 0) / Math.max(1, history.length);
      const variance = history.reduce((a, b) => a + Math.pow(b - avgHistory, 2), 0) / Math.max(1, history.length);
      const stdDev = Math.sqrt(variance);

      beatCooldownRef.current = Math.max(0, beatCooldownRef.current - 1);
      let beatDetected = false;

      if (
        beatCooldownRef.current === 0 &&
        history.length >= ENERGY_HISTORY_SIZE &&
        avgEnergy > avgHistory + stdDev * BEAT_THRESHOLD &&
        bass > 0.4
      ) {
        beatDetected = true;
        beatCooldownRef.current = 10;
      }

      setAnalysis({
        bass: Math.min(1, bass),
        mid: Math.min(1, mid),
        treble: Math.min(1, treble),
        volume: Math.min(1, rmsVolume * 5),
        spectrum: normalizedSpectrum,
        beatDetected,
        energyHistory: [...history],
      });

      animationRef.current = requestAnimationFrame(analyze);
    };

    analyze();
  }, []);

  const startMicrophone = useCallback(async () => {
    cleanupCurrentSource();

    try {
      const { audioContext, analyser, gainNode } = ensureAudioContext();

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      source.connect(analyser);
      analyser.connect(gainNode);

      setSourceType('microphone');
      setIsPlaying(true);
      analyzeLoop();
    } catch (error) {
      console.error('Failed to start microphone:', error);
      cleanupCurrentSource();
      throw error;
    }
  }, [cleanupCurrentSource, ensureAudioContext, analyzeLoop]);

  const loadAudioFile = useCallback(
    async (file: File) => {
      cleanupCurrentSource();

      const { audioContext, analyser, gainNode } = ensureAudioContext();

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audioElementRef.current = audio;

      const url = URL.createObjectURL(file);
      audio.src = url;

      const source = audioContext.createMediaElementSource(audio);
      sourceNodeRef.current = source;
      source.connect(analyser);
      analyser.connect(gainNode);

      setSourceType('file');

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });

      try {
        await audio.play();
        setIsPlaying(true);
        analyzeLoop();
      } catch (error) {
        console.error('Failed to play audio:', error);
        cleanupCurrentSource();
        URL.revokeObjectURL(url);
        throw error;
      }
    },
    [cleanupCurrentSource, ensureAudioContext, analyzeLoop]
  );

  const togglePlay = useCallback(async () => {
    if (sourceType !== 'file' || !audioElementRef.current) return;

    const audio = audioElementRef.current;
    const audioContext = audioContextRef.current;

    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (e) {
        console.error('Play failed:', e);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [sourceType]);

  const stop = useCallback(() => {
    cleanupCurrentSource();
    setSourceType('none');
    setAnalysis({
      bass: 0,
      mid: 0,
      treble: 0,
      volume: 0,
      spectrum: new Float32Array(FFT_SIZE / 2),
      beatDetected: false,
      energyHistory: [],
    });
  }, [cleanupCurrentSource]);

  const setOutputVolume = useCallback((v: number) => {
    setVolume(v);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = v;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupCurrentSource();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [cleanupCurrentSource]);

  return {
    sourceType,
    isPlaying,
    analysis,
    volume,
    startMicrophone,
    loadAudioFile,
    togglePlay,
    stop,
    setOutputVolume: setOutputVolume,
  };
}

export default useAudioAnalyzer;

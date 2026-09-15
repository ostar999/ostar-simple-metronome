(function() {
  // ═══════════════════════════════════════════════════════
  // Constants
  // ═══════════════════════════════════════════════════════
  const STORAGE_KEY = 'metronome_settings_v2';

  const BEAT_STATES = ['strong', 'secondary', 'weak', 'rest'];
  const BEAT_LABELS = { strong: '强', secondary: '次', weak: '弱', rest: '休' };

  const DEFAULT_PATTERNS = {
    '2/4':  ['strong','weak'],
    '3/4':  ['strong','weak','weak'],
    '4/4':  ['strong','weak','secondary','weak'],
    '3/8':  ['strong','weak','weak'],
    '6/8':  ['strong','weak','weak','secondary','weak','weak'],
    '12/8': ['strong','weak','weak','secondary','weak','weak','secondary','weak','weak','secondary','weak','weak'],
  };

  const SOUND_TYPES = ['classic', 'wood', 'digital', 'clave'];
  const SOUND_LABELS = { classic: '经典', wood: '木鱼', digital: '电子', clave: '响棒' };
  const ACTIVE_TS = '4/4'; // default

  const MAX_BEATS = 16;

  // ═══════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════
  let audioCtx = null;
  let masterGain = null;
  let bpm = 80;
  let beatsPerMeasure = 4;
  let beatStates = ['strong','weak','secondary','weak']; // per-beat state
  let timeSigDenom = 4; // denominator of time signature (4 or 8)
  let currentBeat = 0;
  let globalBeatCount = 0;
  let isPlaying = false;
  let nextNoteTime = 0;
  let schedulerTimer = null;
  let animationId = null;
  let soundType = 'classic';
  let volume = 0.8;
  let emphasizeSecondary = true;
  let gainStrong = 1.0;
  let gainSecondary = 0.6;
  let gainWeak = 0.5;
  let noteValue = 4; // 4分/8分/16分/32分音符
  let activeTsButton = ACTIVE_TS;

  // Tap tempo
  let tapTimes = [];
  const TAP_WINDOW_MS = 2000;
  const MAX_TAP_SAMPLES = 8;

  // Pendulum
  let lastBeatTime = 0;
  let pendulumAngle = 20;
  const MAX_ANGLE = 20;

  // ═══════════════════════════════════════════════════════
  // DOM refs
  // ═══════════════════════════════════════════════════════
  const $bpmValue    = document.getElementById('bpmValue');
  const $tempoMarking= document.getElementById('tempoMarking');
  const $beatRow     = document.getElementById('beatRow');
  const $bpmSlider   = document.getElementById('bpmSlider');
  const $btnPlay     = document.getElementById('btnPlay');
  const $playIcon    = document.getElementById('playIcon');
  const $btnMinus    = document.getElementById('btnMinus');
  const $btnPlus     = document.getElementById('btnPlus');
  const $btnTap      = document.getElementById('btnTap');
  const $beatCounter = document.getElementById('beatCounter');
  const $pendulumArm = document.getElementById('pendulumArm');
  const $scaleMarks  = document.getElementById('scaleMarks');
  const $tsButtons   = document.getElementById('tsButtons');
  const $subButtons  = document.getElementById('subButtons');
  const $soundOptions= document.getElementById('soundOptions');
  const $volumeSlider= document.getElementById('volumeSlider');
  const $volumeVal   = document.getElementById('volumeVal');
  const $toggleSecondary = document.getElementById('toggleSecondary');
  const $gainStrong     = document.getElementById('gainStrong');
  const $gainSecondary  = document.getElementById('gainSecondary');
  const $gainWeak       = document.getElementById('gainWeak');
  const $btnTheme    = document.getElementById('btnTheme');
  const $tempoToggle = document.getElementById('tempoToggle');
  const $tempoPresets= document.getElementById('tempoPresets');
  const $btnReset    = document.getElementById('btnReset');

  // ═══════════════════════════════════════════════════════
  // Scale marks
  // ═══════════════════════════════════════════════════════
  function buildScaleMarks() {
    let html = '';
    for (let i = 0; i < 17; i++) {
      html += '<div class="scale-mark"></div>';
    }
    $scaleMarks.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════
  // Beat dots UI
  // ═══════════════════════════════════════════════════════
  function getStepsPerBeat() { return Math.max(1, Math.round(noteValue / timeSigDenom)); }
  function getTotalSteps() { return beatsPerMeasure * getStepsPerBeat(); }

  function renderBeatDots() {
    let html = '';
    for (let i = 0; i < beatsPerMeasure; i++) {
      const state = beatStates[i] || 'weak';
      html += `<div class="beat-dot state-${state}" data-idx="${i}" data-label="${BEAT_LABELS[state]}" title="点击切换: ${BEAT_LABELS[state]}">${i+1}</div>`;
    }
    $beatRow.innerHTML = html;

    $beatRow.querySelectorAll('.beat-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.idx, 10);
        cycleBeatState(idx);
      });
    });
  }

  function cycleBeatState(idx) {
    const currentState = beatStates[idx] || 'weak';
    const currentIdx = BEAT_STATES.indexOf(currentState);
    const nextIdx = (currentIdx + 1) % BEAT_STATES.length;
    beatStates[idx] = BEAT_STATES[nextIdx];
    renderBeatDots();
    updateActiveDot();
    saveSettings();
  }

  function updateActiveDot() {
    if (!isPlaying) return;
    const spb = getStepsPerBeat();
    const mainIdx = Math.floor(currentBeat / spb);
    $beatRow.querySelectorAll('.beat-dot').forEach((d, i) => {
      d.classList.toggle('active', i === mainIdx);
    });
  }

  function clearActiveDots() {
    $beatRow.querySelectorAll('.beat-dot').forEach(d => d.classList.remove('active'));
  }

  // ═══════════════════════════════════════════════════════
  // Tempo marking
  // ═══════════════════════════════════════════════════════
  function getTempoMarking(b) {
    if (b <= 39)  return 'Grave';
    if (b <= 59)  return 'Largo';
    if (b <= 65)  return 'Larghetto';
    if (b <= 75)  return 'Adagio';
    if (b <= 79)  return 'Andante';
    if (b <= 89)  return 'Andantino';
    if (b <= 99)  return 'Moderato';
    if (b <= 109) return 'Allegretto';
    if (b <= 132) return 'Allegro';
    if (b <= 159) return 'Vivace';
    if (b <= 179) return 'Presto';
    return 'Prestissimo';
  }

  // ═══════════════════════════════════════════════════════
  // Sound synthesis
  // ═══════════════════════════════════════════════════════
  function createClickBuffer(gain, sound) {
    const ctx = audioCtx;
    const sampleRate = ctx.sampleRate;
    const duration = 0.04;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const amp = gain;

    switch (sound) {
      case 'wood':
        // Low, resonant wood block
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 60);
          const tone1 = Math.sin(2 * Math.PI * 500 * t);
          const tone2 = Math.sin(2 * Math.PI * 800 * t) * 0.3;
          data[i] = (tone1 + tone2) * env * amp;
        }
        break;
      case 'digital':
        // Clean sine beep
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 80);
          const tone = Math.sin(2 * Math.PI * 1200 * t);
          data[i] = tone * env * amp * 0.8;
        }
        break;
      case 'clave':
        // Bright, short, very percussive
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 200);
          const tone = Math.sin(2 * Math.PI * 2200 * t);
          const noise = (Math.random() * 2 - 1) * 0.15;
          data[i] = (tone + noise) * env * amp * 0.7;
        }
        break;
      case 'classic':
      default:
        // Classic click: sine + noise + thump
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          const env = Math.exp(-t * 120);
          const tone = Math.sin(2 * Math.PI * 950 * t);
          const noise = (Math.random() * 2 - 1) * 0.25;
          const thump = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 200) * 0.5;
          data[i] = (tone + noise + thump) * env * amp;
        }
        break;
    }
    return buffer;
  }

  function playClick(time, gain, sound) {
    if (!audioCtx || !masterGain) return;
    const buffer = createClickBuffer(gain, sound);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(masterGain);
    src.start(time);
  }

  function getBeatGain(state) {
    // Returns amplitude based on beat state, custom gains, and emphasizeSecondary setting
    switch (state) {
      case 'strong':    return gainStrong;
      case 'secondary': return emphasizeSecondary ? gainSecondary : gainWeak;
      case 'weak':      return gainWeak;
      default:          return 0;
    }
  }

  // ═══════════════════════════════════════════════════════
  // Scheduler
  // ═══════════════════════════════════════════════════════
  const SCHEDULE_AHEAD = 0.1;
  const LOOK_AHEAD_MS = 20;

  function nextStep() {
    const total = getTotalSteps();
    const secondsPerStep = (60.0 / bpm) / getStepsPerBeat();
    nextNoteTime += secondsPerStep;
    currentBeat = (currentBeat + 1) % total;
    globalBeatCount++;
  }

  function scheduleBeat(beatTime, stepIdx) {
    const total = getTotalSteps();
    const spb = getStepsPerBeat();
    const isMain = stepIdx % spb === 0;
    const mainIdx = Math.floor(stepIdx / spb);
    const mainState = beatStates[mainIdx] || 'weak';

    if (mainState !== 'rest') {
      if (isMain) {
        playClick(beatTime, getBeatGain(mainState), soundType);
      } else {
        // Sub-beat: soft click
        playClick(beatTime, gainWeak * 0.35, soundType);
      }
    }
    scheduleVisualUpdate(beatTime, stepIdx, isMain);
  }

  function scheduleVisualUpdate(beatTime, stepIdx, isMain) {
    const now = audioCtx.currentTime;
    const delay = Math.max(0, (beatTime - now) * 1000);
    setTimeout(() => onStepVisual(stepIdx, isMain), delay);
  }

  function onStepVisual(stepIdx, isMain) {
    const spb = getStepsPerBeat();
    const mainIdx = Math.floor(stepIdx / spb);
    $beatRow.querySelectorAll('.beat-dot').forEach((d, i) => {
      d.classList.toggle('active', i === mainIdx && isMain);
    });
    $beatCounter.textContent = `${mainIdx + 1} / ${beatsPerMeasure}`;
    if (isMain) {
      pendulumAngle = -pendulumAngle;
      lastBeatTime = performance.now();
    }
  }

  function scheduler() {
    if (!isPlaying) return;
    while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
      scheduleBeat(nextNoteTime, currentBeat);
      nextStep();
    }
    schedulerTimer = setTimeout(scheduler, LOOK_AHEAD_MS);
  }

  // ═══════════════════════════════════════════════════════
  // Pendulum animation
  // ═══════════════════════════════════════════════════════
  function animatePendulum() {
    if (!isPlaying) {
      const current = parseFloat(
        ($pendulumArm.style.transform || 'rotate(0deg)').replace('rotate(','').replace('deg)','')
      ) || 0;
      if (Math.abs(current) < 0.3) {
        $pendulumArm.style.transition = 'transform 0.4s ease-out';
        $pendulumArm.style.transform = 'rotate(0deg)';
        animationId = null;
        return;
      }
      $pendulumArm.style.transition = 'none';
      $pendulumArm.style.transform = `rotate(${current * 0.85}deg)`;
      animationId = requestAnimationFrame(animatePendulum);
      return;
    }

    const now = performance.now();
    const elapsed = (now - lastBeatTime) / 1000;
    const beatDuration = 60.0 / bpm;
    const progress = Math.min(elapsed / beatDuration, 1);
    const prevAngle = -pendulumAngle;
    const currentAngle = prevAngle + (pendulumAngle - prevAngle) * (0.5 - 0.5 * Math.cos(Math.PI * progress));

    $pendulumArm.style.transition = 'none';
    $pendulumArm.style.transform = `rotate(${currentAngle}deg)`;
    animationId = requestAnimationFrame(animatePendulum);
  }

  // ═══════════════════════════════════════════════════════
  // Start / Stop
  // ═══════════════════════════════════════════════════════
  function start() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(audioCtx.destination);
    } else {
      // Ensure gain node exists
      if (!masterGain) {
        masterGain = audioCtx.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(audioCtx.destination);
      }
    }

    isPlaying = true;
    $btnPlay.classList.add('playing');
    $playIcon.textContent = '⏸';
    currentBeat = 0;
    globalBeatCount = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;
    pendulumAngle = MAX_ANGLE;
    lastBeatTime = performance.now();

    updateActiveDot();
    $beatCounter.textContent = `1 / ${beatsPerMeasure}`;
    $pendulumArm.style.transform = `rotate(${MAX_ANGLE}deg)`;

    scheduler();
    if (!animationId) {
      animationId = requestAnimationFrame(animatePendulum);
    }
  }

  function stop() {
    isPlaying = false;
    $btnPlay.classList.remove('playing');
    $playIcon.textContent = '▶';
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    currentBeat = 0;
    globalBeatCount = 0;
    clearActiveDots();
    $beatCounter.textContent = `0 / ${beatsPerMeasure}`;
    if (!animationId) {
      animationId = requestAnimationFrame(animatePendulum);
    }
  }

  function togglePlay() {
    isPlaying ? stop() : start();
  }

  // ═══════════════════════════════════════════════════════
  // BPM controls
  // ═══════════════════════════════════════════════════════
  function setBPM(newBpm, source) {
    newBpm = Math.max(30, Math.min(250, newBpm));
    if (bpm === newBpm && source !== 'input') return;
    bpm = newBpm;
    $bpmValue.value = bpm;
    $tempoMarking.textContent = getTempoMarking(bpm);
    if (source !== 'slider') $bpmSlider.value = bpm;
    saveSettings();
  }

  function handleBpmInput() {
    let val = parseInt($bpmValue.value, 10);
    if (isNaN(val) || val < 30) val = 30;
    if (val > 250) val = 250;
    $bpmValue.value = val;
    setBPM(val, 'input');
  }

  function changeBPM(delta) {
    setBPM(bpm + delta);
  }

  // ═══════════════════════════════════════════════════════
  // Time signature
  // ═══════════════════════════════════════════════════════
  function setTimeSignature(beats, pattern, buttonEl) {
    beatsPerMeasure = beats;
    beatStates = pattern.slice(0, beats);
    while (beatStates.length < beats) beatStates.push('weak');
    // Update denominator
    const denom = buttonEl ? parseInt(buttonEl.dataset.denom, 10) : 4;
    timeSigDenom = denom || 4;
    // Auto-set note value: /4→4分, /8→8分
    noteValue = timeSigDenom === 8 ? 8 : 4;
    updateSubUI();
    // Update active button
    $tsButtons.querySelectorAll('.btn-ts-quick').forEach(b => b.classList.remove('active'));
    if (buttonEl) buttonEl.classList.add('active');
    activeTsButton = buttonEl ? buttonEl.textContent : null;
    renderBeatDots();
    updateActiveDot();
    if (!isPlaying) {
      $beatCounter.textContent = `0 / ${beatsPerMeasure}`;
    }
    saveSettings();
  }

  // ═══════════════════════════════════════════════════════
  // Subdivision
  // ═══════════════════════════════════════════════════════
  function setNoteValue(nv) {
    nv = parseInt(nv, 10);
    if (![4,8,16,32].includes(nv)) return;
    // Reject 4分 in /8 time
    if (nv === 4 && timeSigDenom === 8) return;
    noteValue = nv;
    updateSubUI();
    if (!isPlaying) {
      $beatCounter.textContent = `0 / ${beatsPerMeasure}`;
    }
    saveSettings();
  }

  function updateSubUI() {
    $subButtons.querySelectorAll('.btn-sub').forEach(b => {
      const nv = parseInt(b.dataset.note, 10);
      b.classList.toggle('active', nv === noteValue);
      // Disable 4分 when in /8 time (quarter note doesn't align with eighth-note beats)
      if (nv === 4 && timeSigDenom === 8) {
        b.disabled = true;
      } else {
        b.disabled = false;
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  // Sound type
  // ═══════════════════════════════════════════════════════
  function setSoundType(type) {
    soundType = type;
    $soundOptions.querySelectorAll('.btn-sound').forEach(b => {
      b.classList.toggle('active', b.dataset.sound === type);
    });
    saveSettings();
  }

  // ═══════════════════════════════════════════════════════
  // Volume
  // ═══════════════════════════════════════════════════════
  function setVolume(val) {
    volume = val / 100;
    $volumeSlider.value = val;
    $volumeVal.textContent = val;
    if (masterGain) {
      masterGain.gain.value = volume;
    }
    saveSettings();
  }

  // ═══════════════════════════════════════════════════════
  // Tap tempo
  // ═══════════════════════════════════════════════════════
  function handleTap() {
    const now = Date.now();
    tapTimes = tapTimes.filter(t => now - t < TAP_WINDOW_MS);
    tapTimes.push(now);
    if (tapTimes.length > MAX_TAP_SAMPLES) tapTimes.shift();

    if (tapTimes.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < tapTimes.length; i++) {
        totalInterval += tapTimes[i] - tapTimes[i - 1];
      }
      const avgMs = totalInterval / (tapTimes.length - 1);
      const tappedBpm = Math.round(60000 / avgMs);
      setBPM(Math.max(30, Math.min(250, tappedBpm)));
    }

    $btnTap.style.background = 'var(--accent-soft)';
    setTimeout(() => { $btnTap.style.background = ''; }, 120);
  }

  // ═══════════════════════════════════════════════════════
  // Persistence (localStorage)
  // ═══════════════════════════════════════════════════════
  function saveSettings() {
    const settings = {
      bpm,
      beatsPerMeasure,
      beatStates: beatStates.slice(0, beatsPerMeasure),
      soundType,
      volume: Math.round(volume * 100),
      emphasizeSecondary,
      gainStrong,
      gainSecondary,
      gainWeak,
      savedSecondaryGain,
      noteValue,
      timeSigDenom,
      activeTsButton,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // localStorage not available
    }
  }

  function resetToDefaults() {
    // Stop playback if running
    if (isPlaying) stop();

    // Reset all state to defaults
    bpm = 80;
    beatsPerMeasure = 4;
    beatStates = ['strong','weak','secondary','weak'];
    soundType = 'classic';
    volume = 0.8;
    emphasizeSecondary = true;
    gainStrong = 1.0;
    gainSecondary = 0.6;
    gainWeak = 0.5;
    savedSecondaryGain = 0.6;
    noteValue = 4;
    timeSigDenom = 4;
    activeTsButton = '4/4';

    // Update UI
    $bpmValue.value = bpm;
    $bpmSlider.value = bpm;
    $tempoMarking.textContent = getTempoMarking(bpm);
    $volumeSlider.value = 80;
    $volumeVal.textContent = '80';
    if (masterGain) masterGain.gain.value = 0.8;
    renderBeatDots();
    clearActiveDots();
    $beatCounter.textContent = `0 / ${beatsPerMeasure}`;

    // Update TS buttons
    $tsButtons.querySelectorAll('.btn-ts-quick').forEach(b => {
      b.classList.toggle('active', b.textContent === '4/4');
    });

    // Update sound buttons
    $soundOptions.querySelectorAll('.btn-sound').forEach(b => {
      b.classList.toggle('active', b.dataset.sound === 'classic');
    });

    // Update toggle
    $toggleSecondary.classList.toggle('on', true);
    $gainSecondary.disabled = false;

    // Update gain inputs
    $gainStrong.value = '1.0';
    $gainSecondary.value = '0.6';
    $gainWeak.value = '0.5';

    // Update subdivision UI
    updateSubUI();

    // Clear localStorage
    try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}

    // Tap tempo reset
    tapTimes = [];
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);

      // Restore BPM
      if (typeof s.bpm === 'number') {
        bpm = Math.max(30, Math.min(250, s.bpm));
        $bpmValue.value = bpm;
        $bpmSlider.value = bpm;
        $tempoMarking.textContent = getTempoMarking(bpm);
      }

      // Restore beat settings
      if (typeof s.beatsPerMeasure === 'number' && Array.isArray(s.beatStates)) {
        beatsPerMeasure = Math.max(1, Math.min(MAX_BEATS, s.beatsPerMeasure));
        beatStates = s.beatStates.slice(0, beatsPerMeasure);
        while (beatStates.length < beatsPerMeasure) beatStates.push('weak');
        // Validate states
        beatStates = beatStates.map(st => BEAT_STATES.includes(st) ? st : 'weak');
      }

      // Restore sound
      if (typeof s.soundType === 'string' && SOUND_TYPES.includes(s.soundType)) {
        soundType = s.soundType;
      }

      // Restore volume
      if (typeof s.volume === 'number') {
        volume = Math.max(0, Math.min(1, s.volume / 100));
        $volumeSlider.value = Math.round(volume * 100);
        $volumeVal.textContent = Math.round(volume * 100);
      }

      // Restore emphasizeSecondary
      if (typeof s.emphasizeSecondary === 'boolean') {
        emphasizeSecondary = s.emphasizeSecondary;
        $toggleSecondary.classList.toggle('on', emphasizeSecondary);
        if (!emphasizeSecondary) {
          $gainSecondary.disabled = true;
        }
      }

      // Restore gain levels
      if (typeof s.gainStrong === 'number') {
        gainStrong = Math.max(0, Math.min(1, s.gainStrong));
        $gainStrong.value = gainStrong.toFixed(1);
      }
      if (typeof s.gainSecondary === 'number') {
        gainSecondary = Math.max(0, Math.min(1, s.gainSecondary));
        $gainSecondary.value = gainSecondary.toFixed(1);
      }
      if (typeof s.savedSecondaryGain === 'number') {
        savedSecondaryGain = Math.max(0, Math.min(1, s.savedSecondaryGain));
      } else if (typeof s.gainSecondary === 'number') {
        savedSecondaryGain = gainSecondary;
      }

      // Restore note value & time sig denom
      if (typeof s.noteValue === 'number') {
        noteValue = [4,8,16,32].includes(s.noteValue) ? s.noteValue : 4;
        updateSubUI();
      }
      if (typeof s.timeSigDenom === 'number') {
        timeSigDenom = [4,8].includes(s.timeSigDenom) ? s.timeSigDenom : 4;
      }
      if (typeof s.gainWeak === 'number') {
        gainWeak = Math.max(0, Math.min(1, s.gainWeak));
        $gainWeak.value = gainWeak.toFixed(1);
      }

      // Activate matching TS button
      if (s.activeTsButton) {
        const btn = Array.from($tsButtons.querySelectorAll('.btn-ts-quick'))
          .find(b => b.textContent === s.activeTsButton);
        if (btn) {
          $tsButtons.querySelectorAll('.btn-ts-quick').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeTsButton = s.activeTsButton;
        }
      }

      // Update UI to match loaded state
      renderBeatDots();
      updateSoundUI();
      updateTsUI();
      $beatCounter.textContent = `0 / ${beatsPerMeasure}`;
      return true;
    } catch (e) {
      return false;
    }
  }

  function updateSoundUI() {
    $soundOptions.querySelectorAll('.btn-sound').forEach(b => {
      b.classList.toggle('active', b.dataset.sound === soundType);
    });
  }

  function updateTsUI() {
    if (!activeTsButton) return;
    $tsButtons.querySelectorAll('.btn-ts-quick').forEach(b => {
      b.classList.toggle('active', b.textContent === activeTsButton);
    });
  }

  // ═══════════════════════════════════════════════════════
  // Keyboard
  // ═══════════════════════════════════════════════════════
  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      return;
    }
    if (e.target.tagName === 'INPUT') return;

    switch (e.code) {
      case 'Space': e.preventDefault(); togglePlay(); break;
      case 'ArrowUp': e.preventDefault(); changeBPM(1); break;
      case 'ArrowDown': e.preventDefault(); changeBPM(-1); break;
      case 'ArrowRight': e.preventDefault(); changeBPM(e.shiftKey ? 10 : 1); break;
      case 'ArrowLeft': e.preventDefault(); changeBPM(e.shiftKey ? -10 : -1); break;
      case 'KeyT': if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); handleTap(); } break;
    }
  }

  // ═══════════════════════════════════════════════════════
  // Event bindings
  // ═══════════════════════════════════════════════════════
  $btnPlay.addEventListener('click', togglePlay);
  $btnMinus.addEventListener('click', () => changeBPM(-1));
  $btnPlus.addEventListener('click', () => changeBPM(1));
  $btnTap.addEventListener('click', handleTap);

  $bpmSlider.addEventListener('input', () => {
    setBPM(parseInt($bpmSlider.value, 10), 'slider');
  });

  $bpmValue.addEventListener('change', handleBpmInput);
  $bpmValue.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $bpmValue.blur(); }
  });

  $volumeSlider.addEventListener('input', () => {
    setVolume(parseInt($volumeSlider.value, 10));
  });

  function handleGainChange() {
    let val = parseFloat($gainStrong.value);
    gainStrong = isNaN(val) ? 1.0 : Math.max(0, Math.min(1, val));
    $gainStrong.value = gainStrong.toFixed(1);

    val = parseFloat($gainSecondary.value);
    gainSecondary = isNaN(val) ? 0.6 : Math.max(0, Math.min(1, val));
    $gainSecondary.value = gainSecondary.toFixed(1);
    savedSecondaryGain = gainSecondary;

    val = parseFloat($gainWeak.value);
    gainWeak = isNaN(val) ? 0.5 : Math.max(0, Math.min(1, val));
    $gainWeak.value = gainWeak.toFixed(1);

    saveSettings();
  }

  $gainStrong.addEventListener('change', handleGainChange);
  $gainSecondary.addEventListener('change', handleGainChange);
  $gainWeak.addEventListener('change', handleGainChange);

  // Note value buttons
  $subButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-sub');
    if (!btn) return;
    setNoteValue(btn.dataset.note);
  });

  // Time sig quick buttons
  $tsButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-ts-quick');
    if (!btn) return;
    const beats = parseInt(btn.dataset.beats, 10);
    const pattern = btn.dataset.pattern.split(',');
    setTimeSignature(beats, pattern, btn);
  });

  // Sound buttons
  $soundOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-sound');
    if (!btn) return;
    setSoundType(btn.dataset.sound);
  });

  // Tempo preset buttons
  document.getElementById('tempoPresets').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-tempo-preset');
    if (!btn) return;
    setBPM(parseInt(btn.dataset.bpm, 10));
  });

  let savedSecondaryGain = 0.6;

  $toggleSecondary.addEventListener('click', () => {
    emphasizeSecondary = !emphasizeSecondary;
    $toggleSecondary.classList.toggle('on', emphasizeSecondary);
    if (!emphasizeSecondary) {
      savedSecondaryGain = gainSecondary;
      gainSecondary = gainWeak;
      $gainSecondary.value = gainWeak.toFixed(1);
      $gainSecondary.disabled = true;
    } else {
      gainSecondary = savedSecondaryGain;
      $gainSecondary.value = savedSecondaryGain.toFixed(1);
      $gainSecondary.disabled = false;
    }
    saveSettings();
  });

  // Theme toggle
  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    $btnTheme.textContent = dark ? '☀️' : '🌙';
    try { localStorage.setItem('metronome_theme', dark ? 'dark' : 'light'); } catch(e) {}
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(!isDark);
  }

  $btnTheme.addEventListener('click', toggleTheme);

  // Tempo presets toggle (mobile)
  function isMobile() { return window.innerWidth <= 460; }

  function collapsePresets() {
    $tempoPresets.classList.add('collapsed');
    $tempoToggle.classList.remove('open');
  }

  function expandPresets() {
    $tempoPresets.classList.remove('collapsed');
    $tempoToggle.classList.add('open');
  }

  $tempoToggle.addEventListener('click', () => {
    if ($tempoPresets.classList.contains('collapsed')) {
      expandPresets();
    } else {
      collapsePresets();
    }
  });

  // Auto-collapse when tapping a preset on mobile
  $tempoPresets.addEventListener('click', (e) => {
    if (e.target.closest('.btn-tempo-preset') && isMobile()) {
      collapsePresets();
    }
  });

  $btnReset.addEventListener('click', resetToDefaults);

  document.addEventListener('keydown', handleKeydown);

  // ═══════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════
  // Theme
  const savedTheme = (() => { try { return localStorage.getItem('metronome_theme'); } catch(e) { return null; } })();
  applyTheme(savedTheme === 'dark');

  // Collapse tempo presets on mobile by default
  if (isMobile()) collapsePresets();

  buildScaleMarks();
  loadSettings();  // loads saved state & renders beat dots
  renderBeatDots(); // ensure rendered (in case loadSettings didn't)
  $pendulumArm.style.transform = 'rotate(0deg)';
})();

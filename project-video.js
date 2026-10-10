/* Shared native MP4 playback and page audio controls. */
// Adapt native media to the existing event-driven Play/Pause controller.
function nativeProjectPlayer(video) {
  return {
    on: (name, handler) => video.addEventListener(name, handler),
    off: (name, handler) => video.removeEventListener(name, handler),
    ready: () => Promise.resolve(),
    setMuted: value => { video.muted = value; return Promise.resolve(); },
    setVolume: value => { video.volume = value; return Promise.resolve(); },
    play: () => video.play(),
    pause: () => video.pause(),
    destroy() {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  };
}

function initProjectVideos(root, options = {}) {
  const frames = [...root.querySelectorAll('[data-project-native-src]')]
    .filter(frame => !frame.closest('[hidden]'));
  if (!frames.length) return () => {};
  let disposed = false;
  const cleanups = [];
  const audioEntries = [];
  let pageMuted = options.audioState?.muted ?? true;
  let audible = null;
  let preferred = null;
  let audioRevision = 0;
  let audioQueue = Promise.resolve();
  const detailFrames = frames.filter(frame => options.index || frame.parentElement.hasAttribute('data-project-detail-video'));
  const soundButton = options.soundButton || (detailFrames.length ? document.createElement('button') : null);
  const updateSoundLabel = () => {
    if (!soundButton || disposed) return;
    soundButton.textContent = pageMuted ? '(Sound)' : '(Mute)';
    soundButton.setAttribute('aria-label', pageMuted ? 'Enable project video sound' : 'Mute project videos');
    soundButton.setAttribute('aria-pressed', String(!pageMuted));
  };
  // Serialize handoffs: the previous player must confirm mute before another can unmute.
  const syncAudio = () => {
    if (!soundButton || disposed) return;
    if (options.audioState) pageMuted = options.audioState.muted;
    const revision = ++audioRevision;
    audioQueue = audioQueue.then(async () => {
      if (disposed || revision !== audioRevision) return;
      const candidates = document.hidden ? [] : audioEntries.filter(entry => entry.relevant());
      candidates.sort((a, b) => {
        const distance = entry => {
          const rect = entry.box.getBoundingClientRect();
          return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);
        };
        return distance(a) - distance(b);
      });
      const target = pageMuted ? null : candidates.includes(preferred) ? preferred : candidates[0];
      if (audible === (target || null)) return;
      if (audible) {
        await audible.player.setMuted(true);
        audible = null;
      }
      if (disposed || revision !== audioRevision || !target) return;
      // All other players stay muted, including newly mounted and offscreen players.
      await target.player.setVolume(1);
      if (disposed || revision !== audioRevision) return;
      audible = target;
      await target.player.setMuted(false);
    }).catch(async () => {
      if (disposed) return;
      // A rejected mute must not leave audio playing under a '(Sound)' label.
      if (audible) {
        try { await audible.player.pause(); } catch { /* Keep ownership until mute succeeds. */ }
      }
      if (disposed) return;
      pageMuted = true;
      if (options.audioState) options.audioState.muted = true;
      updateSoundLabel();
      soundButton.title = 'Audio change failed. Click to retry.';
      // Retain audible on failure so the next handoff must retry muting it.
    });
  };
  const positionAudioControls = () => {
    if (!soundButton || disposed) return;
    const sound = soundButton.getBoundingClientRect();
    const soundTop = sound.bottom - Math.max(44, sound.height);
    for (const frame of detailFrames) {
      const button = frame.parentElement.querySelector('.project-video-toggle');
      if (!button) continue;
      const rect = button.getBoundingClientRect();
      const bottom = rect.bottom + Number(button.dataset.controlLift || 0);
      const overlaps = rect.width && rect.right > sound.right - Math.max(44, sound.width) &&
        rect.left < sound.right && bottom > soundTop && bottom - Math.max(44, rect.height) < sound.bottom;
      const lift = overlaps ? Math.max(0, bottom - soundTop + 8) : 0;
      button.dataset.controlLift = String(lift);
      button.style.setProperty('--project-control-lift', `${lift}px`);
    }
  };
  const onAudioScroll = () => { preferred = null; syncAudio(); positionAudioControls(); };
  if (options.soundButton) {
    soundButton.addEventListener('audiochange', syncAudio);
    document.addEventListener('visibilitychange', syncAudio);
    cleanups.push(() => {
      soundButton.removeEventListener('audiochange', syncAudio);
      document.removeEventListener('visibilitychange', syncAudio);
    });
  } else if (soundButton) {
    soundButton.className = 'detail-sound-control';
    soundButton.type = 'button';
    updateSoundLabel();
    (root.querySelector('.detail') || root).append(soundButton);
    const sound = event => {
      event.preventDefault();
      event.stopPropagation();
      pageMuted = !pageMuted;
      soundButton.removeAttribute('title');
      updateSoundLabel();
      syncAudio();
      positionAudioControls();
    };
    soundButton.addEventListener('click', sound);
    window.addEventListener('scroll', onAudioScroll, {passive: true});
    window.addEventListener('resize', onAudioScroll);
    document.addEventListener('visibilitychange', syncAudio);
    cleanups.push(() => {
      soundButton.removeEventListener('click', sound);
      window.removeEventListener('scroll', onAudioScroll);
      window.removeEventListener('resize', onAudioScroll);
      document.removeEventListener('visibilitychange', syncAudio);
      soundButton.remove();
    });
  }

  const unavailable = (frame, button) => {
    if (disposed || !globalThis.document?.body) return;
    frame.style.visibility = 'hidden';
    frame.parentElement.removeAttribute('data-video-ready');
    if (button) {
      button.disabled = true;
      button.textContent = '(Play)';
      button.title = 'Video unavailable. Reload to retry.';
      button.setAttribute('aria-label', 'Video unavailable. Reload to retry.');
    }
  };
  const mount = frames => {
    if (disposed) return;
    for (const frame of frames) {
      const box = frame.parentElement;
      const button = box.querySelector('.project-video-toggle');
      const detail = options.index || box.hasAttribute('data-project-detail-video');
      const detailAutoplay = detail && (options.index || box.dataset.playback === 'autoplay');

      {
        frame.muted = detail || box.dataset.playback === 'autoplay';
        if (detail) frame.autoplay = detailAutoplay;
        frame.style.visibility = 'hidden';
      }
      frame.src = frame.dataset.projectNativeSrc;
      const player = nativeProjectPlayer(frame);
      let playing = false;
      let busy = false;
      const observer = new ResizeObserver(() => { positionAudioControls(); });
      observer.observe(box);
      const update = value => {
        if (disposed) return;
        const changed = playing !== value;
        playing = value;
        if (detail) {
          box.dataset.videoPlaying = String(value);
        }
        if (detail && changed) syncAudio();
        if (button) {
          button.textContent = value ? '(Pause)' : '(Play)';
          button.removeAttribute('title');
          button.setAttribute('aria-label', `${value ? 'Pause' : 'Play'} video`);
        }
      };
      const onPlay = () => {
        if (disposed) return;
        if (detail && (document.hidden || !inView || frame.closest('[hidden]'))) {
          Promise.resolve(player.pause()).catch(() => {});
          return;
        }
        frame.style.visibility = '';
        update(true);
      };
      const onPause = () => update(false);
      const onError = () => {
        if (detail) { ready = false; update(false); }
        unavailable(frame, button);
      };
      player.on('play', onPlay);
      player.on('pause', onPause);
      player.on('ended', onPause);
      player.on('error', onError);
      const toggle = async event => {
        event.preventDefault();
        event.stopPropagation();
        if (busy || disposed || (detail && (!ready || !inView || document.hidden))) return;
        if (detail && !playing) preferred = audioEntry;
        busy = true;
        try {
          // Do not change the label until the player confirms the actual player state.
          await (playing ? player.pause() : player.play());
        } catch {
          if (!disposed) button.title = 'Playback failed. Press Play to retry.';
        } finally { busy = false; }
      };
      button?.addEventListener('click', toggle);
      let inView = !detail || !globalThis.IntersectionObserver;
      const autoplay = detail ? detailAutoplay : box.dataset.playback === 'autoplay';
      let ready = !detail;
      const audioEntry = {player, box, relevant: () => ready && playing && inView && !frame.closest('[hidden]')};
      if (detail) audioEntries.push(audioEntry);
      const syncPlayback = () => {
        if (disposed || !ready) return;
        if (document.hidden || !inView || frame.closest('[hidden]')) Promise.resolve(player.pause()).catch(() => {});
        else if (autoplay) Promise.resolve(player.play()).catch(() => {});
      };
      const metadata = () => {
        if (disposed || !frame.videoWidth || !frame.videoHeight) return;
        box.style.setProperty('--video-ratio', String(frame.videoWidth / frame.videoHeight));

      };
      let intersection;
      {
        frame.addEventListener('loadedmetadata', metadata);
        document.addEventListener('visibilitychange', syncPlayback);
        if (globalThis.IntersectionObserver) {
          intersection = new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            syncPlayback();
            if (detail) syncAudio();
          });
          intersection.observe(box);
        }
        syncPlayback();
      }
      const readyTimer = setTimeout(onError, 10000);
      player.ready().then(async () => {
        clearTimeout(readyTimer);
        if (disposed) return;

        ready = true;
        if (detail) { box.setAttribute('data-video-ready', ''); syncPlayback(); positionAudioControls(); }
        update(playing);
        if (button) button.disabled = false;
      }).catch(() => { clearTimeout(readyTimer); onError(); });
      cleanups.push(() => {
        clearTimeout(readyTimer);
        observer.disconnect();
        intersection?.disconnect();
        {
          frame.removeEventListener('loadedmetadata', metadata);
          document.removeEventListener('visibilitychange', syncPlayback);
        }
        button?.removeEventListener('click', toggle);
        box.removeAttribute('data-video-ready');
        player.off('play', onPlay);
        player.off('pause', onPause);
        player.off('ended', onPause);
        player.off('error', onError);
        // Release the native source and stop playback on route/category changes.
        Promise.resolve(player.destroy()).catch(() => {});
      });
    }
  };
  mount(frames);
  return () => {
    if (disposed) return;
    for (const entry of options.index ? audioEntries : []) {
      Promise.resolve(entry.player.setMuted(true)).catch(() => {});
      Promise.resolve(entry.player.pause()).catch(() => {});
    }
    disposed = true;
    cleanups.forEach(cleanup => cleanup());
  };
}

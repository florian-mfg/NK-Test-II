/* Shared slot controls; only Vimeo slots load the SDK. */
let projectVimeoSDK;
function loadProjectVimeoSDK() {
  if (globalThis.Vimeo?.Player) return Promise.resolve(globalThis.Vimeo);
  if (!projectVimeoSDK) {
    projectVimeoSDK = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://player.vimeo.com/api/player.js';
      const timer = setTimeout(() => finish(new Error('Vimeo SDK timeout')), 10000);
      function finish(error) {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve(globalThis.Vimeo);
      }
      script.onload = () => finish(globalThis.Vimeo?.Player ? null : new Error('Vimeo SDK unavailable'));
      script.onerror = () => finish(new Error('Vimeo SDK unavailable'));
      document.head.append(script);
    }).catch(error => { projectVimeoSDK = null; throw error; });
  }
  return projectVimeoSDK;
}

// Adapt native media to the existing event-driven Play/Pause controller.
function nativeProjectPlayer(video) {
  return {
    on: (name, handler) => video.addEventListener(name, handler),
    off: (name, handler) => video.removeEventListener(name, handler),
    ready: () => Promise.resolve(),
    getVideoWidth: () => Promise.resolve(video.videoWidth),
    getVideoHeight: () => Promise.resolve(video.videoHeight),
    play: () => video.play(),
    pause: () => video.pause(),
    destroy() {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  };
}

function initProjectVideos(root) {
  const frames = [...root.querySelectorAll('[data-project-video-src], [data-project-native-src]')]
    .filter(frame => !frame.closest('[hidden]'));
  if (!frames.length) return () => {};
  let disposed = false;
  const cleanups = [];
  const unavailable = (frame, button) => {
    if (disposed) return;
    frame.style.visibility = 'hidden';
    if (button) {
      button.disabled = true;
      button.textContent = '(Play)';
      button.title = 'Video unavailable. Reload to retry.';
      button.setAttribute('aria-label', 'Video unavailable. Reload to retry.');
    }
  };
  const mount = (frames, Player) => {
    if (disposed) return;
    for (const frame of frames) {
      const box = frame.parentElement;
      const button = box.querySelector('.project-video-toggle');
      const native = frame.hasAttribute('data-project-native-src');
      if (native) {
        frame.muted = box.dataset.playback === 'autoplay';
        frame.style.visibility = 'hidden';
      }
      frame.src = native ? frame.dataset.projectNativeSrc : frame.dataset.projectVideoSrc;
      const player = native ? nativeProjectPlayer(frame) : new Player(frame);
      let ratio = 16 / 9;
      let playing = false;
      let busy = false;
      const fit = () => {
        if (disposed || native) return;
        const {width, height} = box.getBoundingClientRect();
        if (!width || !height) return;
        frame.style.width = `${Math.max(width, height * ratio)}px`;
        frame.style.height = `${Math.max(height, width / ratio)}px`;
      };
      const observer = new ResizeObserver(fit);
      observer.observe(box);
      const update = value => {
        if (disposed) return;
        playing = value;
        if (button) {
          button.textContent = value ? '(Pause)' : '(Play)';
          button.removeAttribute('title');
          button.setAttribute('aria-label', `${value ? 'Pause' : 'Play'} video`);
        }
      };
      const onPlay = () => { if (native && !disposed) frame.style.visibility = ''; update(true); };
      const onPause = () => update(false);
      const onError = () => unavailable(frame, button);
      player.on('play', onPlay);
      player.on('pause', onPause);
      player.on('ended', onPause);
      player.on('error', onError);
      const toggle = async event => {
        event.preventDefault();
        event.stopPropagation();
        if (busy || disposed) return;
        busy = true;
        try {
          // Do not change the label until the player confirms the actual player state.
          await (playing ? player.pause() : player.play());
        } catch {
          if (!disposed) button.title = 'Playback failed. Press Play to retry.';
        } finally { busy = false; }
      };
      button?.addEventListener('click', toggle);
      let inView = true;
      const autoplay = native && box.dataset.playback === 'autoplay';
      const syncPlayback = () => {
        if (disposed) return;
        if (document.hidden || !inView || frame.closest('[hidden]')) player.pause();
        else if (autoplay) player.play().catch(() => {});
      };
      const metadata = () => {
        if (disposed || !frame.videoWidth || !frame.videoHeight) return;
        ratio = frame.videoWidth / frame.videoHeight;
        box.style.setProperty('--video-ratio', String(ratio));
        fit();
      };
      let intersection;
      if (native) {
        frame.addEventListener('loadedmetadata', metadata);
        document.addEventListener('visibilitychange', syncPlayback);
        if (globalThis.IntersectionObserver) {
          intersection = new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            syncPlayback();
          });
          intersection.observe(box);
        }
        syncPlayback();
      }
      const readyTimer = setTimeout(onError, 10000);
      player.ready().then(async () => {
        clearTimeout(readyTimer);
        if (disposed) return;
        if (!native) frame.style.visibility = '';
        update(playing);
        if (button) button.disabled = false;
        try {
          const [width, height] = await Promise.all([player.getVideoWidth(), player.getVideoHeight()]);
          if (disposed) return;
          if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            ratio = width / height;
            box.style.setProperty('--video-ratio', String(ratio));
          }
        } catch { /* Keep 16:9 if dimensions are unavailable. */ }
        fit();
      }).catch(() => { clearTimeout(readyTimer); onError(); });
      fit();
      cleanups.push(() => {
        clearTimeout(readyTimer);
        observer.disconnect();
        intersection?.disconnect();
        if (native) {
          frame.removeEventListener('loadedmetadata', metadata);
          document.removeEventListener('visibilitychange', syncPlayback);
        }
        button?.removeEventListener('click', toggle);
        player.off('play', onPlay);
        player.off('pause', onPause);
        player.off('ended', onPause);
        player.off('error', onError);
        // destroy removes the iframe and stops playback on route/category changes.
        Promise.resolve(player.destroy()).catch(() => {});
      });
    }
  };
  mount(frames.filter(frame => frame.hasAttribute('data-project-native-src')));
  const vimeoFrames = frames.filter(frame => frame.hasAttribute('data-project-video-src'));
  if (vimeoFrames.length) loadProjectVimeoSDK().then(({Player}) => mount(vimeoFrames, Player))
    .catch(() => vimeoFrames.forEach(frame => unavailable(frame, frame.parentElement.querySelector('.project-video-toggle'))));
  return () => {
    if (disposed) return;
    disposed = true;
    cleanups.forEach(cleanup => cleanup());
  };
}

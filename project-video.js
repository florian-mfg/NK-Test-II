/* Only project Vimeo slots use this controller; Home/Info never load the SDK. */
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

function initProjectVideos(root) {
  const frames = [...root.querySelectorAll('[data-project-video-src]')]
    .filter(frame => !frame.closest('[hidden]'));
  if (!frames.length) return () => {};
  let disposed = false;
  const cleanups = [];
  const unavailable = (frame, button) => {
    if (disposed) return;
    frame.style.visibility = 'hidden';
    if (button) {
      button.disabled = true;
      button.querySelector('img').setAttribute('src', 'material/play.svg');
      button.title = 'Video unavailable. Reload to retry.';
      button.setAttribute('aria-label', 'Video unavailable. Reload to retry.');
    }
  };
  loadProjectVimeoSDK().then(({Player}) => {
    if (disposed) return;
    for (const frame of frames) {
      const box = frame.parentElement;
      const button = box.querySelector('.project-video-toggle');
      frame.src = frame.dataset.projectVideoSrc;
      const player = new Player(frame);
      let ratio = 16 / 9;
      let playing = false;
      let busy = false;
      const fit = () => {
        if (disposed) return;
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
          button.querySelector('img').setAttribute('src', value ? 'material/pause.svg' : 'material/play.svg');
          button.removeAttribute('title');
          button.setAttribute('aria-label', `${value ? 'Pause' : 'Play'} ${frame.title}`);
        }
      };
      const onPlay = () => update(true);
      const onPause = () => update(false);
      const onError = () => unavailable(frame, button);
      player.on('play', onPlay);
      player.on('pause', onPause);
      player.on('ended', onPause);
      player.on('error', onError);
      const toggle = async () => {
        if (busy || disposed) return;
        busy = true;
        try {
          // Do not change the label until Vimeo confirms the actual player state.
          await (playing ? player.pause() : player.play());
        } catch {
          if (!disposed) button.title = 'Playback failed. Press Play to retry.';
        } finally { busy = false; }
      };
      button?.addEventListener('click', toggle);
      const readyTimer = setTimeout(onError, 10000);
      player.ready().then(async () => {
        clearTimeout(readyTimer);
        if (disposed) return;
        frame.style.visibility = '';
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
        button?.removeEventListener('click', toggle);
        player.off('play', onPlay);
        player.off('pause', onPause);
        player.off('ended', onPause);
        player.off('error', onError);
        // destroy removes the iframe and stops playback on route/category changes.
        Promise.resolve(player.destroy()).catch(() => {});
      });
    }
  }).catch(() => frames.forEach(frame => unavailable(frame, frame.parentElement.querySelector('.project-video-toggle'))));
  return () => {
    if (disposed) return;
    disposed = true;
    cleanups.forEach(cleanup => cleanup());
  };
}

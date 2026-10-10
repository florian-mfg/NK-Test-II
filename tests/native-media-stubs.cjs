exports.installNativeMediaStubs = (window, players = []) => {
  const state = new WeakMap();
  const get = video => {
    if (!state.has(video)) {const player = {frame: video, calls: []}; state.set(video, player); players.push(player);}
    return state.get(video);
  };
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype, 'src');
  Object.defineProperty(window.HTMLMediaElement.prototype, 'src', {
    get: descriptor.get, set(value) {get(this); descriptor.set.call(this, value);}
  });
  window.HTMLMediaElement.prototype.play = function() {get(this).calls.push('play');this.dispatchEvent(new window.Event('play'));return Promise.resolve();};
  window.HTMLMediaElement.prototype.pause = function() {get(this).calls.push('pause');this.dispatchEvent(new window.Event('pause'));};
  window.HTMLMediaElement.prototype.load = function() {get(this).calls.push('destroy');};
  return players;
};

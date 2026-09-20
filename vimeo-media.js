/* Shared URL contract for Studio, the public adapter and project rendering. */
(function (root) {
  'use strict';
  function parseVimeoUrl(value) {
    if (typeof value !== 'string' || /[\r\n]/.test(value)) return null;
    try {
      const url = new URL(value.trim());
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      const match = /^(?:www\.)?vimeo\.com$/.test(url.hostname)
        ? url.pathname.match(/^\/([1-9]\d*)(?:\/([a-zA-Z0-9]+))?\/?$/)
        : url.hostname === 'player.vimeo.com' ? url.pathname.match(/^\/video\/([1-9]\d*)\/?$/) : null;
      if (!match) return null;
      const hashes = url.searchParams.getAll('h');
      if (hashes.length > 1 || (hashes.length && !/^[a-zA-Z0-9]+$/.test(hashes[0]))) return null;
      const hash = hashes[0] || match[2];
      const embed = new URL(`https://player.vimeo.com/video/${match[1]}`);
      if (hash) embed.searchParams.set('h', hash);
      // Keep the original URL for diagnostics. Only the privacy hash reaches the
      // player; pasted playback/UI parameters cannot override the rendering mode.
      return {type: 'vimeo', src: url.href, id: match[1], embedUrl: embed.href};
    } catch { return null; }
  }
  const api = Object.freeze({parseVimeoUrl});
  root.VimeoMedia = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

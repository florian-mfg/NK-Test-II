/* Local ordered media data. Replace this array with normalized CMS media later. */
(function (root) {
  'use strict';
  const dimensions = {
    'DSCF6919.jpg': [640, 480],
    'Mountain_v20003.jpg': [360, 480],
    '_DSF0857.jpg': [720, 480],
    'Stone_Artefakt_9.jpg': [360, 480],
    'Iceland25_Echo.jpg': [888, 480],
    'DSCF2880.jpg': [320, 480],
    'MA_GD_Tanzartefakt_7.jpg': [480, 480],
    '_DSF2669.jpg': [720, 480],
    'Stone_Conserve_Blau_RZ_v2.jpg': [400, 480],
    'DSCF1339.jpg': [854, 480],
    'DSCF6978.jpg': [384, 480],
    'TextureBump_ARC_W_RZ.jpg': [432, 480],
    '_DSF3392.jpg': [720, 480],
    'DSCF7780.jpg': [360, 480],
    'Strommast_Sundown_RZ.jpg': [720, 480],
    '_DSF5795.jpg': [320, 480],
    'MountainRange_raw.jpg': [384, 480],
    '_DSF4139.jpg': [720, 480],
    'DSCF7807.jpg': [384, 480],
    '_DSF6111.jpg': [720, 480],
  };
  const media = [
    'DSCF6919.jpg', 'Mountain_v20003.jpg', '_DSF0857.jpg', 'Stone_Artefakt_9.jpg',
    'Iceland25_Echo.jpg', 'DSCF2880.jpg', 'MA_GD_Tanzartefakt_7.jpg', '_DSF2669.jpg',
    'Stone_Conserve_Blau_RZ_v2.jpg', 'DSCF1339.jpg', 'DSCF6978.jpg', 'TextureBump_ARC_W_RZ.jpg',
    '_DSF3392.jpg', 'DSCF7780.jpg', 'Strommast_Sundown_RZ.jpg', '_DSF5795.jpg',
    'MountainRange_raw.jpg', '_DSF4139.jpg', 'DSCF7807.jpg', '_DSF6111.jpg'
  ].map(file => ({type: 'image', src: `material/${file}`, aspectRatio: dimensions[file][0] / dimensions[file][1]}));
  root.FrontpageMedia = media;
  if (typeof module !== 'undefined' && module.exports) module.exports = media;
})(typeof globalThis !== 'undefined' ? globalThis : this);

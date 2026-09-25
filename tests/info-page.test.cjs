'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('../studio/node_modules/jsdom');
const adapter = require('../sanity-data.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const doc = (type, fields = {}) => ({_id: type, _type: type, ...fields});
function content(extra = {}) {
  return adapter.normalize({projects: [], siteSettings: doc('siteSettings', {brandName: 'CMS Brand', email: 'published@example.com'}),
    infoPage: doc('infoPage', {introduction: 'Berliner Boy', work: ['Eps51'], skills: ['Tattooboss'], contactLinks: [{label: 'Email', destination: 'email'}]}), ...extra});
}

function setup(hash = '#info', mobile = false) {
  const dom = new JSDOM(read('index.html'), {url: `https://example.com/portfolio/${hash}`, runScripts: 'outside-only', pretendToBeVisual: true});
  const {window} = dom;
  const scrollCalls = [];
  window.scrollTo = (x, y) => {scrollCalls.push([x, y]); window.scrollY = y;};
  const breakpoint = new window.EventTarget();
  breakpoint.matches = mobile;
  window.matchMedia = () => breakpoint;
  window.ResizeObserver = class {observe() {}};
  window.HTMLCanvasElement.prototype.getContext = () => ({measureText: text => ({width: text.length * 50, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 50})});
  Object.defineProperty(window.document, 'fonts', {value: {ready: Promise.resolve(), addEventListener() {}}});
  const dialog = window.document.querySelector('.mobile-menu');
  dialog.close = () => {dialog.open = false;};
  dialog.showModal = () => {dialog.open = true;};
  let resolve, reject, requests = 0;
  const pending = new Promise((yes, no) => {resolve = yes; reject = no;});
  window.SanityData = {load: () => {requests++; return pending;}};
  for (const file of ['projects.js', 'vimeo-media.js', 'project-modules.js', 'project-video.js', 'app.js']) vm.runInContext(read(file), dom.getInternalVMContext());
  window.fitWorkMenu();
  const flush = () => new Promise(yes => setImmediate(yes));
  return {window, dom, scrollCalls, setMobile: value => {breakpoint.matches = value; breakpoint.dispatchEvent(new window.Event('change'));}, requests: () => requests, reject: async () => {reject(new Error('offline')); await flush();},
    settle: async result => {resolve(result); await flush();}};
}
const success = data => ({ok: true, data, error: null});

test('Info Contact links only Site Settings values, leaving labels plain and opening only Instagram in a new tab', async () => {
  const app = setup();
  try {
    const check = (email, instagram) => {
      const root = app.window.document.querySelector('.info-contact');
      const mail = root.querySelector('a[href^="mailto:"]');
      const social = root.querySelector('a[href^="https:"]');
      assert.equal(mail.href, email);
      assert.equal(mail.hasAttribute('target'), false);
      assert.equal(mail.hasAttribute('rel'), false);
      assert.equal(social.href, instagram);
      assert.equal(social.target, '_blank');
      assert.equal(social.rel, 'noopener noreferrer');
      assert.equal(mail.textContent, 'published@example.com');
      assert.equal(social.textContent, 'example');
      assert.equal(mail.previousSibling.textContent, 'Mail: ');
      assert.equal(social.previousSibling.textContent, 'Instagram: ');
      assert.equal(root.querySelector('p').textContent, 'Mail: published@example.comInstagram: exampleCall');
    };
    assert.equal(app.window.document.querySelector('.info-contact a'), null, 'No hardcoded contacts before Site Settings loads');
    await app.settle(success(content({
      siteSettings: doc('siteSettings', {email: 'published@example.com', instagram: 'https://www.instagram.com/example/', phone: '+49301234567'}),
      infoPage: doc('infoPage', {contactLinks: [
        {label: 'Email', destination: 'email'}, {label: 'Social', destination: 'instagram'}, {label: 'Call', destination: 'phone'},
      ]}),
    })));
    check('mailto:published@example.com', 'https://www.instagram.com/example/');
    const phone = app.window.document.querySelector('.info-contact a[href^="tel:"]');
    assert.equal(phone.href, 'tel:+49301234567');
    assert.equal(phone.hasAttribute('target'), false);
    assert.equal(phone.hasAttribute('rel'), false);
    app.window.renderInfo();
    check('mailto:published@example.com', 'https://www.instagram.com/example/');
  } finally {app.dom.window.close();}
});

test('Info updates only existing paragraphs and respects published empty arrays', async () => {
  const app = setup();
  try {
    const {document} = app.window;
    const root = document.querySelector('.info');
    const wrappers = [...root.querySelectorAll('section, div, h2, p')];
    const header = document.querySelector('.main-nav').outerHTML;
    const menu = document.querySelector('.mobile-menu nav').outerHTML;
    const scrollCount = app.scrollCalls.length;
    await app.settle(success(content()));
    assert.equal(document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.equal(document.querySelector('.info-work p').textContent, 'Eps51');
    assert.equal(document.querySelector('.info-skills p').textContent, 'Tattooboss');
    assert.equal(document.querySelector('.info-cv p').innerHTML, '');
    assert.equal(document.querySelector('.info-clients p').innerHTML, '');
    assert.equal(document.querySelector('.info-contact a').href, 'mailto:published@example.com');
    assert.deepEqual([...root.querySelectorAll('section, div, h2, p')], wrappers);
    assert.equal(document.querySelector('.main-nav').outerHTML, header);
    assert.equal(document.querySelector('.mobile-menu nav').outerHTML, menu);
    assert.equal(app.scrollCalls.length, scrollCount);
    assert.equal(app.requests(), 1);
    app.window.renderInfo();
    assert.equal(app.requests(), 1);
    assert.equal(document.querySelector('.info-intro').textContent, 'Berliner Boy');
  } finally {app.dom.window.close();}
});

test('failed requests and missing or malformed Info retain the exact local fallback', async () => {
  for (const result of [
    {ok: false, data: null, error: {code: 'timeout'}},
    success(content({infoPage: null})),
    success(content({infoPage: doc('infoPage', {work: 'malformed'})}))
  ]) {
    const app = setup();
    try {
      const initial = app.window.document.querySelector('.info').outerHTML;
      await app.settle(result);
      assert.equal(app.window.document.querySelector('.info').outerHTML, initial);
    } finally {app.dom.window.close();}
  }
  const app = setup();
  try {
    const initial = app.window.document.querySelector('.info').outerHTML;
    await app.reject();
    assert.equal(app.window.document.querySelector('.info').outerHTML, initial);
  } finally {app.dom.window.close();}
});

test('missing settings do not invent contact destinations while published Info wins', async () => {
  const app = setup();
  try {
    const contacts = app.window.document.querySelector('.info-contact p').innerHTML;
    await app.settle(success(content({siteSettings: null})));
    assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.equal(app.window.document.querySelector('.info-work p').textContent, 'Eps51');
    assert.equal(app.window.document.querySelector('.info-skills p').textContent, 'Tattooboss');
    assert.equal(app.window.document.querySelector('.info-contact p').innerHTML, contacts);
  } finally {app.dom.window.close();}
});

test('CMS contact emptiness is respected; settings are optional when no contacts need them', async () => {
  const app = setup();
  try {
    await app.settle(success(content({siteSettings: null, infoPage: doc('infoPage', {introduction: 'Berliner Boy', contactLinks: []})})));
    assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.equal(app.window.document.querySelector('.info-contact p').innerHTML, '');
  } finally {app.dom.window.close();}
});

test('late published content wins after scrolling or focus without resetting scrolling', async () => {
  for (const interaction of ['scroll', 'focus']) {
    const app = setup();
    try {
      const section = app.window.document.querySelector('.info');
      if (interaction === 'scroll') app.window.scrollY = 150;
      else app.window.document.querySelector('.main-nav a').focus();
      const calls = app.scrollCalls.length;
      await app.settle(success(content()));
      assert.equal(app.window.document.querySelector('.info'), section);
      assert.equal(section.querySelector('.info-intro').textContent, 'Berliner Boy');
      assert.equal(section.querySelector('.info-work p').textContent, 'Eps51');
      assert.equal(section.querySelector('.info-skills p').textContent, 'Tattooboss');
      assert.equal(app.scrollCalls.length, calls);
      if (interaction === 'scroll') assert.equal(app.window.scrollY, 150);
      // A later explicit visit uses the cached snapshot, without another fetch.
      app.window.renderInfo();
      assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
      assert.equal(app.requests(), 1);
    } finally {app.dom.window.close();}
  }
});

test('other routes keep their local DOM and direct project routing during async loading', async () => {
  for (const hash of ['#home', '#imprint', '#privacy-policy']) {
    const app = setup(hash);
    try {
      const initial = app.window.document.querySelector('#app').innerHTML;
      await app.settle(success(content()));
      assert.equal(app.window.location.hash, hash);
      assert.equal(app.window.document.querySelector('#app').innerHTML, initial, hash);
      assert.equal(app.requests(), 1);
      app.window.renderInfo();
      assert.equal(app.window.document.querySelector('.info-work p').textContent, 'Eps51');
    } finally {app.dom.window.close();}
  }
});

test('navigating away from Info before completion does not render it again', async () => {
  const app = setup();
  try {
    app.window.renderHome();
    const initial = app.window.document.querySelector('#app').innerHTML;
    await app.settle(success(content()));
    assert.equal(app.window.document.querySelector('#app').innerHTML, initial);
  } finally {app.dom.window.close();}
});

test('ordered arrays and line breaks remain ordered, and CMS strings are escaped', async () => {
  const app = setup();
  try {
    await app.settle(success(content({infoPage: doc('infoPage', {introduction: '<img src=x onerror=alert(1)>',
      cv: [{period: '2025', text: 'Second'}, {period: '2020', text: 'First'}], work: ['Two', 'One\nMore'], skills: ['B', 'A'], selectedClients: ['Z', 'Y'], contactLinks: [{label: '<b>Mail</b>', destination: 'email'}]})})));
    const {document} = app.window;
    assert.equal(document.querySelector('.info-intro img'), null);
    assert.equal(document.querySelector('.info-intro').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(document.querySelector('.info-cv p').innerHTML, '2025 Second<br>2020 First');
    assert.equal(document.querySelector('.info-work p').innerHTML, 'Two<br>One<br>More');
    assert.equal(document.querySelector('.info-skills p').innerHTML, 'B<br>A');
    assert.equal(document.querySelector('.info-clients p').innerHTML, 'Z<br>Y');
    assert.equal(document.querySelector('.info-contact b'), null);
  } finally {app.dom.window.close();}
});

test('live published Info values are retrieved and rendered', {skip: !process.env.INFO_LIVE_SMOKE}, async () => {
  const result = await adapter.load();
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.data.infoPage?.introduction, 'Berliner Boy');
  assert.ok(result.data.infoPage?.work.includes('Eps51'));
  assert.ok(result.data.infoPage?.skills.includes('Tattooboss'));
  assert.equal(result.data.siteSettings?.brandName, 'Nicolas Kawohl');
  assert.ok(result.data.siteSettings?.contacts.email);
  const app = setup();
  try {
    await app.settle(result);
    assert.equal(app.window.document.querySelector('.info-intro').textContent, 'Berliner Boy');
    assert.ok(app.window.document.querySelector('.info-work p').textContent.includes('Eps51'));
    assert.ok(app.window.document.querySelector('.info-skills p').textContent.includes('Tattooboss'));
  } finally {app.dom.window.close();}
});

const labelFields = ['cvLabel', 'workLabel', 'skillsLabel', 'contactLabel', 'selectedClientsLabel'];
const defaultLabels = ['CV', 'Work', 'Skills', 'Contact', 'Selected Clients'];

const legacyOrder = ['cv', 'work', 'skills', 'contactLinks', 'selectedClients'];
const defaultOrder = ['cv', 'work', 'skills', 'news', 'publications', 'contactLinks', 'selectedClients'];
const savedOrder = ids => ids.map(section => ({section}));

test('Info ordering defaults and defensive normalization preserve every existing section', () => {
  for (const sectionOrder of [undefined, null, [], 'invalid']) {
    const data = content({infoPage: doc('infoPage', {sectionOrder})});
    assert.deepEqual(data.infoPage.sectionOrder, defaultOrder);
    assert.equal(data.infoPage.additionalIntroduction, '');
    assert.equal(data.issues.length, 0);
  }
  const data = content({infoPage: doc('infoPage', {
    sectionOrder: savedOrder(['work', 'work', 'unknown', 'cv']), work: ['Unchanged'],
  })});
  assert.deepEqual(data.infoPage.sectionOrder, ['work', 'cv', 'skills', 'news', 'publications', 'contactLinks', 'selectedClients']);
  assert.deepEqual(data.infoPage.work, ['Unchanged']);
  assert.equal(data.issues.length, 0);
  assert.match(adapter.query, /additionalIntroduction,sectionOrder\[\]\{section\}/);
});

test('legacy section orders keep Clients right on desktop and preserve labels and contacts', async () => {
  // A legacy order can move Clients in the list without changing its desktop column.
  for (const order of [legacyOrder, ['work', 'cv', 'selectedClients', 'skills', 'contactLinks']]) {
    const app = setup();
    try {
      const root = app.window.document.querySelector('.info');
      const selectors = ['.info-cv', '.info-work', '.info-skills', '.info-contact', '.info-clients'];
      const original = Object.fromEntries(legacyOrder.map((id, index) => [id, root.querySelector(selectors[index])]));
      const fields = Object.fromEntries(labelFields.map((field, index) => [field, `Custom ${index}`]));
      await app.settle(success(content({infoPage: doc('infoPage', {...fields, sectionOrder: savedOrder(order),
        contactLinks: [{label: 'Write', destination: 'email'}]})})));
      const desktopOrder = [...order.filter(id => id !== 'selectedClients'), 'selectedClients'];
      assert.deepEqual([...root.querySelectorAll('h2')].map(node => node.textContent), desktopOrder.map(id => `Custom ${legacyOrder.indexOf(id)}`));
      assert.deepEqual([...root.querySelector('.info-details').children], desktopOrder.slice(0, 4).map(id => original[id]));
      assert.equal(root.querySelector('.info-side-section'), original.selectedClients);
      assert.equal(root.querySelector('.info-contact a').href, 'mailto:published@example.com');
      assert.equal(root.querySelectorAll('.info-columns > .info-column').length, 2);
      app.window.renderInfo();
      assert.deepEqual([...app.window.document.querySelectorAll('.info h2')].map(node => node.textContent), desktopOrder.map(id => `Custom ${legacyOrder.indexOf(id)}`));
    } finally {app.dom.window.close();}
  }
});

test('additional introduction follows the biography with escaped text and the same line-break support', async () => {
  const app = setup();
  try {
    await app.settle(success(content({infoPage: doc('infoPage', {
      introduction: 'Biography', additionalIntroduction: 'More\n<b>Plain text</b>',
    })})));
    const intro = app.window.document.querySelector('.info-intro');
    const extra = app.window.document.querySelector('.info-additional-intro');
    assert.equal(intro.textContent, 'Biography');
    assert.equal(intro.nextElementSibling, extra);
    assert.equal(extra.innerHTML, 'More<br>&lt;b&gt;Plain text&lt;/b&gt;');
    assert.equal(extra.nextElementSibling.className, 'info-columns');
    app.window.applySanityInfo();
    assert.equal(app.window.document.querySelectorAll('.info-additional-intro').length, 1);
  } finally {app.dom.window.close();}
});

test('optional News and Publications omit empty headings, preserve entry order and safely render links', async () => {
  for (const id of ['news', 'publications']) {
    for (const value of [undefined, null, [], [{title: ' '}]]) {
      const app = setup();
      try {
        await app.settle(success(content({infoPage: doc('infoPage', {[id]: value})})));
        assert.equal(app.window.document.querySelector(`.info-${id}`), null);
        assert.deepEqual([...app.window.document.querySelectorAll('.info h2')].map(n => n.textContent), defaultLabels);
      } finally {app.dom.window.close();}
    }
    const app = setup();
    try {
      const entries = [
        {title: 'Second', additionalInfo: '2026', url: 'https://example.com/article?q=1&lang=en'},
        {title: '<b>First</b>', additionalInfo: 'Opening\nOctober'},
        {title: 'Unsafe', url: 'javascript:alert(1)'},
        {title: 'Credentials', url: 'https://user:pass@example.com/'},
      ];
      const raw = doc('infoPage', {[id]: entries, [`${id}Label`]: '<b>Custom heading</b>'});
      const before = JSON.stringify(raw);
      await app.settle(success(content({infoPage: raw})));
      assert.equal(JSON.stringify(raw), before);
      const section = app.window.document.querySelector(`.info-details .info-${id}`);
      assert.ok(section);
      assert.equal(section.querySelector('h2').textContent, '<b>Custom heading</b>');
      assert.equal(section.querySelector('b'), null);
      assert.equal(section.querySelectorAll('a').length, 1);
      assert.equal(section.querySelector('a').href, entries[0].url);
      assert.equal(section.querySelector('a').target, '_blank');
      assert.equal(section.querySelector('a').rel, 'noopener noreferrer');
      assert.equal(section.querySelector('p').innerHTML, '<a href="https://example.com/article?q=1&amp;lang=en" target="_blank" rel="noopener noreferrer">Second 2026</a><br>&lt;b&gt;First&lt;/b&gt; Opening<br>October<br>Unsafe<br>Credentials');
      app.window.renderInfo();
      assert.equal(app.window.document.querySelectorAll(`.info-${id}`).length, 1);
    } finally {app.dom.window.close();}
  }
});

test('seven-section order pins Clients on desktop, follows the saved sequence on mobile and survives resizing', async () => {
  const order = ['publications', 'selectedClients', 'work', 'news', 'cv', 'skills', 'contactLinks'];
  const labels = {cv: 'CV', work: 'Work', skills: 'Skills', news: 'Updates', publications: 'Books', contactLinks: 'Contact', selectedClients: 'Selected Clients'};
  for (const mobile of [false, true]) {
    const app = setup('#info', mobile);
    try {
      await app.settle(success(content({infoPage: doc('infoPage', {
        sectionOrder: savedOrder(order), newsLabel: 'Updates', publicationsLabel: 'Books',
        news: [{title: 'A'}, {title: 'B'}], publications: [{title: 'Book', url: 'http://example.com/book'}],
        cv: [{period: '2026', text: 'CV content'}], work: ['Work content'], skills: ['Skill'],
        contactLinks: [{label: 'Write', destination: 'email'}],
      })})));
      const check = isMobile => {
        const root = app.window.document.querySelector('.info');
        const expected = isMobile ? order : [...order.filter(id => id !== 'selectedClients'), 'selectedClients'];
        assert.deepEqual([...root.querySelectorAll('h2')].map(n => n.textContent), expected.map(id => labels[id]));
        if (!isMobile) {
          assert.ok(root.querySelector('.info-details > .info-news'));
          assert.ok(root.querySelector('.info-details > .info-publications'));
          assert.ok(root.querySelector('.info-columns > .info-clients.info-side-section'));
        }
        assert.equal(root.querySelector('.info-cv p').textContent, '2026 CV content');
        assert.equal(root.querySelector('.info-work p').textContent, 'Work content');
        assert.equal(root.querySelector('.info-contact a').href, 'mailto:published@example.com');
      };
      check(mobile);
      app.setMobile(!mobile); check(!mobile);
      app.setMobile(mobile); check(mobile);
      const oldRoot = app.window.document.querySelector('.info');
      app.window.location.hash = '#home'; app.window.route();
      const oldMarkup = oldRoot.outerHTML;
      app.setMobile(!mobile);
      assert.equal(oldRoot.outerHTML, oldMarkup, 'Info listener is removed on navigation');
    } finally {app.dom.window.close();}
  }
});

test('new labels default independently and legacy saved orders gain optional identifiers without mutation', () => {
  const raw = doc('infoPage', {sectionOrder: savedOrder(legacyOrder), newsLabel: ' ', publicationsLabel: null});
  const before = JSON.stringify(raw);
  const info = content({infoPage: raw}).infoPage;
  assert.equal(info.newsLabel, 'News'); assert.equal(info.publicationsLabel, 'Publications');
  assert.deepEqual(info.sectionOrder, [...legacyOrder, 'news', 'publications']);
  assert.deepEqual(info.news, []); assert.deepEqual(info.publications, []);
  assert.equal(JSON.stringify(raw), before);
  assert.match(adapter.query, /news\[\]\{title,additionalInfo,url\}/);
  assert.match(adapter.query, /publications\[\]\{title,additionalInfo,url\}/);
});

test('absent, empty and whitespace additional introduction create no extra DOM or spacing', async () => {
  for (const additionalIntroduction of [undefined, null, '', ' \n ']) {
    const app = setup();
    try {
      await app.settle(success(content({infoPage: doc('infoPage', {additionalIntroduction})})));
      const root = app.window.document.querySelector('.info');
      assert.equal(root.querySelector('.info-additional-intro'), null);
      assert.equal(root.querySelector('.info-intro').nextElementSibling.className, 'info-columns');
    } finally {app.dom.window.close();}
  }
});

test('custom Info labels render as plain text in existing headings and survive revisiting', async () => {
  const app = setup();
  try {
    const labels = ['Experience', 'Work Experience', 'Expertise', 'Get in touch', '<b>Clients</b>'];
    const fields = Object.fromEntries(labelFields.map((field, index) => [field, labels[index]]));
    const root = app.window.document.querySelector('.info');
    const nodes = [...root.querySelectorAll('*')];
    const otherContent = app.window.document.querySelector('.main-nav').outerHTML;
    const info = content().infoPage;
    await app.settle(success(content({infoPage: doc('infoPage', {...info, ...fields})})));
    assert.deepEqual([...root.querySelectorAll('h2')].map(node => node.textContent), labels);
    assert.equal(root.querySelector('h2 b'), null);
    // Existing headings, columns and paragraphs retain their identity.
    for (const node of nodes.filter(node => node.matches('section, div, h2, p'))) assert.ok(root.contains(node));
    assert.equal(root.querySelector('.info-work p').textContent, 'Eps51');
    assert.equal(root.querySelector('.info-skills p').textContent, 'Tattooboss');
    assert.equal(root.querySelector('.info-contact a').href, 'mailto:published@example.com');
    assert.equal(app.window.document.querySelector('.main-nav').outerHTML, otherContent);
    app.window.renderInfo();
    assert.deepEqual([...app.window.document.querySelectorAll('.info h2')].map(node => node.textContent), labels);
  } finally {app.dom.window.close();}
});

test('absent, undefined, null, empty and whitespace labels use defaults without filling empty content', async () => {
  for (const value of ['absent', undefined, null, '', '   ']) {
    const app = setup();
    try {
      const fields = value === 'absent' ? {} : Object.fromEntries(labelFields.map(field => [field, value]));
      await app.settle(success(content({infoPage: doc('infoPage', {...fields,
        introduction: '', cv: [], work: [], skills: [], contactLinks: [], selectedClients: []})})));
      const root = app.window.document.querySelector('.info');
      assert.deepEqual([...root.querySelectorAll('h2')].map(node => node.textContent), defaultLabels);
      assert.ok([...root.querySelectorAll('p')].every(node => node.innerHTML === ''));
    } finally {app.dom.window.close();}
  }
});

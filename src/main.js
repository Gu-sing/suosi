import { initSimulation } from './simulation.js';
import { createMemberModal, assetUrl } from './ui.js';

const repo = 'https://github.com/Source-of-USTB/2026-registration';
const paths = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  shuffle: '<path d="m17 3 4 4-4 4M3 17l5-5M3 7h4l10 10h4M14 7h7M17 13l4 4-4 4"/>',
  gravity: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  flag: '<path d="M5 21V3m0 1c5-5 9 5 14 0v10c-5 5-9-5-14 0"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  view: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h8"/>',
  merge: '<circle cx="6" cy="7" r="3"/><circle cx="17" cy="6" r="4"/><path d="m7 13 3 3m7-3-3 3"/><circle cx="12" cy="19" r="3"/>',
};
const icon = (name) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

document.querySelector('#app').innerHTML = `
  <a class="skip-link" href="#playground">跳到成员墙</a>
  <header class="site-header">
    <a class="wordmark" href="./"><img src="${import.meta.env.BASE_URL}images/Source.jpg" alt="Source"/><span>Source of USTB</span></a>
    <span class="header-divider">/</span><span class="header-title">2026 秋季招新</span>
    <div class="header-actions"><button class="header-search" id="search-members" aria-label="搜索成员">${icon('search')}<span>搜索成员…</span><kbd>/</kbd></button><a class="button button-small" href="${repo}">GitHub ${icon('arrow')}</a></div>
  </header>
  <div class="dashboard">
    <aside class="member-sidebar" aria-label="社团成员">
      <div class="community-identity"><img src="${import.meta.env.BASE_URL}images/Source.jpg" alt=""/><div><strong>Source of USTB</strong><span>北京科技大学开源技术社区</span></div></div>
      <div class="sidebar-section-title"><h2>社团成员</h2><span id="sidebar-member-count">—</span></div>
      <label class="sr-only" for="sidebar-search">查找社团成员</label><input id="sidebar-search" class="sidebar-search" placeholder="查找成员…" type="search" autocomplete="off"/>
      <div id="sidebar-members" class="sidebar-members"></div><p id="sidebar-empty" hidden>没有找到匹配成员</p>
      <div class="sidebar-links"><a href="${repo}/blob/master/docs/gitHowTo.md">Git 打卡指南 ${icon('arrow')}</a><a href="${repo}">项目仓库 ${icon('arrow')}</a></div>
    </aside>
    <div class="workspace">
      <main class="content-grid">
        <div class="main-column">
          <div class="page-heading"><div><h1>欢迎来到 Source</h1><p>在这里认识新朋友，开始你的开源之旅。</p></div><button class="button button-small" id="show-members" disabled>查看所有成员</button></div>
          <section class="playground" id="playground" aria-labelledby="arena-title">
            <div class="arena-header">
              <div class="arena-heading"><h2 id="arena-title">成员墙</h2><span id="member-count" class="member-count">—</span><span id="race-status" class="race-status" hidden>准备出发</span></div>
              <div class="arena-actions">
                <div class="tool-group" id="float-tools"><button class="button button-small" id="shuffle" disabled>${icon('shuffle')}<span>打乱</span></button><button class="button button-small" id="gravity" aria-pressed="false" disabled>${icon('gravity')}<span>重力</span></button></div>
                <button class="button button-small" id="camera" aria-pressed="false" hidden>${icon('view')}<span>查看全程</span></button>
                <button class="button icon-button" id="pause" title="暂停动画" aria-label="暂停动画" aria-pressed="false" disabled>${icon('pause')}</button>
                <button class="button icon-button" id="reset" title="重新排列" aria-label="重新排列" disabled>${icon('reset')}</button>
                <button class="button button-primary button-small" id="start-race" disabled>${icon('flag')}<span>开始下落赛</span></button><button class="button button-small" id="start-merge" disabled>${icon('merge')}<span>合成大西瓜</span></button><button class="button button-small" id="exit-race" hidden>结束比赛</button>
              </div>
            </div>
            <div class="merge-hud" id="merge-hud" hidden><div class="merge-stat"><span>本局得分</span><strong id="merge-score">0</strong></div><div class="merge-stat"><span>本机最高</span><strong id="merge-best-score">0</strong></div><div class="merge-next"><div id="merge-next-avatar"></div><div><span>下一个</span><strong id="merge-next-name">—</strong></div></div></div>
            <div class="merge-over" id="merge-over" hidden><div><strong>这一局装满啦</strong><p id="merge-over-score"></p></div><button class="button button-primary" id="merge-restart">换一组头像再来</button></div>
            <div class="canvas-wrap" id="canvas-wrap"><canvas id="world" aria-label="可拖拽的成员头像，也可通过查看所有成员按钮查看资料。"></canvas><div class="stage-message" id="stage-message" role="status">正在加载成员…</div></div>
            <div class="arena-footer"><span id="play-hint">拖动头像让它们碰撞，点击头像认识新朋友。</span><span id="race-clock" hidden>00.00 s</span><span id="arena-note">自由碰撞</span></div>
            <section class="merge-progress" id="merge-progress" aria-labelledby="merge-levels-title" hidden><div class="results-heading"><h3 id="merge-levels-title">本局合成路线</h3><span id="merge-summary">小头像 → 大西瓜</span></div><ol class="merge-levels" id="merge-levels" aria-label="头像从小到大的合成顺序"></ol></section>
            <section class="race-results" id="race-results" aria-labelledby="results-title" hidden><div class="results-heading"><h3 id="results-title">实时排名</h3><span id="race-summary">等待出发</span></div><ol class="leaderboard" id="leaderboard"></ol></section>
            <p class="sr-only" id="race-announcement" role="status" aria-live="polite"></p>
          </section>
          <div class="contribution-note">每个头像，都来自一位成员的 Pull Request。<a href="${repo}/blob/master/docs/gitHowTo.md">添加我的头像 ${icon('arrow')}</a></div>
        </div>
        <aside class="info-sidebar" aria-label="参与方式和玩法说明">
          <section class="info-card"><h2>加入 Source of USTB</h2><p>无需准备完美的作品。从一次提交开始，和大家一起学习、分享、创造。</p><ol class="join-steps"><li>Fork 项目仓库</li><li>添加头像和自我介绍</li><li>提交 Pull Request</li></ol><a class="button button-dark" href="${repo}/blob/master/docs/gitHowTo.md">查看参与指南</a></section>
          <section class="info-card"><h2 id="instructions-title">试着和大家碰个面</h2><div id="float-help"><p>拖动小球，让头像相互碰撞；点击头像，看看朋友们的介绍。</p><p>也可以开启重力、发起下落赛，或试试合成大西瓜。</p></div><div id="race-help" hidden><p>所有头像从同一片起跑区出发，沿长赛道自由下落。</p><p>弹柱、斜坡和旋转挡板会改变小球的方向。最先抵达底部终点的成员获胜。</p><p>镜头自动跟随领先者，也可以切换全程视角。</p></div><div id="merge-help" hidden><p>每局随机挑选一组成员头像，组成从小到大的合成路线。两个相同头像碰到一起，就会合成下一级。</p><p>移动鼠标后点击投放；手机上拖动瞄准、松手投放。也可以聚焦画布，按 ← → 移动，空格或 Enter 投放。</p><p>堆积的头像持续超过虚线，本局结束。试着合成路线最后的「大西瓜」！最大头像会保留，可以继续挑战高分。</p></div></section>
          <section class="info-card community-note"><h2>Learn. Collaborate. Grow.</h2><p>保持好奇，分享所学。<br>下一次有趣的尝试，就从这里开始。</p><a href="${repo}">查看开源项目 ${icon('arrow')}</a></section>
        </aside>
      </main>
      <footer class="site-footer"><span>Source of USTB</span><span>北京科技大学 · 2026</span><a href="${repo}">GitHub</a></footer>
    </div>
  </div>
  <dialog id="member-dialog" class="member-dialog" aria-labelledby="m-name"><button class="button icon-button dialog-close" id="m-close" aria-label="关闭成员资料">${icon('close')}</button><div class="profile-avatar"><img id="m-avatar" alt=""/><span id="m-initial" hidden></span></div><h2 id="m-name"></h2><p id="m-bio"></p><div id="m-tags"></div><div id="m-social"></div></dialog>
  <dialog id="members-dialog" class="directory-dialog" aria-labelledby="directory-title"><div class="directory-heading"><h2 id="directory-title">Source 的新朋友</h2><button class="button icon-button" id="directory-close" aria-label="关闭成员列表">${icon('close')}</button></div><label class="search-label" for="member-search">搜索名字、简介或兴趣标签</label><input id="member-search" type="search" placeholder="搜索成员" autocomplete="off"/><div id="member-list" class="member-list"></div><p id="empty-search" hidden>没有找到匹配的成员。</p></dialog>
`;

const $ = (selector) => document.querySelector(selector);
const memberModal = createMemberModal();
let simulation;
let previousAnnouncement = '';
let leaderboardOrder = '';
const leaderboardRows = new Map();
let displayedMergeLevels = null;
let displayedNextLevel = null;

function mergeAvatar(member) {
  const avatar = document.createElement('span');
  avatar.className = 'merge-avatar';
  avatar.textContent = Array.from(member.name || member.id || '?')[0].toUpperCase();
  const url = assetUrl(member.avatarUrl);
  if (url) {
    const image = document.createElement('img');
    image.alt = ''; image.src = url;
    image.onerror = () => image.remove();
    avatar.append(image);
  }
  return avatar;
}

function updateMerge(state) {
  const game = state.merge;
  if (!game) return;
  const over = game.phase === 'over';
  const reached = game.levels[game.bestLevel];
  $('#merge-score').textContent = game.score;
  $('#merge-best-score').textContent = game.bestScore || 0;
  $('#merge-over').hidden = !over;
  $('#merge-over-score').textContent = `本局 ${game.score} 分 · 最高到达第 ${game.bestLevel + 1} 级`;
  $('#merge-summary').textContent = game.bestLevel === game.levels.length - 1 ? '已合成大西瓜！继续挑战高分' : `最高第 ${game.bestLevel + 1} 级 / 共 ${game.levels.length} 级`;
  if (displayedMergeLevels !== game.levels) {
    displayedMergeLevels = game.levels;
    displayedNextLevel = null;
    $('#merge-levels').replaceChildren(...game.levels.map(({ member }, index) => {
      const row = document.createElement('li');
      const avatar = mergeAvatar(member);
      avatar.style.setProperty('--avatar-size', `${22 + index / Math.max(1, game.levels.length - 1) * 22}px`);
      const name = member.name || member.id || 'Source';
      const label = document.createElement('span');
      label.className = 'merge-level-label';
      label.textContent = index === game.levels.length - 1 ? '大西瓜' : String(index + 1);
      row.title = `第 ${index + 1} 级：${name}${index === game.levels.length - 1 ? '（大西瓜）' : ''}`;
      row.setAttribute('aria-label', row.title);
      row.append(avatar, label);
      return row;
    }));
  }
  [...$('#merge-levels').children].forEach((row, index) => {
    row.classList.toggle('is-reached', index <= game.bestLevel);
    row.classList.toggle('is-current', index === game.bestLevel);
    if (index === game.bestLevel) row.setAttribute('aria-current', 'step');
    else row.removeAttribute('aria-current');
  });
  if (displayedNextLevel !== game.nextLevel) {
    displayedNextLevel = game.nextLevel;
    const next = game.levels[game.nextLevel];
    $('#merge-next-avatar').replaceChildren(...(next ? [mergeAvatar(next.member)] : []));
    $('#merge-next-name').textContent = next ? `${next.member.name || next.member.id} · ${game.nextLevel + 1} 级` : '—';
  }
  $('#play-hint').textContent = over ? '本局结束，换一组头像再挑战一次。' : state.paused ? '已暂停，点击播放按钮继续。' : '点击投放 · 拖动瞄准后松手 · ← → 移动 / 空格投放';
  $('#arena-note').textContent = '相同头像 → 更大一级';
  const announcementKey = `merge:${game.phase}:${state.paused}:${game.bestLevel}`;
  if (announcementKey !== previousAnnouncement) {
    $('#race-announcement').textContent = over ? `本局结束，得分 ${game.score}，最高第 ${game.bestLevel + 1} 级。` : state.paused ? '合成游戏已暂停。' : reached ? `已到达第 ${game.bestLevel + 1} 级，${reached.member.name || reached.member.id}。` : '合成游戏开始。';
    previousAnnouncement = announcementKey;
  }
}

function updateLeaderboard(ranking, phase) {
  const order = ranking.map((entry) => entry.id).join('|');
  const rows = ranking.map((entry, i) => {
    let row = leaderboardRows.get(entry.id);
    if (!row) {
      row = document.createElement('li');
      const place = document.createElement('span'); place.className = 'rank-number';
      const name = document.createElement('span'); name.className = 'rank-name';
      const value = document.createElement('span'); value.className = 'rank-value';
      row.append(place, name, value); leaderboardRows.set(entry.id, row);
    }
    row.className = `leaderboard-row${i === 0 && phase !== 'countdown' && phase !== 'idle' ? ' is-leader' : ''}`;
    row.children[0].textContent = String(i + 1).padStart(2, '0');
    row.children[1].textContent = entry.name;
    row.children[2].textContent = entry.finished && Number.isFinite(entry.time) ? `${entry.time.toFixed(2)} s` : phase === 'idle' || phase === 'countdown' ? '准备中' : `${Math.floor(Math.max(0, Math.min(1, entry.progress)) * 100)}%`;
    return row;
  });
  if (order !== leaderboardOrder || $('#leaderboard').children.length !== rows.length) {
    $('#leaderboard').replaceChildren(...rows);
    leaderboardOrder = order;
  }
}

function updateState(state) {
  const racing = state.mode === 'race';
  const merging = state.mode === 'merge';
  $('#member-count').textContent = state.memberCount;
  $('#sidebar-member-count').textContent = state.memberCount;
  $('#float-help').hidden = racing || merging;
  $('#race-help').hidden = !racing;
  $('#merge-help').hidden = !merging;
  $('#instructions-title').textContent = merging ? '来合成一颗大西瓜' : racing ? '关于下落赛' : '试着和大家碰个面';
  $('#arena-title').textContent = merging ? '合成大西瓜' : racing ? '重力下落赛' : '成员墙';
  $('#float-tools').hidden = racing || merging;
  $('#camera').hidden = !racing;
  $('#exit-race').hidden = !racing && !merging;
  $('#exit-race').textContent = merging ? '返回成员墙' : '结束比赛';
  $('#reset').hidden = racing || merging;
  $('#start-race').hidden = merging;
  $('#start-merge').disabled = state.memberCount === 0;
  $('#start-merge span').textContent = merging ? '重新开局' : '合成大西瓜';
  $('#start-merge').classList.toggle('button-primary', merging);
  $('#merge-hud').hidden = !merging;
  $('#merge-progress').hidden = !merging;
  if (!merging) $('#merge-over').hidden = true;
  $('#race-results').hidden = !racing;
  $('#race-status').hidden = !racing;
  $('#race-clock').hidden = !racing;
  $('#arena-note').hidden = racing;
  $('#canvas-wrap').classList.toggle('race-mode', racing);
  $('#canvas-wrap').classList.toggle('merge-mode', merging);
  $('#world').classList.toggle('is-paused', state.paused);
  $('#world').style.touchAction = racing || state.paused || merging && state.merge?.phase === 'over' ? 'pan-y' : 'none';
  if (merging) $('#world').setAttribute('tabindex', '0');
  else $('#world').removeAttribute('tabindex');
  $('#world').setAttribute('aria-label', merging ? '合成大西瓜。点击或拖动后松手投放头像；左右方向键瞄准，空格或 Enter 投放；相同头像碰撞会合成更大一级。' : racing ? '头像沿长赛道受重力下落，与障碍发生碰撞；可查看全程，排名显示在画布下方。' : '可拖拽的成员头像，也可通过查看所有成员按钮查看资料。');
  $('#gravity').setAttribute('aria-pressed', state.gravity);
  $('#gravity').title = state.gravity ? '关闭重力' : '开启重力';
  const pauseLabel = state.paused ? '继续动画' : '暂停动画';
  if ($('#pause').title !== pauseLabel) $('#pause').innerHTML = icon(state.paused ? 'play' : 'pause');
  $('#pause').title = pauseLabel; $('#pause').setAttribute('aria-label', pauseLabel); $('#pause').setAttribute('aria-pressed', state.paused);
  $('#pause').disabled = state.memberCount === 0 || merging && state.merge?.phase === 'over';
  if (merging) {
    updateMerge(state);
    return;
  }
  if (!racing) {
    $('#start-race').disabled = state.memberCount === 0;
    $('#start-race span').textContent = '开始下落赛';
    $('#play-hint').textContent = state.paused ? '已暂停，点击播放按钮继续。' : '拖动头像让它们碰撞，点击头像认识新朋友。';
    $('#arena-note').textContent = '自由碰撞';
    previousAnnouncement = '';
    $('#race-announcement').textContent = '';
    return;
  }
  const { phase, countdown, elapsed, cameraMode, ranking = [], results = [] } = state.race;
  const active = phase === 'countdown' || phase === 'running';
  $('#start-race').disabled = active || state.memberCount === 0;
  $('#start-race span').textContent = phase === 'finished' ? '再赛一次' : phase === 'countdown' ? '准备出发' : phase === 'running' ? '比赛进行中' : '开始下落赛';
  $('#race-clock').textContent = `${Math.max(0, elapsed).toFixed(2).padStart(5, '0')} s`;
  $('#race-status').textContent = state.paused ? '已暂停' : ({idle:'准备出发',countdown:`${Math.ceil(countdown)} 秒后出发`,running:'正在下落',finished:'比赛结束'}[phase]);
  $('#camera span').textContent = cameraMode === 'overview' ? '跟随领先者' : '查看全程';
  $('#camera').setAttribute('aria-pressed', cameraMode === 'overview');
  $('#play-hint').textContent = state.paused ? '已暂停，点击播放按钮继续。' : cameraMode === 'overview' ? '全程视角 · 点击「跟随领先者」回到近景。' : '镜头自动跟随领先者 · 查看全程可看到所有参赛成员。';
  $('#results-title').textContent = phase === 'finished' ? '比赛结果' : '实时排名';
  $('#race-summary').textContent = `${results.length} / ${state.memberCount} 已抵达终点${results.length ? ` · 冠军：${results[0].name}` : ''}`;
  const announcementKey = `${phase}:${state.paused}:${results[0]?.id || ''}`;
  if (announcementKey !== previousAnnouncement) {
    $('#race-announcement').textContent = state.paused ? '比赛已暂停。' : phase === 'finished' ? `比赛结束，${results.length} 位成员抵达终点。${results[0] ? `冠军是 ${results[0].name}，用时 ${results[0].time.toFixed(2)} 秒。` : ''}` : results.length ? `${results[0].name} 率先抵达终点。` : phase === 'running' ? '比赛开始，小球正在沿赛道下落。' : phase === 'countdown' ? '三秒倒计时，准备出发。' : '赛道准备就绪。';
    previousAnnouncement = announcementKey;
  }
  updateLeaderboard(ranking, phase);
}

$('#shuffle').addEventListener('click', () => simulation?.shuffle());
$('#gravity').addEventListener('click', () => simulation?.toggleGravity());
$('#pause').addEventListener('click', () => simulation?.setPaused(!simulation.getState().paused));
$('#reset').addEventListener('click', () => simulation?.reset());
$('#start-race').addEventListener('click', () => {
  simulation?.startRace();
  $('#playground').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
});
function startMerge() {
  previousAnnouncement = '';
  simulation?.startMerge();
  $('#world').focus({ preventScroll: true });
  $('#playground').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
$('#start-merge').addEventListener('click', startMerge);
$('#merge-restart').addEventListener('click', startMerge);
$('#exit-race').addEventListener('click', () => simulation?.setMode('float'));
$('#camera').addEventListener('click', () => simulation?.setCameraMode(simulation.getState().race.cameraMode === 'overview' ? 'leader' : 'overview'));
function setupDirectory(members) {
  const dialog = $('#members-dialog');
  const matchesMember = (member, term) => [member.name, member.bio, ...(Array.isArray(member.tags) ? member.tags : [])].join(' ').toLocaleLowerCase().includes(term);
  function renderSidebar(query = '') {
    const matches = members.filter((member) => matchesMember(member, query.trim().toLocaleLowerCase()));
    $('#sidebar-empty').hidden = matches.length > 0;
    $('#sidebar-members').replaceChildren(...matches.map((member) => {
      const button = document.createElement('button'); button.className = 'sidebar-member';
      const name = document.createElement('span'); name.textContent = member.name || member.id;
      button.append(makeAvatar(member, 'sidebar-avatar'), name);
      button.addEventListener('click', () => memberModal.open(member));
      return button;
    }));
  }
  renderSidebar();
  $('#sidebar-search').addEventListener('input', (event) => renderSidebar(event.target.value));
  $('#search-members').addEventListener('click', () => $('#show-members').click());
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input, textarea, [contenteditable], dialog')) {
      event.preventDefault(); $('#show-members').click();
    }
  });
  function makeAvatar(member, className = '') {
    const avatar = document.createElement('span');
    avatar.className = className;
    avatar.textContent = (member.name || '?').slice(0, 1).toUpperCase();
    if (member.avatarUrl) {
      const image = document.createElement('img');
      image.alt = ''; image.loading = 'lazy'; image.src = assetUrl(member.avatarUrl);
      image.onerror = () => image.remove(); avatar.append(image);
    }
    return avatar;
  }
  function renderMembers(query = '') {
    const term = query.trim().toLocaleLowerCase();
    const matches = members.filter((member) => [member.name, member.bio, ...(Array.isArray(member.tags) ? member.tags : [])].join(' ').toLocaleLowerCase().includes(term));
    $('#empty-search').hidden = matches.length > 0;
    $('#member-list').replaceChildren(...matches.map((member) => {
      const button = document.createElement('button'); button.className = 'directory-member';
      const text = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = member.name || member.id || 'Source 新朋友';
      const tags = document.createElement('small'); tags.textContent = (Array.isArray(member.tags) ? member.tags : []).join(' · ') || '很高兴认识你';
      text.append(name, tags); button.append(makeAvatar(member, 'directory-avatar'), text);
      button.addEventListener('click', () => memberModal.open(member)); return button;
    }));
  }
  $('#show-members').addEventListener('click', () => { $('#member-search').value = ''; renderMembers(); dialog.showModal(); $('#member-search').focus(); });
  $('#directory-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  $('#member-search').addEventListener('input', (event) => renderMembers(event.target.value));
}
async function boot() {
  try {
    simulation = await initSimulation($('#world'), { onStateChange: updateState, onSelect: (member) => memberModal.open(member) });
    $('#stage-message').hidden = true;
    ['shuffle', 'gravity', 'pause', 'reset', 'start-race', 'start-merge', 'show-members'].forEach((id) => { $(`#${id}`).disabled = false; });
    setupDirectory(simulation.getMembers()); updateState(simulation.getState());
    if (!simulation.getState().memberCount) {
      $('#stage-message').textContent = '还没有成员，提交第一个 PR 加入我们。';
      $('#stage-message').hidden = false;
    }
  } catch (error) {
    console.error('Unable to initialize playground:', error);
    $('#stage-message').hidden = false;
    $('#stage-message').replaceChildren();
    const message = document.createElement('span'); message.textContent = '成员加载失败，请检查网络后重试。';
    const retry = document.createElement('button'); retry.className = 'button button-primary'; retry.textContent = '重新加载';
    retry.addEventListener('click', () => location.reload()); $('#stage-message').append(message, retry);
  }
}
boot();
if (import.meta.hot) import.meta.hot.dispose(() => simulation?.destroy());

import { initSimulation } from './simulation.js';

document.querySelector('#app').innerHTML = `
  <canvas id="world"></canvas>
  <div id="modal" class="modal hidden">
    <!-- 弹窗内容容器 -->
    <div class="modal-content">
      <img id="m-avatar" src="" />
      <h2 id="m-name"></h2>
      <p id="m-bio"></p>
      <div id="m-tags"></div>
      <button id="m-close">关闭</button>
    </div>
  </div>
`;

// 启动物理世界
initSimulation(document.querySelector('#world'));
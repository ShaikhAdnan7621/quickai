(function () {
  'use strict';

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector(`[data-content="${btn.dataset.tab}"]`).classList.add('active');
    };
  });
})();

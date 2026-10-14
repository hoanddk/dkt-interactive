async function loadPrototype() {
  const target = document.querySelector('#poc-content');
  const status = document.querySelector('#build-status');
  try {
    const [htmlResponse, reportResponse] = await Promise.all([
      fetch(`dist/content.html?t=${Date.now()}`, { cache: 'no-store' }),
      fetch(`dist/build-report.json?t=${Date.now()}`, { cache: 'no-store' })
    ]);
    if (!htmlResponse.ok || !reportResponse.ok) throw new Error('POC output chưa được build.');
    const [html, report] = await Promise.all([htmlResponse.text(), reportResponse.json()]);
    target.innerHTML = html;
    status.textContent = `5 slots · ready ${report.summary.ready} · warning ${report.summary.warning} · missing ${report.summary.missing} · error ${report.summary.error}`;
    bindInteractive();
  } catch (error) {
    target.innerHTML = `<div class="fatal"><strong>Prototype chưa sẵn sàng.</strong><p>${error.message}</p><p>Chạy npm run build hoặc npm run dev trong thư mục file-oriented-poc.</p></div>`;
    status.textContent = 'BUILD REQUIRED';
  }
}

function bindInteractive() {
  document.querySelectorAll('.b01-hotspot').forEach((button) => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      const isOpen = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!isOpen));
      panel.hidden = isOpen;
    });
  });
}

loadPrototype();

try {
  const reload = new EventSource('/__reload');
  reload.addEventListener('reload', () => window.location.reload());
} catch {
  // Static/manual preview remains usable; refresh manually after a build.
}

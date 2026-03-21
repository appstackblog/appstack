(() => {
  const viewport = document.querySelector('meta[name="viewport"]');
  const content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

  if (viewport) {
    viewport.setAttribute('content', content);
  }

  const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let lastTouchEnd = 0;
  const preventDefault = (event) => event.preventDefault();

  document.addEventListener('gesturestart', preventDefault, { passive: false });
  document.addEventListener('gesturechange', preventDefault, { passive: false });
  document.addEventListener('gestureend', preventDefault, { passive: false });
  document.addEventListener('dblclick', preventDefault, { passive: false });
  document.addEventListener(
    'touchmove',
    (event) => {
      if (!isTouchDevice()) return;
      if (event.touches.length > 1 || (typeof event.scale === 'number' && event.scale !== 1)) {
        event.preventDefault();
      }
    },
    { passive: false }
  );
  document.addEventListener(
    'touchend',
    (event) => {
      if (!isTouchDevice()) return;
      const now = Date.now();
      if (now - lastTouchEnd <= 280) event.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );

  localStorage.setItem('flameTheme', 'red');
  document.querySelectorAll('.launch-card').forEach((card) => {
    card.addEventListener('click', () => {
      localStorage.setItem('flameTheme', 'red');
      window.location.href = card.dataset.target;
    });
  });
})();

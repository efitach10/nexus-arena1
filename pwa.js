(() => {
  'use strict';
  let installPrompt = null;
  let registration = null;
  let updateRequested = false;
  let offlineReady = false;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isAppleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function refreshState() {
    document.documentElement.classList.toggle('is-standalone', isStandalone());
    document.querySelectorAll('[data-install-app]').forEach(button => {
      button.setAttribute('aria-label', isStandalone() ? 'האפליקציה מותקנת' : 'התקנה במסך הבית');
      button.classList.toggle('pwa-installed', isStandalone());
    });
    document.querySelectorAll('[data-offline-status]').forEach(el => {
      el.textContent = offlineReady ? 'הממשק זמין גם ללא אינטרנט לאחר הטעינה הראשונית.' : 'הממשק יישמר לשימוש ללא אינטרנט לאחר השלמת הטעינה הראשונית.';
    });
    const indicator = document.getElementById('pwa-offline');
    if (indicator) indicator.hidden = navigator.onLine !== false;
  }

  window.showInstallHelp = function () {
    let text;
    if (isStandalone()) {
      text = '<p>האפליקציה כבר פתוחה בחלון עצמאי ממסך הבית.</p>';
    } else if (isAppleMobile()) {
      text = '<p>כדי להתקין באייפון או באייפד:</p><ol><li>פתחו את הקישור ב־Safari.</li><li>לחצו על שיתוף.</li><li>בחרו ״הוסף למסך הבית״.</li><li>אם מופיעה האפשרות ״פתיחה כיישום אינטרנט״, הפעילו אותה ולחצו ״הוסף״.</li></ol>';
    } else {
      text = '<p>בתפריט הדפדפן בחרו ״התקנת אפליקציה״ או ״הוספה למסך הבית״. במחשב אפשר להשתמש גם בסמל ההתקנה שבשורת הכתובת, אם הוא מופיע.</p><p>אם הקישור פתוח בדפדפן פנימי של אפליקציה אחרת, פתחו אותו בדפדפן הרגיל.</p>';
    }
    if (typeof window.openModal === 'function') window.openModal('Nexus במסך הבית', `${text}<p data-offline-status></p><p>זהו אבטיפוס. אין סנכרון בין מכשירים, והשינויים נשמרים במכשיר הזה.</p>`);
    refreshState();
  };

  window.installNexus = async function () {
    if (isStandalone() || !installPrompt) return window.showInstallHelp();
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted' && typeof window.toast === 'function') window.toast('ההתקנה אושרה. האפליקציה תופיע במכשיר');
    } catch {
      window.showInstallHelp();
    }
    refreshState();
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    refreshState();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; refreshState(); });
  window.addEventListener('online', refreshState);
  window.addEventListener('offline', refreshState);
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', refreshState);
  window.addEventListener('hashchange', refreshState);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-install-app]')) window.installNexus();
  });

  function showUpdate() {
    if (document.getElementById('pwa-update')) return;
    const bar = document.createElement('div');
    bar.id = 'pwa-update';
    bar.className = 'pwa-update';
    bar.setAttribute('role', 'status');
    const label = document.createElement('span'); label.textContent = 'גרסה חדשה של Nexus מוכנה';
    const update = document.createElement('button'); update.className = 'btn small'; update.textContent = 'עדכון עכשיו';
    update.addEventListener('click', () => {
      if (!registration?.waiting) { bar.remove(); return; }
      updateRequested = true;
      registration.waiting.postMessage({type: 'ACTIVATE_UPDATE'});
    });
    const close = document.createElement('button'); close.className = 'iconbtn'; close.textContent = '×'; close.setAttribute('aria-label', 'עדכון מאוחר יותר');
    close.addEventListener('click', () => bar.remove());
    bar.append(label, update, close); document.body.append(bar);
  }

  window.addEventListener('load', async () => {
    const indicator = document.createElement('div'); indicator.id = 'pwa-offline'; indicator.className = 'pwa-offline';
    indicator.setAttribute('role', 'status'); indicator.textContent = 'מצב ללא אינטרנט'; indicator.hidden = true; document.body.append(indicator);
    refreshState();
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateRequested) window.location.reload();
    });
    try {
      const root = new URL('./', document.baseURI);
      registration = await navigator.serviceWorker.register(new URL('sw.js', root), {scope: root.pathname, updateViaCache: 'none'});
      if (registration.waiting) showUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
        });
      });
      await navigator.serviceWorker.ready;
      offlineReady = true;
      refreshState();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {});
      });
    } catch (error) {
      console.warn('Nexus offline setup could not complete', error);
    }
  });
})();

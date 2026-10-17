// SATZIO Produktseite – minimales JavaScript.

// Ziel des Buttons „Web-App öffnen“. Einzige Stelle, die angepasst werden muss.
// Beispiele: '/app/' (gleiche Domain), 'https://app.example.de/', 'http://localhost:8080'
// Web-App liegt auf derselben Domain unter /app/ (siehe docker/nginx.conf)
const APP_URL = '/app/';

document.querySelectorAll('[data-app-link]').forEach((a) => {
  a.setAttribute('href', APP_URL);
});

// Kopieren-Buttons für Terminal-Befehle
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const text = btn.getAttribute('data-copy');
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    const label = btn.textContent;
    btn.textContent = ok ? 'Kopiert' : 'Fehler';
    btn.classList.toggle('is-done', ok);
    setTimeout(() => {
      btn.textContent = label;
      btn.classList.remove('is-done');
    }, 1600);
  });
});

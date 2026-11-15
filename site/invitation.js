(() => {
  'use strict';
  const button = document.getElementById('save-date-response');
  const status = document.getElementById('response-status');
  const params = new URLSearchParams(location.search);
  const token = params.get('invite');
  if (!button || !status) return;
  let acknowledged = false;
  let pending = false;
  let available = false;
  const preview = !token;
  if (preview) {
    button.addEventListener('click', () => {
      status.textContent = 'You’ll be able to let us know from the personal link in your text invitation.';
    });
    return;
  }
  const endpoint = '/api/invitation';
  async function send(action) {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action }), credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.timeout(20000)
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('Responses aren’t open yet. Please try again later.'); }
    if (!response.ok) throw new Error(data.error || 'Please try again in a moment.');
    if (typeof data.greeting !== 'string' || typeof data.acknowledged !== 'boolean') throw new Error('Please try again in a moment.');
    return data;
  }
  function showSaved() {
    acknowledged = true;
    button.textContent = 'Date saved. Thank you!';
    button.disabled = true;
    status.textContent = 'Thanks for letting us know.';
  }
  async function load() {
    button.disabled = true;
    try {
      const data = await send('view');
      available = true;
      if (data.greeting) document.getElementById('greeting').textContent = data.greeting;
      const note = document.getElementById('personal-note');
      if (data.personalNote) { note.textContent = data.personalNote; note.hidden = false; }
      status.textContent = '';
      if (data.acknowledged) showSaved();
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'This is taking a little longer. Please try again.' : error.message;
      button.textContent = 'Try invitation again';
    } finally { if (!acknowledged) button.disabled = false; }
  }
  button.addEventListener('click', async () => {
    if (pending || acknowledged) return;
    pending = true;
    if (!available) {
      await load();
      if (available && !acknowledged) button.textContent = 'We’ve saved the date';
      pending = false;
      return;
    }
    button.disabled = true;
    button.textContent = 'Saving…';
    status.textContent = '';
    try { await send('acknowledge'); showSaved(); }
    catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'This is taking a little longer. Please try again.' : error.message;
      button.textContent = 'Try again';
      button.disabled = false;
    } finally { pending = false; }
  });
  load();
})();

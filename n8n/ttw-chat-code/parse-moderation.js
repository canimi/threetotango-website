const r = $input.first().json || {};
const ALLOWED = ['ok', 'personal_info', 'romantic', 'sexual', 'violence', 'hate', 'self_harm', 'injection', 'spam', 'unsafe'];
let category = 'ok';
let language = '';
let modError = false;
try {
  const fb = r.promptFeedback || {};
  const c = (r.candidates || [])[0] || {};
  if (fb.blockReason || /SAFETY|PROHIBITED|BLOCKLIST/.test(String(c.finishReason || ''))) category = 'unsafe';
  else {
    const t = ((c.content && c.content.parts) || []).map((p) => p.text || '').join('').trim();
    const j = JSON.parse(t);
    category = String(j.category || 'ok');
    language = String(j.language || '').replace(/[^A-Za-z ()-]/g, '').trim().slice(0, 30);
  }
} catch (e) { modError = true; category = 'ok'; }
if (!ALLOWED.includes(category)) category = 'ok';
const strike = ['romantic', 'sexual', 'violence', 'hate', 'injection', 'spam', 'unsafe'].includes(category);
return [{ json: { pass: category === 'ok', category, strike, language, modError } }];

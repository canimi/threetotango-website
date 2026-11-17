const g = $('Gate Decide').first().json;
const r = $input.first().json || {};
const FALLBACK = {
  luka: 'Hmm. I lost interest. Ask me something else. 🧐',
  budy: 'Mrrp? I got distracted by a sound! Say that again? 😹',
  caddy: 'I was napping. Say that again. 😴'
};
let text = (r.content || []).filter((c) => c && c.type === 'text').map((c) => c.text).join(' ').trim();
const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
if (paras.length > 1) text = paras[paras.length - 1];
text = text
  .replace(/https?:\/\/\S+/gi, '')
  .replace(/www\.\S+/gi, '')
  .replace(/[#@]\S+/g, '')
  .replace(/^\s*(luka|budy|caddy)\s*:\s*/i, '')
  .replace(/\*[^*]{0,80}\*/g, '')
  .replace(/^["“”«»']+|["“”«»']+$/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();
let filtered = false;
if (r.stop_reason === 'max_tokens' || [...text].length > 280) {
  const cut = [...text].slice(0, 280).join('');
  const m = cut.match(/^[\s\S]*[.!?…。！？؟।](?:\s*\p{Extended_Pictographic})*/u);
  text = (m ? m[0] : cut).trim();
}
if (!text) { text = FALLBACK[g.cat] || FALLBACK.budy; filtered = true; }
const u = r.usage || {};
const inT = Number(u.input_tokens) || 0;
const outT = Number(u.output_tokens) || 0;
const cr = Number(u.cache_read_input_tokens) || 0;
const cw = Number(u.cache_creation_input_tokens) || 0;
const cost = (inT * 0.10 + outT * 0.50 + cr * 0.01 + cw * 0.125) / 1e6;
return [{ json: { reply: text, filtered, cost: cost.toFixed(6), inT, outT, cr, cw, stop: String(r.stop_reason || '') } }];

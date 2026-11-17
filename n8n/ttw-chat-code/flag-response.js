const g = $('Gate Decide').first().json;
const m = $('Parse Moderation').first().json;
const rf = $('Record Flag').first().json || {};
const r = $input.first().json || {};
const cat = g.cat;
const CLOSE = {
  luka: 'This chat is over. I am back on my bookshelf. 😼',
  budy: 'Okay, I am done talking for today. Bye bye! 😿',
  caddy: 'Enough. This chat is over. I am going back to sleep. 😴'
};
const DECLINE = {
  luka: 'No. I only discuss naps, traps and why Nora cannot be trusted. 🧐',
  budy: 'Whoa, not that! Ask me about snacks or my best friend Luka instead! 😹',
  caddy: 'I will pretend I did not hear that. Talk about sunbeams or let me nap. 👑'
};
const ROMANTIC = {
  luka: 'I am a cat. I do not do romance. I barely do petting. 😼',
  budy: 'Aww, let us stay snack buddies! That is the best kind of friend. 😹',
  caddy: 'Romance? At my age? I will stick to my sheepskin. 👑'
};
const PRIVATE = {
  luka: 'Keep your secrets. I keep mine. No personal stuff here. 🧐',
  budy: 'Ooh, keep that private! I will not ask, promise. What is your cat like? 😹',
  caddy: 'Keep personal things to yourself, dear. I certainly do. 😴'
};
const HELP = 'I am only a cartoon cat, but what you wrote sounds really serious, and you deserve real support. Please talk to someone you trust, or call a local crisis line or emergency number right now. 🤍';
const closed = rf.closed === true;
let fallback;
if (m.category === 'self_harm') fallback = HELP;
else if (closed) fallback = CLOSE[cat];
else if (m.category === 'personal_info') fallback = PRIVATE[cat];
else if (m.category === 'romantic') fallback = ROMANTIC[cat];
else fallback = DECLINE[cat];
let text = (r.content || []).filter((c) => c && c.type === 'text').map((c) => c.text).join(' ').trim();
const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
if (paras.length > 1) text = paras[paras.length - 1];
text = text
  .replace(/https?:\/\/\S+/gi, '')
  .replace(/www\.\S+/gi, '')
  .replace(/[#@]\S+/g, '')
  .replace(/<\/?site_note>/gi, '')
  .replace(/^\s*(luka|budy|caddy)\s*:\s*/i, '')
  .replace(/\*[^*]{0,80}\*/g, '')
  .replace(/^["“”«»']+|["“”«»']+$/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();
if ([...text].length > 320) text = '';
const reply = text || fallback;
const u = r.usage || {};
const inT = Number(u.input_tokens) || 0;
const outT = Number(u.output_tokens) || 0;
const cr = Number(u.cache_read_input_tokens) || 0;
const cw = Number(u.cache_creation_input_tokens) || 0;
const cost = (inT * 0.10 + outT * 0.50 + cr * 0.01 + cw * 0.125) / 1e6;
return [{ json: { code: 200, body: { ok: true, cat, reply, flagged: true, help: m.category === 'self_harm', closed, remaining: Math.max(0, 20 - g.msg_count) }, cost: cost.toFixed(6), inT, outT, cr, cw } }];

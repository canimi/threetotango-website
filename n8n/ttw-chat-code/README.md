# TTW · Chat — current Code-node sources (2026-11-17, after the language fix)

The SDK file `../ttw-chat.workflow-sdk.ts` is the first version. Since then (live version daf5fecd):
- Moderation (Gemini) also returns `language`; "romantic" is no longer a category (pet affection is fine; Haiku handles flirting in character).
- Flow: Parse Moderation → **Build Claude Request** → Message OK? → Call Claude (true) / Record Flag → **Call Claude Decline** → Flag Response → Save Flag Cost → Flag Out → Respond JSON (false).
- History is sent as a transcript inside one user message, so the reply language follows the newest visitor message.
- Haiku `thinking` is disabled and `max_tokens` is 160 (set in Call Claude / Call Claude Decline jsonBody too).
- Blocked messages get a short Haiku reply in the visitor's language (the model never sees the blocked text); canned English replies are only the fallback.
The files here are the exact jsCode of each Code node.

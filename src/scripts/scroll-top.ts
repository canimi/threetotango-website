/**
 * Every (re)load starts at the top of the page. The browser's own scroll restoration is switched off,
 * so a refresh never lands halfway down. Links to an anchor (#household, #main …) still jump there.
 */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const toTop = () => {
  if (!location.hash) window.scrollTo(0, 0);
};
toTop();
window.addEventListener('pageshow', (e) => {
  if ((e as PageTransitionEvent).persisted) toTop();
});

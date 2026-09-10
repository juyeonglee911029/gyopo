export function handleNavigationClick(event: React.MouseEvent<HTMLAnchorElement>, href: string, pathname: string) {
  if (typeof window === 'undefined') return;
  const current = href === '/' ? pathname === '/' : pathname.startsWith(href);
  const key = `gyopo-navigation-cycle:${href}`;
  const stage = Number(window.sessionStorage.getItem(key) || '0');

  if (!current) {
    window.sessionStorage.setItem(key, '1');
    window.dispatchEvent(new CustomEvent('gyopo-navigation-blank', { detail: { visible: false } }));
    window.dispatchEvent(new CustomEvent('gyopo-navigation-fx'));
    return;
  }

  if (stage === 1) {
    event.preventDefault();
    window.sessionStorage.setItem(key, '2');
    window.dispatchEvent(new CustomEvent('gyopo-navigation-blank', { detail: { visible: true } }));
    window.dispatchEvent(new CustomEvent('gyopo-navigation-fx'));
    return;
  }

  event.preventDefault();
  window.sessionStorage.setItem(key, '1');
  window.dispatchEvent(new CustomEvent('gyopo-navigation-blank', { detail: { visible: false } }));
  window.dispatchEvent(new CustomEvent('gyopo-navigation-fx'));
}

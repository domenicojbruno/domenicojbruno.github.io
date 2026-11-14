// Visit statistics via GoatCounter (cookieless, no personal data, free for
// personal sites). Inert until a site code is set in src/content/profile.json:
//   "analytics": { "goatcounter": "yourcode" }   ->  yourcode.goatcounter.com
// The dashboard shows visits per page, referrers, countries, devices and
// campaigns. Links shared as https://…/?ref=some-label show up under that
// label, which is how to tell which recruiter or posting a visit came from.

import profile from './content/profile.json';

const code = (profile.analytics?.goatcounter ?? '').trim();
export const analyticsEnabled = code.length > 0;

type Counter = { no_onload?: boolean; count?: (o: { path: string }) => void };
let loading: Promise<void> | null = null;

/** Count one page view. Called on first load and on every in-app navigation. */
export function track(path: string) {
  if (!analyticsEnabled || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return;
  const w = window as unknown as { goatcounter?: Counter };
  if (!loading) {
    w.goatcounter = { no_onload: true };          // this is a single-page app: count manually
    loading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://gc.zgo.at/count.js';
      s.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }
  void loading.then(() => w.goatcounter?.count?.({ path }));
}

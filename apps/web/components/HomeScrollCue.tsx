'use client';
// Home scroll cue (Sprint 8S Extension): a low-profile line pinned to the bottom edge of the first screen of the Home tab,
// 'Scroll down for more council info ↓', telling a reader that more cards sit below the fold. The first downward turn of
// the mouse wheel or trackpad (a wheel event with deltaY > 0) dismisses it at once; any other scroll away from the top
// (keyboard, scrollbar, touch) does too. The fade itself is the .home-scroll-cue CSS transition in globals.css (opacity
// to 0, no motion for readers who ask for reduced motion). It shows only while the page is taller than the window, and
// it is decorative: aria-hidden, no pointer events.
import { useEffect, useState } from 'react';

export const HOME_SCROLL_CUE_TEXT = 'Scroll down for more council info ↓';

export function HomeScrollCue() {
  const [dismissed, setDismissed] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (window.scrollY > 0) {
      setDismissed(true);
      return;
    }
    const dismiss = () => setDismissed(true);
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) dismiss();
    };
    const onScroll = () => {
      if (window.scrollY > 0) dismiss();
    };
    // The Home cards load after mount, so re-measure whenever the page grows or shrinks.
    const measure = () => setHasMore(document.documentElement.scrollHeight > window.innerHeight + 1);
    const resize = new ResizeObserver(measure);
    resize.observe(document.body);
    measure();
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      resize.disconnect();
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const hidden = dismissed || !hasMore;
  return (
    <div aria-hidden="true" data-hidden={hidden} className="home-scroll-cue pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center">
      <span className="rounded-full border border-line bg-white px-4 py-1 text-sm text-muted shadow">{HOME_SCROLL_CUE_TEXT}</span>
    </div>
  );
}

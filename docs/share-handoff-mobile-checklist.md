# Share Handoff Mobile Checklist

BLU-19 adds share actions that should be checked on real phones because Web Share, SMS links, safe-area padding, and tap behavior vary by platform.

## Automated Coverage

- Active shares render a Korean message preview with the share name, destination when set, remaining share window, and tracking link.
- Share controls expose named actions for native share/KakaoTalk handoff, SMS, and link copy.
- Clipboard success is announced with `aria-live`.
- PIN input uses numeric keyboard hints with `inputMode`, `pattern`, and one-time-code autocomplete.
- Dashboard focus states cover form fields, selects, destination results, and share links.
- Reduced-motion preferences disable animation/transition timing.

## Manual Matrix

| Scenario | Expected result |
| --- | --- |
| iOS Safari | Native share opens and KakaoTalk/SMS can be selected if installed. |
| Installed iOS PWA | Share panel remains usable in standalone mode, including safe-area padding. |
| Android Chrome | Native share opens Android share sheet; SMS link opens the message app with text filled. |
| Installed Android PWA | Copy, SMS, and native share controls retain 48px tap targets. |
| Narrow viewport around 360px | Session card text wraps without horizontal scrolling. |
| Reduced motion enabled | UI remains understandable without relying on motion-only feedback. |

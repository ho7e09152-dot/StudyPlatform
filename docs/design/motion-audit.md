# Study-ing Motion Audit

> Audited: 2026-08-13
> Scope: authenticated App Shell, routes, overlays, menus, tabs, details, progress and theme changes

## Current state

- No animation library is installed. The product uses CSS transitions and a small number of React-mounted overlays.
- Hover and selection transitions existed, but durations ranged from 130–450ms with several different easing curves.
- Modal, Activity Drawer, mobile navigation and Toast mounted with entry motion but unmounted immediately, so no consistent exit state existed.
- The App Shell correctly persisted across protected route changes, but main content had no shared route transition or route-focus behavior.
- Workspace and account menus had no shared popover motion. Native `details` controls animated only their chevrons.
- Existing reduced-motion rules covered selected legacy animations but did not provide one authenticated-app foundation.
- No `transition: all` declaration was found in the authenticated product foundation.

## Decisions

| Interaction | Before | Decision |
| --- | --- | --- |
| Route content | Immediate replacement | Keep App Shell fixed; main content enters with 6px/200ms motion and receives focus after route or Workspace change |
| Modal | Mount only | Backdrop fade plus 8px/0.985 panel entry; 150ms exit with pointer events disabled |
| Mobile sheet | Same static full-screen panel | Use the same dialog foundation with a 220ms subtle entry; no full-height travel |
| Activity Drawer | One-off 200ms 24px entry | Shared 240ms edge entry and 200ms exit |
| Mobile navigation | Immediate mount/unmount | Shared left-edge motion, focus trap, Escape and focus restoration |
| Workspace/Profile menu | Immediate | 140ms opacity and -4px entry; selection closes immediately |
| Toast | One-off entry only | 200ms entry and 150ms exit |
| Tabs/view switch | Immediate replacement or one-off animation | Shared 180ms opacity + 3px content swap; no stagger or morphing |
| Details/accordion | Chevron only | 180ms opacity + 4px content reveal; native layout behavior remains |
| Progress | 400–450ms variants | 280ms width transition, never forced from zero on initial load |
| Theme/accent | Mixed | 140ms color/background/border transition on stable product surfaces |
| Reduced motion | Partial | Authenticated App disables translation and reduces all non-essential timing to 1ms |

## Constraints preserved

- No route, API, component hierarchy or product copy changes.
- No new dependency, spring, bounce, stagger, parallax, blur animation or decorative page reveal.
- Focus is available immediately; it does not wait for animation completion.
- Closing overlays ignore pointer input during their short exit phase.
- Public Landing and OAuth visuals are not expanded with additional motion.

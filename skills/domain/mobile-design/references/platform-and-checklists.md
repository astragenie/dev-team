# Mobile Design — Platform Conventions & Checklists

Reference for `skills/domain/mobile-design/`.

---

## Platform Divergence Matrix

### When to Unify vs Diverge

```
                    UNIFY (same on both)          DIVERGE (platform-specific)
                    ───────────────────           ──────────────────────────
Business Logic      Always                        -
Data Layer          Always                        -
Core Features       Always                        -

Navigation          -                             iOS: edge swipe, Android: back button
Gestures            -                             Platform-native feel
Icons               -                             SF Symbols vs Material Icons
Date Pickers        -                             Native pickers feel right
Modals/Sheets       -                             iOS: bottom sheet vs Android: dialog
Typography          -                             SF Pro vs Roboto (or custom)
Error Dialogs       -                             Platform conventions for alerts
```

### iOS (Human Interface Guidelines)

- **Font**: SF Pro (iOS 16+), SF Compact (watchOS)
- **Touch target**: 44pt × 44pt minimum
- **Back navigation**: Edge swipe from left edge
- **Tab bar**: Bottom, up to 5 tabs with SF Symbols
- **Modals**: Bottom sheets for contextual actions
- **Progress**: Spinner (`UIActivityIndicatorView`)
- **Pull to refresh**: Native `UIRefreshControl`

### Android (Material Design 3)

- **Font**: Roboto (or custom with Material tokens)
- **Touch target**: 48dp × 48dp minimum
- **Back navigation**: System back gesture/button
- **Tab icons**: Material Symbols (outlined weight = default)
- **Action sheets**: Bottom Sheet or Dialog (context-dependent)
- **Progress**: Linear progress bar (`LinearProgressIndicator`)
- **Pull to refresh**: `SwipeRefreshLayout`

---

## Pre-Development Checklist

Before starting ANY mobile project:

- [ ] Platform confirmed? (iOS / Android / Both)
- [ ] Framework chosen? (RN / Flutter / Native)
- [ ] Navigation pattern decided? (Tabs / Stack / Drawer)
- [ ] State management selected? (Zustand / Redux / Riverpod / BLoC)
- [ ] Offline requirements known?
- [ ] Deep linking planned from day one?
- [ ] Target devices defined? (Phone / Tablet / Both)

Before every screen:

- [ ] Touch targets ≥ 44-48px?
- [ ] Primary CTA in thumb zone?
- [ ] Loading state exists?
- [ ] Error state with retry exists?
- [ ] Offline handling considered?
- [ ] Platform conventions followed?

---

## Pre-Release Checklist

Before shipping to stores:

- [ ] `console.log` removed?
- [ ] `SecureStore` for sensitive data (not `AsyncStorage`)?
- [ ] SSL pinning enabled?
- [ ] Lists optimized (memo, keyExtractor, getItemLayout)?
- [ ] Memory cleanup on unmount (subscriptions, timers)?
- [ ] Tested on low-end devices (not just flagship)?
- [ ] Accessibility labels on all interactive elements?
- [ ] Deep links tested end-to-end?
- [ ] Push notification permissions handled gracefully?

---

## Mobile UX Psychology Quick Reference

### Fitts' Law for Touch

```
Desktop: Cursor is precise (1px)
Mobile:  Finger is imprecise (~7mm contact area)

→ Touch targets MUST be 44-48px minimum
→ Important actions in THUMB ZONE (bottom of screen)
→ Destructive actions AWAY from easy reach (top)
```

### Mobile-Specific Cognitive Load

| Desktop | Mobile Difference |
|---|---|
| Multiple windows | ONE task at a time |
| Keyboard shortcuts | Touch gestures |
| Hover states | NO hover (tap or nothing) |
| Large viewport | Limited space, scroll vertical |
| Stable attention | Interrupted constantly |

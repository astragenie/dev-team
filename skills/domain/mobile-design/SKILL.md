---
name: mobile-design
tier: domain
description: Mobile-first design thinking and implementation patterns for iOS and Android — touch interaction, performance optimization, platform conventions, and framework selection. Use when building React Native, Flutter, or native mobile apps.
source: davila7/claude-code-templates/cli-tool/components/skills/creative-design/mobile-design
source_version: 2026-06-08
last_reviewed: 2026-06-08
owner: hero-crew
triggers: ["React Native", "Flutter", "iOS", "Android", "mobile app", "SwiftUI", "Kotlin", "Jetpack Compose", "FlatList", "FlashList", "touch target", "thumb zone", "mobile design", "cross-platform", "Expo", "mobile navigation", "deep linking", "offline", "haptics"]
---

# Mobile Design System

> **Philosophy:** Touch-first. Battery-conscious. Platform-respectful. Offline-capable.
> **Core Principle:** Mobile is NOT a small desktop. THINK mobile constraints. ASK platform choice.

## When to use

Consult this skill when:
- Building React Native, Flutter, SwiftUI, or Kotlin Compose apps
- Designing touch interactions, gestures, or thumb-zone UX
- Optimizing list rendering performance (FlatList, FlashList, ListView.builder)
- Making platform-specific decisions (iOS vs Android conventions)
- Handling mobile-specific concerns: offline, push notifications, deep linking
- Choosing a mobile framework (RN vs Flutter vs native)
- Debugging mobile performance issues (60fps, memory, battery drain)

## Mandatory: ASK Before Assuming

> **STOP! If the user's request is open-ended, DO NOT default to your favorites.**

You MUST ask if not specified:
- **Platform**: "iOS, Android, or both?"
- **Framework**: "React Native, Flutter, or native?"
- **Navigation**: "Tab bar, drawer, or stack-based?"
- **State**: "What state management? (Zustand/Redux/Riverpod/BLoC?)"
- **Offline**: "Does this need to work offline?"

## Critical Anti-Patterns (Never Do)

**Performance Sins:**
- `ScrollView` for long lists → use `FlatList` / `FlashList` / `ListView.builder`
- Inline `renderItem` function → use `useCallback` + `React.memo`
- Missing `keyExtractor` → use unique stable IDs, NOT index
- `useNativeDriver: false` → always use `useNativeDriver: true`
- `setState()` everywhere in Flutter → targeted state, `const` constructors

**Touch/UX Sins:**
- Touch target < 44px (iOS) / 48dp (Android) → make it larger
- Spacing < 8px between targets → min 8-12px gap
- No loading state → always show loading feedback
- No error state → show error with retry option
- Gesture-only interactions → always provide button alternative

**Security Sins:**
- Token in `AsyncStorage` → use `SecureStore` / `Keychain` / `EncryptedSharedPreferences`
- Hardcoded API keys → environment variables, secure storage
- Logging sensitive data → never log tokens, passwords, PII

## Platform Quick Reference

| Element | iOS | Android |
|---|---|---|
| **Primary Font** | SF Pro / SF Compact | Roboto |
| **Min Touch Target** | 44pt × 44pt | 48dp × 48dp |
| **Back Navigation** | Edge swipe left | System back button/gesture |
| **Bottom Tab Icons** | SF Symbols | Material Symbols |
| **Action Sheet** | UIActionSheet from bottom | Bottom Sheet / Dialog |
| **Progress** | Spinner | Linear progress (Material) |

## Framework Decision Tree

```
WHAT ARE YOU BUILDING?
        ├── OTA updates + rapid iteration + web team → React Native + Expo
        ├── Pixel-perfect custom UI + performance critical → Flutter
        ├── Deep native features + single platform
        │   ├── iOS only → SwiftUI
        │   └── Android only → Kotlin + Jetpack Compose
        ├── Existing RN codebase → React Native (bare workflow)
        └── Enterprise + existing Flutter codebase → Flutter
```

## Thumb Zone (One-Handed Usage)

```
┌─────────────────────────────┐
│      HARD TO REACH          │ ← Navigation, menu, back
├─────────────────────────────┤
│      OK TO REACH            │ ← Secondary actions
├─────────────────────────────┤
│      EASY TO REACH          │ ← PRIMARY CTAs, tab bar
└─────────────────────────────┘
```

Primary CTAs and tab bar belong at the BOTTOM. Destructive actions go at the top (hard to reach).

## References

Load a reference when the work matches its scope:

| Reference | Load when |
|---|---|
| [references/performance.md](references/performance.md) | RN/Flutter performance, FlatList optimization, 60fps, Flutter const constructors |
| [references/platform-and-checklists.md](references/platform-and-checklists.md) | iOS/Android divergence, pre-dev checklist, pre-release checklist |

## Done / Acceptance

A mobile feature or screen is ready when:
- Platform confirmed and conventions applied (SF Pro / Roboto, touch targets, navigation)
- All lists use `FlatList`/`FlashList`/`ListView.builder` (never `ScrollView` for long lists)
- Touch targets meet platform minimums (44pt iOS / 48dp Android)
- Primary CTAs placed in thumb zone (bottom of screen)
- Loading, error, and offline states all handled
- Sensitive data in `SecureStore` / `Keychain` (not `AsyncStorage`)
- No `console.log` in production builds
- Memory cleanup on unmount (subscriptions, timers disposed)
- Accessibility labels on all interactive elements

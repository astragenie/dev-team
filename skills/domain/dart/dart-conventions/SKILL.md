---
name: dart-conventions
tier: domain
stack: dart
description: Dart 3 conventions — null safety, sealed classes, pattern matching, Result types, lints. Use when touching *.dart files outside Flutter UI.
owner: sergeymilashico
last_reviewed: 2026-05-22
triggers: ["*.dart", "pubspec.yaml", "pubspec.lock", "dart"]
---

# Dart Conventions

Applies to Dart 3 code. For Flutter-specific UI patterns, see `skills/domain/flutter/flutter-conventions`.

## When to Use

Lead: recommend when a builder touches `.dart` files, adds domain logic, or reviews Dart PRs.

## Core rules

**Null safety**
- Sound null safety required. No `late` without a clear invariant; prefer `?` + null checks.
- Avoid `!` (bang operator) in application code — use `??`, `?.`, or explicit null checks.
- Use `required` on named parameters that have no sensible default.

**Types and style**
- Prefer `final` for local variables and fields that don't change after assignment.
- Named constructors over factory methods when there are multiple construction paths (`User.fromJson`, `User.empty`).
- `const` constructors on value-like classes. Use `const` at call sites when possible — the compiler eliminates redundant allocations.
- Prefer `sealed class` (Dart 3) for discriminated domain types — exhaustive switch is compiler-enforced.
- Extension methods to add behaviour without subclassing third-party types.

**Error handling**
- `Result<T, E>` (or `Either<L, R>`) for domain operations with expected failure modes.
- Throw for programmer errors and unrecoverable situations. Return `Result` for business-rule violations, validation errors, and not-found cases.
- Never swallow exceptions with `catch (_) {}` without a comment and a logged recovery action.

## Result type pattern

```dart
sealed class Result<T> {
  const Result();
}

final class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;
}

final class Err<T> extends Result<T> {
  const Err(this.error);
  final Object error;
}

// Usage with exhaustive switch (Dart 3)
final result = await placeOrder(cart, customer);
switch (result) {
  case Ok(:final value):  print('Order placed: ${value.id}');
  case Err(:final error): print('Failed: $error');
}
```

## Sealed classes for domain variants

```dart
sealed class OrderStatus {}

final class Pending  extends OrderStatus {}
final class Shipped  extends OrderStatus { final String trackingId; const Shipped(this.trackingId); }
final class Delivered extends OrderStatus {}
final class Cancelled extends OrderStatus { final String reason; const Cancelled(this.reason); }

// Exhaustive switch — compiler catches missing cases
String describe(OrderStatus s) => switch (s) {
  Pending()    => 'Waiting',
  Shipped(:final trackingId) => 'In transit: $trackingId',
  Delivered()  => 'Done',
  Cancelled(:final reason) => 'Cancelled: $reason',
};
```

## Naming

- Classes, enums, typedefs: `UpperCamelCase`.
- Variables, functions, parameters: `lowerCamelCase`.
- Constants: `lowerCamelCase` (Dart convention — not `UPPER_SNAKE`).
- Private members: `_lowerCamelCase`.
- File names: `snake_case.dart`.

## Lints

`analysis_options.yaml` must include `package:lints/recommended.yaml` (or `package:very_good_analysis/analysis_options.yaml` for strict projects).

Key rules in effect: `prefer_const_constructors`, `prefer_final_locals`, `avoid_dynamic_calls`, `unawaited_futures`, `cancel_subscriptions`, `close_sinks`.

## Async

- `async` / `await` end-to-end. No `.then` chains in application code.
- Every `Future` is awaited or explicitly fire-and-forgot with error logging.
- `unawaited(...)` from `dart:async` to make intentional fire-and-forget explicit.
- `Stream` for push-based data; `StreamController.broadcast` for multi-subscriber scenarios.

## Testing

- `package:test` for pure Dart. `package:mocktail` for mocks (not `mockito` + build_runner unless already in project).
- Test names: `group('ClassName', () { test('does X when Y', ...) })`.
- No file system or network access in unit tests — inject via abstractions.

## Anti-patterns

- `dynamic` in domain code.
- `!` bang on a nullable that could legitimately be null.
- Inheritance beyond 2 levels — use composition or mixins.
- `static` mutable state.
- Catching `Exception` or `Object` without rethrowing or converting to a typed error.
- Returning `null` from a public method to signal failure — use `Result` or throw.

## Done criteria

- `dart analyze` clean (no warnings, no errors).
- `dart format` applied.
- Sound null safety — no `!` in critical paths.
- Domain variants modelled with `sealed class`.
- Expected failure modes use `Result` / typed errors.
- Every public async method returns a typed `Future<T>` or `Stream<T>`.

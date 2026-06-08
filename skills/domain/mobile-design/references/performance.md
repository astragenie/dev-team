# Mobile Design — Performance Reference

Reference for `skills/domain/mobile-design/`.

---

## React Native: Critical Performance Rules

### List Optimization

```typescript
// CORRECT: Memoized renderItem + React.memo wrapper
const ListItem = React.memo(({ item }: { item: Item }) => (
  <View style={styles.item}>
    <Text>{item.title}</Text>
  </View>
));

const renderItem = useCallback(
  ({ item }: { item: Item }) => <ListItem item={item} />,
  []
);

// CORRECT: FlatList with all optimizations
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}  // Stable ID, NOT index
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

### Animation Performance

```
GPU-accelerated (FAST):     CPU-bound (SLOW):
├── transform               ├── width, height
├── opacity                 ├── top, left, right, bottom
└── (use these ONLY)        ├── margin, padding
                            └── (AVOID animating these)
```

Always use `useNativeDriver: true` — animations blocked by the JS thread are janky.

### RN Anti-Pattern Quick Reference

| Never Do | Always Do |
|---|---|
| `ScrollView` for long lists | `FlatList` / `FlashList` |
| Inline `renderItem` | `useCallback` + `React.memo` |
| Index as `keyExtractor` | Unique stable ID from data |
| Skip `getItemLayout` | Provide when items have fixed height |
| `useNativeDriver: false` | `useNativeDriver: true` always |
| `console.log` in production | Remove before release build |

---

## Flutter: Critical Performance Rules

### Const Constructors

```dart
// CORRECT: const constructors prevent rebuilds
class MyWidget extends StatelessWidget {
  const MyWidget({super.key}); // CONST!

  @override
  Widget build(BuildContext context) {
    return const Column( // CONST!
      children: [
        Text('Static content'),
        MyConstantWidget(),
      ],
    );
  }
}
```

### Targeted State Updates

```dart
// CORRECT: Targeted state with ValueListenableBuilder
ValueListenableBuilder<int>(
  valueListenable: counter,
  builder: (context, value, child) => Text('$value'),
  child: const ExpensiveWidget(), // Won't rebuild!
)
```

### Flutter Anti-Pattern Quick Reference

| Never Do | Always Do |
|---|---|
| `setState()` everywhere | Targeted state management |
| Mutable constructors for static widgets | `const` constructors |
| `ListView` for large data | `ListView.builder` |
| Skip `dispose()` | Clean up controllers, listeners |

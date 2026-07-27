# Composition

Apply this reference when creating a component file, deciding where a sub-component lives, exporting a component, or judging whether a repeated pattern has earned a shared component.

## File and Directory Naming

A component's file name is its identity in kebab-case, and its exported name is the PascalCase of that file name. Keeping the two mechanically related means a reader who sees `<JobListItem>` in a tree knows the file without searching.

A component made of **sub-components** gets its own directory, and every part lives in it. Cohesion, not file count, is what earns the directory: `JobList`, `JobListHeader`, `JobListItem`, `JobListItemLoading`, and `JobListLoading` change together, so they sit together.

**Example:**

```text
job-list/
├── job-list.tsx              # the parent; bears the component's name
├── job-list-header.tsx
├── job-list-item.tsx
├── job-list-item-loading.tsx
└── job-list-loading.tsx
```

**Guidelines:**

- MUST name component files in kebab-case, and name the exported component the PascalCase of the file name.
- MUST give a component its own directory once it has sub-components, and place every part of it in that directory.
- MUST name the file bearing the parent component after the component itself, so the directory and its main file share a name.
- MUST name each sub-component file after the component it exports, prefixed by the parent's name (`job-list-item.tsx` exports `JobListItem`).
- MUST NOT scatter a component's parts across sibling directories, or leave a sub-component beside an unrelated component because it happened to be written there first.
- SHOULD keep a component with no sub-components as a single file rather than creating a directory for it alone.
- MUST follow the host project's directory layout for where component directories themselves live — a feature-owned components directory, a route-local underscore directory, or a shared component root — rather than imposing a new one.

## Exports

Named exports let a reader match an import to a file without opening it, and let a file grow a second exported part without churn. A default export is reserved for the one case a framework demands it: a route or page module whose framework loads it by file position.

**Guidelines:**

- MUST use named exports for components.
- MUST reserve `export default` for route, page, or layout modules whose framework requires it.
- SHOULD write the export inline (`export function JobListItem(…)`) as the default; follow the host project's convention where it consistently uses a trailing `export { … }` block instead.
- MUST NOT mix both forms within one file.

### Barrel Files

A barrel re-exports a directory's public parts from one module. It shortens imports and hides which file a part lives in — which is a cost as often as a benefit, because it also hides that an import reaches into a component's internals.

**Guidelines:**

- SHOULD NOT add a barrel file by default; import each part from the file that defines it.
- MUST add barrels when the host project consistently uses them, matching its placement and naming.
- MUST, when a barrel exists, export only the parts a consumer outside the directory may use, keeping internal parts (a context module, a private sub-component) out of it.

## Compound Components

A component with configurable parts is a set of cooperating components, not one component with a render prop for every slot. The parts are exported **flat**, each name prefixed by the parent's, so the tree reads as `<Button><ButtonIcon /><ButtonText>Save</ButtonText></Button>`.

Do not attach parts to the parent as properties (`Button.Text`). The dot form defeats tree-shaking, obscures where each part is defined, and reads as a namespace the parent does not actually own.

Variant state reaches the parts through a **private context** the parent provides, so a caller sets `variant` once on the parent instead of repeating it on every child. The context hook throws when a part renders outside its parent, turning a misuse into an immediate, named error.

**Example:**

```tsx
// button-context.tsx — private to the directory; not exported from a barrel
export function useButtonContext({
  componentName,
}: {
  componentName: string;
}): ButtonContextValue {
  const value = useContext(ButtonContext);

  if (value === null) {
    throw new Error(
      `<${componentName}> must be used within a <Button> component.`,
    );
  }

  return value;
}
```

**Guidelines:**

- MUST export compound parts as flat, named exports whose names begin with the parent component's name.
- MUST NOT expose parts as properties of the parent component (`Button.Text`, `Card.Header`).
- MUST pass variant state (`variant`, `intent`, `size`, and similar) from the parent to its parts through a private context module named `<parent>-context.tsx`, rather than re-declaring those props on every part.
- MUST make the context hook throw a message naming both the part and its required parent when the part renders outside it.
- MUST NOT export the context or its hook outside the component's own directory.
- SHOULD keep a part's own props limited to what that part alone varies; anything the whole component varies belongs on the parent.

## Primitive and Domain Components

A **primitive** knows nothing about the product's domain — a button, a text field, a select list. A **domain component** knows one entity and composes primitives to present it — a feed row, a collection list item. Keeping them apart is what lets a primitive serve a second feature without carrying the first feature's vocabulary.

A domain component **composes** a primitive; it never re-implements the primitive's appearance, and it never reaches into the primitive's internals to restyle it.

**Guidelines:**

- MUST place primitives in the host project's shared component location and domain components with the feature that owns their entity.
- MUST compose an existing primitive rather than re-creating its appearance; re-implementing a control that already exists is a defect, not a shortcut.
- MUST NOT give a primitive a prop, a branch, or a name that refers to a domain entity.
- SHOULD build a domain wrapper around a primitive when a feature needs the primitive bound to something specific — a form library's field controller, or one entity's shape — rather than adding that binding to the primitive itself.

### Promotion

**Guidelines:**

- MUST keep a component in the feature that owns it until a second feature needs it identically, or a third needs it at all; only then promote it to the shared location.
- MUST NOT build variants, props, or slots that no current consumer uses.
- SHOULD promote by moving the component and updating its importers in one change, rather than copying it and leaving two divergent versions.

## Icon Components

A component that renders a fixed icon imports it directly. A component that lets its caller choose the icon accepts the **icon component itself** as a prop — not a glyph-name string, which defeats type checking and hides which icons a bundle actually includes.

**Example:**

```tsx
export function MenuItem({ icon: Icon, label }: MenuItemProps): JSX.Element {
  return (
    <View style={styles.item}>
      <Icon color={theme.colors.text.neutral.base} size={24} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
```

**Guidelines:**

- MUST accept a caller-chosen icon as a component-typed prop, and alias it to a capitalized local name (`icon: Icon`) so it renders as an element.
- MUST NOT accept a glyph-name string when the icon set exposes components.
- MUST size and colour an icon from the project's design tokens, never from a hard-coded literal.
- MUST source icons from the host project's single icon set rather than introducing a second one.

# Styles

How CSS is organised, and the conventions a new component follows. The navbar
and the player control are the worked example: copy their shape.

## Why this exists

The stylesheet reached 1470 lines in a single file with 7 design tokens and 54
hardcoded colours, four competing naming conventions, and no ordering
discipline. That last one produced a real bug: `.tabs button` has specificity
`(0,1,1)` and silently beat `.syncbtn` at `(0,1,0)`, so a button styled as a
green outlined control rendered as a flat grey tab and nobody noticed until it
was screenshotted.

## Layers

```scss
@layer tokens, legacy, layout, components, utilities;
```

Declared in `_layers.scss`, which must be the first `@use` in `index.scss`
because Sass requires `@use` before any other rule and the layer statement has
to reach the output first to fix the order.

**Layer order beats specificity.** Anything in `components` wins over anything
in `legacy` no matter how many classes the legacy selector chains. That is what
makes migrating one component at a time safe: the old rules keep working for
everything not yet moved, and cannot fight the new ones.

`legacy` is the old stylesheet, wrapped whole. It shrinks as components move out
and the layer disappears when it is empty.

**Nothing may be left unlayered.** Unlayered CSS beats every layer, so one stray
unwrapped rule outranks the entire system.

## Files

Styles live **next to the component they style**, not in a central stylesheet.

```
src/
  components/
    navbar/
      navbar.ts       imports "./navbar.scss"
      navbar.scss
    player/
      player.ts       imports "./player.scss"
      player.scss
  styles/
    index.scss        @use list: layers, tokens, legacy
    _layers.scss      the layer order, first @use
    _tokens.scss      custom properties, in @layer tokens
    _mixins.scss      shared mixins, no output of its own
    _legacy.scss      the not-yet-migrated stylesheet
```

A component's `.scss` is pulled in by its own `.ts`, so deleting the folder
deletes the styles with it. Each wraps its rules in `@layer components` and
pulls mixins with `@use "mixins" as *`.

That bare `"mixins"` resolves through a sass load path pointing at
`src/styles`, set in `vite.config.ts`. **It needs `api: "modern-compiler"`**:
Vite 5 defaults to sass's legacy API, where the option is `includePaths`, so
`loadPaths` is silently ignored and every component fails with "Can't find
stylesheet to import" even though the same file compiles from the sass CLI.

Import order does not matter. `main.ts` imports `styles/index.scss` first, which
puts the layer statement at the top of the bundle, and after that the cascade is
decided by layer membership rather than by source order. Verified: moving every
component stylesheet out of `styles/` and into its component folder produced a
byte-identical CSS bundle.

## Naming

Module prefix, BEM-lite:

```
.player                    the block
.player__trigger           an element of it
.player__trigger--set      a variant of that element
```

**Everything nests under the block**, using `&__` so the whole component is one
top-level rule:

```scss
.player {
  &__trigger {
    &:hover { }
    &--set { }
  }
}
```

That compiles to `.player__trigger--set`, byte for byte what writing the
selectors out flat produces. It buys enforcement rather than output: a selector
that does not belong to the block cannot be added without being obvious, and the
component has one visible boundary.

**Do not confuse it with a real descendant wrapper.** `.player { .trigger { } }`
compiles to `.player .trigger` at two classes, which restarts the specificity
arms race that `@layer` exists to end. Nesting is for authoring; it must not
change what lands in the output.

Every selector in a component should be exactly one class. Checked by compiling
the component and looking for a descendant combinator or a second class in any
selector.

- Two underscores for an element, two dashes for a variant.
- **One level of element nesting only.** `.player__level-name`, not
  `.player__level__name`. If you want a third level the component wants
  splitting.
- The block name matches the file name.
- No bare generic classes. `.nm`, `.meta`, `.sk`, `.on`, `.err` and `.wide` were
  all real class names here, and all of them are collisions waiting to happen.
- Variants are toggled by full class name from TypeScript:
  `el.classList.toggle("player__trigger--set", on)`.

## Tokens

Everything in `_tokens.scss`, referenced as `var(--x)`. No literal colour, size
or radius in a component file except genuine one-offs, and those are listed
under "Known drift" below rather than left silently.

Scales are named by t-shirt size, smallest first: `--r-*` radius, `--s-*`
spacing, `--fs-*` font size.

## Mixins

`_mixins.scss` emits nothing on its own. Current set:

| Mixin | For |
|---|---|
| `button-reset` | strips background, border, cursor. Deliberately does **not** set `font-family` |
| `button-control` | `button-reset` plus `font-family: inherit` and a radius |
| `field` | input styling, placeholder, focus ring and disabled state |
| `panel` | the raised surface: background, border, radius |
| `stack($gap)` | column flex |
| `row($gap)` | row flex, centred |
| `truncate` | single line ellipsis |
| `no-spinner` | hides number input spinners |

`button-reset` and `button-control` are split because a `<button>` does not
inherit the page font by default, and the existing tabs relied on that. Choosing
one of the two is a real decision each time, not boilerplate.

## Migrating a component

1. Cut its rules out of `_legacy.scss`.
2. Write `components/thing/thing.scss` with `@layer components` and the new names.
3. Rename the class strings in the TypeScript that builds it.
4. `import "./thing.scss"` at the top of `components/thing/thing.ts`.
5. **Screenshot before and after and diff the pixels.** A structural refactor
   that changes appearance is two changes in one commit and neither can be
   reviewed. The navbar migration was verified identical across five states,
   down to zero differing pixels.

## Units

**Everything is `rem` against a 16px root.** No root `font-size` is set anywhere,
so the browser default applies and `1rem` is `16px`, which is why converting was
a no-op: every migrated state stayed pixel identical.

The point is that the app respects the reader's browser font size setting.
Verified by forcing the root to 20px and 24px: the navbar grows from 42px to 53
to 62 tall, tab text 13 to 16.25 to 19.5, the popover 336 to 420 to 504 wide,
with the layout intact and nothing clipped.

`px` survives in exactly one place, and it is deliberate:

- **`--hairline: 1px`.** Borders should stay crisp. A 1px border scaled to
  1.5px straddles a device pixel and renders soft or uneven. Confirmed to hold
  at 1px across all three root sizes.

Do not convert map or canvas dimensions when those get migrated. Tile sizes,
icon sizes and the world transform are tied to real pixels and are not a
typographic measure.

## Text size control

The type scale is multiplied by `--ui-scale`, so a small / medium / large
setting is a single property change. Presets live in `_tokens.scss`:

| Setting | `--ui-scale` |
|---|---|
| `data-text="small"` | 0.875 |
| default | 1 |
| `data-text="large"` | 1.125 |
| `data-text="huge"` | 1.25 |

Driven from TypeScript by stamping the root:

```ts
document.documentElement.setAttribute("data-text", "large");
```

Measured across all four, with the navbar open:

| | tab | sync | note | chip | popover | nav height |
|---|---|---|---|---|---|---|
| small | 11.38 | 10.94 | 10.06 | 9.63 | 214 | 40 |
| default | 13 | 12.5 | 11.5 | 11 | 244 | 42 |
| large | 14.63 | 14.06 | 12.94 | 12.38 | 275 | 45 |
| huge | 16.25 | 15.63 | 14.38 | 13.75 | 305 | 47 |

Text-driven widths scale with it, so popovers grow to fit rather than
overflowing. Spacing and radii deliberately **do not** scale: this is a text
size control, not a density control. A `--density` multiplier over the `--s-*`
scale is the same one-line pattern if that is wanted later.

### Per component, and the trap that makes it work

**Overriding `--ui-scale` on a component does nothing on its own.** Custom
properties are substituted where they are *declared*, not where they are used,
so `--fs-md` declared on `:root` has already resolved `--ui-scale` to the root
value by the time a descendant sees it. Proved it:

```css
:root  { --k: 2; --size: calc(8px * var(--k)); }
#inner { --k: 3; }                                    /* still 16px */
#redeclared { --k: 3; --size: calc(8px * var(--k)); } /* 24px */
```

That is why the scale lives in the `type-scale` mixin rather than being written
out once. A component that wants its own size re-emits it:

```scss
.player {
  --ui-scale: 1.5;
  @include type-scale;
}
```

Verified: that puts the player control at 19.5px while the tabs beside it stay
at 13px.

The presets above work without the mixin only because `:root` and
`:root[data-text="large"]` match the **same element**, so the override is in
scope when `--fs-*` is substituted. Any *descendant* override needs the mixin.

Component-local deviation tokens must carry the multiplier themselves, as the
player's do: `calc(0.78125rem * var(--ui-scale))`. They are declared on
`.player`, so they pick up a local `--ui-scale` automatically.

## The scale

Set in `_tokens.scss`. The navbar and player use nothing else except the named
deviations below. Comments in the table are the px equivalent at a 16px root
and `--ui-scale: 1`.

| Token | Now | = px | Used for |
|---|---|---|---|
| `--fs-xs` | 0.6875rem | 11px | level chips, roster meta |
| `--fs-sm` | 0.75rem | 12px | remove button, level inputs |
| `--fs-md` | 0.8125rem | 13px | tabs, trigger, name input |
| `--s-3xs` | 0.125rem | 2px | hairline gaps |
| `--s-2xs` | 0.1875rem | 3px | roster gap, chip padding |
| `--s-xs` | 0.25rem | 4px | grid gaps |
| `--s-sm` | 0.375rem | 6px | control padding, navbar gap |
| `--s-md` | 0.5rem | 8px | pick padding, levels margin |
| `--s-lg` | 0.625rem | 10px | navbar padding, editor row gap |
| `--s-xl` | 0.75rem | 12px | tab padding, popover padding |
| `--r-xs` | 0.25rem | 4px | chips and fields |
| `--r-md` | 0.375rem | 6px | tabs, controls |
| `--r-lg` | 0.5rem | 8px | the popover |

## Deviations

Every value in the navbar that does **not** sit on the scale is declared as a
custom property on `.player` rather than buried in a rule. That is deliberate:
the drift is countable and lives in one block, and removing one means pointing
its name at a scale token and deleting the line.

| Deviation | Now | = px | Nearest scale step |
|---|---|---|---|
| `--player-fs-control` | 0.78125rem | 12.5px | `--fs-sm` 12 or `--fs-md` 13 |
| `--player-fs-note` | 0.71875rem | 11.5px | `--fs-xs` 11 or `--fs-sm` 12 |
| `--player-fs-micro` | 0.65625rem | 10.5px | `--fs-xs` 11 |
| `--player-gap` | 0.5625rem | 9px | `--s-md` 8 or `--s-lg` 10 |
| `--player-input-pad-x` | 0.5625rem | 9px | `--s-md` 8 or `--s-lg` 10 |
| `--player-sync-pad-x` | 0.6875rem | 11px | `--s-lg` 10 or `--s-xl` 12 |
| `--player-pick-pad-y` | 0.3125rem | 5px | `--s-xs` 4 or `--s-sm` 6 |
| `--player-remove-pad-x` | 0.4375rem | 7px | `--s-sm` 6 or `--s-md` 8 |
| `--player-entry-radius` | 0.3125rem | 5px | `--r-xs` 4 or `--r-md` 6 |
| `--player-sync-disabled-opacity` | 0.5 |  | `--opacity-disabled` 0.6 |

Sizes are also fixed dimensions rather than scale values, and are fine as
component tokens: `--player-pop-width` 15.25rem, `--player-pop-width-wide` 21rem,
`--player-field-name-width` 1.625rem.

## Behaviour still to decide

Not sizes, but the same kind of drift, and each changes pixels:

- **Tabs do not inherit the app font.** `.navbar__tab` sets no `font-family`, so
  tabs render in the browser's default button font while every other control
  uses Segoe UI. This is why `button-reset` and `button-control` are separate
  mixins. Switching `.navbar__tab` to `button-control` fixes it.
- **Tabs resize when selected.** The base tab has no border and the active one
  adds one, so the row shifts by 2px per tab on selection. `.player__trigger`
  already avoids this with a transparent border; the tabs should match.
- **`.linkbtn` is still a legacy global**, shared across several tabs, so it
  belongs to a later shared-primitives pass rather than to the player.

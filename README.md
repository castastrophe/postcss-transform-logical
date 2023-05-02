# postcss-transform-logical

> Transform logical CSS properties using a `logical` keyword.

## Installation

Install this plugin for PostCSS using your preferred package manager:

```sh
yarn add -D postcss-transform-logical
```

## CLI Usage

Run PostCSS with this plugin using the following command:

```sh
postcss -u postcss-transform-logical -o dist/index.css src/index.css
```

Or add it to your PostCSS configuration:

```js
module.exports = {
  plugins: {
    'postcss-transform-logical': {},
  },
};
```

## Usage

This plugin transforms logical CSS properties using a `logical` keyword. To do this, prefix your desired transform with `logical` and follow it up with your desired transform function(s).

```css
.transform-it {
  transform: logical rotate(90deg) scale3d(2.5, 1.2, 0.3);
}
```

This will output the following:

```css
.transform-it,
[dir="ltr"] .transform-it,
.transform-it:dir(ltr) {
  transform: rotate(90deg) scale3d(2.5, 1.2, 0.3);
}

[dir="rtl"] .transform-it,
.transform-it:dir(rtl) {
  transform: matrix(-1, 0, 0, 1, 0, 0) rotate(90deg) scale3d(2.5, 1.2, 0.3);
}
```

For the left-to-right selector, note that the logical keyword was dropped and no replacement was inserted. This is because the logical keyword is the default for left-to-right layouts.

For the right-to-left selector, note that the logical keyword was replaced with a matrix transform. This transform adjusts the element's position to account for the right-to-left layout.

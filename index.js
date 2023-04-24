/** @link https://github.com/shellscape/postcss-values-parser */
const valuesParser = require('postcss-values-parser');

/**
 * @type import('postcss').PluginCreator
 *
 * from:
 * .indicatorndicator { transform: logical rotate(0deg); }
 *
 * to:
 * @note: ltr is not necessary b/c it's a 0deg rotation...
 * [dir="rtl"] .indicator { transform: matrix(-1, 0, 0, 1, 0, 0); }
 * @todo: .indicator:dir(rtl) { transform: matrix(-1, 0, 0, 1, 0, 0); }
 *
 * from:
 * .item { transform: logical rotate(90deg); }
 *
 * to:
 * [dir="ltr"] .item { transform: rotate(90deg); }
 * [dir="rtl"] .item { transform: matrix(-1, 0, 0, 1, 0, 0) rotate(90deg); }
 */
module.exports = () => {
  return {
    postcssPlugin: 'postcss-transform-logical',
    /**
     * @type import('postcss').Processors.Rule
     * @description Look for rules that contain a transform property with the logical keyword
     * and if found, add a direction to the selector and add the transform value to the rule
     * @param {import('postcss').Rule} rule
     */
    Rule(rule, { result, Declaration }) {
      const processRule = rule.nodes.filter(n => n.type === 'decl' && n.prop === 'transform' && n.value.includes('logical')).map(n => n.value);
      if (processRule.length === 0) return;

      // Skip rules that already have a direction specified
      if (['[dir="ltr"]', '[dir="rtl"]', ':dir(ltr)', ':dir(rtl)'].every(test => rule.selector.includes(test))) {
        return;
      }

      /**
       * A utility function to create a new rule with the given transforms
       * @param {import('postcss').Rule} rule
       * @param {string[]} transforms
       * @param {'ltr'|'rtl'} direction
       * @returns {void}
       */
      function createRule(rule, transforms = [], direction = 'ltr') {
        // If there are no transforms, we don't need to create a new rule
        if (!rule || transforms.length === 0) return;

        const selectors = [];
        // If direction is `ltr`, include a clean selector as a fallback
        if (direction === 'ltr') selectors.push(rule.selector);

        selectors.push(
          `[dir="${direction}"] ${rule.selector}`,
          `${rule.selector}:dir(${direction})`,
        );

        rule.cloneAfter({
          selector: selectors.join(',\n'),
          raws: {
            before: '\n\n',
          },
          nodes: [
            new Declaration({
              raws: {
                before: '\n  ',
                between: ': ',
                after: ';',
              },
              prop: 'transform',
              value: transforms.join(' '),
            }),
          ],
        });
      }

      // These are the values for the updated transforms after parsing
      const ltrTransforms = [];
      const rtlTransforms = [];
      rule.walkDecls('transform', (decl, index) => {
        const values = valuesParser.parse(decl.value);
        if (!values || values.nodes.length === 0) {
          decl.warn(result, `could not parse ${decl.value}`, {
            plugin: this.postcssPlugin,
          });
          return;
        }

        // We need to walk the values to find the functions we want to update
        values.walk((val, idx) => {
          /* -- Start by testing all the cases where we'd want to skip processing -- */
          if (idx === 0 && val.type === 'word' && val.value !== 'logical') return false;
          if (idx === 0 && val.type === 'word' && val.value === 'logical') return;

          if (val.type === 'func' && val.name === 'matrix') {
            decl.error('logical flips cannot be performed on transforms that use matrix()', {
              plugin: this.postcssPlugin,
            });
            return false;
          }

          /* @todo: are there any edge cases to consider? */
          if (val.type !== 'func') {
            if (['word', 'comment'].every(type => type === val.type) && val.value) {
              [ltrTransforms, rtlTransforms].forEach(t => t.push(val.value));
            }
            return;
          }

          /* -- Start processing the value data -- */
          const valueString = valuesParser.nodeToString(val);

          // If the function is not rotate, we just copy it to both LTR and RTL
          if (!val.name?.startsWith('rotate')) {
            [ltrTransforms, rtlTransforms].forEach(t => t.push(valueString));
            return;
          }

          // If the function is rotate, we need to check the value
          // If it's 0deg, we don't need to add it to either LTR or RTL
          // If it's not 0deg, we need to add it to both LTR and RTL
          let rotation;
          val.nodes.filter(n => n.type === 'numeric' && n.unit === 'deg').forEach(n => {
            if (n.value && !rotation) rotation = parseInt(n.value, 10);
          });

          if (!rotation) return;

          // If the rotation is not 0deg, add it to both LTR and RTL
          if (rotation > 0) {
            [ltrTransforms, rtlTransforms].forEach(t => t.push(valueString));
          }
        }, true);

        // Remove the original transform declaration
        decl.remove();
      });

      createRule(rule, [
        'matrix(-1, 0, 0, 1, 0, 0)',
        ...rtlTransforms
      ], 'rtl');

      if (ltrTransforms.length > 0) {
        createRule(rule, ltrTransforms);
      }

      // Remove the original rule if it's empty now
      if (rule.nodes.length === 0) rule.remove();
    },
  };
};

module.exports.postcss = true;

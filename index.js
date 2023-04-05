/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * from:
 * .spectrum-Accordion-itemIndicator { transform: logical rotate(0deg); }
 *
 * to:
 * @note: ltr is not necessary b/c it's a 0deg rotation...
 * [dir="rtl"] .spectrum-Accordion-itemIndicator { transform: matrix(-1, 0, 0, 1, 0, 0); }
 * @todo: .spectrum-Accordion-itemIndicator:dir(rtl) { transform: matrix(-1, 0, 0, 1, 0, 0); }
 *
 * from:
 * .spectrum-Accordion-item.is-open > .spectrum-Accordion-itemHeading > .spectrum-Accordion-itemIndicator { transform: logical rotate(90deg); }
 *
 * to:
 * [dir="ltr"] .spectrum-Accordion-item.is-open > .spectrum-Accordion-itemHeading > .spectrum-Accordion-itemIndicator { transform: rotate(90deg); }
 * [dir="rtl"] .spectrum-Accordion-item.is-open > .spectrum-Accordion-itemHeading > .spectrum-Accordion-itemIndicator { transform: matrix(-1, 0, 0, 1, 0, 0) rotate(90deg); }
 */

const selectorParser = require('postcss-selector-parser');
const valueParser = require('postcss-value-parser');

/** @type import('postcss').PluginCreator */
module.exports = () => {
  return {
    postcssPlugin: 'postcss-transform-logical',
    prepare() {
      return {
        /**
         * @type import('postcss').Processors.Rule
         * @description Look for rules that contain a transform property with the logical keyword
         * and if found, add a direction to the selector and add the transform value to the rule
         * @param {import('postcss').Rule} rule
         */
        Rule(rule, { result, Declaration }) {
          const transforms = rule.nodes.filter(n => n.type === 'decl' && n.prop === 'transform').map(n => n.value);
          if (transforms.length === 0) return;

          // Skip rules that already have a direction specified
          if (rule.selector.includes('[dir="ltr"]') || rule.selector.includes('[dir="rtl"]')) return;

          // These are the values for the updated transforms after parsing
          const ltrTransforms = [];
          const rtlTransforms = ['matrix(-1, 0, 0, 1, 0, 0)'];
          rule.walkDecls('transform', (decl) => {
            let values = valueParser(decl.value);
            if (!values || values.nodes.length === 0) {
              decl.warn(result, `could not parse ${decl.value}`, {
                plugin: this.postcssPlugin,
              });
              return;
             }

             // We only process the transform if it includes the `logical` keyword
            if (values.nodes[0]?.value !== 'logical') return;

            // We need to walk the values to find the functions
            values.walk((val, idx) => {
              if (idx === 0 && val.value !== 'logical') return false;
              if (val.type !== 'function') {
                if (val.value === 'logical') return;
                /* @todo: is there any edge cases to consider here? */
                return;
              }

              if (val.value === 'matrix') {
                decl.error('logical flips cannot be performed on transforms that use matrix()', {
                  plugin: this.postcssPlugin,
                });
                return false;
              }

              const valueString = valueParser.stringify(val);

              // If the function is not rotate, we just copy it to both LTR and RTL
              if (val.value !== 'rotate') {
                ltrTransforms.push(valueString);
                rtlTransforms.push(valueString);
                return;
              }

              // If the function is rotate, we need to check the value
              // If it's 0deg, we don't need to add it to either LTR or RTL
              // If it's not 0deg, we need to add it to both LTR and RTL
              const rotation = valueParser.unit(val.nodes[0]?.value);
              // Throw an error if we can't parse the rotation value
              if (!rotation) {
                decl.error('could not parse rotation value', {
                  plugin: this.postcssPlugin,
                });
                return;
              }

              if (parseInt(rotation.number, 10) !== 0) {
                ltrTransforms.push(valueString);
                rtlTransforms.push(valueString);
              }
            }, true);

            // Remove the original transform declaration
            decl.remove();
          });

          function createRule(rule, transforms, direction = 'ltr') {
            rule.cloneAfter({
              selector: `[dir="${direction}"] ${rule.selector}`,
              nodes: [
                new Declaration({
                  raws: {
                    before: '\n      ',
                    between: ': ',
                    after: ';',
                  },
                  prop: 'transform',
                  value: transforms.join(' '),
                }),
              ],
            })
          }

          if (ltrTransforms.length > 0) createRule(rule, ltrTransforms);
          if (rtlTransforms.length > 0) createRule(rule, rtlTransforms, 'rtl');

          // Remove the original rule if it's empty now
          if (rule.nodes.length === 0) {
            rule.remove();
            return;
          }
        },
      };
    }
  };
};

module.exports.postcss = true;

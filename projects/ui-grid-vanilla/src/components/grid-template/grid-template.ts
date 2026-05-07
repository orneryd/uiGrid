import { template } from '@ornery/web-components';
import { bindEvents, setupConnect } from '@ornery/web-components/templates';

/**
 * A declarative template element for defining reusable cell/row templates
 * without writing JavaScript.
 * 
 * Supports both `${this.prop}` and `{{prop}}` binding syntax.
 *
 * @example
 * ```html
 * <!-- Define a reusable badge component from markup alone -->
 * <template is="ui-grid-template" name="ui-status-badge" status="unknown">
 *   <style>
 *     :host { display: inline-block; }
 *     .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
 *     .badge-active { background: #d1fae5; color: #065f46; }
 *     .badge-inactive { background: #fee2e2; color: #991b1b; }
 *   </style>
 *   <span class="badge badge-${this.status}">${this.status}</span>
 * </template>
 *
 * <!-- Use it inside a grid cell slot -->
 * <ui-grid-element>
 *   <template slot="cell-status">
 *     <ui-status-badge status="{{value}}"></ui-status-badge>
 *   </template>
 * </ui-grid-element>
 * ```
 */
export class UIGridTemplate extends HTMLTemplateElement {
  static readonly TAG = 'ui-grid-template';

  connectedCallback(): void {
    const componentName = this.getAttribute('name') || this.getAttribute('id');
    if (!componentName) {
      throw new Error(
        'ui-grid-template requires a "name" or "id" attribute to register the component'
      );
    }

    const htmlTemplate = this.innerHTML;
    const defaultAttrs = this;

    const render = (props: Record<string, unknown> = {}) => {
      // Support both ${} and {{}} bindings
      const rendered = htmlTemplate.replace(/\$\{.+?}/gim, (s) => {
        return template(s, props) as string;
      }).replace(/{{\s*([^}]+?)\s*}}/g, (_match, expression) => {
        return template('${' + String(expression).trim() + '}', props) as string;
      });
      const parsed = new DOMParser().parseFromString(rendered, 'text/html');
      const elements = [...parsed.head.children, ...bindEvents(parsed.body, props).childNodes];
      return setupConnect(elements, props);
    };

    if (!customElements.get(componentName)) {
      customElements.define(
        componentName,
        class extends HTMLElement {
          private _observer: MutationObserver | null = null;

          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback(): void {
            this.applyAttributes();
            this._observer = new MutationObserver(() => this.applyAttributes());
            this._observer.observe(this, { attributes: true });
          }

          applyAttributes(): void {
            const props: Record<string, string> = {};
            // Apply defaults from the template definition
            Array.from(defaultAttrs.attributes).forEach((attr) => {
              if (attr.name !== 'is' && attr.name !== 'name' && attr.name !== 'id') {
                props[attr.name] = attr.value;
              }
            });
            // Override with instance attributes
            Array.from(this.attributes).forEach((attr) => {
              props[attr.name] = attr.value;
            });
            render(props).connect(this.shadowRoot!);
          }

          disconnectedCallback(): void {
            this._observer?.disconnect();
            this._observer = null;
          }
        },
      );
    }
  }

  static define(tagName = UIGridTemplate.TAG): void {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, UIGridTemplate, { extends: 'template' });
    }
  }
}

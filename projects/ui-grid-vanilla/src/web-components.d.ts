declare module '@ornery/web-components' {
  export function template(expr: string, context: Record<string, unknown>): string | unknown;
  export function stripES6(expr: string, context: Record<string, unknown>): string;
  export function getFromObj(path: string, obj: Record<string, unknown>): unknown;
  export function toParams(str: string, options?: Record<string, (val: string, key: string, params: Record<string, unknown>) => unknown>): Record<string, unknown>;
  export function toSearch(options: Record<string, unknown>): string;
  export function prefixKeys(obj: Record<string, unknown>, prefix: string): Record<string, unknown>;
  export function toDataAttrs(obj: Record<string, unknown>): Record<string, unknown>;
  export function encodeHTML(str: string): string;
  export function shouldEncode(str: string): string;
  export function toLowerMap(obj: unknown): unknown;
  export const ContextBinding: (superclass: typeof HTMLElement) => typeof HTMLElement;
  export class DataManager {
    get(key?: string): unknown;
    getState(): Record<string, unknown>;
    set(key: string | Record<string, unknown>, value?: unknown): unknown;
    setState(newState: Record<string, unknown>): unknown;
    subscribe(callback: (event: string, newState: Record<string, unknown>, oldState: Record<string, unknown>) => void): { destroy(): void };
    subscribeTo(keys: string | string[], callback: (updates: Record<string, unknown>, newState: Record<string, unknown>, oldState: Record<string, unknown>) => void): { destroy(): void };
  }
  export class EventMap {
    set(key: string, val: unknown, notify?: boolean): EventMap;
    get(key: string): unknown;
    getAll(): Record<string, unknown>;
    del(key: string, notify?: boolean): EventMap;
    clear(notify?: boolean): EventMap;
    replace(keyValuePairs: Record<string, unknown>, notify?: boolean): EventMap;
    on(event: string, callback: (...args: unknown[]) => void): { destroy(): void };
  }
  export class I18n {
    constructor(options?: Record<string, unknown>);
    getLocale(): string;
    setLocale(locale: string): void;
    getMessages(locale?: string): Record<string, string>;
    setMessages(values: Record<string, Record<string, string>>): void;
    addMessages(locale: string | Record<string, string>, newStrings?: Record<string, string>): void;
    get(key: string, data?: Record<string, unknown>): string;
    getAll(namespace?: string, context?: Record<string, unknown>): Record<string, string>;
    subscribe(callback: (...args: unknown[]) => void): { destroy(): void };
  }
}

declare module '@ornery/web-components/templates' {
  type ConnectableNodeList = Node[] & {
    connect(root?: Element | ShadowRoot): Element | ShadowRoot | undefined;
  };
  export function bindEvents(root: Element, context?: Record<string, unknown>): Element;
  export function setupConnect(nodeList: Node[], context?: Record<string, unknown>): ConnectableNodeList;
}

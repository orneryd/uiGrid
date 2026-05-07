declare module '*.html' {
  type ConnectableNodeList = Node[] & {
    connect(root?: Element | ShadowRoot): Element | ShadowRoot | undefined;
  };
  const template: (props?: Record<string, unknown> | object) => ConnectableNodeList;
  export default template;
}

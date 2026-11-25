/** The browser bundle accepts an ArrayBuffer in both Vite and Node/Vitest. */
declare module 'mammoth/mammoth.browser.js' {
  interface ExtractResult {
    value: string;
    messages: readonly unknown[];
  }
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>;
  };
  export default mammoth;
}

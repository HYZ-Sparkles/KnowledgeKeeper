/** Vite resolves `?url` imports to the emitted asset URL (used for pdf.js' worker). */
declare module '*?url' {
  const url: string;
  export default url;
}

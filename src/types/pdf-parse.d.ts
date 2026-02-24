declare module 'pdf-parse' {
  function pdfParse(
    dataBuffer: Buffer,
    options?: { pagerender?: (pageData: unknown) => string },
  ): Promise<{ numpages: number; numrender: number; info: unknown; metadata: unknown; text: string }>;
  export = pdfParse;
}

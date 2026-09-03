/** react-pdf `file` source. Password must live on the source so a remount can still decrypt. */
export function pdfDocumentFile(url: string | null, password?: string) {
  if (!url) return null;
  const secret = password?.trim();
  if (secret) return { url, password: secret };
  return url;
}

export function resolveAppAsset(relativePath: string) {
  return new URL(relativePath, document.baseURI).toString();
}

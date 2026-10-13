/** The gallery is only reachable inside the private preview package. */
export function isDesignSystemReference(
  previewEnabled: unknown,
  search: string,
): boolean {
  return previewEnabled === true && new URLSearchParams(search).get('reference') === 'design-system';
}

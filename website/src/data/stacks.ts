export const STACKS = [
  { id: 'rspack', label: 'Rspack' },
  { id: 'rsbuild', label: 'Rsbuild' },
  { id: 'rslib', label: 'Rslib' },
  { id: 'rstest', label: 'Rstest' },
  { id: 'rsdoctor', label: 'Rsdoctor' },
  { id: 'rspress', label: 'Rspress' },
  { id: 'rslint', label: 'Rslint' },
] as const;

export type StackId = (typeof STACKS)[number]['id'];

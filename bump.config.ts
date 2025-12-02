import { defineConfig } from 'bumpp';
import { version } from './package.json';

export default defineConfig({
  commit: 'v%s',
  currentVersion: version,
  confirm: false,
  tag: false,
  push: false,
});

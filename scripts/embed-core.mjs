import { cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

// Ship the private workspace inside the public plugin, including its declarations.
const output = 'dist/esm';
const embedded = join(output, 'shared-core');
cpSync('packages/native-ui-core/dist', embedded, { recursive: true });
function rewrite(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      rewrite(file);
    } else if (file.endsWith('.js') || file.endsWith('.d.ts')) {
      const source = readFileSync(file, 'utf8');
      const rewritten = source.replace(/(['"])@webview-native-ui\/core(?:\/([^'"]+))?\1/g, (_, quote, subpath) => {
        const target = subpath === 'integration' ? 'native-integration/index' : subpath || 'index';
        let path = relative(dirname(file), join(embedded, `${target}.js`))
          .split('\\')
          .join('/');
        if (!path.startsWith('.')) path = `./${path}`;
        return `${quote}${path}${quote}`;
      });
      if (rewritten !== source) writeFileSync(file, rewritten);
    }
  }
}
rewrite(output);

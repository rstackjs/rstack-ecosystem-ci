import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

const origin = process.argv[2] ?? 'http://localhost:5137';

// Allow the dev/preview server to finish its initial compilation in CI.
for (let attempt = 0; ; attempt++) {
  try {
    const response = await fetch(origin, {
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) break;
    throw new Error(`Server returned ${response.status}`);
  } catch (error) {
    if (attempt >= 59) throw error;
    await setTimeout(1_000);
  }
}

for (const stack of ['rspack', 'rsbuild']) {
  const response = await fetch(`${origin}/?stack=${stack}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /Rstack Ecosystem CI/);
  // Timeline rows must already exist in the response, before JavaScript runs.
  assert.ok(html.includes(`github.com/web-infra-dev/${stack}/commit/`));

  const stylesheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
  assert.ok(stylesheets.length > 0, 'SSR must include stylesheet links');
  for (const [link] of stylesheets) {
    const href = link.match(/href="([^"]+)"/)?.[1];
    assert.ok(href);
    const css = await fetch(new URL(href, origin));
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);
    assert.ok((await css.text()).length > 0);
  }
  console.log(`SSR and CSS passed: ${stack}`);
}

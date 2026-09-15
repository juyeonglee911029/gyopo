import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('./src/app/api/online-count/route.ts', import.meta.url), 'utf8');
const code = stripTypeScriptTypes(source).replace("import { NextResponse } from 'next/server';", 'const NextResponse = Response;');
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('online count reports exact aggregates including zero and more than 200', async (t) => {
  for (const count of [0, 1, 315]) {
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      assert.match(url, /:runAggregationQuery$/);
      const query = JSON.parse(options.body).structuredAggregationQuery;
      assert.equal(query.structuredQuery.limit, undefined);
      assert.equal(query.structuredQuery.from[0].collectionId, 'publicPresence');
      assert.equal(query.structuredQuery.where.fieldFilter.field.fieldPath, 'lastSeenAt');
      assert.deepEqual(query.aggregations, [{ count: {}, alias: 'online' }]);
      return Response.json([{ result: { aggregateFields: { online: { integerValue: String(count) } } } }]);
    });
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { count });
    t.mock.restoreAll();
  }
});

test('unavailable or malformed data never becomes a fabricated count', async (t) => {
  for (const response of [new Response('', { status: 403 }), Response.json([]), Response.json([{ result: { aggregateFields: { online: { integerValue: '-1' } } } }])]) {
    t.mock.method(globalThis, 'fetch', async () => response);
    const result = await GET();
    assert.equal(result.status, 503);
    assert.equal((await result.json()).count, null);
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const result = await GET();
  assert.equal(result.status, 503);
  assert.equal((await result.json()).count, null);
});

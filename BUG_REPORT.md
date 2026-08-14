# Bug Report

Found while writing unit tests for `src/services/taskService.js`
(`tests/taskService.test.js`). Each bug below was discovered because a test
written against the _documented/expected_ behavior failed against the actual
implementation.

Run `npm test` to reproduce — 6 of 32 tests fail, corresponding to the 4 bugs
below.

---

## Bug 1: `getByStatus` matches on substring, not exact value

**Where:** `src/services/taskService.js`, line 5

```js
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

**Expected behavior:** `getByStatus('todo')` should return only tasks whose
status is _exactly_ `'todo'`.

**Actual behavior:** `.includes()` is a **string** method here (since
`t.status` is a string, not an array), so it does substring matching. A query
like `getByStatus('do')` incorrectly matches any task with status `'todo'`,
because `'todo'.includes('do')` is `true`. This also means `GET
/tasks?status=do` on the API would silently return tasks the caller didn't
ask for.

**How discovered:** Test `getByStatus > does not return tasks whose status
merely contains the search string as a substring` — expected 0 results for
`getByStatus('do')` with a task of status `'todo'` in the store, got 1.

**Suggested fix:**

```js
const getByStatus = (status) => tasks.filter((t) => t.status === status);
```

---

## Bug 2: `getPaginated` has an off-by-one page offset

**Where:** `src/services/taskService.js`, line 7

```js
const getPaginated = (page, limit) => {
  const offset = page * limit;
  return tasks.slice(offset, offset + limit);
};
```

**Expected behavior:** Page 1 with `limit=10` should return the first 10
items (offset 0). Page 2 should return items 11–20 (offset 10).

**Actual behavior:** Because `offset = page * limit` (not `(page - 1) *
limit`), **page 1 skips the first 10 items entirely** and returns what should
be page 2's data. Every page is shifted forward by one page's worth of
items, and the true last page of data is silently dropped (e.g. with 25
items and `limit=10`, page 3 returns nothing instead of the final 5 items).

**How discovered:** Tests `getPaginated > returns the first page of results
for page 1`, `> returns the second page of results for page 2`, and `>
returns a partial page when fewer items remain` — all three failed, each
off by exactly one page's worth of items.

**Suggested fix:**

```js
const getPaginated = (page, limit) => {
  const offset = (page - 1) * limit;
  return tasks.slice(offset, offset + limit);
};
```

---

## Bug 3: `update` allows overwriting a task's `id`

**Where:** `src/services/taskService.js`, line 26

```js
const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const updated = { ...tasks[index], ...fields };
  tasks[index] = updated;
  return updated;
};
```

**Expected behavior:** `PUT /tasks/:id` should update the fields provided
(title, description, status, etc.) but the task's identity (`id`) should
never change as a side effect of an update.

**Actual behavior:** Because `fields` is spread directly onto the existing
task with no filtering, sending `{ "id": "something-else", "title": "..." }`
in the request body silently changes the task's `id`. The task is now
unreachable at its original ID, and any external reference to the old ID
(bookmarks, other systems, etc.) breaks.

**How discovered:** Test `update > does not let the update change the task
id` — expected the original `id` to be preserved, got the attacker-supplied
`id` value instead.

**Suggested fix:** Strip protected fields (`id`, `createdAt`) from `fields`
before merging, e.g.:

```js
const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const {
    id: _ignoredId,
    createdAt: _ignoredCreatedAt,
    ...safeFields
  } = fields;
  const updated = { ...tasks[index], ...safeFields };
  tasks[index] = updated;
  return updated;
};
```

---

## Bug 4: `completeTask` resets `priority` to `'medium'`

**Where:** `src/services/taskService.js`, line 34

```js
const completeTask = (id) => {
  const task = findById(id);
  if (!task) return null;
  const updated = {
    ...task,
    priority: 'medium',
    status: 'done',
    completedAt: new Date().toISOString(),
  };
  ...
};
```

**Expected behavior:** Marking a task complete (`PATCH /tasks/:id/complete`)
should change `status` to `'done'` and set `completedAt`, without touching
unrelated fields like `priority`.

**Actual behavior:** `priority` is unconditionally overwritten to
`'medium'`. A `high`-priority task loses that information the moment it's
completed, which breaks any reporting or history that relies on knowing the
original priority of finished work.

**How discovered:** Test `completeTask > preserves the task priority when
completing it` — created a task with `priority: 'high'`, completed it,
expected `priority` to still be `'high'`, got `'medium'`.

**Suggested fix:** Drop the `priority: 'medium'` line entirely — there's no
reason completion should touch priority:

```js
const updated = {
  ...task,
  status: "done",
  completedAt: new Date().toISOString(),
};
```

---

## Summary

| #   | Function       | Bug                                                  | Severity                               |
| --- | -------------- | ---------------------------------------------------- | -------------------------------------- |
| 1   | `getByStatus`  | Substring match instead of exact match               | Medium — wrong filter results          |
| 2   | `getPaginated` | Off-by-one page offset, drops first page & last page | High — pagination is unusable          |
| 3   | `update`       | Allows overwriting `id` via request body             | High — data integrity / identity issue |
| 4   | `completeTask` | Silently resets `priority` on completion             | Medium — silent data loss              |

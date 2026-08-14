# Take-Home Assignment — The Untested API

A small Task Manager API (Node.js + Express, in-memory store) that shipped
without tests. This submission adds a test suite, documents the bugs those
tests uncovered, fixes one of them, and adds a new `assign` endpoint.

## Documentation in this repo

| File                             | What's in it                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [ASSIGNMENT.md](./ASSIGNMENT.md) | The original assignment brief (the task as given).                                                               |
| [BUG_REPORT.md](./BUG_REPORT.md) | The 4 bugs found through testing — expected vs. actual behavior, how each was discovered, and the suggested fix. |
| README.md                        | This file — overview, setup, results, and submission notes.                                                      |

## Project layout

```
task-api/
├── src/
│   ├── app.js                  # Express app + server bootstrap
│   ├── routes/tasks.js         # /tasks route handlers
│   ├── services/taskService.js # In-memory task store + business logic
│   └── utils/validators.js     # Request body validation
└── tests/
    ├── taskService.test.js     # Unit tests for the service layer
    ├── tasks.route.test.js     # Integration tests for the routes (Supertest)
    └── assign.test.js          # Tests for the new PATCH /:id/assign endpoint
```

## Setup

```bash
git clone https://github.com/ghsunnyk/underpin-services-assignment.git
cd task-api
npm install
npm start        # runs on port 3000
npm test         # run tests
npm run coverage # run tests + coverage report
```

The API uses an in-memory store — no database needed. Data resets on restart.

## Tests

Unit tests for `taskService.js` and integration tests for the routes (via
Supertest), covering the happy path for every endpoint plus edge cases
(empty results, invalid input, not-found, pagination boundaries, filtering).

**Coverage** (`npm run coverage`):

```
File             | % Stmts | % Branch | % Funcs | % Lines
-----------------|---------|----------|---------|---------
All files        |   95.56 |     90.8 |   90.32 |   95.13
 src/routes      |     100 |    91.66 |     100 |     100
 src/services    |     100 |       95 |     100 |     100
 src/utils       |   92.59 |    89.74 |     100 |   92.59
```

Well above the 80% target. (`src/app.js` is the server bootstrap and is not
exercised by tests, which is why the top-level `src` number is lower.)

> **Note on failing tests:** `npm test` reports 4 failing tests by design.
> Each one asserts the _correct_ behavior for a bug that is still open (bugs
> 1, 3, and 4 in [BUG_REPORT.md](./BUG_REPORT.md)) — so the failures _are_ the
> bug documentation. The suggested fix for each is included as a comment right
> next to the buggy line in the source. See "Bug fix" below for the one that
> was actually fixed.

## Bugs, fix, and feature

### Bug report

Four bugs were found while writing the service-layer tests. Full details in
[BUG_REPORT.md](./BUG_REPORT.md):

1. `getByStatus` — substring match instead of exact match.
2. `getPaginated` — off-by-one page offset (drops the first and last page).
3. `update` — request body can overwrite a task's `id`.
4. `completeTask` — silently resets `priority` to `'medium'`.

### Bug fix

**Bug 2 (pagination)** is fixed in `src/services/taskService.js`: the offset
now uses `(page - 1) * limit`, so page 1 returns the first page of results.
The pagination tests that previously failed now pass.

### New feature — `PATCH /tasks/:id/assign`

Assigns a task to a person.

- **Body:** `{ "assignee": "string" }`
- Stores `assignee` on the task and returns the updated task.
- `400` if `assignee` is missing, not a string, or empty/whitespace-only.
- `404` if the task doesn't exist.
- The name is trimmed before storing. Re-assigning an already-assigned task
  is allowed (it simply overwrites the previous assignee).

Tests for this endpoint live in `tests/assign.test.js`.

## Submission notes

- **What I'd test next:** concurrent updates against the shared in-memory
  store, malformed/oversized JSON bodies, and the `getStats` overdue logic
  around timezones and the `done`-excluded case.
- **What surprised me:** the bugs were subtle and only surfaced through tests
  written against the _documented_ behavior — `getByStatus` using string
  `.includes()` looks correct at a glance.
- **Questions before shipping to production:** should the store be swapped for
  a real database (data currently resets on restart)? Should `PUT /tasks/:id`
  reject unknown/protected fields like `id`? Is auth expected on write
  endpoints?

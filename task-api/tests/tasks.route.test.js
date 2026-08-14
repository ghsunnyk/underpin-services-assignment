const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('POST /tasks', () => {
  it('creates a task and returns 201 with the created task', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Write integration tests', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write integration tests');
    expect(res.body.priority).toBe('high');
    expect(res.body.status).toBe('todo');
    expect(res.body.id).toBeDefined();
  });

  it('defaults optional fields when not provided', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Minimal task' });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe('');
    expect(res.body.priority).toBe('medium');
    expect(res.body.dueDate).toBeNull();
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/tasks').send({ priority: 'high' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when title is an empty string', async () => {
    const res = await request(app).post('/tasks').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid status value', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Bad status', status: 'not-a-real-status' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid priority value', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Bad priority', priority: 'urgent' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid dueDate', async () => {
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'Bad due date', dueDate: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  it('persists the task so it shows up in GET /tasks', async () => {
    await request(app).post('/tasks').send({ title: 'Persisted task' });
    const res = await request(app).get('/tasks');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Persisted task');
  });
});

describe('GET /tasks', () => {
  it('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all tasks', async () => {
    await request(app).post('/tasks').send({ title: 'Task 1' });
    await request(app).post('/tasks').send({ title: 'Task 2' });

    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  it('filters by status via ?status=', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks?status=done');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('B');
  });

  it('returns an empty array for a status with no matching tasks', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.body).toEqual([]);
  });

  it('paginates results via ?page= and ?limit=', async () => {
    for (let i = 1; i <= 15; i++) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }

    const res = await request(app).get('/tasks?page=1&limit=10');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    expect(res.body[0].title).toBe('Task 1');
  });

  it('returns the remaining tasks on the last page', async () => {
    for (let i = 1; i <= 15; i++) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }

    const res = await request(app).get('/tasks?page=2&limit=10');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0].title).toBe('Task 11');
  });
});

describe('GET /tasks/stats', () => {
  it('returns zero counts when there are no tasks', async () => {
    const res = await request(app).get('/tasks/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('returns correct counts by status', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'B', status: 'in_progress' });
    await request(app).post('/tasks').send({ title: 'C', status: 'done' });

    const res = await request(app).get('/tasks/stats');

    expect(res.body.todo).toBe(1);
    expect(res.body.in_progress).toBe(1);
    expect(res.body.done).toBe(1);
  });

  it('counts overdue tasks correctly', async () => {
    await request(app)
      .post('/tasks')
      .send({ title: 'Overdue', status: 'todo', dueDate: '2020-01-01T00:00:00.000Z' });

    const res = await request(app).get('/tasks/stats');
    expect(res.body.overdue).toBe(1);
  });
});

describe('PUT /tasks/:id', () => {
  it('updates an existing task and returns it', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });

    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
    expect(res.body.id).toBe(created.body.id);
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app).put('/tasks/does-not-exist').send({ title: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when the update body is invalid', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });

    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ status: 'not-a-real-status' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when title is set to an empty string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });

    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ title: '   ' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes an existing task and returns 204', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Delete me' });

    const res = await request(app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);

    const getRes = await request(app).get('/tasks');
    expect(getRes.body).toHaveLength(0);
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app).delete('/tasks/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('marks a task as done', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Finish me' });

    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app).patch('/tasks/does-not-exist/complete');
    expect(res.status).toBe(404);
  });

  it('preserves the priority set at creation time', async () => {
    const created = await request(app)
      .post('/tasks')
      .send({ title: 'High priority task', priority: 'high' });

    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);

    expect(res.body.priority).toBe('high');
  });
});
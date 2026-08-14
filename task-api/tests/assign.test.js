const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');
const { validateAssignTask } = require('../src/utils/validators');

beforeEach(() => {
  taskService._reset();
});

describe('validateAssignTask', () => {
  it('accepts a valid assignee string', () => {
    expect(validateAssignTask({ assignee: 'Priya' })).toBeNull();
  });

  it('rejects a missing assignee', () => {
    expect(validateAssignTask({})).toBe(
      'assignee is required and must be a non-empty string'
    );
  });

  it('rejects an empty string assignee', () => {
    expect(validateAssignTask({ assignee: '' })).toBe(
      'assignee is required and must be a non-empty string'
    );
  });

  it('rejects a whitespace-only assignee', () => {
    expect(validateAssignTask({ assignee: '   ' })).toBe(
      'assignee is required and must be a non-empty string'
    );
  });

  it('rejects a non-string assignee', () => {
    expect(validateAssignTask({ assignee: 123 })).toBe(
      'assignee is required and must be a non-empty string'
    );
  });
});

describe('taskService.assignTask', () => {
  it('sets the assignee on the task', () => {
    const task = taskService.create({ title: 'Do the thing' });
    const updated = taskService.assignTask(task.id, 'Priya');

    expect(updated.assignee).toBe('Priya');
  });

  it('returns null when the task does not exist', () => {
    expect(taskService.assignTask('missing-id', 'Priya')).toBeNull();
  });

  it('persists the assignment in the store', () => {
    const task = taskService.create({ title: 'Do the thing' });
    taskService.assignTask(task.id, 'Priya');

    expect(taskService.findById(task.id).assignee).toBe('Priya');
  });

  it('overwrites an existing assignee when reassigned', () => {
    const task = taskService.create({ title: 'Do the thing' });
    taskService.assignTask(task.id, 'Priya');
    const reassigned = taskService.assignTask(task.id, 'Rohan');

    expect(reassigned.assignee).toBe('Rohan');
  });

  it('does not change any other field on the task', () => {
    const task = taskService.create({ title: 'Do the thing', priority: 'high' });
    const updated = taskService.assignTask(task.id, 'Priya');

    expect(updated.title).toBe('Do the thing');
    expect(updated.priority).toBe('high');
    expect(updated.status).toBe('todo');
  });

  it('a newly created task starts with assignee: null', () => {
    const task = taskService.create({ title: 'Unassigned' });
    expect(task.assignee).toBeNull();
  });
});

describe('PATCH /tasks/:id/assign', () => {
  it('assigns a task and returns the updated task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Assign me' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Priya' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Priya');
    expect(res.body.id).toBe(created.body.id);
  });

  it('trims surrounding whitespace from the assignee name', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Assign me' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '  Priya  ' });

    expect(res.body.assignee).toBe('Priya');
  });

  it('returns 404 when the task does not exist', async () => {
    const res = await request(app)
      .patch('/tasks/does-not-exist/assign')
      .send({ assignee: 'Priya' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('returns 400 when assignee is missing', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Assign me' });

    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when assignee is an empty string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Assign me' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '' });

    expect(res.status).toBe(400);
  });

  it('allows reassigning a task that already has an assignee', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Assign me' });
    await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Priya' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Rohan' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Rohan');
  });

  it('validates the id 404 check before returning, even with a valid body', async () => {
    const res = await request(app)
      .patch('/tasks/some-fake-id/assign')
      .send({ assignee: 'Priya' });

    expect(res.status).toBe(404);
  });
});
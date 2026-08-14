const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  it('creates a task with the given title and sensible defaults', () => {
    const task = taskService.create({ title: 'Write tests' });

    expect(task.title).toBe('Write tests');
    expect(task.description).toBe('');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.dueDate).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeDefined();
  });

  it('respects fields explicitly passed in', () => {
    const task = taskService.create({
      title: 'Ship feature',
      description: 'Important work',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-12-01T00:00:00.000Z',
    });

    expect(task.description).toBe('Important work');
    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.dueDate).toBe('2026-12-01T00:00:00.000Z');
  });

  it('assigns a unique id to every task', () => {
    const t1 = taskService.create({ title: 'Task 1' });
    const t2 = taskService.create({ title: 'Task 2' });

    expect(t1.id).not.toBe(t2.id);
  });

  it('adds the created task to the store returned by getAll', () => {
    taskService.create({ title: 'Task 1' });
    expect(taskService.getAll()).toHaveLength(1);
  });
});

describe('getAll', () => {
  it('returns an empty array when there are no tasks', () => {
    expect(taskService.getAll()).toEqual([]);
  });

  it('returns all created tasks', () => {
    taskService.create({ title: 'Task 1' });
    taskService.create({ title: 'Task 2' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  it('returns a copy, not a reference to the internal array', () => {
    taskService.create({ title: 'Task 1' });
    const result = taskService.getAll();
    result.push({ id: 'fake', title: 'Injected' });

    expect(taskService.getAll()).toHaveLength(1);
  });
});

describe('findById', () => {
  it('returns the matching task', () => {
    const created = taskService.create({ title: 'Findable' });
    const found = taskService.findById(created.id);
    expect(found).toEqual(created);
  });

  it('returns undefined for a non-existent id', () => {
    expect(taskService.findById('does-not-exist')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  it('returns only tasks with an exact status match', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });

    const result = taskService.getByStatus('todo');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });

  it('does not return tasks whose status merely contains the search string as a substring', () => {
    taskService.create({ title: 'A', status: 'todo' });

    const result = taskService.getByStatus('do');

    expect(result).toHaveLength(0);
  });

  it('returns an empty array when no tasks match the status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    expect(taskService.getByStatus('done')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 25; i++) {
      taskService.create({ title: `Task ${i}` });
    }
  });

  it('returns the first page of results for page 1', () => {
    const result = taskService.getPaginated(1, 10);

    expect(result).toHaveLength(10);
    expect(result[0].title).toBe('Task 1');
    expect(result[9].title).toBe('Task 10');
  });

  it('returns the second page of results for page 2', () => {
    const result = taskService.getPaginated(2, 10);

    expect(result).toHaveLength(10);
    expect(result[0].title).toBe('Task 11');
    expect(result[9].title).toBe('Task 20');
  });

  it('returns a partial page when fewer items remain', () => {
    const result = taskService.getPaginated(3, 10);

    expect(result).toHaveLength(5);
    expect(result[0].title).toBe('Task 21');
  });

  it('returns an empty array when the page is beyond the available data', () => {
    const result = taskService.getPaginated(10, 10);
    expect(result).toEqual([]);
  });
});

describe('getStats', () => {
  it('returns zero counts and zero overdue when there are no tasks', () => {
    expect(taskService.getStats()).toEqual({
      todo: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    });
  });

  it('counts tasks correctly by status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'todo' });
    taskService.create({ title: 'C', status: 'in_progress' });
    taskService.create({ title: 'D', status: 'done' });

    const stats = taskService.getStats();

    expect(stats.todo).toBe(2);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(1);
  });

  it('counts a task as overdue when its dueDate is in the past and it is not done', () => {
    taskService.create({
      title: 'Overdue',
      status: 'todo',
      dueDate: '2020-01-01T00:00:00.000Z',
    });

    expect(taskService.getStats().overdue).toBe(1);
  });

  it('does not count a task as overdue once it is done, even with a past dueDate', () => {
    const task = taskService.create({
      title: 'Finished late',
      status: 'todo',
      dueDate: '2020-01-01T00:00:00.000Z',
    });
    taskService.completeTask(task.id);

    expect(taskService.getStats().overdue).toBe(0);
  });

  it('does not count a task with no dueDate as overdue', () => {
    taskService.create({ title: 'No due date', status: 'todo', dueDate: null });
    expect(taskService.getStats().overdue).toBe(0);
  });

  it('does not count a task with a future dueDate as overdue', () => {
    taskService.create({
      title: 'Future',
      status: 'todo',
      dueDate: '2099-01-01T00:00:00.000Z',
    });
    expect(taskService.getStats().overdue).toBe(0);
  });
});

describe('update', () => {
  it('updates the given fields and leaves others untouched', () => {
    const task = taskService.create({ title: 'Original', priority: 'low' });
    const updated = taskService.update(task.id, { title: 'Updated' });

    expect(updated.title).toBe('Updated');
    expect(updated.priority).toBe('low');
    expect(updated.id).toBe(task.id);
  });

  it('returns null when the task does not exist', () => {
    expect(taskService.update('missing-id', { title: 'X' })).toBeNull();
  });

  it('persists the update in the store', () => {
    const task = taskService.create({ title: 'Original' });
    taskService.update(task.id, { title: 'Updated' });

    expect(taskService.findById(task.id).title).toBe('Updated');
  });

  it('does not let the update change the task id', () => {
    const task = taskService.create({ title: 'Original' });
    const updated = taskService.update(task.id, { id: 'hijacked-id', title: 'Updated' });

    expect(updated.id).toBe(task.id);
  });
});

describe('remove', () => {
  it('removes an existing task and returns true', () => {
    const task = taskService.create({ title: 'To delete' });
    const result = taskService.remove(task.id);

    expect(result).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });

  it('returns false when the task does not exist', () => {
    expect(taskService.remove('missing-id')).toBe(false);
  });

  it('does not affect other tasks', () => {
    const t1 = taskService.create({ title: 'Keep me' });
    const t2 = taskService.create({ title: 'Delete me' });
    taskService.remove(t2.id);

    expect(taskService.getAll()).toHaveLength(1);
    expect(taskService.findById(t1.id)).toBeDefined();
  });
});

describe('completeTask', () => {
  it('marks the task as done and sets completedAt', () => {
    const task = taskService.create({ title: 'Finish me' });
    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe('done');
    expect(completed.completedAt).not.toBeNull();
  });

  it('returns null when the task does not exist', () => {
    expect(taskService.completeTask('missing-id')).toBeNull();
  });

  it('preserves the task priority when completing it', () => {
    const task = taskService.create({ title: 'High priority', priority: 'high' });
    const completed = taskService.completeTask(task.id);

    expect(completed.priority).toBe('high');
  });
});
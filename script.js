/* ===== State & Constants ===== */
const STORAGE_KEY = 'todo_app_data';
const THEME_KEY = 'todo_theme';
const state = { tasks: [], filter: 'all', search: '' };
let theme = 'light';
let toastTimer = null;
let deletedTaskData = null;
let allWereCompleted = false;

const $ = id => document.getElementById(id);
const todayStr = () => new Date().toISOString().split('T')[0];
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ===== Data Management ===== */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.tasks = raw ? JSON.parse(raw) : [];
  } catch { state.tasks = []; }
}

function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks)); } catch {}
}

/* ===== Theme ===== */
function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch {}
  document.documentElement.setAttribute('data-theme', theme);
  $('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  $('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
}

/* ===== Recurring Task Reset ===== */
function processRecurringTasks() {
  let changed = false;
  const today = todayStr();
  state.tasks.forEach(t => {
    if (!t.completed || t.recurring === 'none' || !t.completedAt) return;
    let shouldReset = false;
    if (t.recurring === 'daily') {
      shouldReset = t.completedAt !== today;
    } else if (t.recurring === 'weekly') {
      const done = new Date(t.completedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      shouldReset = done < weekAgo;
    }
    if (shouldReset) {
      t.completed = false;
      t.completedAt = null;
      changed = true;
    }
  });
  if (changed) { saveTasks(); }
}

/* ===== Completed Today Count ===== */
function completedToday() {
  const today = todayStr();
  return state.tasks.filter(t => t.completed && t.completedAt === today).length;
}

/* ===== Rendering ===== */
function render() {
  const list = $('taskList');
  const empty = $('emptyState');
  const emptyIcon = $('emptyIcon');
  const emptyTitle = $('emptyTitle');
  const emptySubtitle = $('emptySubtitle');

  let filtered = getFilteredTasks();

  list.innerHTML = '';

  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    if (state.tasks.length === 0) {
      emptyIcon.textContent = '📋';
      emptyTitle.textContent = 'No tasks yet';
      emptySubtitle.textContent = 'Add a task to get started';
    } else if (state.search && state.filter === 'all') {
      emptyIcon.textContent = '🔍';
      emptyTitle.textContent = 'No results';
      emptySubtitle.textContent = 'Try a different search term';
    } else {
      emptyIcon.textContent = '🎯';
      emptyTitle.textContent = 'No tasks here';
      emptySubtitle.textContent = 'Try a different filter';
    }
    updateProgress();
    updateCount();
    return;
  }

  empty.classList.add('hidden');

  filtered.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = task.id;
    li.draggable = true;

    /* Drag handle */
    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';
    handle.setAttribute('aria-hidden', 'true');

    /* Checkbox */
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task-check';
    check.checked = task.completed;
    check.setAttribute('aria-label', 'Toggle task');

    /* Body wrapper */
    const body = document.createElement('div');
    body.className = 'task-body';

    /* Top row: text + actions */
    const top = document.createElement('div');
    top.className = 'task-top';

    const textSpan = document.createElement('span');
    textSpan.className = 'task-text' + (task.completed ? ' completed' : '');
    textSpan.textContent = task.text;

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'task-btn edit-btn';
    editBtn.textContent = '✏️';
    editBtn.setAttribute('aria-label', 'Edit task');
    const delBtn = document.createElement('button');
    delBtn.className = 'task-btn delete-btn';
    delBtn.textContent = '🗑️';
    delBtn.setAttribute('aria-label', 'Delete task');

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    top.appendChild(check);
    top.appendChild(textSpan);
    top.appendChild(actions);

    body.appendChild(top);

    /* Tags row */
    const tags = document.createElement('div');
    tags.className = 'task-tags';

    if (task.priority && task.priority !== 'medium') {
      const pTag = document.createElement('span');
      pTag.className = 'tag priority-' + task.priority;
      pTag.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
      tags.appendChild(pTag);
    } else if (task.priority === 'medium') {
      const pTag = document.createElement('span');
      pTag.className = 'tag priority-medium';
      pTag.textContent = 'Medium';
      tags.appendChild(pTag);
    }

    if (task.category) {
      const cTag = document.createElement('span');
      cTag.className = 'tag category-' + task.category;
      cTag.textContent = task.category.charAt(0).toUpperCase() + task.category.slice(1);
      tags.appendChild(cTag);
    }

    if (task.recurring && task.recurring !== 'none') {
      const rTag = document.createElement('span');
      rTag.className = 'tag recurring';
      rTag.textContent = task.recurring === 'daily' ? 'Daily' : 'Weekly';
      tags.appendChild(rTag);
    }

    if (task.dueDate) {
      const due = document.createElement('span');
      const d = new Date(task.dueDate + 'T00:00:00');
      const todayDate = new Date(todayStr() + 'T00:00:00');
      const isOverdue = !task.completed && d < todayDate;
      due.className = 'due-date' + (isOverdue ? ' overdue' : '') + (task.completed ? ' completed-overdue' : '');
      const options = { month: 'short', day: 'numeric' };
      due.textContent = '📅 ' + d.toLocaleDateString('en-US', options);
      tags.appendChild(due);
    }

    body.appendChild(tags);

    /* Subtasks */
    const subSection = document.createElement('div');
    subSection.className = 'subtask-section';

    if (task.subtasks && task.subtasks.length > 0) {
      const subList = document.createElement('div');
      subList.className = 'subtask-list';
      task.subtasks.forEach(st => {
        const subItem = document.createElement('div');
        subItem.className = 'subtask-item';
        subItem.dataset.id = st.id;

        const stCheck = document.createElement('input');
        stCheck.type = 'checkbox';
        stCheck.className = 'subtask-check';
        stCheck.checked = st.completed;

        const stText = document.createElement('span');
        stText.className = 'subtask-text' + (st.completed ? ' completed' : '');
        stText.textContent = st.text;

        const stDel = document.createElement('button');
        stDel.className = 'subtask-del';
        stDel.textContent = '×';
        stDel.setAttribute('aria-label', 'Remove subtask');

        subItem.appendChild(stCheck);
        subItem.appendChild(stText);
        subItem.appendChild(stDel);
        subList.appendChild(subItem);

        stCheck.addEventListener('change', () => {
          toggleSubtask(task.id, st.id);
        });

        stText.addEventListener('dblclick', () => {
          editSubtaskText(task.id, st.id, stText, st);
        });

        stDel.addEventListener('click', () => {
          removeSubtask(task.id, st.id);
        });
      });
      subSection.appendChild(subList);
    }

    const addSubBtn = document.createElement('button');
    addSubBtn.className = 'subtask-add-btn';
    addSubBtn.textContent = '+ Subtask';
    subSection.appendChild(addSubBtn);

    body.appendChild(subSection);

    li.appendChild(handle);
    li.appendChild(body);

    /* --- Event Listeners --- */
    check.addEventListener('change', () => {
      toggleTask(task.id);
    });

    textSpan.addEventListener('dblclick', () => {
      startEditText(task, textSpan);
    });

    editBtn.addEventListener('click', () => {
      startEditText(task, textSpan);
    });

    delBtn.addEventListener('click', () => {
      deleteTask(task.id);
    });

    addSubBtn.addEventListener('click', () => {
      startAddSubtask(task.id, subSection, addSubBtn);
    });

    /* Drag events */
    li.addEventListener('dragstart', onDragStart);
    li.addEventListener('dragend', onDragEnd);
    li.addEventListener('dragover', onDragOver);
    li.addEventListener('dragleave', onDragLeave);
    li.addEventListener('drop', onDrop);

    list.appendChild(li);
  });

  updateProgress();
  updateCount();
  checkAllCompleted();
}

/* ===== Inline Text Editing ===== */
function startEditText(task, textSpan) {
  if (task.completed) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  input.value = task.text;
  input.maxLength = 200;

  const parent = textSpan.parentNode;
  parent.insertBefore(input, textSpan);
  textSpan.style.display = 'none';

  const finish = () => {
    const val = input.value.trim();
    if (val && val !== task.text) {
      task.text = val;
      saveTasks();
      render();
    } else {
      textSpan.style.display = '';
      input.remove();
    }
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = task.text; input.blur(); }
  });

  input.focus();
  input.select();
}

/* ===== Task CRUD ===== */
function addTask() {
  const input = $('taskInput');
  const text = input.value.trim();
  if (!text) return;

  const dueDate = $('dueDateInput').value || null;
  const priority = $('priorityInput').value;
  const category = $('categoryInput').value;
  const recurring = $('recurringInput').value;

  const task = {
    id: genId(),
    text,
    completed: false,
    completedAt: null,
    dueDate,
    priority,
    category,
    recurring,
    subtasks: [],
    createdAt: new Date().toISOString(),
    order: state.tasks.length,
  };

  state.tasks.push(task);
  saveTasks();

  input.value = '';
  $('dueDateInput').value = '';
  $('priorityInput').value = 'medium';
  $('categoryInput').value = '';
  $('recurringInput').value = 'none';
  input.focus();

  if (state.filter !== 'all') {
    state.filter = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  }

  render();
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? todayStr() : null;
  saveTasks();
  render();
}

function deleteTask(id) {
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [task] = state.tasks.splice(idx, 1);
  saveTasks();

  /* Auto-check all completed state before render */
  const allCompleted = state.tasks.length > 0 && state.tasks.every(t => t.completed);
  allWereCompleted = allCompleted;

  render();
  showToast('Task deleted', task);
}

function editSubtaskText(taskId, subtaskId, el, st) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'subtask-input';
  input.value = st.text;
  input.maxLength = 200;

  const parent = el.parentNode;
  parent.insertBefore(input, el);
  el.style.display = 'none';

  const finish = () => {
    const val = input.value.trim();
    if (val && val !== st.text) {
      st.text = val;
      saveTasks();
      render();
    } else {
      el.style.display = '';
      input.remove();
    }
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = st.text; input.blur(); }
  });
  input.focus();
  input.select();
}

/* ===== Subtask Operations ===== */
function toggleSubtask(taskId, subtaskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  const st = task.subtasks.find(s => s.id === subtaskId);
  if (!st) return;
  st.completed = !st.completed;

  /* Auto-complete parent if all subtasks done */
  const allDone = task.subtasks.length > 0 && task.subtasks.every(s => s.completed);
  if (allDone && !task.completed) {
    task.completed = true;
    task.completedAt = todayStr();
  } else if (!allDone && task.completed) {
    task.completed = false;
    task.completedAt = null;
  }

  saveTasks();
  render();
}

function removeSubtask(taskId, subtaskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
  saveTasks();
  render();
}

function startAddSubtask(taskId, section, addBtn) {
  /* Remove any existing input */
  const existing = section.querySelector('.subtask-input-wrap');
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.className = 'subtask-input-wrap';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'subtask-input';
  input.placeholder = 'Add subtask...';
  input.maxLength = 200;

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-add';
  saveBtn.textContent = 'Add';
  saveBtn.style.padding = '4px 10px';
  saveBtn.style.fontSize = '12px';

  wrap.appendChild(input);
  wrap.appendChild(saveBtn);

  /* Find the add button's position in the section */
  const parent = addBtn.parentNode;
  parent.insertBefore(wrap, addBtn);

  const finish = () => {
    const text = input.value.trim();
    if (text) {
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.subtasks.push({ id: genId(), text, completed: false });
        saveTasks();
        render();
      }
    } else {
      wrap.remove();
    }
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { wrap.remove(); }
  });

  saveBtn.addEventListener('click', finish);

  input.addEventListener('blur', () => {
    /* Small delay so button click can fire first */
    setTimeout(() => { if (!wrap.contains(document.activeElement)) wrap.remove(); }, 150);
  });

  input.focus();
}

/* ===== Filter & Search ===== */
function getFilteredTasks() {
  let result = state.tasks.slice();

  /* Category filter */
  if (state.filter !== 'all') {
    result = result.filter(t => t.category === state.filter);
  }

  /* Search */
  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter(t => t.text.toLowerCase().includes(q));
  }

  return result;
}

function setFilter(filter) {
  state.filter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
  render();
}

/* ===== Progress ===== */
function updateProgress() {
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  $('progressFill').style.width = pct + '%';
  $('progressText').textContent = done + ' / ' + total;

  const todayCount = completedToday();
  $('todayText').textContent = todayCount + ' done today';
}

function updateCount() {
  const active = state.tasks.filter(t => !t.completed).length;
  $('taskCount').textContent = active === 1 ? '1 item left' : active + ' items left';
}

/* ===== Confetti ===== */
function triggerConfetti() {
  const canvas = $('confettiCanvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const colors = ['#6c63ff', '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#22c55e', '#f97316'];
  const particles = [];

  for (let i = 0; i < 180; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: Math.random() * 6 - 3,
      vy: Math.random() * 3 + 2,
      rot: Math.random() * 360,
      rotV: Math.random() * 12 - 6,
      gravity: 0.08,
      alpha: 1,
    });
  }

  let frame = 0;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      if (p.alpha <= 0) return;
      alive = true;
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.rot += p.rotV;
      if (p.y > canvas.height + 20) p.alpha -= 0.03;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    frame++;
    if (alive && frame < 250) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  animate();
}

function checkAllCompleted() {
  const allDone = state.tasks.length > 0 && state.tasks.every(t => t.completed);
  if (allDone && !allWereCompleted) {
    triggerConfetti();
  }
  allWereCompleted = allDone;
}

/* ===== Toast / Undo ===== */
function showToast(msg, task) {
  const toast = $('toast');
  const msgEl = $('toastMsg');
  const undoBtn = $('toastUndo');

  msgEl.textContent = msg;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);

  const dismiss = () => {
    toast.classList.remove('show');
    deletedTaskData = null;
  };

  toastTimer = setTimeout(dismiss, 5000);

  undoBtn.onclick = () => {
    if (deletedTaskData) {
      state.tasks.push(deletedTaskData);
      state.tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
      saveTasks();
      render();
      toast.classList.remove('show');
      deletedTaskData = null;
      if (toastTimer) clearTimeout(toastTimer);
    }
  };
}

/* ===== Drag & Drop ===== */
let dragId = null;

function onDragStart(e) {
  const item = e.target.closest('.task-item');
  if (!item) return;
  dragId = item.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
  item.classList.add('dragging');
}

function onDragEnd(e) {
  const item = e.target.closest('.task-item');
  if (item) item.classList.remove('dragging');
  document.querySelectorAll('.task-item').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
  dragId = null;
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.target.closest('.task-item');
  if (!item || item.dataset.id === dragId) return;

  const rect = item.getBoundingClientRect();
  const mid = rect.top + rect.height / 2;

  document.querySelectorAll('.task-item').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  item.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
}

function onDragLeave(e) {
  const item = e.target.closest('.task-item');
  if (item && !item.contains(e.relatedTarget)) {
    item.classList.remove('drag-over-top', 'drag-over-bottom');
  }
}

function onDrop(e) {
  e.preventDefault();
  const target = e.target.closest('.task-item');
  if (!target || !dragId || target.dataset.id === dragId) return;

  const draggedTask = state.tasks.find(t => t.id === dragId);
  const targetTask = state.tasks.find(t => t.id === target.dataset.id);
  if (!draggedTask || !targetTask) return;

  const rect = target.getBoundingClientRect();
  const mid = rect.top + rect.height / 2;
  const insertBefore = e.clientY < mid;

  state.tasks = state.tasks.filter(t => t.id !== dragId);
  const tIdx = state.tasks.findIndex(t => t.id === targetTask.id);
  state.tasks.splice(insertBefore ? tIdx : tIdx + 1, 0, draggedTask);
  state.tasks.forEach((t, i) => t.order = i);

  document.querySelectorAll('.task-item').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  saveTasks();
  render();
}

/* ===== Clear Completed ===== */
function clearCompleted() {
  if (!state.tasks.some(t => t.completed)) return;
  state.tasks = state.tasks.filter(t => !t.completed);
  saveTasks();
  render();
}

/* ===== Keyboard Shortcuts ===== */
function handleKeyboard(e) {
  /* n to focus add task - only when not in an input */
  if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    const tag = e.target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      e.preventDefault();
      $('taskInput').focus();
    }
  }
}

/* ===== Event Listener Setup ===== */
function init() {
  loadTheme();
  loadTasks();
  processRecurringTasks();
  render();

  /* Add task */
  $('addBtn').addEventListener('click', addTask);
  $('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  /* Theme toggle */
  $('themeToggle').addEventListener('click', toggleTheme);

  /* Filters */
  $('filterGroup').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (btn) setFilter(btn.dataset.filter);
  });

  /* Search */
  let searchTimer;
  $('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      render();
    }, 250);
  });

  /* Clear completed */
  $('clearCompleted').addEventListener('click', clearCompleted);

  /* Keyboard shortcut */
  document.addEventListener('keydown', handleKeyboard);
}

document.addEventListener('DOMContentLoaded', init);

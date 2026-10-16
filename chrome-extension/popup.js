const key = 'nesmi-chores-v1';
const list = document.getElementById('tasks');
const status = document.getElementById('status');
const input = document.getElementById('task');
let tasks = [];
let available = true;
try {
  const stored = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(stored) || stored.some(t => typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.done !== 'boolean')) throw new Error('Invalid data');
  tasks = stored;
} catch {
  available = false;
  status.textContent = 'Saved tasks could not be read. Reopen the extension or clear its stored data.';
}
function save(next) {
  try { localStorage.setItem(key, JSON.stringify(next)); tasks = next; render(); }
  catch { status.textContent = 'Could not save. Your previous tasks have been kept. Please try again.'; }
}
function render() {
  list.replaceChildren();
  for (const task of tasks) {
    const row = document.createElement('li');
    const check = document.createElement('input'); check.type = 'checkbox'; check.id = task.id; check.checked = task.done;
    const label = document.createElement('label'); label.htmlFor = task.id; label.textContent = task.title;
    check.addEventListener('change', () => save(tasks.map(t => t.id === task.id ? {...t, done: check.checked} : t)));
    const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', 'Delete ' + task.title);
    remove.addEventListener('click', () => save(tasks.filter(t => t.id !== task.id)));
    row.append(check, label, remove); list.append(row);
  }
  if (available) status.textContent = tasks.length ? `${tasks.filter(t => !t.done).length} remaining · ${tasks.filter(t => t.done).length} completed` : 'No chores yet. Add your first task above.';
  document.getElementById('clear').disabled = !tasks.some(t => t.done);
  document.querySelector('#add button').disabled = !available;
}
document.getElementById('add').addEventListener('submit', event => {
  event.preventDefault(); const title = input.value.trim();
  if (!title || !available) return;
  if (tasks.length >= 200) { status.textContent = 'Your checklist is full. Remove some tasks before adding more.'; return; }
  save([...tasks, {id: crypto.randomUUID(), title: title.slice(0,160), done: false}]);
  if (tasks.some(t => t.title === title)) input.value = '';
  input.focus();
});
document.getElementById('clear').addEventListener('click', () => save(tasks.filter(t => !t.done)));
render();

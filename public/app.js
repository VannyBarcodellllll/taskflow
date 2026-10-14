const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statuses = {todo:'To do',doing:'In progress',done:'Done'};
const colors = {todo:'#a4aabd',doing:'#edb06c',done:'#6bb29b'};
let projects = [], tasks = [], projectId = null, view = 'board', dashboard = true, toastTimer, deleteAction, draggedId;
async function api(path, method = 'GET', data) {
  const response = await fetch('/api/'+path, {method, headers:data ? {'Content-Type':'application/json'} : {}, body:data ? JSON.stringify(data) : undefined});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Please try again.');
  return result;
}
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }
async function load() { [projects,tasks] = await Promise.all([api('projects'),api('tasks')]); if (projectId && !projects.some(p=>p.id===projectId)) projectId=null; render(); }
function localToday() { const now=new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; }
function dateLabel(date) { return date ? new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}) : 'No due date'; }
function filteredTasks() { const query=$('search').value.trim().toLowerCase(); return tasks.filter(t => (!projectId || t.project_id===projectId) && (!$('priorityFilter').value || t.priority===$('priorityFilter').value) && (!$('statusFilter').value || t.status===$('statusFilter').value) && (!query || (t.title+' '+t.description+' '+t.project_name).toLowerCase().includes(query))); }
function render() {
  const scoped=tasks.filter(t=>!projectId || t.project_id===projectId),done=scoped.filter(t=>t.status==='done').length,rate=scoped.length ? Math.round(done/scoped.length*100) : 0;
  $('totalStat').textContent=scoped.length; $('doingStat').textContent=scoped.filter(t=>t.status==='doing').length; $('doneStat').textContent=done; $('rateStat').textContent=rate+'%'; $('rateBar').style.width=rate+'%'; $('navCount').textContent=tasks.length;
  const project=projects.find(p=>p.id===projectId);
  $('pageTitle').textContent=project ? project.name : dashboard ? 'Make room for good work.' : 'Every task, in one place.';
  $('pageSubtitle').textContent=project ? 'A little clarity for your next big idea.' : 'Your projects, your progress, and what comes next.';
  $('breadcrumbTitle').textContent=project ? project.name : dashboard ? 'Overview' : 'All tasks';
  $('dashboardNav').classList.toggle('active',dashboard && !projectId); $('allTasksNav').classList.toggle('active',!dashboard && !projectId);
  $('projectOverview').hidden=!dashboard || Boolean(projectId); $('projectCount').textContent=projects.length;
  $('deleteProject').hidden=!projectId;
  $('projectNav').innerHTML=projects.map(p=>`<button class="nav ${projectId===p.id?'active':''}" data-project="${p.id}"><span class="project-dot" style="background:${p.color}"></span><span>${esc(p.name)}</span></button>`).join('');
  $('projectCards').innerHTML=projects.map(p=>{const list=tasks.filter(t=>t.project_id===p.id),completed=list.filter(t=>t.status==='done').length,percent=list.length?Math.round(completed/list.length*100):0;return `<button class="project-card" data-project="${p.id}"><span class="project-dot" style="background:${p.color}">▱</span><strong>${esc(p.name)}</strong><p>${list.length} tasks · ${completed} completed</p><div class="progress"><i style="width:${percent}%;background:${p.color}"></i></div><div class="bottom"><span>${percent}% complete</span><span>Open project ↗</span></div></button>`}).join('')+'<button class="project-card add-project" id="emptyAddProject"><div><span class="plus">+</span><strong>Start something new</strong></div></button>';
  $('newTask').disabled=!projects.length;
  renderTasks();
}
function card(t) { return `<article class="task-card" draggable="true" data-task="${t.id}" tabindex="0" role="button" aria-label="Edit ${esc(t.title)}"><div class="task-top"><span class="project-label" style="color:${t.project_color}">${esc(t.project_name)}</span><span class="priority ${t.priority}">${t.priority[0].toUpperCase()+t.priority.slice(1)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description)||'Add a description to give this task a little context.'}</p><div class="task-bottom"><span class="${t.due_date && t.due_date<localToday() && t.status!=='done'?'overdue':''}">◷ ${dateLabel(t.due_date)}</span><span class="avatar">A</span></div></article>`; }
function renderTasks() {
  const list=filteredTasks(); $('taskCount').textContent=list.length; $('board').hidden=view!=='board'; $('taskList').hidden=view!=='list'; $('boardHint').hidden=view!=='board'; $('empty').hidden=list.length>0;
  $('boardView').classList.toggle('active',view==='board'); $('listView').classList.toggle('active',view==='list');
  $('board').innerHTML=Object.entries(statuses).map(([status,label])=>{const items=list.filter(t=>t.status===status);return `<div class="column" data-status="${status}"><div class="column-title"><span class="status-dot" style="background:${colors[status]}"></span>${label}<span class="count">${items.length}</span><button data-add-status="${status}" aria-label="Add a task to ${label}" ${projects.length?'':'disabled'}>+</button></div>${items.map(card).join('')||'<div class="empty-column">Drop a task here.</div>'}</div>`}).join('');
  $('taskList').innerHTML=list.map(t=>`<button class="list-row" data-task="${t.id}"><strong>${esc(t.title)}</strong><span>${esc(t.project_name)}</span><span>${statuses[t.status]}</span><span>${dateLabel(t.due_date)}</span></button>`).join('');
}
function openTask(id, status='todo') {
  const t=tasks.find(item=>item.id===id); if(!projects.length){openProject();return}
  $('taskForm').reset(); $('taskError').textContent=''; $('taskDialogTitle').textContent=t?'Edit task':'New task'; $('taskId').value=t?.id||''; $('taskTitle').value=t?.title||''; $('taskDescription').value=t?.description||'';
  $('taskProject').innerHTML=projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join(''); $('taskProject').value=t?.project_id||projectId||projects[0].id;
  $('taskStatus').value=t?.status||status; $('taskPriority').value=t?.priority||'medium'; $('taskDue').value=t?.due_date||''; $('deleteTask').hidden=!t;
  $('taskDialog').showModal(); $('taskTitle').focus();
}
function openProject() { $('projectForm').reset(); $('projectError').textContent=''; $('projectDialog').showModal(); $('projectName').focus(); }
function chooseProject(id) { projectId=id;dashboard=false;resetFilters();render(); }
function resetFilters(){ $('search').value='';$('priorityFilter').value='';$('statusFilter').value=''; }
function confirmDelete(title,message,action) { $('confirmTitle').textContent=title;$('confirmText').textContent=message;deleteAction=action;$('confirmDialog').showModal(); }
$('taskForm').addEventListener('submit', async e=>{e.preventDefault();const id=$('taskId').value;$('saveTask').disabled=true;$('taskError').textContent='';try{await api('tasks'+(id?'/'+id:''),id?'PATCH':'POST',{title:$('taskTitle').value,description:$('taskDescription').value,project_id:Number($('taskProject').value),status:$('taskStatus').value,priority:$('taskPriority').value,due_date:$('taskDue').value});await load();$('taskDialog').close();toast(id?'Task updated.':'A new step on your board.')}catch(error){$('taskError').textContent=error.message}finally{$('saveTask').disabled=false}});
$('projectForm').addEventListener('submit',async e=>{e.preventDefault();$('saveProject').disabled=true;try{const p=await api('projects','POST',{name:$('projectName').value,color:$('projectColor').value});await load();$('projectDialog').close();chooseProject(p.id);toast('Your project is ready.')}catch(error){$('projectError').textContent=error.message}finally{$('saveProject').disabled=false}});
$('deleteTask').onclick=()=>{const id=Number($('taskId').value);confirmDelete('Delete this task?','This permanently removes the task from your workspace.',async()=>{await api('tasks/'+id,'DELETE');$('taskDialog').close();await load();toast('Task deleted.')})};
$('deleteProject').onclick=()=>{const p=projects.find(p=>p.id===projectId);confirmDelete('Delete '+p.name+'?','This permanently removes the project and all of its tasks.',async()=>{await api('projects/'+p.id,'DELETE');projectId=null;dashboard=true;await load();toast('Project deleted.')})};
$('cancelDelete').onclick=()=>$('confirmDialog').close();$('confirmDelete').onclick=async()=>{$('confirmDelete').disabled=true;try{await deleteAction();$('confirmDialog').close()}catch(error){toast(error.message)}finally{$('confirmDelete').disabled=false}};
$('dashboardNav').onclick=()=>{projectId=null;dashboard=true;resetFilters();render()};$('allTasksNav').onclick=()=>{projectId=null;dashboard=false;resetFilters();render()};$('newTask').onclick=()=>openTask();$('newProject').onclick=openProject;$('addProjectCard').onclick=openProject;
$('boardView').onclick=()=>{view='board';renderTasks()};$('listView').onclick=()=>{view='list';renderTasks()};
for(const id of ['search','priorityFilter','statusFilter'])$(id).addEventListener('input',renderTasks);
document.addEventListener('click',e=>{const close=e.target.closest('[data-close]');if(close){$(close.dataset.close).close();return}const p=e.target.closest('[data-project]');if(p){chooseProject(Number(p.dataset.project));return}const task=e.target.closest('[data-task]');if(task){openTask(Number(task.dataset.task));return}const add=e.target.closest('[data-add-status]');if(add){openTask(undefined,add.dataset.addStatus);return}if(e.target.closest('#emptyAddProject'))openProject()});
document.addEventListener('keydown',e=>{if(e.target.matches('.task-card')&&['Enter',' '].includes(e.key)){e.preventDefault();openTask(Number(e.target.dataset.task))}});
$('board').addEventListener('dragstart',e=>{const card=e.target.closest('[data-task]');if(!card)return;draggedId=Number(card.dataset.task);e.dataTransfer.setData('text/plain',String(draggedId));e.dataTransfer.effectAllowed='move'});
$('board').addEventListener('dragover',e=>{const column=e.target.closest('[data-status]');if(!column||!draggedId)return;e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.column').forEach(c=>c.classList.toggle('drag-over',c===column))});
$('board').addEventListener('dragend',()=>{draggedId=null;document.querySelectorAll('.column').forEach(c=>c.classList.remove('drag-over'))});
$('board').addEventListener('drop',async e=>{e.preventDefault();const column=e.target.closest('[data-status]'),id=draggedId;draggedId=null;document.querySelectorAll('.column').forEach(c=>c.classList.remove('drag-over'));if(!column||!id)return;const t=tasks.find(t=>t.id===id);if(t?.status===column.dataset.status)return;try{await api('tasks/'+id,'PATCH',{status:column.dataset.status});await load();toast('Moved to '+statuses[column.dataset.status]+'.')}catch(error){toast(error.message)}});
$('today').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
load().catch(error=>{toast('Could not load your workspace: '+error.message);$('pageSubtitle').textContent='Check that the server is running, then refresh this page.'});

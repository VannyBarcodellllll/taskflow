import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server.mjs';
test('REST API validates input, persists tasks, and preserves project relationships', async () => {
  const folder=mkdtempSync(join(tmpdir(),'taskflow-test-')),dbPath=join(folder,'test.sqlite');
  let server=createApp({dbPath,seed:false});
  const start=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const stop=()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  await start();
  let base='http://127.0.0.1:'+server.address().port;
  const request=async(path,method='GET',data)=>{const r=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()}};
  try {
    assert.equal((await request('projects','POST',{name:'   '})).status,400);
    const p=await request('projects','POST',{name:'Test project',color:'#6d6af2'}); assert.equal(p.status,201);
    const project_id=p.data.id;
    const task=await request('tasks','POST',{project_id,title:'Test persistence',description:'<script>ordinary text</script>',status:'todo',priority:'high',due_date:'2026-10-31'}); assert.equal(task.status,201); assert.equal(task.data.project_name,'Test project');
    assert.equal((await request('tasks/'+task.data.id,'PATCH',{status:'invalid'})).status,400);
    assert.equal((await request('tasks/'+task.data.id,'PATCH',{due_date:'2026-02-30'})).status,400);
    assert.equal((await request('tasks/'+task.data.id,'PATCH',{due_date:'2026-99-99'})).status,400);
    assert.equal((await request('tasks/'+task.data.id,'PATCH',{status:'done'})).data.status,'done');
    await stop(); server=createApp({dbPath,seed:false}); await start();base='http://127.0.0.1:'+server.address().port;
    const list=await request('tasks'); assert.equal(list.data.length,1); assert.equal(list.data[0].status,'done'); assert.equal(list.data[0].description,'<script>ordinary text</script>');
    assert.equal((await request('projects/'+project_id,'DELETE')).status,200); assert.equal((await request('tasks')).data.length,0);
    assert.equal((await request('tasks/'+task.data.id,'PATCH',{status:'todo'})).status,404);
    const rejected=await fetch(base+'/api/projects',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({name:'Wrong origin'})}); assert.equal(rejected.status,403);
  } finally { await stop(); rmSync(folder,{recursive:true,force:true}); }
});

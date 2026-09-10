'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Study=require('../src/study.js');
test('treino reserva revisões, dificuldades e novidades sem repetir habilidades',()=>{
  const now=Date.now(),countries=Array.from({length:14},(_,i)=>({id:String(i),r:'A'}));
  const Core={skillOf:(_,id)=>Number(id)<6?{attempts:3,level:2,nextReviewAt:new Date(now-1000).toISOString()}:Number(id)<8?{attempts:2,level:1,nextReviewAt:new Date(now+86400000).toISOString()}:{attempts:0}};
  const plan=Study.plan(Core,countries,{},['cap'],'A',now);
  assert.equal(plan.length,10);assert.equal(new Set(plan.map(c=>c.id+':'+c.direction)).size,10);
  assert.equal(plan.filter(c=>Number(c.id)<6).length,6);
  assert.equal(plan.filter(c=>Number(c.id)>=6&&Number(c.id)<8).length,2);
  assert.equal(plan.filter(c=>Number(c.id)>=8).length,2);
  assert.deepEqual(Study.plan(Core,countries,{},['cap'],'B',now),[]);
});
test('poucas opções encerram uma série menor; filtros de direção são respeitados',()=>{
  const cards=Study.plan({skillOf:()=>({attempts:0})},[{id:'A',r:'R',sr:'S'}],{},['cap'],'S');
  assert.deepEqual(cards,[{id:'A',direction:'cap'}]);
});
test('próxima revisão usa o dia local, conta habilidades e distingue vencidas',()=>{
  const now=new Date(2026,8,10,23,50).getTime(),next=new Date(2026,8,11,0,10).toISOString();
  const items=[{skill:{nextReviewAt:next}},{skill:{nextReviewAt:next}}];
  assert.match(Study.nextReview(items,now),/amanhã.*2 habilidades/);
  assert.match(Study.nextReview(items,Date.parse(next)),/2 habilidades estão prontas/);
  assert.match(Study.nextReview([],now),/iniciar seu ciclo/);
});
test('evolução conta habilidades únicas e não declara recuperação se voltou a errar',()=>{
  const a={id:'A',direction:'cap',correct:false,wasNew:true};
  assert.match(Study.evolution([a,{...a,wasNew:false,correct:true}]),/1 habilidade nova.*1 habilidade que/);
  assert.doesNotMatch(Study.evolution([a,{...a,correct:true},a]),/Voltou/);
  assert.equal(Study.evolution([]),'');
});

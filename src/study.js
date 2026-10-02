(function(root) {
  'use strict';
  function plan(Core, countries, progress, directions, region, now = Date.now(), size = 10) {
    size = [5, 10, 20].includes(size) ? size : 10;
    const date = new Date(now).toLocaleDateString('sv-SE');
    const hash = text => [...text].reduce((h,c) => ((h * 31) + c.charCodeAt(0)) >>> 0, 7);
    const cards = countries.filter(c => region === 'Mundo inteiro' || c.r === region || c.sr === region)
      .flatMap(c => directions.map(direction => ({ id:c.id, direction, skill:Core.skillOf(progress,c.id,direction) })))
      .sort((a,b) => hash(date+a.id+a.direction)-hash(date+b.id+b.direction));
    const due = cards.filter(c => c.skill.attempts && Date.parse(c.skill.nextReviewAt) <= now)
      .sort((a,b) => Date.parse(a.skill.nextReviewAt)-Date.parse(b.skill.nextReviewAt));
    const weak = cards.filter(c => c.skill.attempts && c.skill.level <= 1 && !due.includes(c));
    const fresh = cards.filter(c => !c.skill.attempts);
    const chosen = [];
    function take(list, count) {
      for(let i=0;i<count;i++) {
        const remaining=list.filter(c => !chosen.includes(c));
        const next=remaining.find(c => !chosen.some(s => s.id===c.id)) || remaining[0];
        if(!next) break;
        chosen.push(next);
      }
    }
    take(due,size * 0.6);take(weak,size * 0.2);take(fresh,size * 0.2);
    take([...due,...weak,...fresh,...cards],size-chosen.length);
    return chosen.map(({id,direction})=>({id,direction}));
  }
  function nextReview(items, now = Date.now()) {
    const dates=items.map(i=>Date.parse(i.skill.nextReviewAt)).filter(Number.isFinite).sort((a,b)=>a-b);
    if(!dates.length) return 'Responda algumas perguntas para iniciar seu ciclo de revisão.';
    const due=dates.filter(d=>d<=now).length;
    if(due) return `${due} ${due===1?'habilidade está pronta':'habilidades estão prontas'} para revisar agora.`;
    const day=d=>new Date(d).toLocaleDateString('pt-BR');
    const next=day(dates[0]), today=day(now), tomorrow=new Date(now);
    tomorrow.setDate(tomorrow.getDate()+1);
    const when=next===today?'hoje':next===day(tomorrow.getTime())?'amanhã':`em ${next}`;
    const count=dates.filter(d=>day(d)===next).length;
    return `Tudo revisado por enquanto. Próxima revisão ${when}, a partir das ${new Date(dates[0]).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}: ${count} ${count===1?'habilidade':'habilidades'}.`;
  }
  function evolution(answers) {
    const skills=new Map();
    for(const a of answers) {
      const key=a.id+':'+a.direction, s=skills.get(key)||{fresh:false,difficult:false,correct:false};
      s.fresh ||= Boolean(a.wasNew);s.difficult ||= Boolean(a.wasDifficult) || !a.correct;s.correct=a.correct;
      skills.set(key,s);
    }
    const fresh=[...skills.values()].filter(s=>s.fresh).length;
    const recovered=[...skills.values()].filter(s=>s.difficult&&s.correct).length;
    const parts=[];
    if(fresh) parts.push(`Você praticou ${fresh} ${fresh===1?'habilidade nova':'habilidades novas'}.`);
    if(recovered) parts.push(`Voltou a acertar ${recovered} ${recovered===1?'habilidade que apresentou dificuldade':'habilidades que apresentaram dificuldade'}.`);
    return parts.join(' ') || (answers.length?'Cada resposta atualizou seu plano de revisão.':'');
  }
  function note(container,text) {
    if(!text)return;
    const p=document.createElement('p');p.className='section-copy study-summary';p.textContent=text;container.append(p);
  }
  function recommendation({ pending = [], mistakes = [], fresh = [] }) {
    if (pending.length) return { kind: 'due', title: 'Revisar pendências',
      text: `${pending.length} habilidades estão vencidas nos filtros atuais. Comece pelas revisões mais antigas.` };
    if (mistakes.length) return { kind: 'mistakes', title: 'Reforçar os erros desta sessão',
      text: `${mistakes.length} pontos ainda precisam de revisão nesta sessão.` };
    if (fresh.length) return { kind: 'fresh', title: 'Conhecer novos países e habilidades',
      text: `${fresh.length} habilidades ainda não foram praticadas nos filtros atuais.` };
    return { kind: 'daily', title: 'Fazer o treino de hoje', text: 'As revisões estão em dia nestes filtros. Faça uma série curta para continuar praticando.' };
  }
  const SHORTCUTS = [
    ['1 a 4', 'Escolher uma alternativa no treino, fora de campos e botões.'],
    ['Enter ou Espaço', 'Depois da resposta, avançar; em um botão, ativá-lo.'],
    ['Setas', 'Com o mapa em foco, percorrer os países pela direção.'],
    ['Inicial do país', 'Com o mapa em foco, ir ao próximo país com essa inicial.'],
    ['Home / End', 'No mapa, ir ao primeiro / último país em ordem alfabética.'],
    ['Enter ou Espaço no mapa', 'Selecionar o país ativo.'],
    ['+ / −', 'No mapa, aproximar / afastar.'],
    ['0 ou Escape', 'No mapa, restaurar a visão do mundo.'],
  ];
  function shortcuts(container) {
    const details = document.createElement('details'); details.className = 'pgroup';
    const title = document.createElement('summary'); title.textContent = 'Atalhos de teclado'; details.append(title);
    const list = document.createElement('dl');
    SHORTCUTS.forEach(([key, action]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = key; dd.textContent = action; list.append(dt, dd);
    });
    details.append(list); container.append(details);
  }
  function freshPlan(Core, countries, progress, directions, region) {
    return countries.filter(c => region === 'Mundo inteiro' || c.r === region || c.sr === region)
      .flatMap(c => directions.filter(direction => !Core.skillOf(progress, c.id, direction).attempts)
        .map(direction => ({ id: c.id, direction })))
      .sort((a, b) => directions.indexOf(a.direction) - directions.indexOf(b.direction) || a.id.localeCompare(b.id));
  }
  function duePlan(Core, countries, progress, directions, region, now = Date.now()) {
    return countries.filter(c => region === 'Mundo inteiro' || c.r === region || c.sr === region)
      .flatMap(c => directions.map(direction => ({ id: c.id, direction, skill: Core.skillOf(progress, c.id, direction) })))
      .filter(c => c.skill.attempts > 0 && Date.parse(c.skill.nextReviewAt) <= now)
      .sort((a,b) => Date.parse(a.skill.nextReviewAt) - Date.parse(b.skill.nextReviewAt))
      .map(({id,direction}) => ({id,direction}));
  }
  function card(container,start,size = 10,onSize = () => {}) {
    const section=document.createElement('section');section.className='pgroup';
    const label=document.createElement('label');label.htmlFor='dailySize';label.textContent='Perguntas no treino de hoje';
    const select=document.createElement('select');select.id='dailySize';
    [5,10,20].forEach(n=>{const option=document.createElement('option');option.value=n;option.textContent=String(n);select.append(option);});
    select.value=String(size);select.addEventListener('change',()=>onSize(Number(select.value)));
    const row=document.createElement('div');row.className='button-row';row.append(label,select);section.append(row);
    const button=document.createElement('button');button.id='dailyTraining';button.className='btn';button.type='button';
    button.textContent='Treino de hoje';button.addEventListener('click',()=>start(Number(select.value)));section.append(button);
    note(section,'Revisões vencidas, pontos fracos e novidades, conforme o modo e a área selecionados. Com poucas habilidades disponíveis, a série será menor.');
    container.append(section);
  }
  const api={plan,duePlan,freshPlan,nextReview,evolution,note,card,shortcuts,recommendation,SHORTCUTS};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasStudy=api;
})(globalThis);

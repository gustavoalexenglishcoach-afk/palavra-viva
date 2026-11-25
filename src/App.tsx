import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Session } from '@supabase/supabase-js';
import { BookOpen, LayoutDashboard, NotebookPen, FolderOpen, Presentation, Search, Plus, Bell, ChevronRight, BookMarked, MoreHorizontal, Menu, X, Save, ArrowLeft, Monitor, LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';
import BibleReader from './components/BibleReader';

type Sermon = { id:string; user_id:string; title:string; theme:string; date:string; status:string; content:string; created_at:string };
type PresentationSlide = { id:string; title:string; body:string; background?:string; visualStyle?:string };
type SavedPresentation = { id:string; user_id:string; sermon_id:string|null; title:string; slides:PresentationSlide[]; created_at:string };
type SermonDraft = { sermonType:string; baseText:string; objective:string; introduction:string; points:string[]; conclusion:string; references:string; notes:string };
const emptyDraft = ():SermonDraft => ({sermonType:'',baseText:'',objective:'',introduction:'',points:['','',''],conclusion:'',references:'',notes:''});
const normalizeSlides = (raw:unknown):PresentationSlide[] => {
 let value=raw;
 if(typeof value==='string'){
  try{value=JSON.parse(value);}catch{return [];}
 }
 if(!Array.isArray(value))return [];
 return value.filter(item=>item&&typeof item==='object').map((item,index)=>({
  id:typeof item.id==='string'&&item.id?item.id:crypto.randomUUID(),
  title:typeof item.title==='string'?item.title:typeof item.heading==='string'?item.heading:'Slide '+(index+1),
  body:typeof item.body==='string'?item.body:typeof item.content==='string'?item.content:'',
  ...(typeof item.background==='string'?{background:item.background}:{}),
  ...(typeof item.visualStyle==='string'?{visualStyle:item.visualStyle}:{})
 }));
};
const readDraft = (raw:string):SermonDraft => {
 try {
  const parsed=JSON.parse(raw);
  if(parsed?.format==='palavra-viva-v1') return {
   ...emptyDraft(),
   sermonType:parsed.sermonType||'',
   baseText:parsed.baseText||'',
   objective:parsed.objective||'',
   introduction:parsed.introduction||'',
   points:Array.isArray(parsed.points)&&parsed.points.length?parsed.points:['','',''],
   conclusion:parsed.conclusion||'',
   references:parsed.references||'',
   notes:parsed.notes||''
  };
 } catch {}
 return {...emptyDraft(),notes:raw||''};
};

export default function App(){
 const [session,setSession]=useState<Session|null>(null);
 const [loading,setLoading]=useState(true);
 const [authMode,setAuthMode]=useState<'login'|'signup'>('login');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [authMessage,setAuthMessage]=useState('');
 const [authBusy,setAuthBusy]=useState(false);
 const [page,setPage]=useState('Início');
 const [sermons,setSermons]=useState<Sermon[]>([]);
 const [active,setActive]=useState<Sermon|null>(null);
 const [query,setQuery]=useState('');
 const [mobile,setMobile]=useState(false);
 const [title,setTitle]=useState('');
 const [theme,setTheme]=useState('');
 const [draft,setDraft]=useState<SermonDraft>(emptyDraft());
 const [saving,setSaving]=useState(false);
 const [viewMode,setViewMode]=useState(false);
 const [notice,setNotice]=useState('');
 const [presentations,setPresentations]=useState<SavedPresentation[]>([]);
 const [activePresentation,setActivePresentation]=useState<SavedPresentation|null>(null);
 const [presentationSlides,setPresentationSlides]=useState<PresentationSlide[]>([]);
 const [presentationTitle,setPresentationTitle]=useState('');
 const [presentationSermonId,setPresentationSermonId]=useState<string|null>(null);
 const [presentationBusy,setPresentationBusy]=useState(false);
 const [presentationMode,setPresentationMode]=useState(false);
 const [currentSlide,setCurrentSlide]=useState(0);
 const [visualStyle,setVisualStyle]=useState('cinematic');
 const [presentationFullscreen,setPresentationFullscreen]=useState(false);

 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false);});
  return ()=>subscription.unsubscribe();
 },[]);

 useEffect(()=>{
  if(!session){setSermons([]);setPresentations([]);return;}
  let alive=true;
  supabase.from('sermons').select('*').order('created_at',{ascending:false}).then(({data,error})=>{
   if(!alive)return;
   if(error){setNotice('Não foi possível carregar suas mensagens. Confira se a tabela do banco já foi criada.');return;}
   setSermons((data||[]) as Sermon[]);
  });
  return ()=>{alive=false;};
 },[session]);

 useEffect(()=>{
  if(!session)return;
  let alive=true;
  supabase.from('presentations').select('*').order('created_at',{ascending:false}).then(({data,error})=>{
   if(!alive)return;
   if(error){if(error.code!=='42P01')setNotice('Não foi possível carregar as apresentações. Confira a configuração da tabela no Supabase.');return;}
   setPresentations(((data||[]) as SavedPresentation[]).map(p=>({...p,slides:normalizeSlides(p.slides)})));
  });
  return ()=>{alive=false;};
 },[session]);

 const filtered=useMemo(()=>sermons.filter(s=>(s.title+' '+s.theme).toLowerCase().includes(query.toLowerCase())),[sermons,query]);
 const create=()=>{setActive(null);setTitle('');setTheme('');setDraft(emptyDraft());setViewMode(false);setNotice('');setPage('Editor');};
 const edit=(s:Sermon)=>{setActive(s);setTitle(s.title);setTheme(s.theme);setDraft(readDraft(s.content));setViewMode(false);setNotice('');setPage('Editor');};
 const save=async()=>{
  if(!title.trim()||!session?.user)return;
  setSaving(true);setNotice('');
  const fields={title:title.trim(),theme:theme.trim()||'Sem categoria',date:new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}),status:'Rascunho',content:JSON.stringify({format:'palavra-viva-v1',...draft})};
  const result=active
   ? await supabase.from('sermons').update(fields).eq('id',active.id).select().single()
   : await supabase.from('sermons').insert({...fields,user_id:session.user.id}).select().single();
  setSaving(false);
  if(result.error){setNotice('Não foi possível salvar. Verifique a conexão e as políticas do banco.');return;}
  const saved=result.data as Sermon;
  setSermons(old=>active?old.map(s=>s.id===saved.id?saved:s):[saved,...old]);
  setPage('Mensagens');setActive(null);setNotice('Mensagem salva na nuvem.');
 };
 const buildSlides=(s:Sermon):PresentationSlide[]=>{
  const d=readDraft(s.content);
  const slides:PresentationSlide[]=[{id:crypto.randomUUID(),title:s.title,body:[d.baseText?'Texto bíblico: '+d.baseText:'',d.objective?'Objetivo: '+d.objective:''].filter(Boolean).join('\\n\\n')||s.theme}];
  if(d.introduction.trim())slides.push({id:crypto.randomUUID(),title:'Introdução',body:d.introduction});
  d.points.filter(p=>p.trim()).forEach((p,i)=>slides.push({id:crypto.randomUUID(),title:'Ponto '+(i+1),body:p}));
  if(d.references.trim())slides.push({id:crypto.randomUUID(),title:'Referências bíblicas',body:d.references});
  if(d.conclusion.trim())slides.push({id:crypto.randomUUID(),title:'Conclusão',body:d.conclusion});
  return slides;
 };
 const backgroundChoices=[{label:'Automática pelo tema',value:'auto'},{label:'Bíblia e luz',value:'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1920&q=85'},{label:'Amanhecer',value:'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=85'},{label:'Montanhas',value:'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=85'},{label:'Natureza',value:'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1920&q=85'},{label:'Cruz e esperança',value:'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1920&q=85'}];
 const getSlideBackground=(slide:PresentationSlide)=>{
  if(slide.background&&slide.background!=='auto')return slide.background;
  const sourceTheme=sermons.find(s=>s.id===presentationSermonId)?.theme||'';
  const words=(presentationTitle+' '+sourceTheme+' '+slide.title+' '+slide.body).toLocaleLowerCase('pt-BR');
  const backgrounds=[
   {keys:['oração','orar','intercessão','presença de deus'],url:'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1920&q=85'},
   {keys:['fé','confiança','crer','esperança','promessa'],url:'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=85'},
   {keys:['família','casamento','filhos','lar'],url:'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1920&q=85'},
   {keys:['tempestade','medo','proteção','livramento','luta','provação'],url:'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=85'},
   {keys:['salvação','cruz','jesus','graça','perdão','amor'],url:'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1920&q=85'},
   {keys:['adoração','louvor','igreja','missão','santidade'],url:'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=85'}
  ];
  return backgrounds.find(item=>item.keys.some(key=>words.includes(key)))?.url||'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1920&q=85';
 };
 const changeVisualStyle=(style:string)=>{setVisualStyle(style);setPresentationSlides(old=>old.map(slide=>({...slide,visualStyle:style})));};
 const changeSlideBackground=(id:string,value:string)=>setPresentationSlides(old=>old.map(slide=>slide.id===id?{...slide,background:value}:slide));
 const toggleFullscreen=async()=>{try{if(!document.fullscreenElement){const stage=document.querySelector('.presentation-stage') as HTMLElement|null;if(!stage)throw new Error('Slide não encontrado');await stage.requestFullscreen();setPresentationFullscreen(true);}else{await document.exitFullscreen();setPresentationFullscreen(false);}}catch{setNotice('Não foi possível ativar a tela cheia neste navegador.');}};
 useEffect(()=>{const onFullscreen=()=>setPresentationFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',onFullscreen);return()=>document.removeEventListener('fullscreenchange',onFullscreen);},[]);
 useEffect(()=>{if(!presentationMode)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='ArrowRight'||event.key===' '){event.preventDefault();setCurrentSlide(i=>Math.min(presentationSlides.length-1,i+1));}else if(event.key==='ArrowLeft'){event.preventDefault();setCurrentSlide(i=>Math.max(0,i-1));}else if(event.key==='Escape'&&document.fullscreenElement){document.exitFullscreen();}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[presentationMode,presentationSlides.length]);
 const startPresentation=(s:Sermon)=>{
  setActivePresentation(null);setPresentationTitle(s.title);setPresentationSermonId(s.id);
  setPresentationSlides(buildSlides(s).map(slide=>({...slide,visualStyle:'cinematic'})));setVisualStyle('cinematic');setCurrentSlide(0);setPresentationMode(false);setNotice('');setPage('EditorApresentacao');
 };
 const newBlankPresentation=()=>{
  setActivePresentation(null);setPresentationTitle('Nova apresentação');setPresentationSermonId(null);
  setPresentationSlides([{id:crypto.randomUUID(),title:'Título do slide',body:'Digite o conteúdo aqui.',visualStyle:'cinematic'}]);setVisualStyle('cinematic');
  setCurrentSlide(0);setPresentationMode(false);setNotice('');setPage('EditorApresentacao');
 };
 const editPresentation=async(p:SavedPresentation)=>{
  setNotice('Carregando os slides salvos...');
  const result=await supabase.from('presentations').select('*').eq('id',p.id).single();
  if(result.error){
   setNotice('Não foi possível carregar esta apresentação da nuvem. Tente novamente.');
   return;
  }
  const latest=result.data as SavedPresentation;
  const slides=normalizeSlides(latest.slides);
  setActivePresentation({...latest,slides});setPresentationTitle(latest.title);setPresentationSermonId(latest.sermon_id);
  setPresentationSlides(slides);setVisualStyle(slides[0]?.visualStyle||'cinematic');setCurrentSlide(0);setPresentationMode(false);setNotice('');
  setPage('EditorApresentacao');
 };
 const savePresentation=async()=>{
  if(!session?.user||!presentationTitle.trim()||!presentationSlides.length)return;
  setPresentationBusy(true);setNotice('');
  const fields={title:presentationTitle.trim(),sermon_id:presentationSermonId,slides:presentationSlides,user_id:session.user.id};
  const result=activePresentation
   ? await supabase.from('presentations').update({title:fields.title,slides:fields.slides,sermon_id:fields.sermon_id}).eq('id',activePresentation.id).select().single()
   : await supabase.from('presentations').insert(fields).select().single();
  setPresentationBusy(false);
  if(result.error){setNotice('Não foi possível salvar. Confira se você criou a tabela presentations no Supabase.');return;}
  const saved=result.data as SavedPresentation;
  setPresentations(old=>activePresentation?old.map(p=>p.id===saved.id?saved:p):[saved,...old]);
  const normalized={...saved,slides:normalizeSlides(saved.slides)};setActivePresentation(normalized);setPresentationSlides(normalized.slides);setNotice('Apresentação salva na nuvem.');
 };
 const updateSlide=(id:string,field:'title'|'body',value:string)=>setPresentationSlides(old=>old.map(slide=>slide.id===id?{...slide,[field]:value}:slide));
 const addSlide=()=>{const slide={id:crypto.randomUUID(),title:'Novo slide',body:'',visualStyle};setPresentationSlides(old=>[...old,slide]);setCurrentSlide(presentationSlides.length);};
 const deleteSlide=(id:string)=>{setPresentationSlides(old=>old.filter(s=>s.id!==id));setCurrentSlide(i=>Math.max(0,Math.min(i,presentationSlides.length-2)));};
 const handleAuth=async(e:FormEvent)=>{
  e.preventDefault();setAuthBusy(true);setAuthMessage('');
  const result=authMode==='signup'
   ? await supabase.auth.signUp({email,password})
   : await supabase.auth.signInWithPassword({email,password});
  setAuthBusy(false);
  if(result.error){setAuthMessage(result.error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':result.error.message);return;}
  if(authMode==='signup'&&!result.data.session)setAuthMessage('Conta criada! Confira seu e-mail para confirmar o cadastro e depois entre no Palavra Viva.');
 };
 const signOut=async()=>{await supabase.auth.signOut();setPage('Início');};
 const nav=[{name:'Início',icon:LayoutDashboard},{name:'Mensagens',icon:NotebookPen},{name:'Bíblia',icon:BookOpen},{name:'Apresentações',icon:Presentation},{name:'Pastas',icon:FolderOpen}];

 if(loading)return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',color:'#536579'}}>Carregando Palavra Viva...</div>;
 if(!session)return <div style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:22,background:'#f6f7f9'}}><form onSubmit={handleAuth} style={{width:'min(420px,100%)',background:'#fff',padding:32,borderRadius:16,border:'1px solid #e7ebef',boxShadow:'0 12px 40px #1c344410'}}><div style={{display:'flex',alignItems:'center',gap:12,marginBottom:28}}><div style={{width:46,height:46,borderRadius:13,background:'#e7c989',color:'#142b46',display:'grid',placeItems:'center'}}><BookOpen size={24}/></div><div><strong style={{font:'800 21px Manrope',color:'#1b2a3b'}}>Palavra Viva</strong><div style={{fontSize:9,letterSpacing:1,color:'#8493a5'}}>PREPARE • ORGANIZE • PROCLAME</div></div></div><h1 style={{font:'800 25px Manrope',color:'#1b2a3b',margin:'0 0 8px'}}>{authMode==='login'?'Acesse seu espaço':'Crie sua conta'}</h1><p style={{fontSize:13,color:'#8793a0',margin:'0 0 24px'}}>Suas mensagens ficam salvas com segurança na sua conta.</p><label style={{display:'block',fontSize:12,fontWeight:700,color:'#526174',marginBottom:7}}>E-mail</label><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" style={{width:'100%',padding:13,border:'1px solid #e1e7ec',borderRadius:8,marginBottom:16}}/><label style={{display:'block',fontSize:12,fontWeight:700,color:'#526174',marginBottom:7}}>Senha</label><input type="password" required minLength={6} autoComplete={authMode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" style={{width:'100%',padding:13,border:'1px solid #e1e7ec',borderRadius:8,marginBottom:18}}/><button type="submit" disabled={authBusy} style={{width:'100%',padding:13,border:0,borderRadius:8,background:'#173653',color:'#fff',fontWeight:700,cursor:'pointer'}}>{authBusy?'Aguarde...':authMode==='login'?'Entrar':'Criar conta'}</button>{authMessage&&<p style={{fontSize:12,lineHeight:1.5,color:'#9a7138',marginTop:15}}>{authMessage}</p>}<p style={{fontSize:12,color:'#778493',textAlign:'center',marginTop:22}}>{authMode==='login'?'Ainda não tem conta?':'Já tem uma conta?'} <button type="button" onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setAuthMessage('');}} style={{border:0,background:'none',color:'#315d7d',fontWeight:700,cursor:'pointer'}}>{authMode==='login'?'Criar conta':'Fazer login'}</button></p></form></div>;

 return <div className="app-shell">
  <aside className={mobile?'sidebar open':'sidebar'}><div className="brand"><div className="brand-mark"><BookOpen size={23}/></div><div><strong>Palavra Viva</strong><small>PREPARE • ORGANIZE • PROCLAME</small></div><button className="mobile-close" onClick={()=>setMobile(false)}><X/></button></div>
   <div className="workspace-label">ESPAÇO DE TRABALHO</div><nav>{nav.map(n=><button key={n.name} className={page===n.name?'nav-item selected':'nav-item'} onClick={()=>{setPage(n.name);setMobile(false);setActive(null)}}><n.icon size={18}/>{n.name}{n.name==='Mensagens'&&<span className="nav-count">{sermons.length}</span>}</button>)}</nav>
   <div className="sidebar-bottom"><div className="holyrics-card"><div className="holyrics-icon"><Monitor size={18}/></div><div><b>Holyrics</b><small>Integração em breve</small></div><span className="status-dot"/></div><div className="profile"><div className="avatar">G</div><div><b>Meu espaço</b><small>{session.user.email}</small></div><button title="Sair da conta" onClick={signOut} style={{marginLeft:'auto',border:0,background:'transparent',color:'#aebdcb',cursor:'pointer'}}><LogOut size={17}/></button></div></div>
  </aside>
  {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
  <main className="main"><header className="topbar"><button className="menu-btn" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">Workspace <ChevronRight size={14}/><b>{page}</b></div><div className="top-actions"><span className="cloud-status"><i/> Sincronizado na nuvem</span><button className="icon-btn"><Bell size={18}/></button><div className="avatar small">G</div></div></header>
  {notice&&<div style={{margin:'15px auto 0',width:'90%',maxWidth:1080,padding:12,borderRadius:8,background:'#f7f1e5',color:'#84672f',fontSize:12}}>{notice}</div>}
  {page==='EditorApresentacao'?<section className="content editor-page">
   <button className="back-link" onClick={()=>{setPresentationMode(false);setPage('Apresentações')}}><ArrowLeft size={16}/> Voltar às apresentações</button>
   <div className="page-heading"><div><span className="eyebrow">EDITOR DE APRESENTAÇÃO</span><h1>{presentationTitle||'Nova apresentação'}</h1><p>Edite seus slides. O conteúdo continua sendo seu.</p></div><div className="editor-actions"><button className="preview-button" onClick={()=>{if(presentationMode){setPresentationMode(false);}else{if(!presentationSlides.length){setNotice('Esta apresentação não tem slides para exibir.');return;}setCurrentSlide(0);setPresentationMode(true);setNotice('');}}}><Monitor size={16}/>{presentationMode?'Voltar ao editor':'Apresentar'}</button><button className="primary" onClick={savePresentation} disabled={presentationBusy}><Save size={17}/>{presentationBusy?'Salvando...':'Salvar apresentação'}</button></div></div>
   {!presentationMode?<div className="editor-card" style={{maxWidth:900}}>
    <label>Nome da apresentação</label><input className="title-input" value={presentationTitle} onChange={e=>setPresentationTitle(e.target.value)}/>
    <label>Modelo visual</label><select className="title-input" value={visualStyle} onChange={e=>changeVisualStyle(e.target.value)}><option value="cinematic">Cinematográfico — imagem e contraste</option><option value="minimal">Minimalista — elegante e limpo</option><option value="warm">Acolhedor — tons dourados</option></select>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,margin:'24px 0 14px'}}><div><b>Slides ({presentationSlides.length})</b><div style={{fontSize:12,color:'#8793a0'}}>Clique em um slide para editar o conteúdo.</div></div><button type="button" className="add-point" onClick={addSlide}><Plus size={15}/> Adicionar slide</button></div>
    {presentationSlides.map((slide,index)=><div key={slide.id} style={{border:'1px solid #e4e9ee',borderRadius:12,padding:18,marginBottom:14,background:'#fff'}}>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><b style={{color:'#31516d'}}>Slide {index+1}</b><button type="button" className="remove-point" title="Excluir slide" disabled={presentationSlides.length===1} onClick={()=>deleteSlide(slide.id)}><X size={15}/></button></div>
     <label>Título</label><input className="title-input" value={slide.title} onChange={e=>updateSlide(slide.id,'title',e.target.value)}/>
     <label>Conteúdo</label><textarea className="structured-textarea" rows={4} value={slide.body} onChange={e=>updateSlide(slide.id,'body',e.target.value)} placeholder="Escreva o conteúdo deste slide..."/>
      <label>Imagem de fundo deste slide</label><select className="title-input" value={slide.background||'auto'} onChange={e=>changeSlideBackground(slide.id,e.target.value)}>{backgroundChoices.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>
    </div>)}
    <div className="editor-foot">Dica: use pouco texto por slide para facilitar a leitura no telão. Você pode editar tudo antes de apresentar.</div>
   </div>:<div className={`presentation-stage style-${presentationSlides[currentSlide]?.visualStyle||visualStyle}`} style={{backgroundImage:`linear-gradient(90deg,rgba(8,19,31,.78),rgba(8,19,31,.42)),url("${getSlideBackground(presentationSlides[currentSlide]||{id:'',title:'',body:''})}")`}}>
    <div className="presentation-brand">PALAVRA VIVA • APRESENTAÇÃO</div>
    <div key={currentSlide} className="presentation-copy"><div className="presentation-title">{presentationSlides[currentSlide]?.title}</div><div className="presentation-body">{presentationSlides[currentSlide]?.body}</div></div>
    <div className="presentation-controls"><button className="presentation-control" disabled={currentSlide===0} onClick={()=>setCurrentSlide(i=>Math.max(0,i-1))}>Anterior</button><span>Slide {currentSlide+1} de {presentationSlides.length}</span><div className="presentation-control-actions"><button className="presentation-control" onClick={toggleFullscreen}>{presentationFullscreen?'Sair da tela cheia':'Tela cheia'}</button><button className="presentation-control" onClick={()=>setPresentationMode(false)}>Fechar</button><button className="presentation-control" disabled={currentSlide>=presentationSlides.length-1} onClick={()=>setCurrentSlide(i=>Math.min(presentationSlides.length-1,i+1))}>Próximo</button></div></div>
   </div>}
  </section>:page==='Editor'?<section className="content editor-page"><button className="back-link" onClick={()=>setPage('Mensagens')}><ArrowLeft size={16}/> Voltar às mensagens</button><div className="page-heading"><div><span className="eyebrow">EDITOR DE MENSAGEM</span><h1>{active?'Editar mensagem':'Nova mensagem'}</h1><p>Organize suas anotações e prepare sua próxima mensagem.</p></div><div className="editor-actions"><button type="button" className="preview-button" onClick={()=>setViewMode(v=>!v)}><BookOpen size={16}/> {viewMode?'Voltar ao editor':'Visualizar mensagem'}</button>{!viewMode&&<button className="primary" onClick={save} disabled={saving}><Save size={17}/> {saving?'Salvando...':'Salvar mensagem'}</button>}</div></div>{viewMode?<article className="reading-card"><div className="reading-topline">VISUALIZAÇÃO DA MENSAGEM</div><h2>{title.trim()||'Mensagem sem título'}</h2><div className="reading-meta">{theme||'Sem categoria'}{draft.sermonType&&<><span>•</span>{draft.sermonType}</>}</div>{draft.baseText&&<section className="reading-section reading-scripture"><h3>Texto bíblico base</h3><p>{draft.baseText}</p></section>}{draft.objective&&<section className="reading-section"><h3>Objetivo da mensagem</h3><p>{draft.objective}</p></section>}{draft.introduction&&<section className="reading-section"><h3>Introdução</h3><p>{draft.introduction}</p></section>}{draft.points.some(p=>p.trim())&&<section className="reading-section"><h3>Desenvolvimento</h3><ol className="reading-points">{draft.points.map((point,index)=>point.trim()&&<li key={index}><p>{point}</p></li>)}</ol></section>}{draft.conclusion&&<section className="reading-section"><h3>Conclusão</h3><p>{draft.conclusion}</p></section>}{draft.references&&<section className="reading-section"><h3>Referências bíblicas complementares</h3><p>{draft.references}</p></section>}{draft.notes&&<section className="reading-section reading-notes"><h3>Anotações pessoais</h3><p>{draft.notes}</p></section>}{!draft.baseText&&!draft.objective&&!draft.introduction&&!draft.points.some(p=>p.trim())&&!draft.conclusion&&!draft.references&&!draft.notes&&<p className="reading-empty">Ainda não há conteúdo registrado nesta mensagem.</p>}</article>:<div className="editor-card">
 <div className="editor-section-heading"><div><b>Identificação</b><span>Comece organizando sua mensagem.</span></div></div>
 <label>Título da mensagem</label><input className="title-input" placeholder="Ex.: A fé que move montanhas" value={title} onChange={e=>setTitle(e.target.value)}/>
 <label>Tema ou categoria</label><input placeholder="Ex.: Fé, família, oração..." value={theme} onChange={e=>setTheme(e.target.value)}/>
 <label>Tipo de pregação</label><select className="title-input" value={draft.sermonType} onChange={e=>setDraft(d=>({...d,sermonType:e.target.value}))}><option value="">Não definido</option><option value="Expositiva">Expositiva</option><option value="Temática">Temática</option><option value="Textual">Textual</option></select>
 <div className="editor-divider"/>
 <div className="editor-section-heading"><div><b>Preparação da mensagem</b><span>Preencha os campos no seu ritmo. Você decide o conteúdo.</span></div></div>
 <label>Texto bíblico base</label><textarea className="structured-textarea compact" placeholder="Ex.: João 15:1-8" value={draft.baseText} onChange={e=>setDraft(d=>({...d,baseText:e.target.value}))}/>
 <label>Objetivo da mensagem</label><textarea className="structured-textarea compact" placeholder="O que você deseja transmitir à igreja?" value={draft.objective} onChange={e=>setDraft(d=>({...d,objective:e.target.value}))}/>
 <label>Introdução</label><textarea className="structured-textarea" placeholder="Registre aqui a introdução da sua mensagem..." value={draft.introduction} onChange={e=>setDraft(d=>({...d,introduction:e.target.value}))}/>
 <div className="editor-divider"/>
 <div className="editor-section-heading"><div><b>Desenvolvimento</b><span>Organize o raciocínio em tópicos.</span></div><button type="button" className="add-point" onClick={()=>setDraft(d=>({...d,points:[...d.points,'']}))}><Plus size={15}/> Adicionar tópico</button></div>
 <div className="outline-list">{draft.points.map((point,index)=><div className="outline-item" key={index}><span className="outline-number">{index+1}</span><textarea className="structured-textarea" placeholder={`Tópico ${index+1}: desenvolva sua anotação...`} value={point} onChange={e=>setDraft(d=>({...d,points:d.points.map((p,i)=>i===index?e.target.value:p)}))}/>{draft.points.length>1&&<button type="button" className="remove-point" title="Remover tópico" onClick={()=>setDraft(d=>({...d,points:d.points.filter((_,i)=>i!==index)}))}><X size={15}/></button>}</div>)}</div>
 <label>Conclusão</label><textarea className="structured-textarea" placeholder="Registre como deseja concluir a mensagem..." value={draft.conclusion} onChange={e=>setDraft(d=>({...d,conclusion:e.target.value}))}/>
 <label>Referências bíblicas complementares</label><textarea className="structured-textarea compact" placeholder="Ex.: Romanos 8:28; Filipenses 4:13; Salmos 23" value={draft.references} onChange={e=>setDraft(d=>({...d,references:e.target.value}))}/>
 <label>Anotações pessoais</label><textarea className="structured-textarea" placeholder="Ideias, ilustrações, lembretes e observações..." value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))}/>
 <div className="editor-foot">Seu conteúdo é seu. A Palavra Viva organiza suas anotações, mas não cria nem altera sua pregação.</div>
 </div>}</section>
  :page==='Início'?<section className="content"><div className="welcome-row"><div><span className="eyebrow">SEU ESPAÇO DE TRABALHO</span><h1>Bem-vindo à Palavra Viva<span>.</span></h1><p>Seu espaço para preparar e organizar mensagens bíblicas.</p></div><button className="primary" onClick={create}><Plus size={18}/> Nova mensagem</button></div><div className="hero"><div className="hero-copy"><span className="hero-tag">SEU ESPAÇO DE PREPARAÇÃO</span><h2>Uma mensagem bem preparada<br/>começa com organização.</h2><p>Reúna suas anotações, referências bíblicas e ideias em um só lugar.</p><button className="hero-button" onClick={create}>Começar uma mensagem <ChevronRight size={17}/></button></div><div className="hero-art"><div className="art-circle"><BookOpen size={78} strokeWidth={1}/></div><span className="art-verse">“Lâmpada para os meus pés<br/>é a tua palavra...”<small> SALMOS 119:105</small></span></div></div>
   <div className="section-title"><div><h2>Visão geral</h2><p>Acompanhe seu material de estudo.</p></div></div><div className="stats"><div className="stat-card"><div className="stat-icon blue"><NotebookPen/></div><span>Mensagens salvas</span><strong>{sermons.length.toString().padStart(2,'0')}</strong><small>Na sua biblioteca</small></div><div className="stat-card"><div className="stat-icon gold"><BookMarked/></div><span>Temas estudados</span><strong>{new Set(sermons.map(s=>s.theme)).size.toString().padStart(2,'0')}</strong><small>Assuntos organizados</small></div><div className="stat-card"><div className="stat-icon green"><Presentation/></div><span>Apresentações</span><strong>{presentations.length.toString().padStart(2,'0')}</strong><small>Prontas para projetar</small></div></div>
   <div className="section-title recent-title"><div><h2>Mensagens recentes</h2><p>Continue de onde você parou.</p></div><button className="text-button" onClick={()=>setPage('Mensagens')}>Ver todas <ChevronRight size={16}/></button></div><div className="sermon-list">{sermons.slice(0,3).map(s=><button className="sermon-row" key={s.id} onClick={()=>edit(s)}><div className="sermon-symbol"><BookOpen/></div><div className="sermon-info"><b>{s.title}</b><span>{s.theme} <i>•</i> {s.date}</span></div><span className={'pill '+(s.status==='Concluída'?'done':'draft')}>{s.status}</span><ChevronRight className="row-arrow" size={18}/></button>)}{!sermons.length&&<div className="empty">Suas mensagens salvas aparecerão aqui.</div>}</div>
  </section>:page==='Mensagens'?<section className="content"><div className="page-heading"><div><span className="eyebrow">SUA BIBLIOTECA</span><h1>Minhas mensagens</h1><p>Suas pregações e estudos, organizados em um só lugar.</p></div><button className="primary" onClick={create}><Plus size={18}/> Nova mensagem</button></div><div className="search-box"><Search size={18}/><input placeholder="Buscar por título ou tema..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="sermon-list full-list">{filtered.map(s=><button className="sermon-row" key={s.id} onClick={()=>edit(s)}><div className="sermon-symbol"><BookOpen/></div><div className="sermon-info"><b>{s.title}</b><span>{s.theme} <i>•</i> {s.date}</span></div><span className={'pill '+(s.status==='Concluída'?'done':'draft')}>{s.status}</span><ChevronRight className="row-arrow" size={18}/></button>)}{!filtered.length&&<div className="empty">Nenhuma mensagem encontrada.</div>}</div></section>
  :page==='Bíblia'?<BibleReader/>:page==='Apresentações'?<section className="content">
   <div className="page-heading"><div><span className="eyebrow">SEUS SLIDES</span><h1>Apresentações</h1><p>Transforme suas mensagens em slides e apresente no telão.</p></div><button className="primary" onClick={newBlankPresentation}><Plus size={18}/> Nova apresentação</button></div>
   <div className="editor-card" style={{marginBottom:22}}><b>Comece por uma mensagem</b><p style={{fontSize:13,color:'#8793a0',marginTop:6}}>Escolha uma mensagem salva para organizar automaticamente os primeiros slides. Você poderá editar tudo.</p>
    {sermons.length?sermons.map(s=><div key={s.id} className="sermon-row" style={{cursor:'default'}}><div className="sermon-symbol"><BookOpen/></div><div className="sermon-info"><b>{s.title}</b><span>{s.theme} • {s.date}</span></div><button className="preview-button" onClick={()=>startPresentation(s)}>Criar slides</button></div>):<div className="empty">Salve uma mensagem primeiro para criar slides a partir dela.</div>}
   </div>
   <div className="section-title"><div><h2>Minhas apresentações</h2><p>Seus slides salvos na nuvem.</p></div></div>
   <div className="sermon-list full-list">{presentations.map(p=><button className="sermon-row" key={p.id} onClick={()=>editPresentation(p)}><div className="sermon-symbol"><Presentation/></div><div className="sermon-info"><b>{p.title}</b><span>{p.slides?.length||0} slides • {new Date(p.created_at).toLocaleDateString('pt-BR')}</span></div><span className="pill done">Salva</span><ChevronRight className="row-arrow" size={18}/></button>)}{!presentations.length&&<div className="empty">Suas apresentações salvas aparecerão aqui.</div>}</div>
  </section>:<section className="content"><div className="page-heading"><div><span className="eyebrow">PALAVRA VIVA</span><h1>{page}</h1><p>Organize suas mensagens por pastas e temas.</p></div></div><div className="coming-card"><div className="coming-icon"><FolderOpen/></div><h2>Tudo organizado no seu ritmo</h2><p>Estamos preparando esta área para uma próxima etapa do Palavra Viva.</p><span className="pill draft">Em desenvolvimento</span></div></section>}
  <footer>Palavra Viva <span>•</span> Seu espaço de preparação e estudo bíblico.</footer></main></div>;
}

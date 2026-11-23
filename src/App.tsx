import { useEffect, useMemo, useState, FormEvent } from 'react';
import { Session } from '@supabase/supabase-js';
import { BookOpen, LayoutDashboard, NotebookPen, FolderOpen, Presentation, Search, Plus, Bell, ChevronRight, BookMarked, MoreHorizontal, Menu, X, Save, ArrowLeft, Monitor, LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';

type Sermon = { id:string; user_id:string; title:string; theme:string; date:string; status:string; content:string; created_at:string };
type SermonDraft = { sermonType:string; baseText:string; objective:string; introduction:string; points:string[]; conclusion:string; references:string; notes:string };
const emptyDraft = ():SermonDraft => ({sermonType:'',baseText:'',objective:'',introduction:'',points:['','',''],conclusion:'',references:'',notes:''});
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

 useEffect(()=>{
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false);});
  return ()=>subscription.unsubscribe();
 },[]);

 useEffect(()=>{
  if(!session){setSermons([]);return;}
  let alive=true;
  supabase.from('sermons').select('*').order('created_at',{ascending:false}).then(({data,error})=>{
   if(!alive)return;
   if(error){setNotice('Não foi possível carregar suas mensagens. Confira se a tabela do banco já foi criada.');return;}
   setSermons((data||[]) as Sermon[]);
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
  {page==='Editor'?<section className="content editor-page"><button className="back-link" onClick={()=>setPage('Mensagens')}><ArrowLeft size={16}/> Voltar às mensagens</button><div className="page-heading"><div><span className="eyebrow">EDITOR DE MENSAGEM</span><h1>{active?'Editar mensagem':'Nova mensagem'}</h1><p>Organize suas anotações e prepare sua próxima mensagem.</p></div><div className="editor-actions"><button type="button" className="preview-button" onClick={()=>setViewMode(v=>!v)}><BookOpen size={16}/> {viewMode?'Voltar ao editor':'Visualizar mensagem'}</button>{!viewMode&&<button className="primary" onClick={save} disabled={saving}><Save size={17}/> {saving?'Salvando...':'Salvar mensagem'}</button>}</div></div>{viewMode?<article className="reading-card"><div className="reading-topline">VISUALIZAÇÃO DA MENSAGEM</div><h2>{title.trim()||'Mensagem sem título'}</h2><div className="reading-meta">{theme||'Sem categoria'}{draft.sermonType&&<><span>•</span>{draft.sermonType}</>}</div>{draft.baseText&&<section className="reading-section reading-scripture"><h3>Texto bíblico base</h3><p>{draft.baseText}</p></section>}{draft.objective&&<section className="reading-section"><h3>Objetivo da mensagem</h3><p>{draft.objective}</p></section>}{draft.introduction&&<section className="reading-section"><h3>Introdução</h3><p>{draft.introduction}</p></section>}{draft.points.some(p=>p.trim())&&<section className="reading-section"><h3>Desenvolvimento</h3><ol className="reading-points">{draft.points.map((point,index)=>point.trim()&&<li key={index}><p>{point}</p></li>)}</ol></section>}{draft.conclusion&&<section className="reading-section"><h3>Conclusão</h3><p>{draft.conclusion}</p></section>}{draft.references&&<section className="reading-section"><h3>Referências bíblicas complementares</h3><p>{draft.references}</p></section>}{draft.notes&&<section className="reading-section reading-notes"><h3>Anotações pessoais</h3><p>{draft.notes}</p></section>}{!draft.baseText&&!draft.objective&&!draft.introduction&&!draft.points.some(p=>p.trim())&&!draft.conclusion&&!draft.references&&!draft.notes&&<p className="reading-empty">Ainda não há conteúdo registrado nesta mensagem.</p>}</article>:<div className="editor-card">
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
   <div className="section-title"><div><h2>Visão geral</h2><p>Acompanhe seu material de estudo.</p></div></div><div className="stats"><div className="stat-card"><div className="stat-icon blue"><NotebookPen/></div><span>Mensagens salvas</span><strong>{sermons.length.toString().padStart(2,'0')}</strong><small>Na sua biblioteca</small></div><div className="stat-card"><div className="stat-icon gold"><BookMarked/></div><span>Temas estudados</span><strong>{new Set(sermons.map(s=>s.theme)).size.toString().padStart(2,'0')}</strong><small>Assuntos organizados</small></div><div className="stat-card"><div className="stat-icon green"><Presentation/></div><span>Apresentações</span><strong>00</strong><small>Prontas para projetar</small></div></div>
   <div className="section-title recent-title"><div><h2>Mensagens recentes</h2><p>Continue de onde você parou.</p></div><button className="text-button" onClick={()=>setPage('Mensagens')}>Ver todas <ChevronRight size={16}/></button></div><div className="sermon-list">{sermons.slice(0,3).map(s=><button className="sermon-row" key={s.id} onClick={()=>edit(s)}><div className="sermon-symbol"><BookOpen/></div><div className="sermon-info"><b>{s.title}</b><span>{s.theme} <i>•</i> {s.date}</span></div><span className={'pill '+(s.status==='Concluída'?'done':'draft')}>{s.status}</span><ChevronRight className="row-arrow" size={18}/></button>)}{!sermons.length&&<div className="empty">Suas mensagens salvas aparecerão aqui.</div>}</div>
  </section>:page==='Mensagens'?<section className="content"><div className="page-heading"><div><span className="eyebrow">SUA BIBLIOTECA</span><h1>Minhas mensagens</h1><p>Suas pregações e estudos, organizados em um só lugar.</p></div><button className="primary" onClick={create}><Plus size={18}/> Nova mensagem</button></div><div className="search-box"><Search size={18}/><input placeholder="Buscar por título ou tema..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="sermon-list full-list">{filtered.map(s=><button className="sermon-row" key={s.id} onClick={()=>edit(s)}><div className="sermon-symbol"><BookOpen/></div><div className="sermon-info"><b>{s.title}</b><span>{s.theme} <i>•</i> {s.date}</span></div><span className={'pill '+(s.status==='Concluída'?'done':'draft')}>{s.status}</span><ChevronRight className="row-arrow" size={18}/></button>)}{!filtered.length&&<div className="empty">Nenhuma mensagem encontrada.</div>}</div></section>
  :<section className="content"><div className="page-heading"><div><span className="eyebrow">PALAVRA VIVA</span><h1>{page}</h1><p>{page==='Bíblia'?'Em breve: consulta e organização de referências bíblicas.':page==='Apresentações'?'Crie e organize apresentações a partir das suas mensagens.':'Organize suas mensagens por pastas e temas.'}</p></div></div><div className="coming-card"><div className="coming-icon">{page==='Bíblia'?<BookOpen/>:page==='Apresentações'?<Presentation/>:<FolderOpen/>}</div><h2>{page==='Apresentações'?'Suas apresentações começam aqui':page==='Bíblia'?'Sua Bíblia, sempre à mão':'Tudo organizado no seu ritmo'}</h2><p>Estamos preparando esta área para uma próxima etapa do Palavra Viva.</p><span className="pill draft">Em desenvolvimento</span></div></section>}
  <footer>Palavra Viva <span>•</span> Seu espaço de preparação e estudo bíblico.</footer></main></div>;
}

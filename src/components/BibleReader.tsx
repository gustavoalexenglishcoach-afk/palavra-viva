import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Search, Bookmark, Highlighter, BookMarked, LoaderCircle, AlertCircle } from 'lucide-react';

type BibleItem = { id: string; name: string; nameLocal?: string; abbreviation?: string; abbreviationLocal?: string; language?: { id?: string; nameLocal?: string }; };
type BookItem = { id: string; name: string; nameLong?: string; abbreviation?: string; };
type ChapterItem = { id: string; number: string; reference?: string; };
type VerseItem = { id: string; reference?: string; number?: string; text?: string; };

const bibleLabel = (b: BibleItem) => {
  const abbreviation = b.abbreviationLocal || b.abbreviation || '';
  const name = b.nameLocal || b.name || 'Tradução disponível';
  return abbreviation ? abbreviation + ' — ' + name : name;
};

export default function BibleReader() {
  const [bibles,setBibles]=useState<BibleItem[]>([]);
  const [books,setBooks]=useState<BookItem[]>([]);
  const [chapters,setChapters]=useState<ChapterItem[]>([]);
  const [verses,setVerses]=useState<VerseItem[]>([]);
  const [copyright,setCopyright]=useState('');
  const [bibleId,setBibleId]=useState('');
  const [bookId,setBookId]=useState('');
  const [chapterId,setChapterId]=useState('');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [selected,setSelected]=useState<string[]>([]);
  const [saved,setSaved]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('pv-bible-favorites')||'[]')}catch{return[]}});
  const [tab,setTab]=useState<'read'|'favorites'>('read');

  useEffect(()=>{let live=true; fetch('/api/bible?action=bibles').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Não foi possível carregar as traduções.');return d;}).then(d=>{if(!live)return;const list=((d.data||[]) as BibleItem[]).filter(b=>b.language?.id==='por');const sorted=[...list].sort((a,b)=>{const aa=(a.abbreviationLocal||a.abbreviation||'').toUpperCase()==='ARA'?0:1;const bb=(b.abbreviationLocal||b.abbreviation||'').toUpperCase()==='ARA'?0:1;return aa-bb||bibleLabel(a).localeCompare(bibleLabel(b),'pt-BR');});setBibles(sorted);const preferred=sorted.find(b=>(b.abbreviationLocal||b.abbreviation||'').toUpperCase()==='ARA')||sorted[0];if(preferred)setBibleId(preferred.id);if(!sorted.length)setError('Nenhuma tradução em português está disponível para esta chave da API.Bible.');}).catch(e=>{if(live)setError(e.message);});return()=>{live=false}},[]);
  useEffect(()=>{if(!bibleId)return;let live=true;setLoading(true);setError('');setBooks([]);setChapters([]);setVerses([]);fetch('/api/bible?action=books&bibleId='+encodeURIComponent(bibleId)).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(d=>{if(!live)return;const list=(d.data||[]) as BookItem[];setBooks(list);const first=list[0];if(first)setBookId(first.id);}).catch(e=>{if(live)setError(e.message||'Erro ao carregar livros.');}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[bibleId]);
  useEffect(()=>{if(!bibleId||!bookId)return;let live=true;setLoading(true);setChapters([]);setVerses([]);fetch('/api/bible?action=chapters&bibleId='+encodeURIComponent(bibleId)+'&bookId='+encodeURIComponent(bookId)).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(d=>{if(!live)return;const list=(d.data||[]) as ChapterItem[];setChapters(list);if(list[0])setChapterId(list[0].id);}).catch(e=>{if(live)setError(e.message||'Erro ao carregar capítulos.');}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[bibleId,bookId]);
  useEffect(()=>{if(!bibleId||!chapterId)return;let live=true;setLoading(true);setVerses([]);fetch('/api/bible?action=verses&bibleId='+encodeURIComponent(bibleId)+'&chapterId='+encodeURIComponent(chapterId)).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}).then(d=>{if(!live)return;setVerses((d.data||[]) as VerseItem[]);setCopyright(d.copyright||'');}).catch(e=>{if(live)setError(e.message||'Erro ao carregar versículos.');}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[bibleId,chapterId]);
  const currentBook=books.find(b=>b.id===bookId);
  const currentChapter=chapters.find(c=>c.id===chapterId);
  const filteredBooks=useMemo(()=>books.filter(b=>(b.name+' '+(b.nameLong||'')).toLowerCase().includes(search.toLowerCase())),[books,search]);
  const persist=(next:string[])=>{setSaved(next);localStorage.setItem('pv-bible-favorites',JSON.stringify(next));};
  const toggleFavorite=(v:VerseItem)=>{const key=v.id;persist(saved.includes(key)?saved.filter(x=>x!==key):[...saved,key]);};
  const toggleSelect=(id:string)=>setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const changeChapter=(direction:number)=>{const index=chapters.findIndex(c=>c.id===chapterId);const next=chapters[index+direction];if(next)setChapterId(next.id);};
  return <div className="bible-reader">
    <div className="bible-intro"><div className="bible-book-icon"><BookOpen size={25}/></div><div><span className="eyebrow">LEITURA E ESTUDO</span><h2>Sua Bíblia, sempre à mão.</h2><p>Escolha uma tradução, navegue pelos livros e marque os versículos importantes.</p></div></div>
    {error&&<div className="bible-alert"><AlertCircle size={18}/><div><b>Conexão com a Bíblia</b><span>{error}</span>{error.includes('Configure a chave')&&<small>Vamos conectar sua conta API.Bible na próxima etapa. Sua chave ficará protegida no servidor.</small>}</div></div>}
    <div className="bible-toolbar"><div className="bible-version"><label>TRADUÇÃO</label><select value={bibleId} onChange={e=>setBibleId(e.target.value)} disabled={!bibles.length}><option value="">{bibles.length?'Selecione uma tradução':'Nenhuma tradução em português foi encontrada'}</option>{bibles.map(b=><option key={b.id} value={b.id}>{bibleLabel(b)}</option>)}</select></div><div className="bible-version"><label>LIVRO</label><select value={bookId} onChange={e=>setBookId(e.target.value)} disabled={!books.length}><option value="">Selecione</option>{books.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div><div className="bible-version chapter-select"><label>CAPÍTULO</label><select value={chapterId} onChange={e=>setChapterId(e.target.value)} disabled={!chapters.length}><option value="">—</option>{chapters.map(c=><option key={c.id} value={c.id}>{c.number}</option>)}</select></div></div>
    <div className="bible-tabs"><button className={tab==='read'?'active':''} onClick={()=>setTab('read')}><BookOpen size={15}/> Leitura</button><button className={tab==='favorites'?'active':''} onClick={()=>setTab('favorites')}><Bookmark size={15}/> Favoritos <span>{saved.length}</span></button></div>
    {tab==='read'?<><div className="bible-reading-head"><div><span className="eyebrow">PALAVRA DE DEUS</span><h3>{currentBook?.name||'Selecione um livro'}{currentChapter?' '+currentChapter.number:''}</h3></div><div className="chapter-arrows"><button onClick={()=>changeChapter(-1)} disabled={!chapters.length||chapters[0]?.id===chapterId}><ChevronLeft size={18}/></button><button onClick={()=>changeChapter(1)} disabled={!chapters.length||chapters[chapters.length-1]?.id===chapterId}><ChevronRight size={18}/></button></div></div>
    <div className="bible-verses">{loading&&!verses.length?<div className="bible-loading"><LoaderCircle className="spin"/> Carregando texto bíblico...</div>:verses.length?verses.map((v,i)=><div key={v.id} className={'bible-verse '+(selected.includes(v.id)?'marked':'')}><button className="verse-number" onClick={()=>toggleSelect(v.id)} title="Marcar versículo">{v.number||v.reference?.split('.').pop()||i+1}</button><p>{v.text?.replace(/<[^>]*>/g,' ').trim()||'Texto indisponível.'}</p><button className={'verse-favorite '+(saved.includes(v.id)?'saved':'')} onClick={()=>toggleFavorite(v)} title="Salvar favorito"><Bookmark size={16}/></button></div>):<div className="bible-empty">Selecione um livro e capítulo para começar a leitura.</div>}</div></>:<div className="bible-favorites"><h3><BookMarked size={18}/> Seus versículos favoritos</h3>{saved.length?<p>Você já marcou {saved.length} versículo(s). Em breve vamos sincronizar seus favoritos na nuvem para toda a equipe.</p>:<p>Toque no marcador ao lado de um versículo para guardá-lo aqui.</p>}</div>}
    <div className="bible-footnote">{copyright&&<><b>{copyright}</b><br/></>}Os textos e créditos seguem as condições da tradução fornecida pela API.Bible. Favoritos, nesta primeira etapa, ficam salvos neste dispositivo.</div>
  </div>;
}

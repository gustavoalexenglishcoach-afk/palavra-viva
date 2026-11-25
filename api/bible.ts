export default async function handler(req: any, res: any) {
  const key = process.env.BIBLE_API_KEY;
  if (!key) return res.status(503).json({ error: 'A Bíblia ainda não foi conectada. Configure a chave da API.Bible na Vercel.' });
  const { action, bibleId, bookId, chapterId } = req.query || {};
  let path = '';
  if (action === 'bibles') {
    // Request the exact three Portuguese Bible editions selected in the API.Bible plan.
    const selectedBibleIds = [
      '78a9f6124f344018-01', // NVI
      'd6e14a625393b4da-01', // NTV
      'afc24de218ef6e38-01', // ARA
    ];
    path = '/bibles?ids=' + encodeURIComponent(selectedBibleIds.join(','));
  }
  else if (action === 'books' && bibleId) path = `/bibles/${encodeURIComponent(bibleId)}/books`;
  else if (action === 'chapters' && bibleId && bookId) path = `/bibles/${encodeURIComponent(bibleId)}/books/${encodeURIComponent(bookId)}/chapters`;
  else if (action === 'verses' && bibleId && chapterId) path = `/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}?content-type=json&include-verse-numbers=true&include-verse-spans=true`;
  else return res.status(400).json({ error: 'Consulta inválida.' });
  try {
    const response = await fetch(`https://rest.api.bible/v1${path}`, { headers: { 'api-key': key, 'Content-Type': 'application/json' } });
    const body = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: body?.message || body?.error || 'Não foi possível consultar a Bíblia.' });
    if (action === 'bibles') {
      body.data = (body.data || []).filter((b: any) =>
        ['78a9f6124f344018-01', 'd6e14a625393b4da-01', 'afc24de218ef6e38-01'].includes(b.id)
      );
    }
    if (action === 'verses') {
      const chapterCopyright = body?.data?.copyright || '';
      const found = new Map<string, { id: string; reference: string; number: string; text: string }>();
      let currentNumber = '';
      const walk = (node: any): void => {
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!node || typeof node !== 'object') return;
        if (node.name === 'verse' && node.attrs?.number) currentNumber = String(node.attrs.number);
        if (node.attrs?.verseId && typeof node.text === 'string') {
          const id = String(node.attrs.verseId);
          const item = found.get(id) || { id, reference: id, number: currentNumber || id.split('.').pop() || '', text: '' };
          item.text += node.text;
          found.set(id, item);
        }
        if (node.items) walk(node.items);
        if (node.content && typeof node.content === 'object') walk(node.content);
      };
      walk(body?.data?.content);
      body.data = Array.from(found.values());
      body.copyright = chapterCopyright;
    }
    res.setHeader('Cache-Control', action === 'bibles' ? 's-maxage=60, stale-while-revalidate=300' : 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(body);
  } catch {
    return res.status(502).json({ error: 'Falha ao conectar com o serviço bíblico. Tente novamente.' });
  }
}

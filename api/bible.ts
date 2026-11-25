export default async function handler(req: any, res: any) {
  const key = process.env.BIBLE_API_KEY;
  if (!key) return res.status(503).json({ error: 'A Bíblia ainda não foi conectada. Configure a chave da API.Bible na Vercel.' });
  const { action, bibleId, bookId, chapterId } = req.query || {};
  let path = '';
  if (action === 'bibles') path = '/bibles?language=por';
  else if (action === 'books' && bibleId) path = `/bibles/${encodeURIComponent(bibleId)}/books`;
  else if (action === 'chapters' && bibleId && bookId) path = `/bibles/${encodeURIComponent(bibleId)}/books/${encodeURIComponent(bookId)}/chapters`;
  else if (action === 'verses' && bibleId && chapterId) path = `/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}/verses?content-type=text&include-verse-numbers=true`;
  else return res.status(400).json({ error: 'Consulta inválida.' });
  try {
    const response = await fetch(`https://rest.api.bible/v1${path}`, { headers: { 'api-key': key, 'Content-Type': 'application/json' } });
    const body = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: body?.message || body?.error || 'Não foi possível consultar a Bíblia.' });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json(body);
  } catch {
    return res.status(502).json({ error: 'Falha ao conectar com o serviço bíblico. Tente novamente.' });
  }
}

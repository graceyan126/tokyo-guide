const ALLOWED_LANGUAGES = ['中文', '日语', '英语']

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST 请求' })
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: '翻译服务未配置：请在 Vercel 添加 GEMINI_API_KEY 后重新部署' })
  const body = req.body || {}, target = ALLOWED_LANGUAGES.includes(body.target) ? body.target : '日语'
  const text = String(body.text || '').trim().slice(0, 5000)
  const image = body.image && /^data:image\/(jpeg|png|webp);base64,/.test(body.image) ? body.image : ''
  if (!text && !image) return res.status(400).json({ error: '请输入文字或选择照片' })
  const parts = [{ text: `你是专业的日本旅行翻译。识别输入语言（中文、日语或英语），自然地翻译为${target}，不要生硬直译。若有图片，先识别图片中与旅行有关的文字。返回严格 JSON，不要 Markdown：{"detectedLanguage":"中文/日语/英语","translation":"自然译文","japanese":"对应的自然日语（使用常用汉字）","reading":"上述日语的完整平假名读音","note":"很短的语境或礼貌程度说明"}。即使目标不是日语，也必须填写 japanese 和 reading，便于用户在日本使用。用户文字：${text || '请识别图片文字'}` }]
  if (image) { const split=image.indexOf(',');parts.push({inlineData:{mimeType:image.slice(5,image.indexOf(';')),data:image.slice(split+1)}}) }
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', {method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts}],generationConfig:{responseMimeType:'application/json'}})})
    const data = await response.json()
    if (!response.ok) { const message=data.error&&data.error.message||'翻译服务请求失败';return res.status(response.status).json({error:response.status===400||response.status===403?'Gemini API Key 无效或没有 Gemini API 权限':response.status===429?'Gemini 免费额度暂时用完，请稍后重试':message}) }
    const raw=data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts&&data.candidates[0].content.parts[0]&&data.candidates[0].content.parts[0].text
    if(!raw) throw new Error('未获得翻译结果')
    return res.status(200).json(JSON.parse(raw.replace(/^```json\s*|\s*```$/g,'')))
  } catch (error) { return res.status(500).json({ error: error.message || '翻译失败，请稍后重试' }) }
}

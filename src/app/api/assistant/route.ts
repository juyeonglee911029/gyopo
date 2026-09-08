export const runtime = 'edge';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const systemPrompt = `당신은 GYOPO 글로벌 한인 포털의 정보 도우미입니다.
한국어로 간결하고 정확하게 답하세요. 모르는 내용은 추측하지 말고 모른다고 말하세요.
여행, 생활, 뉴스, 금융, 이민 질문에는 국가와 날짜를 확인하고, 금전·법률·의료 문제는 전문가 확인이 필요하다고 안내하세요.`;

// Gemini is preferred when its Production secret is available.

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { messages?: ChatMessage[] } | null;
  const messages = body?.messages?.filter((message) => message.role && message.content?.trim()).slice(-12) || [];
  if (!messages.length) return Response.json({ error: '질문을 입력해주세요.' }, { status: 400 });

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !anthropicKey && !openAiKey) {
    return Response.json({ error: 'AI 답변 서비스가 아직 연결되지 않았습니다. 관리자에게 AI API 키 설정을 요청해주세요.' }, { status: 503 });
  }

  try {
    if (geminiKey) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
          generationConfig: { maxOutputTokens: 900, temperature: 0.2 },
        }),
      });
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
      if (response.status === 400 || response.status === 401 || response.status === 403) throw new Error('Gemini API 키가 유효하지 않거나 사용할 수 없습니다. Cloudflare 환경변수의 키를 확인해주세요.');
      if (!response.ok) throw new Error(data.error?.message || 'AI 서비스가 응답하지 않았습니다.');
      const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
      return Response.json({ answer: answer || '답변을 만들지 못했습니다.' });
    }

    if (anthropicKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 900,
          system: systemPrompt,
          messages,
        }),
      });
      const data = await response.json() as { content?: Array<{ text?: string }>; error?: { message?: string } };
      if (response.status === 401) throw new Error('Anthropic API 키가 유효하지 않습니다. Cloudflare 환경변수의 키를 확인해주세요.');
      if (!response.ok) throw new Error(data.error?.message || 'AI 서비스가 응답하지 않았습니다.');
      return Response.json({ answer: data.content?.map((item) => item.text || '').join('\n').trim() || '답변을 만들지 못했습니다.' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${openAiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 900, messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
    });
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message || 'AI 서비스가 응답하지 않았습니다.');
    return Response.json({ answer: data.choices?.[0]?.message?.content?.trim() || '답변을 만들지 못했습니다.' });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'AI 답변을 가져오지 못했습니다.' }, { status: 502 });
  }
}

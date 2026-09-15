import { requireMasterUser, unauthorizedResponse } from '@/lib/apiSecurity';

export const runtime = 'edge';

type DraftInput = { keyword?: unknown; summary?: unknown; metrics?: unknown; exposure?: unknown; actionType?: unknown; missingTopics?: unknown; internalLinks?: unknown };

export type StructuredKeywordDraft = {
  title: string;
  summary: string;
  body: string;
  seoTitle: string;
  metaDescription: string;
  tags: string[];
  imageBrief: string;
  factsToVerify: string[];
};

function clip(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function limitText(value: unknown, limit: number): string {
  return [...(typeof value === 'string' ? value.trim() : '')].slice(0, limit).join('').trim();
}

function parseJson(value: string): Record<string, unknown> | null {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function normalizeDraft(value: Record<string, unknown> | null, keyword: string): StructuredKeywordDraft | null {
  if (!value) return null;
  const tags = Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean).slice(0, 8) : [];
  const factsToVerify = Array.isArray(value.factsToVerify) ? value.factsToVerify.filter((fact): fact is string => typeof fact === 'string').map((fact) => fact.trim()).filter(Boolean).slice(0, 8) : [];
  const draft = {
    title: limitText(value.title, 120),
    summary: limitText(value.summary, 360),
    body: limitText(value.body, 1_000),
    seoTitle: limitText(value.seoTitle, 70),
    metaDescription: limitText(value.metaDescription, 160),
    tags,
    imageBrief: limitText(value.imageBrief, 240),
    factsToVerify,
  } satisfies StructuredKeywordDraft;
  if (!draft.title || !draft.summary || !draft.body || !draft.seoTitle || !draft.metaDescription) return null;
  return { ...draft, title: draft.title || keyword };
}

function rawContent(data: { choices?: Array<{ message?: { content?: string } }>; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; content?: Array<{ text?: string }> }): string {
  return data.choices?.[0]?.message?.content
    || data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n')
    || data.content?.map((part) => part.text || '').join('\n')
    || '';
}

export async function POST(request: Request) {
  try {
    await requireMasterUser(request);
  } catch (error) {
    return unauthorizedResponse(error);
  }

  const body = await request.json().catch(() => null) as DraftInput | null;
  const keyword = clip(body?.keyword, 160);
  const summary = clip(body?.summary, 2_000);
  const metrics = clip(JSON.stringify(body?.metrics || {}), 3_000);
  const exposure = clip(JSON.stringify(body?.exposure || {}), 4_000);
  const actionType = clip(body?.actionType, 80);
  const missingTopics = clip(JSON.stringify(body?.missingTopics || []), 1_500);
  const internalLinks = clip(JSON.stringify(body?.internalLinks || []), 1_500);
  if (!keyword) return Response.json({ error: '핫 키워드를 선택해주세요.' }, { status: 400 });

  const prompt = `GYOPO 운영자가 검토할 한국어 커뮤니티 게시글 초안을 JSON으로 작성하세요.
키워드: ${keyword}
운영자 요약: ${summary || '요약 없음'}
검색 데이터: ${metrics || '데이터 없음'}
Exposure Contract: ${exposure || '계약 없음'}
Action Type: ${actionType || 'UPDATE'}
Missing Topics: ${missingTopics || '없음'}
Existing Internal Links: ${internalLinks || '없음'}

반드시 다음 JSON 객체만 반환하세요. 마크다운 코드펜스와 설명은 금지합니다.
{
  "title": "게시글 제목",
  "summary": "2~3문장 요약",
  "body": "1,000자 이하의 본문",
  "seoTitle": "70자 이하 SEO 제목",
  "metaDescription": "160자 이하 메타 설명",
  "tags": ["관련 태그"],
  "imageBrief": "권한 있는 이미지를 찾기 위한 검색 방향",
  "factsToVerify": ["게시 전 확인할 사실"]
}

조건:
- 제공된 검색 데이터와 운영자 요약만 사실로 사용하세요. 모르는 수치·날짜·장소·인용은 만들지 마세요.
- Action Type에 따라 수정 범위를 다르게 하세요. CTR_OPTIMIZE는 제목·메타·도입부, EXPAND는 누락 섹션·FAQ·표·출처, REFRESH는 오래된 날짜·가격·규칙과 공식 출처를 우선합니다.
- 기존 Ranking Keyword와 연결된 문단·표·FAQ를 삭제하지 말고, 삭제가 필요하면 factsToVerify에 운영자 승인 대상으로 적으세요.
- 국가·도시·Search Intent·Target URL이 계약에 있으면 그 맥락을 벗어나지 마세요.
- 독자에게 도움이 되는 맥락, 핵심 정보, 확인할 점, 다음 행동을 포함하세요.
- 사실을 확인할 수 없는 내용은 factsToVerify에 적으세요.
- 광고 과장과 반복 문장을 피하세요.`;
  const geminiKey = process.env.GEMINI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !deepseekKey && !anthropicKey && !openAiKey) return Response.json({ error: 'AI 초안 서비스가 아직 연결되지 않았습니다. 관리자에게 AI API 키 설정을 요청해주세요.' }, { status: 503 });

  try {
    let content = '';
    if (deepseekKey) {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
        body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.25, max_tokens: 2_000, messages: [{ role: 'system', content: '지시된 JSON 스키마를 정확히 반환하는 한국어 편집 도우미입니다.' }, { role: 'user', content: prompt }] }),
      });
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || 'DeepSeek가 초안을 만들지 못했습니다.');
      content = rawContent(data);
    } else if (geminiKey) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2_000, temperature: 0.25 } }),
      });
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || 'Gemini가 초안을 만들지 못했습니다.');
      content = rawContent(data);
    } else if (anthropicKey) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-3-5-haiku-latest', max_tokens: 2_000, system: '지시된 JSON 스키마를 정확히 반환하는 한국어 편집 도우미입니다.', messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await response.json() as { content?: Array<{ text?: string }>; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || 'Anthropic이 초안을 만들지 못했습니다.');
      content = rawContent(data);
    } else {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 2_000, temperature: 0.25, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: '지시된 JSON 스키마를 정확히 반환하는 한국어 편집 도우미입니다.' }, { role: 'user', content: prompt }] }),
      });
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || 'OpenAI가 초안을 만들지 못했습니다.');
      content = rawContent(data);
    }
    const draft = normalizeDraft(parseJson(content), keyword);
    if (!draft) return Response.json({ error: 'AI가 유효한 구조화 초안을 반환하지 않았습니다. 다시 시도해주세요.' }, { status: 502 });
    return Response.json({ draft, body: draft.body });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'AI 초안을 가져오지 못했습니다.' }, { status: 502 });
  }
}

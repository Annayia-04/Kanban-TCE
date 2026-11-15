/**
 * Couche IA optionnelle (compatible OpenAI / Ollama / tout endpoint chat-completions).
 * Activee si KANBAN_LLM_API_KEY est defini, ou si KANBAN_LLM_BASE_URL pointe vers un
 * serveur local (Ollama, LM Studio, vLLM...).
 */

const BASE_URL = (process.env.KANBAN_LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const API_KEY = process.env.KANBAN_LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const MODEL = process.env.KANBAN_LLM_MODEL || 'gpt-4o-mini';

const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0|host\.docker\.internal/.test(BASE_URL);

export function llmInfo() {
  const enabled = Boolean(API_KEY) || (isLocal && Boolean(process.env.KANBAN_LLM_BASE_URL));
  return {
    enabled,
    engine: enabled ? 'ia' : 'heuristique',
    model: enabled ? MODEL : null,
    baseUrl: enabled ? BASE_URL : null,
    local: isLocal,
  };
}

function buildPrompt(text, members, versions) {
  const team = members.map((m) => `- ${m.name}${m.role ? ` (${m.role})` : ''}`).join('\n') || '- (equipe inconnue)';
  const vers = versions.map((v) => `- ${v.name}`).join('\n') || '- (aucune version)';

  return `Tu es un assistant Product Owner. Transforme ce compte rendu de reunion en user stories actionnables.

EQUIPE (utilise EXACTEMENT ces noms pour "assignees") :
${team}

VERSIONS EXISTANTES (utilise EXACTEMENT ces noms pour "version", ou null) :
${vers}

REGLES :
- Une user story = une action concrete, pas une decision ni un point d'ordre du jour.
- Format francais : "En tant que <role>, je veux <action> afin de <benefice>".
- Ignore les sujets sans action (tour de table, informations, decisions actees).
- "assignees" : tableau de noms de l'equipe reellement concernes (vide si inconnu).
- "priority" : "low" | "medium" | "high".
- "due" : echeance en texte court ("vendredi", "12/11") ou "".
- "confidence" : 0 a 1.
- Ne fabrique aucune action absente du texte.

Reponds UNIQUEMENT avec un tableau JSON, sans texte autour :
[{"title":"...","asA":"...","iWant":"...","soThat":"...","description":"phrase source","assignees":["Nom"],"version":"v1","priority":"medium","due":"","confidence":0.9}]

COMPTE RENDU :
"""
${text.slice(0, 24000)}
"""`;
}

function parseJsonArray(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  const parsed = JSON.parse(s);
  return Array.isArray(parsed) ? parsed : [];
}

export async function llmExtract(text, { members = [], versions = [] } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'Tu es un assistant qui repond uniquement en JSON valide.' },
          { role: 'user', content: buildPrompt(text, members, versions) },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API IA ${res.status} : ${body.slice(0, 180)}`);
    }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? data?.message?.content ?? '';
    const rows = parseJsonArray(raw);

    return rows
      .filter((r) => r && (r.title || r.iWant))
      .map((r, i) => {
        const names = Array.isArray(r.assignees) ? r.assignees : r.assignee ? [r.assignee] : [];
        const matched = members.filter((m) =>
          names.some(
            (n) =>
              String(n).toLowerCase().includes(m.name.split(/\s+/)[0].toLowerCase()) ||
              m.name.toLowerCase().includes(String(n).toLowerCase())
          )
        );
        const version = versions.find((v) => v.name.toLowerCase() === String(r.version || '').toLowerCase());
        return {
          title: String(r.title || r.iWant || 'Action').slice(0, 120),
          asA: String(r.asA || 'l’équipe'),
          iWant: String(r.iWant || ''),
          soThat: String(r.soThat || ''),
          description: String(r.description || ''),
          assigneeIds: matched.map((m) => m.id),
          assigneeNames: matched.map((m) => m.name),
          versionId: version?.id || null,
          versionName: version?.name || (r.version ? String(r.version) : null),
          priority: ['low', 'medium', 'high'].includes(r.priority) ? r.priority : 'medium',
          due: String(r.due || ''),
          points: Number.isFinite(r.points) ? r.points : null,
          tags: [],
          status: 'todo',
          confidence: Math.max(0.2, Math.min(1, Number(r.confidence) || 0.8)),
          cues: ['ia'],
          source: { line: 0, section: '', excerpt: String(r.description || '').slice(0, 220) },
        };
      });
  } finally {
    clearTimeout(timeout);
  }
}

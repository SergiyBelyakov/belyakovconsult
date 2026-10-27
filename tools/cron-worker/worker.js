// Cloudflare Worker: кожні 15 хвилин запускає «Конвеєр контенту» в GitHub.
// Навіщо: GitHub виконує розклад (schedule) із затримками до кількох годин, а Cloudflare Cron Triggers точні.
// Налаштування: секрет GITHUB_TOKEN (fine-grained token лише на репозиторій belyakovconsult, дозвіл Actions: Read and write)
// і Cron Trigger «*/15 * * * *» (Settings → Triggers → Cron Triggers).
const REPO = "SergiyBelyakov/belyakovconsult";
const WORKFLOW = "pipeline.yml";

async function dispatch(env) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "belyakov-cron-worker",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  return r.status === 204 ? "ok" : `GitHub ${r.status}: ${await r.text()}`;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env).then((s) => console.log(s)));
  },
  // Ручна перевірка: відкрийте адресу воркера в браузері, має з'явитися «ok»
  async fetch(request, env) {
    return new Response(await dispatch(env));
  },
};

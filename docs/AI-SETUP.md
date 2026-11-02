# Connect Claude, GPT or OpenRouter to the HabitGrid Assistant

The Assistant is the **Ask** button in the bottom-right corner of the HabitGrid window (version 1.2.2 or newer). It has three modes:

| Mode | Needs | What it understands |
| --- | --- | --- |
| **Built-in** (default) | Nothing. Works offline. | Short commands: "check read", "add habit Walk to work", "new grid Morning", "how am I doing?" (type `help` for the list) |
| **Claude** (Anthropic) | Your Anthropic API key | Plain conversation: "I went for a run and drank water, tick those off" |
| **GPT** (OpenAI) | Your OpenAI API key, or an OpenRouter key | Plain conversation, same as Claude |

In every mode the Assistant uses the same actions:

- add, edit, move, reorder and delete habits
- create, rename and delete grids, and switch which grid is shown
- check or uncheck any day
- look up a day, a week or a month, and streaks
- change settings and open pages

The AI only decides which action to run. HabitGrid runs it on your data, on your computer. You can save a Claude key and a GPT key and switch between them at any time.

---

## Step 1: Get an API key

### Claude (Anthropic)
1. Go to **https://console.anthropic.com** and sign up or log in.
2. **Settings → Billing:** add a payment method and some credit ($5 is plenty to start). This is separate from a Claude.ai subscription.
3. **Settings → Limits:** set a monthly spending limit, for example $5.
4. **Settings → API keys → Create key**, and name it `HabitGrid`.
5. **Copy the key now.** It starts with `sk-ant-` and is shown only once.

| Model | Best for | Price per 1M tokens (input / output) |
| --- | --- | --- |
| `claude-opus-5-5` (default) | Best understanding | $4 / $20 |
| `claude-sonnet-5-5` | Faster and cheaper | $2 / $10 |
| `claude-haiku-5-5` | Cheapest and fastest | $0.10 / $0.50 |

A typical message costs about **2–5 cents on Opus 5.5**, and less than a cent on Haiku 5.5.

### GPT (OpenAI)
1. Go to **https://platform.openai.com** and sign up or log in.
2. **Settings → Billing:** add a payment method and credit. This is separate from ChatGPT Plus.
3. **Settings → Limits:** set a monthly budget.
4. Go to **https://platform.openai.com/api-keys**, click **Create new secret key** and name it `HabitGrid`.
5. **Copy the key now.** It starts with `sk-` and is shown only once.

The default model is `gpt-5`. If your account lists a newer one at https://platform.openai.com/docs/models, type its exact name instead. Any model that supports *function calling* (tools) works.

### OpenRouter (one key for Claude, GPT and more)
1. Go to **https://openrouter.ai**, sign up, and add credit under **Credits**.
2. Go to **Keys → Create Key**, set a credit limit, and copy the key. It starts with `sk-or-`.
3. Pick a model at **https://openrouter.ai/models**. Filter for models that support **tools**, then copy the exact name, for example `openai/gpt-5` or one of Anthropic's Claude models.

OpenRouter adds a small fee when you buy credit, and your messages pass through OpenRouter as well as the model's provider.

---

## Step 2: Put the key into HabitGrid

1. Open HabitGrid and sign in.
2. Click **Ask** in the bottom-right corner.
3. Click the **⚙** icon at the top of the chat panel. You can also go to **Personalize → Assistant → Assistant settings**.
4. Under **Assistant brain**, choose:
   - **Claude** for an Anthropic key
   - **GPT** for an OpenAI key **or an OpenRouter key**
5. Paste the key into **API key**. Click 👁 to check you pasted all of it.
6. **Model:**
   - **Claude or OpenAI:** leave it empty for the default (`claude-opus-5-5` / `gpt-5`), or pick or type another model.
   - **OpenRouter:** type the model name you copied, for example `openai/gpt-5`.
7. **OpenRouter only:** open **Advanced: custom endpoint** and paste
   `https://openrouter.ai/api/v1/chat/completions`
8. Click **Test connection** (Claude and OpenAI). You should see *"Connected … ✓"*. This test is free and uses no tokens. With a custom endpoint the test is skipped, so send a message to try it.
9. Click **Save**. The panel header now shows the provider and model, for example *Claude · claude-opus-5-5*.

To add a second key, open ⚙ again, pick the other brain, paste its key and click **Save**. Both keys stay saved. The brain that's selected when you click Save is the one the chat uses.

### Try it
- "I went to the gym and read 20 pages today"
- "Make a Work grid with habits for inbox zero and a daily standup"
- "Move meditate to my Morning grid"
- "Oops, I didn't stretch yesterday. Untick it."
- "How was my week?" / "Which habit am I worst at this month?"
- "Show me the year for my Health grid"
- "Switch to a light theme and use circle checkboxes"
- "Delete the Study habit". HabitGrid asks you to confirm before deleting anything.

Click 🧹 in the chat header to start a fresh conversation. The ■ button stops a reply that's still running.

---

## Keep your key safe

- **Never put an API key in the code or commit it to GitHub.** The repository is public.
- The key is saved in HabitGrid's data file on your computer, under your profile:
  - Windows: `%APPDATA%\HabitGrid\data.json`
  - macOS: `~/Library/Application Support/HabitGrid/data.json`
- It's sent only to the provider you chose, straight from HabitGrid.
- It's **not** included in **Export backup**. Deleting your HabitGrid profile deletes its keys too.
- Anyone who can open your files could read the key. Use a separate key just for HabitGrid, and give it a spending limit.
- If a key leaks, delete it in the provider's console and create a new one.

### Optional: let others use the Assistant without your key (proxy)

The proxy is a small server you run that holds your key and forwards HabitGrid's requests. Here's how to set one up as a free Cloudflare Worker:

1. Go to https://dash.cloudflare.com → **Workers & Pages → Create → Create Worker**, name it `habitgrid-ai`, and click **Deploy**.
2. Click **Edit code**, paste the code below, and click **Deploy**.
3. In **Settings → Variables and Secrets**, add two **Secrets**: `ANTHROPIC_API_KEY` (your key) and `APP_PASSWORD` (a password you choose).
4. In HabitGrid, open **⚙ → Claude → Advanced: custom endpoint**. Enter `https://habitgrid-ai.<your-name>.workers.dev/?p=<APP_PASSWORD>`, leave the key **empty**, and click **Save**.

```js
// Cloudflare Worker: forwards HabitGrid's Claude requests and adds the API key on the server.
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (new URL(req.url).searchParams.get('p') !== env.APP_PASSWORD) return Response.json({ error: { message: 'Wrong app password' } }, { status: 401 });
    const body = await req.json();
    if (!MODELS.includes(body.model)) return Response.json({ error: { message: 'Model not allowed' } }, { status: 400 });
    body.max_tokens = Math.min(body.max_tokens || 4096, 16000);
    const headers = { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': req.headers.get('anthropic-version') || '2026-10-21' };
    const beta = req.headers.get('anthropic-beta');
    if (beta) headers['anthropic-beta'] = beta;
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
    return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } });
  },
};
```

For GPT, change the URL to `https://api.openai.com/v1/chat/completions`, send `authorization: 'Bearer ' + env.OPENAI_API_KEY` instead of `x-api-key`, and enter the Worker URL under **⚙ → GPT** instead.

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| No **Ask** button | Make sure you're on HabitGrid **1.2.2 or newer** (the version is at the bottom of Personalize). Install the latest release. The button appears after you sign in. |
| *"… rejected the API key"* (401) | The key is wrong, incomplete or deleted. Paste it again, or create a new key. |
| *"Model … not found"* (404), or the key isn't allowed (403) | Check the model name, or leave it empty for the default. On OpenRouter, the name includes the provider, for example `openai/gpt-5`. |
| *"Rate limit hit, or the account has no credit left"* (429) | Add credit, or wait a minute. |
| *"Couldn't reach Claude/GPT"* | Check your internet connection, firewall or VPN. Built-in mode still works offline. |
| *"… declined that request"* | The model's safety system refused it. Rephrase the request. With Claude Opus 5.5, HabitGrid also turns on Anthropic's automatic backup model, so this should be rare. |
| It changed the wrong thing | Ask it to undo ("uncheck read for today"), or fix it in the grid. Every change shows up as a small grey line in the chat. |

---

## For developers

- **`web/js/chat.js`:** the whole Assistant.
  - `TOOLS()` holds the JSON-schema actions, sent to Claude as `input_schema` and to OpenAI as `parameters`.
  - `HANDLERS` holds one function per action, using the same helpers as the UI (`setDone`, `save`, `confirmBox`, `cleanGrids`).
  - `local()` is the Built-in command parser.
  - `ADAPTERS` holds the Anthropic Messages API (`anthropic-version: 2026-10-21`, `output_config.effort: "low"`, `fallbacks: "default"`) and OpenAI Chat Completions.
  - `askAI()` is the tool loop.
- **`main.py` → `Api.ai_request(method, url, headers, body)`:** sends the HTTP request from Python (with certifi's certificates) and returns `{status, text}`. A page loaded from a file can't rely on the web view's cross-origin rules, so requests go through here. It only allows `https://` addresses (and `http://localhost` for testing).
- **Opened in a normal browser for development** (`python -m http.server -d web`): the Assistant falls back to `fetch`.
- **To add an action:** add a `TOOLS()` entry and a `HANDLERS` function with the same name. The function returns `{ result, note }`, where `result` goes to the model and `note` is the grey line in the chat. Optionally, add a pattern to `local()` too.

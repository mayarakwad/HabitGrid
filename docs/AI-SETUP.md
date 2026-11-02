# Connect Claude or GPT to the HabitGrid Assistant

The Assistant is the **Ask** button in the bottom-right corner of the app. It works in three modes:

| Mode | Needs | What it understands |
| --- | --- | --- |
| **Built-in** (default) | Nothing. Works offline. | Short commands: "check read", "add habit Walk", "how am I doing?" (type `help` for the list) |
| **Claude** (Anthropic) | Your Anthropic API key | Plain conversation: "I went for a run and drank water, tick those off" |
| **GPT** (OpenAI) | Your OpenAI API key | Plain conversation, same as Claude |

In every mode the Assistant uses the same 11 actions: list, add, edit, delete and reorder habits, check or uncheck days, read day and month stats, add starter habits, change settings and open pages. The AI only decides which action to run. The app runs it on your own data.

You can save both a Claude key and a GPT key and switch between them at any time.

---

## Part 1: Get a Claude API key (Anthropic)

1. Go to **https://console.anthropic.com** and sign up or log in.
2. Add credit: open **Settings → Billing**, then add a payment method and buy some credit. A few dollars is plenty to start. The API is billed separately from a Claude.ai subscription.
3. Set a spending limit (recommended): in **Settings → Limits**, set a monthly limit, for example $5.
4. Create the key: open **Settings → API keys**, click **Create key**, name it `HabitGrid`, then click **Create**.
5. **Copy the key now.** It starts with `sk-ant-` and is shown only once. If you lose it, delete it and create a new one.

**Model to use:** `claude-opus-5-5` (Claude Opus 5.5). This is the default, so you can leave the model box empty.
Other options in the model list:

| Model | Best for | Price per 1M tokens (input / output) |
| --- | --- | --- |
| `claude-opus-5-5` | Best understanding (default) | $4 / $20 |
| `claude-sonnet-5-5` | Faster and cheaper | $2 / $10 |
| `claude-haiku-5-5` | Cheapest and fastest | $0.10 / $0.50 |

A typical message to the Assistant costs about **2 to 5 cents on Opus 5.5**, and less than a cent on Haiku 5.5.

## Part 2: Get a GPT API key (OpenAI)

1. Go to **https://platform.openai.com** and sign up or log in.
2. Add credit: open **Settings → Billing** and add a payment method and credit. The API is billed separately from a ChatGPT Plus subscription.
3. Set a limit (recommended): in **Settings → Limits**, set a monthly budget.
4. Create the key: open **API keys** (https://platform.openai.com/api-keys), click **Create new secret key**, name it `HabitGrid` and click **Create secret key**.
5. **Copy the key now.** It starts with `sk-` and is shown only once.

**Model to use:** the app defaults to `gpt-5`. If your account lists a newer model at https://platform.openai.com/docs/models, type its exact name in the Model box instead. Any OpenAI model that supports *function calling* (tools) will work.

## Part 3: Put the key into the chatbot

1. Open HabitGrid (https://mayarakwad.github.io/HabitGrid/ or your local copy) and sign in.
2. Click **Ask** in the bottom-right corner. On a phone it's the round chat button above the menu bar.
3. Click the **⚙ settings** icon at the top of the chat panel. You can also go to **Personalize → Assistant → Assistant settings**.
4. Under **Assistant brain**, choose **Claude** or **GPT**.
5. Paste your key into the **API key** box. Click the 👁 eye icon to check you pasted all of it.
6. **Model:** leave it empty to use the default (`claude-opus-5-5` or `gpt-5`), or pick or type another model.
7. Click **Test connection**. You should see *"Connected ✓ … the key works and … is available."* This test is free and uses no tokens.
8. Click **Save**. The panel header now shows the provider and model, for example *Claude · claude-opus-5-5*.
9. To add the other provider too, open ⚙ again, pick it, paste its key and click **Save**. Both keys stay saved. Whichever provider is selected when you click Save is the one the chat uses.

### Try it

- "I went to the gym and read 20 pages today"
- "Add a habit for drinking 8 glasses of water, make it blue"
- "Oops, I didn't actually meditate yesterday. Untick it."
- "Which habit am I worst at this month?"
- "What's my longest streak ever?"
- "Switch to a light theme and use circle checkboxes"
- "Delete the study habit." The app asks you to confirm before anything is deleted.

Click 🧹 in the chat header to start a fresh conversation. The ■ button stops a reply that's still running.

---

## Part 4: Keep your key safe (please read)

- **Never put an API key in the code or commit it to GitHub.** This repository and the GitHub Pages site are public. Bots scan GitHub for leaked keys within minutes.
- When you paste a key into the Assistant settings, it's saved **only in your browser** (in `localStorage`, under your HabitGrid profile). It's sent **directly** from your browser to Anthropic or OpenAI, and never to any other server.
- Anyone who can use your browser profile, or a malicious browser extension, could read the key. Use a separate key just for HabitGrid and give it a spending limit.
- Deleting your HabitGrid account also deletes its saved keys. **Export backup** never includes keys.
- If a key leaks, delete it straight away in the Anthropic or OpenAI console and create a new one.

### Optional: share the chatbot without sharing your key (proxy server)

The setup above means each person types in their own key. If you want friends to use the Assistant through **your** account without seeing the key, put a small server in between that adds the key. Here's one way to do it with a free Cloudflare Worker:

1. Sign in at https://dash.cloudflare.com, then go to **Workers & Pages → Create → Create Worker**. Name it `habitgrid-ai` and click **Deploy**.
2. Click **Edit code**, replace everything with the code below, then click **Deploy**.
3. Go to the Worker's **Settings → Variables and Secrets** and add a **Secret** named `ANTHROPIC_API_KEY` with your key as the value. Also add a secret named `APP_PASSWORD` with any password you choose.
4. Copy the Worker URL, for example `https://habitgrid-ai.yourname.workers.dev`.
5. In HabitGrid, open **⚙ → Claude → Advanced: custom endpoint**. Paste the Worker URL followed by `?p=` and your APP_PASSWORD, for example `https://habitgrid-ai.yourname.workers.dev/?p=mypassword`. Leave the API key box **empty**, then click **Save**.

```js
// Cloudflare Worker: forwards HabitGrid's Claude requests and adds the API key on the server.
const ALLOWED_ORIGIN = 'https://mayarakwad.github.io';
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, anthropic-version, anthropic-beta, anthropic-dangerous-direct-browser-access',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    if (new URL(req.url).searchParams.get('p') !== env.APP_PASSWORD) return new Response('{"error":{"message":"Wrong app password"}}', { status: 401, headers: cors });

    const body = await req.json();
    if (!MODELS.includes(body.model)) return new Response('{"error":{"message":"Model not allowed"}}', { status: 400, headers: cors });
    body.max_tokens = Math.min(body.max_tokens || 4096, 16000);

    const headers = { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': req.headers.get('anthropic-version') || '2026-10-21' };
    const beta = req.headers.get('anthropic-beta');
    if (beta) headers['anthropic-beta'] = beta;
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
    return new Response(res.body, { status: res.status, headers: { ...cors, 'content-type': 'application/json' } });
  },
};
```

**For GPT:** use the same Worker, but fetch `https://api.openai.com/v1/chat/completions` with the header `authorization: 'Bearer ' + env.OPENAI_API_KEY`, and set `MODELS` to your GPT models. In HabitGrid, put this Worker's URL under **⚙ → GPT → Advanced: custom endpoint**.

> The app password stops strangers, but anyone you give it to can use your credit. Keep the spending limit on your API key.

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| *"… rejected the API key"* (401) | The key is wrong, incomplete or deleted. Paste it again (use 👁 to check), or create a new key. |
| *"This API key isn't allowed to use that model"* (403) or *"Model … not found"* (404) | Check the spelling of the model name, or leave the box empty to use the default. For GPT, check which models your account has. |
| *"Rate limit hit, or the account has no credit left"* (429) | Add credit in the provider's Billing page, or wait a minute. |
| *"Couldn't reach Claude/GPT"* | You're offline, or an ad blocker or firewall is blocking `api.anthropic.com` or `api.openai.com`. Built-in mode still works offline. |
| *"… declined that request"* | The model's safety system refused it. Rephrase the request. For Claude Opus 5.5 the app turns on Anthropic's automatic fallback, so this should be rare. |
| The Assistant is missing after an update | Hard-refresh the page (Ctrl+Shift+R, or Cmd+Shift+R on a Mac). The offline cache updates on the next load. |
| It changed the wrong habit | Ask it to undo ("uncheck read for today"), or click the checkbox in the grid. Every change shows up as a small grey line in the chat. |

---

## For developers: how it fits together

Everything is in **`js/chat.js`** (no libraries, no build step):

- `TOOLS()` holds the JSON-schema list of actions. It's sent to Claude as `tools[].input_schema` and to OpenAI as `tools[].function.parameters`.
- `HANDLERS` holds one function per tool. Each one changes `App.data` through the same functions the UI uses (`setDone`, `save`, `updateSetting`, `confirmBox`).
- `local()` is the built-in command parser. It calls the same handlers.
- `ADAPTERS.anthropic` calls `POST https://api.anthropic.com/v1/messages` with the `x-api-key`, `anthropic-version: 2026-10-21` and `anthropic-dangerous-direct-browser-access: true` headers. It uses `output_config.effort: "low"` for quick chat replies and `fallbacks: "default"` (beta header `server-side-fallback-2026-07-01`). It sends the assistant's `content` blocks back unchanged.
- `ADAPTERS.openai` calls `POST https://api.openai.com/v1/chat/completions` with `tools` and `max_completion_tokens`.
- `askAI()` is the tool loop. It sends the message, runs every tool call the model makes, sends the results back, and repeats (up to 10 rounds) until the model replies with text only.

**To add a new action:**

1. Add an entry to `TOOLS()` with `name`, `description` and `props` (JSON-schema properties), plus `required` if needed.
2. Add a function with the same name to `HANDLERS`. It returns `{ result, note }`, where `result` goes back to the model and `note` is the grey line shown in the chat.
3. Optionally, add a pattern to `local()` so Built-in mode understands it too.

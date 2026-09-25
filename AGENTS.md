# OpenChat
* **Frontend:** Next.js 16, React 19, TypeScript 7, Tailwind CSS 4, shadcn/ui — `:3000`
* **Backend:** FastAPI, Python 3.13, uv, Ruff — `:8000`
* **Local AI:** Ollama (`localhost:11434`), `gemma3:1b`
* **Cloud AI Fallback:** OpenAI, Anthropic, Grok, Gemini

## Commands

* Frontend: `npm run dev`
* Add frontend package: `npm install <package-name>`
* Backend: `uv run fastapi dev`
* Add backend package: `uv add <package-name>`
* Tests: `cd backend && pytest`

## Rules

* Never commit `.env` files or API keys.
* Run tests after every change.
* Follow existing project patterns and keep changes minimal.

-
# AI Browser Agent

A self-learning browser automation desktop application built with Electron, React, and Playwright. It uses OpenAI to plan and execute browser tasks, automatically learns reusable patterns from successful runs, and recovers from broken selectors without manual intervention.

---

## Features

- **AI Task Planning** — Describe what you want in plain English; OpenAI generates a step-by-step browser action plan
- **Self-Learning Patterns** — Successful automations are saved as reusable patterns per domain
- **Selector Recovery** — When a selector breaks, the engine automatically attempts fuzzy, text, fingerprint, and AI-based recovery strategies
- **Scheduler** — Run saved patterns on a cron schedule
- **Credential Manager** — Passwords are stored securely in the OS keychain, never in plain text
- **Live Logs & Screenshots** — Real-time log viewer and browser screenshots during task execution
- **CAPTCHA Detection** — Pauses and notifies the user when a CAPTCHA is detected
- **Dark / Light Mode** — Full theme support

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React 18, React Router, TypeScript |
| Build tool | Vite (via electron-vite) |
| Browser automation | Playwright |
| AI planning | OpenAI API |
| Local database | sql.js (SQLite in-memory, persisted to disk) |
| Credential storage | OS keychain (keytar) |
| Styling | CSS custom properties (no UI framework) |

---

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── index.ts           # App entry, window creation
│   ├── ipcHandlers.ts     # All IPC bridge handlers
│   ├── agent/
│   │   ├── AgentController.ts   # Orchestrates task lifecycle
│   │   ├── ExecutionEngine.ts   # Runs actions via Playwright
│   │   ├── AIPlanner.ts         # OpenAI action planning
│   │   ├── SelectorRecovery.ts  # Auto-heal broken selectors
│   │   ├── DOMCompressor.ts     # Compresses DOM for AI context
│   │   └── AgentContext.ts      # Per-task runtime context
│   └── db/
│       ├── DatabaseService.ts   # SQLite database layer
│       ├── PatternRepository.ts # Pattern CRUD & versioning
│       └── CredentialService.ts # Keychain credential manager
├── preload/
│   └── index.ts           # Context bridge (renderer ↔ main)
├── renderer/
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── AppLayout.tsx    # Custom titlebar + sidebar
│       │   └── Sidebar.tsx
│       ├── pages/
│       │   ├── DashboardPage.tsx
│       │   ├── TasksPage.tsx
│       │   ├── TaskDetailView.tsx
│       │   ├── PatternsPage.tsx
│       │   ├── SchedulerPage.tsx
│       │   ├── LogsPage.tsx
│       │   └── SettingsPage.tsx
│       └── context/
│           ├── AuthContext.tsx
│           ├── ThemeContext.tsx
│           └── CheckExpire.tsx
└── shared/
    └── types/
        └── AgentTypes.ts  # Shared types across main & renderer
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- An OpenAI API key

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

The packaged app will be output to the `out/` directory.

---

## Configuration

1. Launch the app and log in
2. Go to **Settings → OpenAI API Key** and paste your key — it is stored in your OS keychain
3. Optionally add site credentials under **Settings → Credential Manager**

---

## Usage

1. **Create a Task** — Go to Tasks → New Task, enter a URL and describe what to do in plain English
2. **Run the Task** — The AI plans the actions, Playwright executes them, and progress is shown live
3. **Reuse Patterns** — Successful tasks save a pattern; future tasks on the same domain reuse it automatically
4. **Schedule** — Go to Scheduler to run any saved pattern on a cron schedule

---

## Agent State Machine

```
IDLE → PLANNING → EXPLORING → EXECUTING → COMPLETED
                                        ↘ STUCK → WAITING_USER
                                        ↘ FAILED
```

---

## Security

- Passwords are **never stored in the database** — only in the OS keychain via keytar
- Credentials are **never sent to OpenAI** — only DOM content and user prompts are shared
- Context isolation is enabled; `nodeIntegration` is disabled in the renderer

---

## Author

Developed by **Samrat**

- [LinkedIn](https://www.linkedin.com/in/samratx/)
- [Facebook](https://www.facebook.com/samratux/)

---

## License

Private — all rights reserved.
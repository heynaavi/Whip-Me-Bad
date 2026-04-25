<p align="center">
  <img src="logo.png" width="120" />
</p>

<h1 align="center">Whip Me Bad</h1>

<p align="center">
  <em>Slap your AI into shipping faster</em>
</p>

<p align="center">
  <a href="https://github.com/Naveen701372/Whip-Me-Bad/releases/latest">
    <img src="https://img.shields.io/badge/download-latest-orange?style=for-the-badge" alt="Download" />
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <a href="#download">Download</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#how-it-works">How it works</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#kiro-integration">Kiro</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="#build-from-source">Build</a>
</p>

---

A dreamy neon whip cracks across your screen — with a satisfying slap — every time you press Enter or your AI coding assistant does something. It's dumb. It's beautiful. It ships.

## Download

| Platform | Link |
|----------|------|
| macOS (.dmg) | [Download](https://github.com/Naveen701372/Whip-Me-Bad/releases/latest) |
| Windows (.exe) | [Download](https://github.com/Naveen701372/Whip-Me-Bad/releases/latest) |

Or build from source — see [below](#build-from-source).

## How it works

**Press Enter. Get whipped.**

The app runs in your menu bar and listens for Enter key presses globally. Every press triggers a whip animation overlay with sound. That's it.

### Streak mode

Mash Enter and the phrases escalate:

| Hits | Vibe | Sample |
|------|------|--------|
| 1–2 | Casual | *spank that code* |
| 3–5 | Warming up | *HARDER, FASTER* |
| 6–9 | Getting hot | *right there, keep going* |
| 10–14 | Almost there | *so close, yes yes yes* |
| 15+ | 🚀 | *SHIPPED, i need a cigarette* |

### Insights

Track your whips from the menu bar. Earn a persona based on your total count:

| Whips | Title |
|-------|-------|
| 0 | 🥚 Fresh Egg |
| 10 | 👋 Casual Slapper |
| 50 | 🍑 Cheeky One |
| 100 | ⚡ Speed Demon |
| 250 | 🔥 Clanker |
| 500 | 💀 Unhinged |
| 1000 | 👑 Whip Royalty |

## Kiro Integration

If you use [Kiro](https://kiro.dev), the app auto-installs hooks in your projects. No config needed.

Hooks trigger on:
- **Prompt submit** — you send a message
- **Tool use** — Kiro writes a file or runs a command
- **Task complete** — a spec task finishes
- **Agent stop** — the agent finishes its run

The app scans your dev folder and installs hooks in any project with a `.kiro` directory. You can also install manually from the menu bar.

## Menu Bar

The app lives in your menu bar with:
- ⏸ Pause / Resume
- 🔊 Volume control
- 📊 Insights (your stats + persona)
- 📁 Install hooks in a project
- 📂 Set watch folder
- 🚀 Launch at login

## Build from Source

```bash
git clone https://github.com/Naveen701372/Whip-Me-Bad.git
cd Whip-Me-Bad
npm install
npm start
```

### Package

```bash
npm run build        # macOS (.dmg)
npm run build:win    # Windows (.exe)
npm run build:all    # both
```

Requires `electron-builder`. Output goes to `dist/`.

## Tech

Electron · Canvas 2D · Web Audio API · Supabase · macOS CGEventTap

## Privacy

Anonymous usage tracking only — device UUID, whip count, trigger type, platform. No personal data. No accounts. See `analytics.js` for the full implementation.

## License

MIT

---

<p align="center">
  <sub>Built with love and questionable judgment 🍑</sub>
</p>

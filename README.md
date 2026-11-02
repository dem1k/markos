# markOS

A Windows 3.11-style desktop playground in the browser (also installable as a PWA).

Built for Mark: black-and-white system icons, boot sequence, overlapping windows, and a couple of games.

## Features

- Boot screen with glitch loading log, 80s beeps, and a short melody
- Fake user select (Mark / Guest / Admin)
- Desktop with drag-and-drop icons, folders, files, and context menu
- Overlapping windows (move, minimize, maximize, close, focus)
- Start menu, taskbar clock, and Restore system icons
- Games: **worm** and **tetris**
- PWA install (standalone window)

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173`), click **Start**, pick a user.

## Build / preview

```bash
npm run build
npm run preview
```

Install from the browser (Chrome/Edge): address bar install icon, or menu → Install markOS.

## Stack

Vite + TypeScript, no UI framework. Desktop state is stored in `localStorage` (no backend yet).

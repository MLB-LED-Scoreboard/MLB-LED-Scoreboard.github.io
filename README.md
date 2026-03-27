# MLB LED Scoreboard Config Editor

A web-based GUI for generating configuration files for the [mlb-led-scoreboard](https://github.com/MLB-LED-Scoreboard/mlb-led-scoreboard) project.

## Features

- Edit `config.json`, `colors/teams.json`, `colors/scoreboard.json`, and `coordinates/wXhY.json` through a form UI
- Select any tagged release version (v9+) or the `dev` branch
- Download or copy the generated JSON output

## Usage

Open the site and select a schema version. Fill out the form fields, then use the **Download** or **Copy** button to get your JSON file. Place the downloaded files in your mlb-led-scoreboard installation directory.

## Development

**Install dependencies:**
```bash
npm install
```

**Run locally:**
```bash
npm run dev
```
Opens at `http://localhost:5173` with hot reload.

**Build for production:**
```bash
npm run build
```
Output goes to `dist/`. Deployed automatically to GitHub Pages on push to `main` via GitHub Actions.

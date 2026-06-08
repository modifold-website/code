![Modifold Banner](https://modifold.com/images/banner.png?v=3)

![Issues](https://img.shields.io/github/issues-raw/modifold-website/code?color=c78aff&label=issues&style=for-the-badge)
![Pull Requests](https://img.shields.io/github/issues-pr-raw/modifold-website/code?color=c78aff&label=PRs&style=for-the-badge)
![Contributors](https://img.shields.io/github/contributors/modifold-website/code?color=c78aff&label=contributors&style=for-the-badge)
![Lines](https://img.shields.io/endpoint?url=https://ghloc.vercel.app/api/modifold-website/code/badge?style=flat&logoColor=white&color=c78aff&style=for-the-badge)
![Commit Activity](https://img.shields.io/github/commit-activity/m/modifold-website/code?color=c78aff&label=commits&style=for-the-badge)
![Last Commit](https://img.shields.io/github/last-commit/modifold-website/code?color=c78aff&label=last%20commit&style=for-the-badge)

# Modifold Web Platform

Modifold is a modding platform for publishing and discovering Hytale mods.

## Quick Start with Docker

Create the local runtime env:

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker`, then start everything:

```bash
docker compose --env-file .env.docker up -d --build
```

Default local URLs:

- Frontend: `http://localhost:3000`
- API: `http://127.0.0.1:4000`

Check services:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f pegasus cronus
curl http://127.0.0.1:4000/health
```

## Local Development without Docker

Frontend:

```bash
cd pegasus
bun install
bun run dev
```

Backend:

```bash
cd cronus
bun install
bun index.js
```

## Contributing

Small improvements are welcome: bug fixes, UI polish, performance work, accessibility, translations, API cleanup, documentation, and deployment hardening.

## License

The project is released under the GNU Affero General Public License v3.0 (AGPL-3.0).

You can freely use, modify, and share the code, but:

- All derivative works must also be licensed under AGPL-3.0.
- If you run a public service based on this code, you must make the source code available to users.

Full details are in the [LICENSE](LICENSE) file.

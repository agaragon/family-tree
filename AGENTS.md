# AI Agent Context — Family Tree

This document helps AI coding assistants (Cursor, Claude Code, etc.) work effectively with this repository.

## Project Overview

Family Tree is a React (Vite) single-page application that renders an editable genealogical graph using React Flow. The architecture follows SOLID principles with a well-defined domain layer.

## Structure

- **`family-tree-web/`** — Main web app (React, Vite, React Flow)
- **`docs/`** — Architecture and import documentation
- **`terraform/`** — AWS infrastructure (S3, CloudFront, Route53)
- **`scripts/`** — Deployment scripts

## Key Files

| Purpose | Path |
|---------|------|
| Architecture | `docs/Architecture.md` |
| Domain layer | `family-tree-web/src/domain/` |
| Services | `family-tree-web/src/services/` |
| Main app | `family-tree-web/src/App.jsx` |

## Conventions

- Domain concepts and constants live in `src/domain/` — extend there for new types.
- Services (`persistenceService`, `layoutService`, `exportService`) are stateless and depend on domain.
- See `docs/Architecture.md` for the full file map, data flow, and SOLID mapping.

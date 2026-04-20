# Dokploy Deployment Guide

This project follows a two-layer deployment strategy on Dokploy to manage interconnected services. The AI/LLM layer is hosted externally.

## CI/CD Workflow
`Push to GitHub` $ightarrow$ `GitHub Actions builds/pushes to GHCR` $ightarrow$ `Webhook triggers Dokploy` $ightarrow$ `Dokploy pulls new image and redeploys`.

## Deployment Layers

### 1. Brain Service Layer (API & Database)
Manages the NestJS API and Neo4j database.
- **Config file:** `docker-compose.prod.yml`

### 2. Web Layer (Frontend)
Manages the Vite/React frontend.
- **Config file:** `docker-compose.web.yml`
- **Important:** The `VITE_API_BASE_URL` must be passed as a build argument during the frontend deployment to ensure the SPA points to the correct production API.

## External AI Service (Ollama)
The AI/LLM services are hosted externally and are not part of this Dokploy stack.
- **Endpoint:** https://ollama.orinocostudios.dev/v1
- **Configuration:** Ensure the `OLLAMA_BASE_URL` environment variable is set in the Brain Service layer.

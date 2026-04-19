# Dokploy Deployment Guide

This project follows a three-layer deployment strategy on Dokploy to manage interconnected services.

## CI/CD Workflow
`Push to GitHub` $ightarrow$ `GitHub Actions builds/pushes to GHCR` $ightarrow$ `Webhook triggers Dokploy` $ightarrow$ `Dokploy pulls new image and redeploys`.

## Deployment Layers

### 1. Ollama Layer (LLM Infrastructure)
Manages LLM and embedding models.
- **Config file:** `docker-compose.ollama.yml`

### 2. Brain Service Layer (API & Database)
Manages the NestJS API and Neo4j database.
- **Config file:** `docker-compose.prod.yml`

### 3. Web Layer (Frontend)
Manages the Vite/React frontend.
- **Config file:** `docker-compose.web.yml`
- **Important:** The `VITE_API_BASE_URL` must be passed as a build argument during the frontend deployment to ensure the SPA points to the correct production API.

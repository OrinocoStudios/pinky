export type DocumentationSectionId = 'deployment' | 'installation' | 'pinky-mcp';

type DocumentationStep = {
  title: string;
  description: string;
};

type DocumentationReference = {
  label: string;
  path: string;
};

export type DocumentationSection = {
  id: DocumentationSectionId;
  label: string;
  title: string;
  intro: string;
  steps: DocumentationStep[];
  references: DocumentationReference[];
};

export const documentationSections: DocumentationSection[] = [
  {
    id: 'deployment',
    label: 'Despliegue',
    title: 'Despliegue en entorno productivo',
    intro:
      'Configura servicios y pipelines para que backend y frontend se publiquen de forma estable, con variables y webhooks correctos.',
    steps: [
      {
        title: 'Preparar servicios en Dokploy',
        description:
          'Crea Neo4j, backend y frontend en la misma red Docker. Usa compose separado para API y web para facilitar redeploys.',
      },
      {
        title: 'Configurar variables de entorno criticas',
        description:
          'Define AUTH/API keys, callbacks, CORS y VITE_API_BASE_URL para que el frontend apunte a la API publica correcta desde build.',
      },
      {
        title: 'Automatizar release y validar despliegue',
        description:
          'Conecta GitHub Actions con GHCR y webhooks de Dokploy. Tras cada release valida health, login y rutas principales.',
      },
    ],
    references: [
      {
        label: 'Guia de despliegue Dokploy',
        path: '/Volumes/diskExtended/Development/OrinocoStudios/pinky-project/pinky/docs/DOKPLOY.md',
      },
      {
        label: 'Registro GHCR y secrets',
        path: '/Volumes/diskExtended/Development/OrinocoStudios/pinky-project/pinky/docs/GITHUB_REGISTRY.md',
      },
      {
        label: 'Checklist de release',
        path: '/Volumes/diskExtended/Development/OrinocoStudios/pinky-project/pinky/docs/PRODUCTION_RELEASE.md',
      },
    ],
  },
  {
    id: 'installation',
    label: 'Instalacion',
    title: 'Instalacion para desarrollo local',
    intro:
      'Levanta el proyecto en local con las dependencias correctas y una configuracion minima para probar flujo completo.',
    steps: [
      {
        title: 'Instalar dependencias por modulo',
        description:
          'Ejecuta npm install en pinky y pinky-mcp. Usa los scripts del repositorio para backend, frontend y servidor MCP.',
      },
      {
        title: 'Configurar entorno base',
        description:
          'Parte de .env.example, define API_KEY, AUTH, Neo4j y modelos. Mantiene secretos fuertes fuera de repositorio.',
      },
      {
        title: 'Validar build y tests',
        description:
          'Antes de usar o desplegar, ejecuta build y test para confirmar que backend y frontend compilan sin regresiones.',
      },
    ],
    references: [
      {
        label: 'Comandos y estructura del proyecto',
        path: '/Volumes/diskExtended/Development/OrinocoStudios/pinky-project/AGENTS.md',
      },
      {
        label: 'Variables de entorno de ejemplo',
        path: '/Volumes/diskExtended/Development/OrinocoStudios/pinky-project/pinky/.env.example',
      },
    ],
  },
  {
    id: 'pinky-mcp',
    label: 'Integracion pinky-mcp',
    title: 'Integracion con pinky-mcp',
    intro:
      'Configura el servidor MCP para trabajar en modo offline-first y sincronizar con Pinky de forma segura y resiliente.',
    steps: [
      {
        title: 'Preparar servidor MCP',
        description:
          'Compila pinky-mcp y configura SQLite local. Si defines PINKY_BASE_URL, habilitas sync remoto con cola local.',
      },
      {
        title: 'Conectar credenciales y scope',
        description:
          'Establece PINKY_API_KEY, tenant/library por defecto y politica de sync para alinear acceso con backend.',
      },
      {
        title: 'Verificar sincronizacion e integracion',
        description:
          'Ejecuta smoke tests de sync y prueba queries para confirmar que documentos y contexto llegan correctamente.',
      },
    ],
    references: [
      {
        label: 'README de pinky-mcp',
        path: '/Volumes/diskExtended/Development/OrinocoStudios/pinky-project/pinky-mcp/README.md',
      },
      {
        label: 'Guia de integracion HTTP Pinky',
        path: '/Volumes/diskExtended/Development/OrinocoStudios/pinky-project/pinky/docs/INTEGRATION_GUIDE.md',
      },
      {
        label: 'Referencia de API',
        path: '/Volumes/diskExtended/Development/OrinocoStudios/pinky-project/pinky/docs/API_REFERENCE.md',
      },
    ],
  },
];

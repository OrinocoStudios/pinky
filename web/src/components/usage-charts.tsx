import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { OverviewResponse } from '../lib/contracts';

type UsageChartsProps = {
  usage: OverviewResponse['usage'];
};

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatLibraryLabel(libraryId: string): string {
  return libraryId.length > 18 ? `${libraryId.slice(0, 16)}...` : libraryId;
}

export function UsageCharts({ usage }: UsageChartsProps) {
  const timelineData = usage.documents.ingestedByDay.map((entry, index) => ({
    id: `${entry.date}-${index}`,
    date: entry.date,
    label: formatDayLabel(entry.date),
    ingesta: entry.count,
    consultas: usage.queries.byDay[index]?.count ?? 0,
  }));

  const libraryData = usage.documents.byLibrary.map((entry) => {
    const queryUsage = usage.queries.byLibrary.find((queryEntry) => queryEntry.libraryId === entry.libraryId);
    return {
      libraryId: entry.libraryId,
      label: formatLibraryLabel(entry.libraryId),
      documentos: entry.count,
      consultas: queryUsage?.count ?? 0,
    };
  });

  const sourceData = usage.documents.bySource.map((entry) => ({
    source: entry.source,
    documentos: entry.count,
  }));

  return (
    <section className="panel usage-panel">
      <div className="usage-header">
        <div>
          <h3>Uso de Pinky</h3>
          <p className="muted-text">Ultimos 14 dias por ingesta y consultas</p>
        </div>
        <div className="usage-kpi">
          <span className="stat-label">Consultas totales</span>
          <strong>{usage.queries.total}</strong>
        </div>
      </div>

      <div className="usage-grid">
        <article className="usage-chart-card">
          <h4>Tendencia diaria</h4>
          {timelineData.length > 0 ? (
            <div className="usage-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid stroke="rgba(152, 173, 214, 0.12)" />
                  <XAxis dataKey="label" stroke="#95a7c5" tick={{ fill: '#95a7c5', fontSize: 12 }} />
                  <YAxis allowDecimals={false} stroke="#95a7c5" tick={{ fill: '#95a7c5', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#101c2d',
                      border: '1px solid rgba(152, 173, 214, 0.22)',
                      borderRadius: 10,
                    }}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload?.date ? payload[0].payload.date : '')}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="ingesta" stroke="#73a2ff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="consultas" stroke="#29d3a0" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="muted-text">Sin datos para la ventana seleccionada.</p>
          )}
        </article>

        <article className="usage-chart-card">
          <h4>Top libraries por documentos</h4>
          {libraryData.length > 0 ? (
            <div className="usage-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={libraryData}>
                  <CartesianGrid stroke="rgba(152, 173, 214, 0.12)" />
                  <XAxis dataKey="label" stroke="#95a7c5" tick={{ fill: '#95a7c5', fontSize: 12 }} />
                  <YAxis allowDecimals={false} stroke="#95a7c5" tick={{ fill: '#95a7c5', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#101c2d',
                      border: '1px solid rgba(152, 173, 214, 0.22)',
                      borderRadius: 10,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="documentos" fill="#73a2ff" />
                  <Bar dataKey="consultas" fill="#29d3a0" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="muted-text">Todavia no hay libraries con documentos.</p>
          )}
        </article>

        <article className="usage-chart-card usage-source-card">
          <h4>Distribucion por origen</h4>
          {sourceData.length > 0 ? (
            <div className="usage-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData}>
                  <CartesianGrid stroke="rgba(152, 173, 214, 0.12)" />
                  <XAxis dataKey="source" stroke="#95a7c5" tick={{ fill: '#95a7c5', fontSize: 12 }} />
                  <YAxis allowDecimals={false} stroke="#95a7c5" tick={{ fill: '#95a7c5', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#101c2d',
                      border: '1px solid rgba(152, 173, 214, 0.22)',
                      borderRadius: 10,
                    }}
                  />
                  <Bar dataKey="documentos" fill="#5f86ff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="muted-text">Sin datos de origen de documentos.</p>
          )}
        </article>
      </div>
    </section>
  );
}

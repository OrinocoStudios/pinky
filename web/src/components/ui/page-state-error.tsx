type PageStateErrorProps = {
  title?: string;
  description?: string;
};

export function PageStateError({
  title = 'No se pudo cargar datos.',
  description = 'Reintenta o verifica que el servicio remoto este disponible.',
}: PageStateErrorProps) {
  return (
    <div className="panel state-panel state-error">
      <strong>{title}</strong>
      <p className="muted-text">{description}</p>
    </div>
  );
}

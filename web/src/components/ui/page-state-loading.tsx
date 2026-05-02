type PageStateLoadingProps = {
  message?: string;
};

export function PageStateLoading({ message = 'Cargando...' }: PageStateLoadingProps) {
  return <div className="panel state-panel">{message}</div>;
}

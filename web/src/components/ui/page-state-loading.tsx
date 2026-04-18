type PageStateLoadingProps = {
  message?: string;
};

export function PageStateLoading({ message = 'Loading...' }: PageStateLoadingProps) {
  return <div className="panel state-panel">{message}</div>;
}

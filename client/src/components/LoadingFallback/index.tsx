import './loading-fallback.css';

interface Props {
  name?: string;
}

export function LoadingFallback({ name = 'component' }: Props) {
  return (
    <div className="loading-fallback">
      <div className="loading-spinner"></div>
      <p className="loading-text">Loading {name}...</p>
    </div>
  );
}

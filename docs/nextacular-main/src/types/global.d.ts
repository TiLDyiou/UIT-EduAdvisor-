export {};

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    gtag?: (
      _command: 'config' | 'event' | 'js' | 'set',
      _targetId: string | Date,
      _config?: Record<string, unknown>
    ) => void;
  }
}

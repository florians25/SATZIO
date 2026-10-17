export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-label="SATZIO wird geladen">
      <div className="flex flex-col items-center gap-3">
        <div className="text-2xl font-black tracking-[0.25em] text-primary">SATZIO</div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}

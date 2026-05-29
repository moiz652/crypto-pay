export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">You’re offline</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Reconnect to continue sending or requesting payments.
      </p>
    </main>
  );
}


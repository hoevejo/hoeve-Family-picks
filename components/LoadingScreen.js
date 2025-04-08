export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-10 h-10 border-4 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
        <p className="text-lg font-semibold">Loading...</p>
      </div>
    </div>
  );
}

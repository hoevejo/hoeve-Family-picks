export default function PublicLayout({ children }) {
  return (
    <main className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] transition-colors">
      {children}
    </main>
  );
}

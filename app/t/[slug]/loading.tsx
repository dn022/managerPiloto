// Aparece na hora do clique enquanto a página nova carrega (sensação de resposta imediata).
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy>
      <div className="skeleton h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
      <div className="skeleton h-64" />
    </div>
  );
}

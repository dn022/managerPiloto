// Fundo da "arena noturna": arcos e linhas abstratos nos cantos, deixando o centro livre.
export default function ArenaBackground() {
  return (
    <div className="arena-bg" aria-hidden>
      <svg className="arena-art arena-art-flow" viewBox="0 0 1000 600" preserveAspectRatio="none" fill="none" stroke="currentColor">
        <path d="M-20 430 C 220 330, 380 520, 600 400 S 900 230, 1020 290" vectorEffect="non-scaling-stroke" strokeWidth=".8" />
        <path d="M-20 470 C 240 380, 400 560, 620 440 S 920 280, 1020 340" vectorEffect="non-scaling-stroke" strokeWidth=".8" strokeDasharray="2 10" opacity=".7" />
        <path d="M-20 80 C 200 140, 420 20, 640 110 S 900 160, 1020 100" vectorEffect="non-scaling-stroke" strokeWidth=".8" opacity=".6" />
      </svg>
      <svg className="arena-art arena-art-br" viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth=".8">
        <g className="art-drift">
          <circle cx="400" cy="400" r="120" />
          <circle cx="400" cy="400" r="190" strokeDasharray="2 9" opacity=".7" />
          <circle cx="400" cy="400" r="260" opacity=".5" />
          <circle cx="400" cy="400" r="330" strokeDasharray="30 14" opacity=".35" />
        </g>
        <path d="M120 400 L400 120" opacity=".4" />
        <path d="M60 400 L400 60" opacity=".25" />
      </svg>
      <svg className="arena-art arena-art-tl" viewBox="0 0 400 400" fill="none" stroke="currentColor" strokeWidth=".8">
        <path d="M0 150 A150 150 0 0 0 150 0" opacity=".6" />
        <path d="M0 230 A230 230 0 0 0 230 0" strokeDasharray="2 9" opacity=".5" />
        <path d="M0 310 A310 310 0 0 0 310 0" opacity=".3" />
      </svg>
    </div>
  );
}

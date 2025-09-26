interface HelpButtonProps {
  onClick?: () => void;
  className?: string;
}

export default function HelpButton({ onClick, className = "" }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative
        w-7 h-7 
        bg-blue-500 hover:bg-blue-600 
        text-white 
        rounded 
        shadow-lg hover:shadow-xl
        transition-all duration-300 ease-in-out
        hover:scale-110
        focus:outline-none focus:ring-4 focus:ring-blue-300
        active:scale-95
        cursor-pointer
        m-1
        ${className}
      `}
      aria-label="Ayuda"
      title="Ayuda"
    >
      <span className="text-sm font-bold group-hover:scale-110 transition-transform duration-200">
        ?
      </span>
      
      {/* Efecto de brillo al hacer hover */}
      <div className="absolute inset-0 rounded bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
      
      {/* Ring animado */}
      <div className="absolute inset-0 rounded border-2 border-blue-300 opacity-0 group-hover:opacity-100 animate-ping"></div>
    </button>
  )
}

// Ejemplo de uso:
// <HelpButton onClick={() => console.log('Ayuda solicitada')} />
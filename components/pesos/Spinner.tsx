"use client"
import Image from "next/image"

interface SpinnerProps {
  visible: boolean
}

export default function Spinner({ visible }: SpinnerProps) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-800/70 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col items-center justify-center relative">
        <Image
          src="/logo.png"
          alt="Loading..."
          width={120}
          height={120}
          className="animate-bounce drop-shadow-lg rounded-xl"
          priority
        />
        <div 
          className="w-20 h-3 mt-5 rounded-full opacity-30"
          style={{
            background: 'radial-gradient(ellipse, rgba(0, 0, 0, 0.4) 0%, transparent 70%)',
            animation: 'shadowPulse 1s ease-in-out infinite'
          }}
        ></div>
      </div>
      
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes shadowPulse {
          0%, 100% {
            transform: scaleX(1);
            opacity: 0.3;
          }
          50% {
            transform: scaleX(0.8);
            opacity: 0.15;
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
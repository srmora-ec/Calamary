"use client"
import Image from "next/image"

interface SpinnerProps {
  visible: boolean
}

export default function Spinner({ visible }: SpinnerProps) {
  if (!visible) return null

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-800/70">
        <Image
          src="/logo.png"
          alt="Loading..."
          width={120}
          height={120}
          className="pulse-zoom"
          priority
        />
      </div>

      <style jsx>{`
        @keyframes pulseZoom {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        .pulse-zoom {
          animation: pulseZoom 1.5s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}

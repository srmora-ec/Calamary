"use client"

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="w-full max-w-md text-center p-8 rounded-2xl shadow-lg bg-white border border-blue-100">
        <div className="flex justify-center mb-5">
          <div className="bg-blue-100 p-4 rounded-full">
            <svg
              className="w-10 h-10 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M3 8l9 6 9-6m-18 0v10a2 2 0 002 2h14a2 2 0 002-2V8"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Verifica tu correo electrónico
        </h1>

        <p className="text-gray-600 leading-relaxed mb-6">
          Te hemos enviado un <span className="font-medium text-blue-600">código</span> o{" "}
          <span className="font-medium text-blue-600">enlace de verificación</span> a tu bandeja de entrada.  
          Si no lo ves, revisa la carpeta de <strong>spam</strong> o <strong>correo no deseado.</strong>
        </p>

        <button
          onClick={() => (window.location.href = "/")}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
        >
          Volver al inicio de sesión
        </button>

        <p className="text-sm text-gray-500 mt-6">
          ¿No recibiste el correo? <a href="#" className="text-blue-600 hover:underline">Reenviar</a>
        </p>
      </div>
    </div>
  )
}

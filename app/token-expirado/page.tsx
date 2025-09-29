export default function TokenExpiradoPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-6">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Invitación no válida</h1>
      <p className="text-gray-700 max-w-md">
        La invitación que intentaste abrir ya no es válida. 
        Puede que el enlace haya caducado o que ya hayas respondido la solicitud.
      </p>
    </div>
  );
}

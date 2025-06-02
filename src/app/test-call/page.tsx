import StartCallButton from "@/app/voice-call/StartCallButton";
import ListenCallButton from "@/app/voice-call/ListenCallButton";

export default function TestCall() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen space-y-6 bg-gray-100 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          Sesli Arama Testi
        </h1>
        
        <div className="space-y-4 mb-6">
          <StartCallButton />
          <ListenCallButton />
        </div>
        
        <div className="flex gap-4 mt-4">
          <audio id="local" autoPlay playsInline muted />
          <audio id="remote" autoPlay playsInline />
        </div>
        
        <div className="mt-6 text-sm text-gray-500">
          <p>Mikrofon erişimi için izin verin.</p>
          <p>İki farklı tarayıcı sekmesinde test edin.</p>
        </div>
      </div>
    </main>
  );
}

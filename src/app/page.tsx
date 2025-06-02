'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  const handleRoleSelection = (role: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userRole', role);
      router.push('/eslesme');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      {/* Ortalanmış Ana Kutu */}
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-xl sm:rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-200">

        {/* Başlık Bölümü */}
        <div className="text-center mb-8 sm:mb-10">
          {/* Mobil Uyumlu İkon */}
          <div className="mb-4 sm:mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-blue-500 rounded-2xl shadow-lg">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                className="w-8 h-8 sm:w-10 sm:h-10"
              >
                <path
                  d="M6 10C6 7.79086 7.79086 6 10 6H22C24.2091 6 26 7.79086 26 10V16C26 18.2091 24.2091 20 22 20H18L14 24V20H10C7.79086 20 6 18.2091 6 16V10Z"
                  fill="white"
                />
                <circle cx="12" cy="13" r="1.5" fill="#3B82F6"/>
                <circle cx="16" cy="13" r="1.5" fill="#3B82F6"/>
                <circle cx="20" cy="13" r="1.5" fill="#3B82F6"/>
              </svg>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-3 sm:mb-4">
            Konuşmak İster Misin?
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Bugün nasıl hissediyorsun?
          </p>
        </div>

        {/* Butonlar */}
        <div className="flex flex-col gap-4 sm:gap-5">
          <button
            onClick={() => handleRoleSelection('speaker')}
            className="w-full py-4 sm:py-5 px-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-lg sm:text-xl font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 ease-in-out"
          >
            💬 Konuşmak İster Misin?
          </button>

          <button
            onClick={() => handleRoleSelection('listener')}
            className="w-full py-4 sm:py-5 px-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-lg sm:text-xl font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200 ease-in-out"
          >
            👂 Sadece Dinlemek İstiyorum
          </button>
        </div>

        {/* Alt Bilgi */}
        <div className="text-center mt-8 sm:mt-10">
          <p className="text-xs sm:text-sm text-gray-500">
            Anonim ve güvenli bir ortamda bağlantı kur
          </p>
        </div>
      </div>
    </div>
  );
}

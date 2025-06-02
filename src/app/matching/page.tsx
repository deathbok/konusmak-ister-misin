'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type UserRole = 'speaker' | 'listener' | null;

export default function MatchingPage() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isMatching, setIsMatching] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Get user role from localStorage
    const storedRole = localStorage.getItem('userRole') as UserRole;
    if (!storedRole) {
      // If no role is stored, redirect to home
      router.push('/');
      return;
    }
    setUserRole(storedRole);

    // Simulate matching process (replace with real Firebase logic later)
    const matchingTimer = setTimeout(() => {
      setIsMatching(false);
      // Here you would typically navigate to chat page
      // router.push('/chat');
    }, 3000);

    return () => clearTimeout(matchingTimer);
  }, [router]);

  const handleGoBack = () => {
    localStorage.removeItem('userRole');
    router.push('/');
  };

  const getRoleText = () => {
    return userRole === 'speaker' ? 'konuşmak' : 'dinlemek';
  };

  const getRoleEmoji = () => {
    return userRole === 'speaker' ? '💬' : '👂';
  };

  if (!userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {isMatching ? (
          <>
            {/* Matching Animation */}
            <div className="space-y-6">
              <div className="text-6xl animate-pulse">
                {getRoleEmoji()}
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Eşleşme Aranıyor...
              </h1>
              
              <p className="text-lg text-gray-600 dark:text-gray-300">
                {getRoleText()} isteyen biri aranıyor
              </p>

              {/* Loading Animation */}
              <div className="flex justify-center space-x-2">
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={handleGoBack}
              className="w-full py-3 px-6 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors duration-200"
            >
              İptal Et
            </button>
          </>
        ) : (
          <>
            {/* Match Found */}
            <div className="space-y-6">
              <div className="text-6xl animate-bounce">
                🎉
              </div>
              
              <h1 className="text-3xl font-bold text-green-600 dark:text-green-400">
                Eşleşme Bulundu!
              </h1>
              
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Sohbete başlamaya hazır mısın?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={() => {
                  // Navigate to chat (implement later)
                  console.log('Starting chat...');
                }}
                className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                Sohbete Başla
              </button>
              
              <button
                onClick={handleGoBack}
                className="w-full py-3 px-6 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors duration-200"
              >
                Ana Sayfaya Dön
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

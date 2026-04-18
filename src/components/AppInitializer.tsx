import { useEffect } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export default function AppInitializer() {
  useEffect(() => {
    const initializeNative = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Configure Status Bar
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#1e293b' }); // Slate-800
          
          // Hide Splash Screen
          await SplashScreen.hide();
          
          // Handle Back Button (Android)
          App.addListener('backButton', ({ canGoBack }) => {
            if (!canGoBack) {
              App.exitApp();
            } else {
              window.history.back();
            }
          });
        } catch (error) {
          console.error('Error initializing native plugins:', error);
        }
      }
    };

    initializeNative();
  }, []);

  return null;
}

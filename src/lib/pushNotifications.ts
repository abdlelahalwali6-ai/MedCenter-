import { toast } from 'sonner';

/**
 * Requests permission for push notifications
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      toast.success('تم تفعيل التنبيهات بنجاح');
      return true;
    }
  }

  return false;
}

/**
 * Shows a local notification (if permission granted)
 */
export function showLocalNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: 'https://cdn-icons-png.flaticon.com/512/3209/3209074.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/3209/3209074.png',
      ...options,
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
}

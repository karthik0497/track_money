// Track-Money: Unified Device & Browser Permissions Manager
// Supports Microphone, Camera, Storage, and Push Notifications for Android / Web

export class PermissionsManager {
  /**
   * Check status of all hardware and browser permissions
   */
  static async getPermissionsStatus() {
    const status = {
      microphone: 'prompt',
      camera: 'prompt',
      notifications: 'default',
      storage: 'granted'
    };

    // 1. Microphone
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const micQuery = await navigator.permissions.query({ name: 'microphone' });
        status.microphone = micQuery.state;
      }
    } catch (e) {
      // Some browsers don't support querying microphone directly
    }

    // 2. Camera
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const camQuery = await navigator.permissions.query({ name: 'camera' });
        status.camera = camQuery.state;
      }
    } catch (e) {
      // Some browsers don't support querying camera directly
    }

    // 3. Notifications
    if ('Notification' in window) {
      status.notifications = Notification.permission;
    }

    // Check local storage flag overrides if permissions were already granted during session
    if (localStorage.getItem('tm_mic_granted') === 'true') {
      status.microphone = 'granted';
    }
    if (localStorage.getItem('tm_cam_granted') === 'true') {
      status.camera = 'granted';
    }

    return status;
  }

  /**
   * Request Microphone Permission via getUserMedia
   */
  static async requestMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { success: false, message: 'Audio recording not supported in this browser' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks immediately after obtaining consent
      stream.getTracks().forEach(t => t.stop());
      localStorage.setItem('tm_mic_granted', 'true');
      return { success: true, message: 'Microphone permission granted!' };
    } catch (err) {
      console.warn('Microphone permission request error:', err);
      localStorage.removeItem('tm_mic_granted');
      return {
        success: false,
        message: err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser or phone settings.'
          : `Microphone error: ${err.message}`
      };
    }
  }

  /**
   * Request Camera Permission via getUserMedia
   */
  static async requestCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { success: false, message: 'Camera access not supported in this browser' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      // Stop all tracks immediately after obtaining consent
      stream.getTracks().forEach(t => t.stop());
      localStorage.setItem('tm_cam_granted', 'true');
      return { success: true, message: 'Camera permission granted!' };
    } catch (err) {
      console.warn('Camera permission request error:', err);
      localStorage.removeItem('tm_cam_granted');
      return {
        success: false,
        message: err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser or phone settings.'
          : `Camera error: ${err.message}`
      };
    }
  }

  /**
   * Request Notifications Permission
   */
  static async requestNotifications() {
    if (!('Notification' in window)) {
      return { success: false, message: 'Notifications not supported in this browser' };
    }
    try {
      const result = await Notification.requestPermission();
      return {
        success: result === 'granted',
        message: result === 'granted' ? 'Notifications permission granted!' : 'Notifications permission denied.'
      };
    } catch (err) {
      return { success: false, message: `Notification error: ${err.message}` };
    }
  }

  /**
   * Request ALL permissions sequentially for one-click setup
   */
  static async requestAllPermissions() {
    const results = {
      microphone: await this.requestMicrophone(),
      camera: await this.requestCamera(),
      notifications: await this.requestNotifications()
    };
    return results;
  }
}

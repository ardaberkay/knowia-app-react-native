const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin: Android windowSoftInputMode ayarı
 * 
 * Bu plugin, MainActivity için windowSoftInputMode="adjustNothing" ayarlar.
 * Bu sayede klavye açıldığında hiçbir layout hareket etmez.
 * Tab bar gibi absolute pozisyonlu elementler yerinde kalır.
 */
module.exports = function withAndroidKeyboardMode(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    
    // Application içindeki activity'leri bul
    const application = manifest.application?.[0];
    if (!application) {
      console.warn('withAndroidKeyboardMode: application bulunamadı');
      return config;
    }
    
    const activities = application.activity;
    if (!activities || activities.length === 0) {
      console.warn('withAndroidKeyboardMode: activity bulunamadı');
      return config;
    }
    
    // MainActivity'yi bul ve windowSoftInputMode ayarla
    for (const activity of activities) {
      if (activity.$['android:name'] === '.MainActivity') {
        activity.$['android:windowSoftInputMode'] = 'adjustNothing';
        console.log('withAndroidKeyboardMode: MainActivity için adjustNothing ayarlandı');
        break;
      }
    }
    
    return config;
  });
};

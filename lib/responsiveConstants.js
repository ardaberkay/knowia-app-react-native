// Pixel 7 referans cihaz: 411dp width, 915dp height
// Tüm responsive değerler bu dosyada toplanmıştır

export const RESPONSIVE_CONSTANTS = {
  // Pixel 7 referans değerleri
  REFERENCE_WIDTH: 411,
  REFERENCE_HEIGHT: 915,
  
  // Breakpoints
  SMALL_SCREEN_MAX_HEIGHT: 800,
  TABLET_MIN_WIDTH: 600,
  
  // Card sizing - Pixel 7'de %91 = 374dp
  CARD: {
    REFERENCE_WIDTH: 374, // 411 * 0.91
    REFERENCE_TABLET_MAX_WIDTH: 500,
    
    NORMAL_PHONE_WIDTH_PERCENT: 0.88,
    TABLET_WIDTH_PERCENT: 0.65,
    
    ASPECT_RATIO: 1.45,
    
    NORMAL_PHONE_MAX_HEIGHT_PERCENT: 0.64,
    SMALL_SCREEN_MAX_HEIGHT_PERCENT: 0.60,
  },
  
  // Deck Card sizing - Pixel 7'de 140dp width, 196dp height
  DECK_CARD: {
    // Referans cihazda (Pixel 7) deck kart genişliği
    REFERENCE_WIDTH: 140,
    REFERENCE_HEIGHT: 196,
    
    // Aspect ratio
    ASPECT_RATIO: 1.4, // 196/140
    
    // Genişlik yüzdeleri (fiziksel ekran boyutu kontrolü için)
    // Deck kartlar horizontal scroll'da olduğu için genişlik yüzdesi kullanmıyoruz
    // Ama küçük ekranlarda biraz küçültebiliriz
  },
};

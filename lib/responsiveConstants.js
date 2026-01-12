// Pixel 7 referans cihaz: 411dp width, 915dp height
// Tüm responsive değerler bu dosyada toplanmıştır

export const RESPONSIVE_CONSTANTS = {
  // Pixel 7 referans değerleri
  REFERENCE_WIDTH: 411,
  REFERENCE_HEIGHT: 915,
  
  // Breakpoints
  SMALL_PHONE_MAX_WIDTH: 380,
  SMALL_SCREEN_MAX_HEIGHT: 800,
  TABLET_MIN_WIDTH: 600,
  
  // Card sizing - Pixel 7'de %88 = 362dp
  CARD: {
    // Referans cihazda (Pixel 7) kart genişliği
    REFERENCE_WIDTH: 362, // 411 * 0.88
    REFERENCE_SMALL_WIDTH: 349, // 411 * 0.85 (küçük telefonlar için)
    REFERENCE_TABLET_MAX_WIDTH: 500,
    
    // Genişlik yüzdeleri (fiziksel ekran boyutu kontrolü için)
    NORMAL_PHONE_WIDTH_PERCENT: 0.88,
    SMALL_PHONE_WIDTH_PERCENT: 0.85,
    TABLET_WIDTH_PERCENT: 0.65,
    
    // Aspect ratio
    ASPECT_RATIO: 1.45,
    
    // Yükseklik limitleri (ekran yüksekliğinin yüzdesi)
    NORMAL_PHONE_MAX_HEIGHT_PERCENT: 0.60,
    SMALL_PHONE_MAX_HEIGHT_PERCENT: 0.55,
    SMALL_SCREEN_MAX_HEIGHT_PERCENT: 0.57,
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

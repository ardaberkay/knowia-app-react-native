// Content limits in one place (cards, CSV import). Forms and the CSV import
// read them from here so the rules can't drift apart.

// Max characters per card field.
export const CARD_LIMITS = {
  question: 400,
  answer: 300,
  example: 200,
  note: 200,
};

// Max characters per deck field.
export const DECK_LIMITS = {
  name: 70,
  toName: 70,
  description: 300,
};

// Profile username length.
export const PROFILE_LIMITS = {
  usernameMin: 3,
  usernameMax: 16,
};

// One CSV import (K10).
export const CSV_LIMITS = {
  maxCards: 1000,
  maxImages: 50,                    // distinct images to upload (files + web links)
  maxFileBytes: 5 * 1024 * 1024,    // 5 MB, the CSV file itself
  maxUrlImageBytes: 2 * 1024 * 1024, // 2 MB, an image downloaded from a web link
  imageConcurrency: 3,              // images processed at the same time
  insertBatchSize: 100,             // cards per insert request
};

// Card images: resized to this width and saved as WebP (storage is 2 MB / file).
export const CARD_IMAGE = {
  width: 512,
  compress: 0.7,
};

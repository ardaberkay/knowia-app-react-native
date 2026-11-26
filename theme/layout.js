// Layout tokens in fixed dp. Sizes are not scaled per device: dp is already
// density-independent, and layouts adapt with flex / % / aspectRatio /
// onLayout instead. Use these for new styles and when touching old ones.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

// Row that holds a tab screen's large title (Keşfet, Kitaplığım), right under
// the safe area, with spacing.lg side padding.
export const SCREEN_TITLE_HEIGHT = 52;

// Minimum touch target (Apple HIG 44pt, Material 48dp).
export const MIN_TOUCH_SIZE = 48;

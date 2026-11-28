// App-wide icon choices, in one place. Every icon is a Phosphor icon (see
// components/ui/PhosphorIcon.js); names are the kebab-case names from
// phosphoricons.com. Screens pick icons from here instead of naming them
// inline, so one concept always gets the same icon and changing it is a
// one-line edit.

// Bottom tabs (navigation/AppNavigator.js). iOS shows fill on the selected
// tab, regular otherwise; Android always shows regular.
export const TAB_ICONS = {
  Home: 'house',
  DiscoverTab: 'compass',
  Library: 'books',
  Profile: 'user',
};

// --- UI icons, by meaning ---
// Each entry is { name, weight } for <PhosphorIcon icon={ICONS.x} />. One
// concept, one icon: don't add a second icon for something listed here.
// Weights: line icons (arrows, x, check, plus, eye...) are bold (regular read
// too thin on device); their fill glyph puts the icon in a filled box. Fill is
// for objects (heart, fire, stack...) and carets, whose fill glyph is the same
// shape made solid.
export const ICONS = {
  // Common controls
  close: { name: 'x', weight: 'bold' },
  check: { name: 'check', weight: 'bold' },
  add: { name: 'plus', weight: 'bold' },
  edit: { name: 'pencil-simple', weight: 'bold' },
  delete: { name: 'trash', weight: 'fill' },
  chevronRight: { name: 'caret-right', weight: 'bold' }, // rows, "see all", next
  arrowRight: { name: 'arrow-right', weight: 'bold' }, // "from → to"
  back: { name: 'arrow-left', weight: 'bold' }, // previous step (tutorial)
  dropdown: { name: 'caret-down', weight: 'fill' }, // pickers, expand
  dropdownOpen: { name: 'caret-up', weight: 'fill' }, // collapse
  more: { name: 'dots-three', weight: 'bold' }, // kebab menus
  search: { name: 'magnifying-glass', weight: 'bold' },
  filterSheet: { name: 'sliders', weight: 'bold' }, // opens the filter sheet
  filterMenu: { name: 'funnel-simple', weight: 'bold' }, // opens a sort/filter menu
  sort: { name: 'sort-ascending', weight: 'bold' },
  category: { name: 'squares-four', weight: 'bold' },
  language: { name: 'translate', weight: 'bold' },
  info: { name: 'info', weight: 'bold' }, // hints, notices, snackbar info
  visible: { name: 'eye', weight: 'bold' },
  hidden: { name: 'eye-slash', weight: 'bold' }, // hidden (password fields)
  user: { name: 'user', weight: 'fill' },
  haptics: { name: 'vibrate', weight: 'bold' },
  notifications: { name: 'bell', weight: 'bold' },
  community: { name: 'users-three', weight: 'fill' },
  settings: { name: 'gear', weight: 'bold' },
  block: { name: 'prohibit', weight: 'bold' },

  // Account / auth forms
  email: { name: 'envelope-simple', weight: 'bold' },
  password: { name: 'password', weight: 'bold' },
  locked: { name: 'lock-simple', weight: 'bold' }, // field can't be changed
  valid: { name: 'check-circle', weight: 'fill' }, // password rule met
  invalid: { name: 'circle', weight: 'bold' }, // password rule not met yet
  apple: { name: 'apple-logo', weight: 'fill' },

  // Home sections (HomeScreen headers, CategoryHeroHeader / CategoryDeckList hero)
  inProgressDecks: { name: 'book-open-user', weight: 'fill' }, // Çalıştığım Desteler
  readyDecks: { name: 'sparkle', weight: 'fill' }, // Hazır Desteler
  // Topluluk Desteleri uses community; an unknown section falls back to deck.

  // Decks, chapters, cards
  deck: { name: 'cards', weight: 'fill' }, // decks
  stack: { name: 'stack', weight: 'fill' }, // cards: card counts, card lists
  chapter: { name: 'puzzle-piece', weight: 'bold' },
  unassigned: { name: 'tray', weight: 'bold' }, // cards without a chapter
  favorite: { name: 'heart', weight: 'fill' },
  favoriteOff: { name: 'heart', weight: 'bold' },
  fire: { name: 'fire', weight: 'fill' }, // learning, streak
  learned: { name: 'graduation-cap', weight: 'fill' },
  trending: { name: 'trend-up', weight: 'bold' }, // trend tab, popularity score
  popular: { name: 'crown-simple', weight: 'fill' },
  newDecks: { name: 'sparkle', weight: 'fill' }, // decks published recently (Keşfet 'Yeni')
  statusNew: { name: 'star-four', weight: 'fill' }, // card status: not studied yet
  calendar: { name: 'calendar-blank', weight: 'fill' },
  time: { name: 'clock', weight: 'fill' },
  trophy: { name: 'trophy', weight: 'fill' },

  // Deck / card forms (label icons stay regular so a form's column matches)
  deckName: { name: 'exam', weight: 'bold' },
  pair: { name: 'arrows-left-right', weight: 'bold' }, // "Karşılığı", front ⇄ back languages
  description: { name: 'file-text', weight: 'bold' },
  createCard: { name: 'file-plus', weight: 'bold' },
  required: { name: 'asterisk', weight: 'bold' },

  // CSV import
  upload: { name: 'cloud-arrow-up', weight: 'bold' },
  download: { name: 'file-arrow-down', weight: 'bold' },
  csvFile: { name: 'file-csv', weight: 'bold' },
  zoom: { name: 'magnifying-glass-plus', weight: 'bold' },

  // Card fields
  question: { name: 'question', weight: 'bold' },
  answer: { name: 'check-circle', weight: 'bold' },
  hint: { name: 'lightbulb', weight: 'bold' },
  guide: { name: 'book-open-text', weight: 'fill' }, // 'Nasıl oluşturulur?' row on the create pages
  note: { name: 'note-pencil', weight: 'bold' },
  image: { name: 'image', weight: 'fill' },

  // Study session
  start: { name: 'rocket-launch', weight: 'fill' },
  play: { name: 'play', weight: 'fill' },
  pause: { name: 'pause', weight: 'fill' },
  speak: { name: 'speaker-high', weight: 'fill' },
  stopSpeak: { name: 'stop', weight: 'fill' },
  shuffle: { name: 'shuffle', weight: 'bold' },
  repeat: { name: 'repeat', weight: 'bold' },
  reverse: { name: 'arrows-down-up', weight: 'bold' }, // answer first
  undo: { name: 'arrow-arc-left', weight: 'bold' },
  swipeLeft: { name: 'arrow-arc-left', weight: 'bold' },
  swipeRight: { name: 'arrow-arc-right', weight: 'bold' },
  // Study tutorial steps
  tapToFlip: { name: 'hand-tap', weight: 'bold' },
  swipeToLearn: { name: 'hand-swipe-right', weight: 'bold' },
  reviewInterval: { name: 'clock-countdown', weight: 'bold' },
};

// --- Categories ---
// Keys are categories.sort_order from Supabase. Each entry is the props for
// <PhosphorIcon>: { name, weight }.
export const CATEGORY_ICONS = {
  1: { name: 'globe-simple', weight: 'regular' }, // Dil
  2: { name: 'atom', weight: 'regular' }, // Bilim (fill reads poorly)
  3: { name: 'compass-tool', weight: 'fill' }, // Matematik
  4: { name: 'castle-turret', weight: 'fill' }, // Tarih
  5: { name: 'globe-hemisphere-east', weight: 'fill' }, // Coğrafya
  6: { name: 'mask-happy', weight: 'fill' }, // Sanat ve Kültür
  7: { name: 'flower-lotus', weight: 'fill' }, // Kişisel Gelişim
  8: { name: 'lightbulb-filament', weight: 'fill' }, // Genel Kültür (trying; fallbacks: lightbulb, star-four)
};
// Used when the category isn't known (e.g. card lists don't load the deck's
// category).
const DEFAULT_CATEGORY_ICON = CATEGORY_ICONS[1];

/** Icon of a category as <PhosphorIcon> props: { name, weight }. */
export const getCategoryIcon = (sortOrder) => CATEGORY_ICONS[sortOrder] || DEFAULT_CATEGORY_ICON;

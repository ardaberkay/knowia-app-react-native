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

// --- Categories ---
// Keys are categories.sort_order from Supabase. Each entry is the props for
// <PhosphorIcon>: { name, weight }.
export const CATEGORY_ICONS = {
  1: { name: 'globe-simple', weight: 'fill' }, // Dil
  2: { name: 'atom', weight: 'regular' }, // Bilim (fill reads poorly)
  3: { name: 'compass-tool', weight: 'fill' }, // Matematik
  4: { name: 'castle-turret', weight: 'fill' }, // Tarih
  5: { name: 'globe-hemisphere-east', weight: 'fill' }, // Coğrafya
  6: { name: 'mask-happy', weight: 'fill' }, // Sanat ve Kültür
  7: { name: 'flower-lotus', weight: 'fill' }, // Kişisel Gelişim
  8: { name: 'star-four', weight: 'fill' }, // Genel Kültür (temporary pick)
};
// Used when the category isn't known (e.g. card lists don't load the deck's
// category).
const DEFAULT_CATEGORY_ICON = CATEGORY_ICONS[1];

/** Icon of a category as <PhosphorIcon> props: { name, weight }. */
export const getCategoryIcon = (sortOrder) => CATEGORY_ICONS[sortOrder] || DEFAULT_CATEGORY_ICON;

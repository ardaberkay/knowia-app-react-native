import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import PhosphorIcon from './PhosphorIcon';
import { ICONS } from '../../theme/icons';
import { typography, fontSizes, fonts } from '../../theme/typography';
import SearchBar from '../tools/SearchBar';

// Kategoriye göre icon, renk ve gradient belirleme
export function getCategoryConfig(category, t) {
  const configs = {
    inProgressDecks: {
      icon: ICONS.inProgressDecks,
      // Canlı turuncu-kırmızı: enerji ve ilerleme hissi (belirgin gradyant)
      gradient: ['#ffa726', '#ff6b35'],
      accentColor: '#ff6b35',
      description: t('home.inProgressDecksDescription', 'Çalıştığınız destelerle bilginizi pekiştirin'),
    },
    defaultDecks: {
      icon: ICONS.readyDecks,
      gradient: ['#667eea', '#764ba2'], // Sakin mor-mavi - güvenilir
      accentColor: '#f093fb',
      description: t('home.defaultDecksDescription', 'Hazır destelerle hızlıca öğrenmeye başlayın'),
    },
    communityDecks: {
      icon: ICONS.community,
      gradient: ['#f093fb', '#f5576c'], // Sosyal pembe-kırmızı - sıcak ve davetkar
      accentColor: '#ff6b9d',
      description: t('home.communityDecksDescription', 'Topluluk destelerini keşfedin ve paylaşın'),
    },
  };

  return configs[category] || {
    icon: ICONS.deck,
    gradient: ['#38f9d7', '#43e97b'],
    accentColor: '#6f8ead',
    description: t('home.allDecksDescription', 'Tüm desteleri keşfedin'),
  };
}

export default function CategoryHeroHeader({ 
  category, 
  title, 
  colors, 
  t,
  search,
  onSearchChange,
  searchPlaceholder,
  sortMenuComponent,
}) {
  const config = getCategoryConfig(category, t);

  return (
    <View style={[styles.heroCard, { backgroundColor: config.gradient[0] }]}>
      <LinearGradient
        colors={[...config.gradient, ...config.gradient.slice().reverse()]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <View style={styles.heroContent}>
          <View style={styles.heroIconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: config.accentColor + '20' }]}>
              <PhosphorIcon icon={config.icon} size={28} color="#fff" />
            </View>
          </View>
          <View style={styles.heroTextContainer}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>{config.description}</Text>
          </View>
        </View>

        {/* Search and Filter Row */}
        <View style={styles.searchRow}>
          <SearchBar
            value={search}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            style={styles.searchBar}
            variant="light"
          />
          {sortMenuComponent}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    marginHorizontal: 12,
  },
  heroGradient: {
    padding: 24,
    minHeight: 140,
    justifyContent: 'center',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroIconContainer: {
    marginRight: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.styles.title2,
    color: '#fff',
    fontSize: fontSizes.title1,
    fontFamily: fonts.bold,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    ...typography.styles.subhead,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: fontSizes.body,
    fontFamily: fonts.medium,
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  searchBar: {
    flex: 1,
  },
});


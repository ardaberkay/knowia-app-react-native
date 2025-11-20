import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Iconify } from 'react-native-iconify';
import { listChapters, distributeUnassignedEvenly, getNextOrdinal, createChapter, getChaptersProgress } from '../../services/ChapterService';
import CreateButton from '../../components/tools/CreateButton';
import CircularProgress from '../../components/ui/CircularProgress';
import { supabase } from '../../lib/supabase';
import LottieView from 'lottie-react-native';

export default function ChaptersScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { deck } = route.params || {};
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [distLoading, setDistLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [progressMap, setProgressMap] = useState(new Map());
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deck?.id) { setLoading(false); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
        // Owner can edit only if deck is not shared (treat undefined as not shared)
        setIsOwner(user?.id === deck.user_id && !deck.is_shared);
        setCurrentUserId(user?.id || null);
        const data = await listChapters(deck.id);
        if (mounted) {
          setChapters(data);
          // Load progress for all chapters
          if (user?.id) {
            const chaptersWithUnassigned = [{ id: null }, ...data];
            const progress = await getChaptersProgress(chaptersWithUnassigned, deck.id, user.id);
            if (mounted) setProgressMap(progress);
          }
        }
      } catch (e) {
        // noop
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [deck?.id]);

  // Refresh progress when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (!deck?.id || !currentUserId || chapters.length === 0) return;
      try {
        const chaptersWithUnassigned = [{ id: null }, ...chapters];
        const progress = await getChaptersProgress(chaptersWithUnassigned, deck.id, currentUserId);
        setProgressMap(progress);
      } catch (e) {
        // noop
      }
    });
    return unsubscribe;
  }, [navigation, deck?.id, currentUserId, chapters]);

  const handleDistribute = async () => {
    if (!deck?.id) return;
    if (!chapters?.length) {
      Alert.alert(t('common.error', 'Hata'), t('chapters.needChapters', 'Dağıtım için en az bir bölüm oluşturmalısın.'));
      return;
    }
    setDistLoading(true);
    try {
      await distributeUnassignedEvenly(deck.id, chapters.map(c => c.id));
      Alert.alert(t('common.success', 'Başarılı'), t('chapters.distributed', 'Atanmamış kartlar bölümlere dağıtıldı.'));
      // Refresh progress after distribution
      if (currentUserId) {
        const chaptersWithUnassigned = [{ id: null }, ...chapters];
        const progress = await getChaptersProgress(chaptersWithUnassigned, deck.id, currentUserId);
        setProgressMap(progress);
      }
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('chapters.distributeError', 'Dağıtım yapılamadı.'));
    } finally {
      setDistLoading(false);
    }
  };

  const handleAddChapter = async () => {
    if (!deck?.id) return;
    if (!isOwner) {
      Alert.alert(t('common.error', 'Hata'), t('chapters.onlyOwner', 'Sadece deste sahibi bölüm ekleyebilir.'));
      return;
    }
    if (chapters.length >= 30) {
      Alert.alert(t('common.error', 'Hata'), t('chapters.limitReached', 'Maksimum 30 bölüm oluşturabilirsin.'));
      return;
    }
    try {
      const next = await getNextOrdinal(deck.id);
      const inserted = await createChapter(deck.id, next);
      // Ordinal'e göre sırala, aynı ordinal'de yeni eklenenler altta (created_at ascending)
      const updatedChapters = [...chapters, inserted].sort((a,b) => {
        if (a.ordinal !== b.ordinal) return a.ordinal - b.ordinal;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      setChapters(updatedChapters);
      // Refresh progress for new chapter
      if (currentUserId) {
        const chaptersWithUnassigned = [{ id: null }, ...updatedChapters];
        const progress = await getChaptersProgress(chaptersWithUnassigned, deck.id, currentUserId);
        setProgressMap(progress);
      }
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('chapters.createError', 'Bölüm eklenemedi.'));
    }
  };

  // Yükleniyor ekranı
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <LottieView source={require('../../assets/flexloader.json')} speed={1.15} autoPlay loop style={{ width: 200, height: 200 }} />
      <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100 }} />
    </View>
  );

  return (
    <View style={[styles.bgGradient, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {loading ? (
          renderLoading()
        ) : chapters.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={64}
              color={colors.muted}
              style={{ marginBottom: 8 }}
            />
            <Text style={[styles.emptyStateTitle, typography.styles.h3, { color: colors.text }]}>
              {t('chapters.noChapters', 'Henüz Bölüm Yok')}
            </Text>
            <Text style={[styles.emptyStateText, typography.styles.body, { color: colors.subtext }]}>
              {t('chapters.noChaptersDesc', 'Bu destede henüz bölüm oluşturulmamış.')}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={(
                <View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ChapterCards', { chapter: { id: null, name: t('chapters.unassigned', 'Atanmamış') }, deck })}
                    activeOpacity={0.8}
                    style={[
                      styles.chapterItem,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.cardBorder,
                        shadowColor: colors.shadowColor,
                        shadowOffset: colors.shadowOffset,
                        shadowOpacity: colors.shadowOpacity,
                        shadowRadius: colors.shadowRadius,
                        elevation: colors.elevation,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.buttonColor} style={{ marginRight: 8 }} />
                      <Text style={[typography.styles.body, { color: colors.text }]}>{t('chapters.unassigned', 'Atanmamış')}</Text>
                    </View>
                  </TouchableOpacity>
                  {isOwner && (
                    <View style={{ paddingBottom: 10, alignItems: 'flex-end' }}>
                      <CreateButton
                        onPress={handleDistribute}
                        disabled={distLoading}
                        loading={distLoading}
                        text={t('chapters.distribute', 'Sihirbazla dağıt')}
                        showIcon={true}
                        iconName="ion:chevron-forward"
                        style={{ flex: 0, borderRadius: 999 }}
                        textStyle={[typography.styles.button]}
                      />
                    </View>
                  )}
                </View>
              )}
              renderItem={({ item, index }) => {
                const chapterProgress = progressMap.get(item.id) || { total: 0, learned: 0, progress: 0 };
                const learningCount = chapterProgress.total - chapterProgress.learned;
                return (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ChapterCards', { chapter: { id: item.id, name: `Bölüm ${index + 1}` }, deck })}
                    activeOpacity={0.8}
                    style={[
                      styles.chapterItem,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.cardBorder,
                        shadowColor: colors.shadowColor,
                        shadowOffset: colors.shadowOffset,
                        shadowOpacity: colors.shadowOpacity,
                        shadowRadius: colors.shadowRadius,
                        elevation: colors.elevation,
                      },
                    ]}
                  >
                    {/* Chapter Header */}
                    <View style={styles.chapterHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={22} color={colors.buttonColor} style={{ marginRight: 8 }} />
                          <Text style={[typography.styles.body, styles.chapterTitle, { color: colors.text }]}>Bölüm {index + 1}</Text>
                        </View>
                        <Iconify icon="ion:chevron-forward" size={26} color={colors.buttonColor} />
                      </View>
                    </View>
                    
                    {/* Divider */}
                    <View style={[styles.chapterDivider, { backgroundColor: colors.border }]} />
                    
                    {/* Progress and Stats Section */}
                    <View style={styles.chapterContent}>
                      <View style={styles.progressContainer}>
                        <CircularProgress
                          progress={chapterProgress?.progress || 0}
                          size={78}
                          strokeWidth={9}
                          showText={true}
                          shouldAnimate={false}
                          fullCircle={true}
                          textStyle={{ fontSize: 16, fontWeight: '900', color: colors.text }}
                        />
                      </View>
                      
                      <View style={styles.statsContainer}>
                        {/* Learning */}
                        <View style={styles.statRow}>
                          <Iconify icon="mdi:fire" size={18} color={colors.buttonColor} style={{ marginRight: 8 }} />
                          <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                            {t('chapters.learning', 'Learning')}: {learningCount}
                          </Text>
                        </View>
                        
                        {/* Learned */}
                        <View style={styles.statRow}>
                          <Iconify icon="dashicons:welcome-learn-more" size={18} color={colors.buttonColor} style={{ marginRight: 8 }} />
                          <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                            {t('chapters.learned', 'Learned')}: {chapterProgress.learned}
                          </Text>
                        </View>
                        
                        {/* Total */}
                        <View style={styles.statRow}>
                          <Iconify icon="ri:stack-fill" size={18} color={colors.buttonColor} style={{ marginRight: 8 }} />
                          <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                            {t('chapters.total', 'Total')}: {chapterProgress.total}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            
          </View>
        )}
        {isOwner && (
          <TouchableOpacity
            onPress={handleAddChapter}
            activeOpacity={0.85}
            style={styles.fab}
          >
            <LinearGradient
              colors={['#F98A21', '#FF6B35']}
              locations={[0, 0.99]}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <MaterialCommunityIcons name="plus" size={28} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bgGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  chapterItem: {
    flexDirection: 'column',
    padding: 20,
    borderRadius: 40,
    borderWidth: 1,
    marginBottom: 14,
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
  },
  chapterHeader: {
    marginBottom: 12,
  },
  chapterTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  chapterDivider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
    opacity: 0.3,
  },
  chapterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  progressContainer: {
    marginRight: 8,
  },
  statsContainer: {
    flex: 1,
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 15,
  },
  distributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 70,
    height: 70,
    borderRadius: 99,
    overflow: 'hidden',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 99,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    flexDirection: 'column',
    gap: -65,
  },
});

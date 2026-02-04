import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { listChapters, distributeUnassignedEvenly, getNextOrdinal, createChapter, getChaptersProgress, deleteChapter, reorderChapterOrdinals } from '../../services/ChapterService';
import CreateButton from '../../components/tools/CreateButton';
import CircularProgress from '../../components/ui/CircularProgress';
import { supabase } from '../../lib/supabase';
import LottieView from 'lottie-react-native';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';

export default function ChaptersScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { deck } = route.params || {};
  const { showSuccess, showError } = useSnackbarHelpers();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [distLoading, setDistLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [progressMap, setProgressMap] = useState(new Map());
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // currentUserId'yi erken yükle (header için)
  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      // Owner can edit only if deck is not shared (treat undefined as not shared)
      if (deck?.user_id) {
        setIsOwner(user?.id === deck.user_id && !deck.is_shared);
      }
    };
    fetchUserId();
  }, [deck?.user_id, deck?.is_shared]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deck?.id) { setLoading(false); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted) return;
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

  // Navigation header'a edit butonu ekle
  useLayoutEffect(() => {
    // Loading bitene kadar header ikonlarını gösterme
    if (loading) {
      navigation.setOptions({
        headerRight: () => null,
      });
      return;
    }

    navigation.setOptions({
      headerRight: () => {
        // Kullanıcı deste sahibiyse ve deste paylaşılmamışsa göster
        if (!currentUserId || !deck?.user_id || currentUserId !== deck.user_id || deck.is_shared) {
          return null;
        }
        return (
          <TouchableOpacity
            onPress={() => setEditMode(!editMode)}
            style={{ marginRight: scale(16) }}
            activeOpacity={0.7}
          >
            <Iconify 
              icon={editMode ? "mingcute:close-fill" : "lucide:edit"} 
              size={moderateScale(22)} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        );
      },
    });
  }, [loading, navigation, currentUserId, deck?.user_id, deck?.is_shared, editMode]);

  const handleAddChapter = async () => {
    if (!deck?.id) return;
    if (!isOwner) {
      showError(t('chapters.onlyOwner', 'Sadece deste sahibi bölüm ekleyebilir.'));
      return;
    }
    if (chapters.length >= 30) {
      showError(t('chapters.limitReached', 'Maksimum 30 bölüm oluşturabilirsin.'));
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
      showError(e.message || t('chapters.createError', 'Bölüm eklenemedi.'));
    }
  };

  const handleDeleteChapter = async (chapterId) => {
    Alert.alert(
      t('chapters.deleteTitle', 'Bölümü Sil'),
      t('chapters.deleteMessage', 'Bu bölümü silmek istediğinize emin misiniz? Bölümdeki kartlar atanmamış kartlara taşınacak.'),
      [
        {
          text: t('common.cancel', 'İptal'),
          style: 'cancel',
        },
        {
          text: t('common.delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChapter(chapterId);
              // Ordinal'leri yeniden düzenle (1, 2, 3, ... şeklinde)
              await reorderChapterOrdinals(deck.id);
              // Bölümleri yeniden yükle (ordinal'ler güncellenmiş olacak)
              const updatedChapters = await listChapters(deck.id);
              setChapters(updatedChapters);
              // Progress'i güncelle
              if (currentUserId) {
                const chaptersWithUnassigned = [{ id: null }, ...updatedChapters];
                const progress = await getChaptersProgress(chaptersWithUnassigned, deck.id, currentUserId);
                setProgressMap(progress);
              }
              showSuccess(t('chapters.deleted', 'Bölüm silindi.'));
            } catch (e) {
              showError(e.message || t('chapters.deleteError', 'Bölüm silinemedi.'));
            }
          },
        },
      ]
    );
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
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={chapters.length === 0 ? { padding: scale(16), flexGrow: 1 } : { padding: scale(16), paddingBottom: '22%' }}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={() => {
                const unassignedProgress = progressMap.get('unassigned') || { total: 0 };
                const unassignedCount = unassignedProgress.total || 0;
                return (
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Iconify icon="ic:round-assignment-late" size={moderateScale(20)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
                          <Text style={[typography.styles.body, { color: colors.text }]}>{t('chapters.unassigned', 'Atanmamış')}</Text>
                        </View>
                        {unassignedCount > 0 && (
                          <View style={[styles.countBadge, { backgroundColor: colors.buttonColor }]}>
                            <Text style={[styles.countBadgeText, { color: '#FFFFFF' }]}>{unassignedCount}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={
                  <View style={styles.emptyStateContainer}>
                    <View style={styles.emptyState}>
                      <Iconify
                        icon="streamline-freehand:plugin-jigsaw-puzzle"
                        size={scale(120)}
                        color={colors.muted}
                        style={{ marginBottom: verticalScale(12), opacity: 0.5 }}
                      />
                      <Text style={[styles.emptyStateText, typography.styles.body, { color: colors.subtext, opacity: 0.6 }]}>
                        {t('chapters.noChaptersDesc', 'Bu destede henüz bölüm oluşturulmamış.')}
                      </Text>
                    </View>
                  </View>
              }
              renderItem={({ item, index }) => {
                const chapterProgress = progressMap.get(item.id) || { total: 0, learned: 0, learning: 0, progress: 0 };
                const learningCount = chapterProgress.learning || 0;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (!editMode) {
                        navigation.navigate('ChapterCards', { chapter: { id: item.id, name: `${t('chapters.chapter', 'Bölüm')} ${item.ordinal}` }, deck });
                      }
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.chapterItem,
                      {
                        backgroundColor: colors.cardBackground,
                        borderColor: editMode ? colors.buttonColor : colors.cardBorder,
                        borderWidth: 1,
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
                          <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={moderateScale(22)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
                          <Text style={[typography.styles.body, styles.chapterTitle, { color: colors.text }]}>{t('chapters.chapter', 'Bölüm')} {item.ordinal}</Text>
                        </View>
                        {editMode ? (
                          <TouchableOpacity
                            onPress={() => handleDeleteChapter(item.id)}
                            style={styles.deleteButton}
                            activeOpacity={0.7}
                          >
                            <Iconify icon="mdi:garbage" size={moderateScale(24)} color="#FF4444" />
                          </TouchableOpacity>
                        ) : (
                          <Iconify icon="ion:chevron-forward" size={moderateScale(26)} color={colors.buttonColor} />
                        )}
                      </View>
                    </View>
                    
                    {/* Divider */}
                    <View style={[styles.chapterDivider, { backgroundColor: colors.border }]} />
                    
                    {/* Progress and Stats Section */}
                    <View style={styles.chapterContent}>
                      <View style={styles.progressContainer}>
                        <CircularProgress
                          progress={chapterProgress?.progress || 0}
                          size={scale(78)}
                          strokeWidth={moderateScale(9)}
                          showText={true}
                          shouldAnimate={false}
                          fullCircle={true}
                          textStyle={{ fontSize: moderateScale(16), fontWeight: '900', color: colors.text }}
                        />
                      </View>
                      
                      <View style={styles.statsContainer}>
                        {/* Learning */}
                        <View style={styles.statRow}>
                          <Iconify icon="mdi:fire" size={moderateScale(18)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
                          <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                            {t('chapters.learning', 'Learning')}: {learningCount}
                          </Text>
                        </View>
                        
                        {/* Learned */}
                        <View style={styles.statRow}>
                          <Iconify icon="dashicons:welcome-learn-more" size={moderateScale(18)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
                          <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
                            {t('chapters.learned', 'Learned')}: {chapterProgress.learned}
                          </Text>
                        </View>
                        
                        {/* Total */}
                        <View style={styles.statRow}>
                          <Iconify icon="ri:stack-fill" size={moderateScale(18)} color={colors.buttonColor} style={{ marginRight: scale(8) }} />
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
        {!loading && isOwner && (
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
              <Iconify icon="ic:round-plus" size={moderateScale(30)} color="#FFFFFF" />
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(25),
    minHeight: verticalScale(400),
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: verticalScale(-150),
  },
  emptyStateTitle: {
    marginTop: verticalScale(16),
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    lineHeight: verticalScale(22),
  },
  chapterItem: {
    flexDirection: 'column',
    padding: moderateScale(20),
    borderRadius: moderateScale(40),
    borderWidth: moderateScale(1),
    marginBottom: verticalScale(14),
    shadowOffset: { width: scale(4), height: verticalScale(6) },
    shadowOpacity: 0.10,
    shadowRadius: moderateScale(10),
    elevation: 5,
  },
  chapterHeader: {
    marginBottom: verticalScale(12),
  },
  chapterTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
  },
  chapterDivider: {
    height: verticalScale(1),
    width: '100%',
    marginBottom: verticalScale(16),
    opacity: 0.3,
  },
  chapterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
  },
  progressContainer: {
    marginRight: scale(8),
  },
  statsContainer: {
    flex: 1,
    gap: verticalScale(8),
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: moderateScale(15),
  },
  deleteButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(8),
  },
  fab: {
    position: 'absolute',
    right: scale(20),
    bottom: verticalScale(24),
    width: scale(70),
    height: scale(70),
    borderRadius: moderateScale(99),
    overflow: 'hidden',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: verticalScale(1) },
    shadowOpacity: 0.08,
    shadowRadius: moderateScale(2),
    elevation: 2,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(99),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: verticalScale(200),
    flexDirection: 'column',
    gap: verticalScale(-65),
  },
  countBadge: {
    minWidth: scale(28),
    height: scale(28),
    borderRadius: moderateScale(14),
    paddingHorizontal: scale(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
});

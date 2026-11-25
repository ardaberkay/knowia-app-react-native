import React, { useEffect, useState, useLayoutEffect, useCallback, memo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Pressable, RefreshControl } from 'react-native';
import { Text } from '../../components/ui/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Iconify } from 'react-native-iconify';
import { listChapters, getNextOrdinal, createChapter, getDeckChaptersProgressRpc, deleteChapter, reorderChapterOrdinals } from '../../services/ChapterService';
import CircularProgress from '../../components/ui/CircularProgress';
import { useAuth } from '../../contexts/AuthContext';
import LottieView from 'lottie-react-native';
import { useSnackbarHelpers } from '../../components/ui/Snackbar';
import { triggerHaptic } from '../../lib/hapticManager';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomInset } from '../../components/ui/CustomTabBar';

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable);

const MemoizedChapterItem = memo(({ item, progressMap, editMode, colors, onPress, onDelete, t }) => {
  const chapterProgress = progressMap.get(item.id) || { total: 0, learned: 0, learning: 0, progress: 0 };
  const learningCount = chapterProgress.learning || 0;
  return (
    <TouchableOpacity
      onPress={() => !editMode && onPress(item)}
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
      <View style={styles.chapterHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Iconify icon="streamline-freehand:plugin-jigsaw-puzzle" size={22} color={colors.buttonColor} style={{ marginRight: 8 }} />
            <Text style={[typography.styles.body, styles.chapterTitle, { color: colors.text }]}>{t('chapters.chapter', 'Bölüm')} {item.ordinal}</Text>
          </View>
          {editMode ? (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('heavy');
                requestAnimationFrame(() => onDelete(item.id));
              }}
              style={styles.deleteButton}
              activeOpacity={0.7}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Iconify icon="mdi:garbage" size={24} color="#FF4444" />
            </TouchableOpacity>
          ) : (
            <Iconify icon="ion:chevron-forward" size={26} color={colors.buttonColor} />
          )}
        </View>
      </View>
      <View style={[styles.chapterDivider, { backgroundColor: colors.border }]} />
      <View style={styles.chapterContent}>
        <View style={styles.progressContainer}>
          <CircularProgress
            progress={chapterProgress?.progress || 0}
            size={78}
            strokeWidth={9}
            showText={true}
            shouldAnimate={true}
            fullCircle={true}
            textStyle={{ fontSize: 16, fontWeight: '900', color: colors.text }}
          />
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statRow}>
            <Iconify icon="mdi:fire" size={18} color={colors.buttonColor} style={{ marginRight: 8 }} />
            <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
              {t('chapters.learning', 'Learning')}: {learningCount}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Iconify icon="dashicons:welcome-learn-more" size={18} color={colors.buttonColor} style={{ marginRight: 8 }} />
            <Text style={[typography.styles.body, styles.statText, { color: colors.text }]}>
              {t('chapters.learned', 'Learned')}: {chapterProgress.learned}
            </Text>
          </View>
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
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.ordinal === nextProps.item.ordinal &&
    prevProps.editMode === nextProps.editMode &&
    prevProps.colors === nextProps.colors &&
    prevProps.progressMap === nextProps.progressMap
  );
});

export default function ChaptersScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { deck } = route.params || {};
  const { showSuccess, showError } = useSnackbarHelpers();
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [distLoading, setDistLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [progressMap, setProgressMap] = useState(new Map());
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sadece butonun basılı olup olmadığını takip ediyoruz (0 = boşta, 1 = basılı)
  const isPressed = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const listBottomInset = useListBottomInset();

  const addChapterAnimatedStyle = useAnimatedStyle(() => {
    // Apple tarzı pürüzsüz yay ayarları (Hafif kütle, yüksek sönümleme)
    const springConfig = { mass: 0.5, damping: 30, stiffness: 400 };

    return {
      // Basıldığında %8 küçül (0.92), bırakıldığında 1'e dön
      transform: [
        { scale: withSpring(isPressed.value ? 0.92 : 1, springConfig) }
      ],
      // Basıldığında hafifçe şeffaflaş (0.85), bırakıldığında tam opak ol (1)
      opacity: withSpring(isPressed.value ? 0.85 : 1, springConfig),
    };
  });

  // currentUserId'yi erken yükle (header için)
  useEffect(() => {
    setCurrentUserId(userId || null);
    // Owner can edit only if deck is not shared (treat undefined as not shared)
    if (deck?.user_id) {
      setIsOwner(userId === deck.user_id && !deck.is_shared);
    }
  }, [userId, deck?.user_id, deck?.is_shared]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deck?.id) { setLoading(false); return; }
      try {
        if (!mounted) return;
        const data = await listChapters(deck.id);
        if (mounted) {
          setChapters(data);
          // Load progress for all chapters (+unassigned) in one RPC call
          if (userId) {
            const progress = await getDeckChaptersProgressRpc(deck.id, userId);
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
  }, [deck?.id, userId]);

  // Refresh progress when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (!deck?.id || !currentUserId || chapters.length === 0) return;
      try {
        const progress = await getDeckChaptersProgressRpc(deck.id, currentUserId);
        setProgressMap(progress);
      } catch (e) {
        // noop
      }
    });
    return unsubscribe;
  }, [navigation, deck?.id, currentUserId, chapters]);

  const onRefresh = useCallback(async () => {
    if (!deck?.id) return;
    setRefreshing(true);
    try {
      const data = await listChapters(deck.id, true);
      setChapters(data);
      if (userId) {
        const progress = await getDeckChaptersProgressRpc(deck.id, userId, true);
        setProgressMap(progress);
      }
    } finally {
      setRefreshing(false);
    }
  }, [deck?.id, userId]);

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
          <View style={{  }}>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic('light');
              requestAnimationFrame(() => {
                setEditMode(!editMode);
              });
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Iconify
              icon={editMode ? "mingcute:close-fill" : "lucide:edit"}
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
          </View>
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
    if (chapters.length >= 40) {
      showError(t('chapters.limitReached', 'Maksimum 30 bölüm oluşturabilirsin.'));
      return;
    }
    try {
      const next = await getNextOrdinal(deck.id);
      const inserted = await createChapter(deck.id, next, currentUserId);
      // Ordinal'e göre sırala, aynı ordinal'de yeni eklenenler altta (created_at ascending)
      const updatedChapters = [...chapters, inserted].sort((a, b) => {
        if (a.ordinal !== b.ordinal) return a.ordinal - b.ordinal;
        return new Date(a.created_at) - new Date(b.created_at);
      });
      setChapters(updatedChapters);
      // Refresh progress for new chapter
      if (currentUserId) {
        const progress = await getDeckChaptersProgressRpc(deck.id, currentUserId);
        setProgressMap(progress);
      }
    } catch (e) {
      showError(e.message || t('chapters.createError', 'Bölüm eklenemedi.'));
    }
  };

  const handleDeleteChapter = useCallback(async (chapterId) => {
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
              await deleteChapter(chapterId, deck.id, currentUserId);
              // Ordinal'leri yeniden düzenle (1, 2, 3, ... şeklinde)
              await reorderChapterOrdinals(deck.id);
              // Bölümleri yeniden yükle (ordinal'ler güncellenmiş olacak)
              const updatedChapters = await listChapters(deck.id);
              setChapters(updatedChapters);
              // Progress'i güncelle
              if (currentUserId) {
                const progress = await getDeckChaptersProgressRpc(deck.id, currentUserId);
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
  }, [deck?.id, currentUserId, t, showSuccess, showError]);

  const handleChapterPress = useCallback((item) => {
    navigation.navigate('ChapterCards', { chapter: { id: item.id, name: `${t('chapters.chapter', 'Bölüm')} ${item.ordinal}` }, deck });
  }, [navigation, deck, t]);

  const renderChapterItem = useCallback(({ item }) => (
    <MemoizedChapterItem
      item={item}
      progressMap={progressMap}
      editMode={editMode}
      colors={colors}
      onPress={handleChapterPress}
      onDelete={handleDeleteChapter}
      t={t}
    />
  ), [progressMap, editMode, colors, handleChapterPress, handleDeleteChapter, t]);

  const listHeader = useCallback(() => {
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
              <Iconify icon="mage:inbox-star" size={24} color={colors.buttonColor} style={{ marginRight: 8 }} />
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
  }, [progressMap, navigation, deck, colors, t]);

  const listEmpty = useCallback(() => (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyState}>
        <Iconify
          icon="streamline-freehand:plugin-jigsaw-puzzle"
          size={120}
          color={colors.muted}
          style={{ marginBottom: 12, opacity: 0.5 }}
        />
        <Text style={[styles.emptyStateText, typography.styles.body, { color: colors.subtext, opacity: 0.6 }]}>
          {t('chapters.noChaptersDesc', 'Bu destede henüz bölüm oluşturulmamış.')}
        </Text>
      </View>
    </View>
  ), [colors, t]);

  // Yükleniyor ekranı
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <LottieView source={require('../../assets/flexloader.json')} speed={1.1} autoPlay loop style={{ width: 160, height: 160 }} />
      <LottieView source={require('../../assets/loaders.json')} speed={1.1} autoPlay loop style={{ width: 100, height: 100, marginTop: -65 }} />
    </View>
  );

  return (
    <View style={[styles.bgGradient, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: 'transparent' }]}>
        {loading ? (
          renderLoading()
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={chapters.length === 0 ? { padding: 16, flexGrow: 1 } : { padding: 16, paddingBottom: listBottomInset + styles.fab.height + 16 } /* clears the FAB */}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              windowSize={7}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              ListHeaderComponent={listHeader}
              ListEmptyComponent={listEmpty}
              renderItem={renderChapterItem}
            />

          </View>
        )}
        {!loading && isOwner && (
          <AnimatedPressable
            style={[styles.fab, addChapterAnimatedStyle, { bottom: insets.bottom + 24 }]} // Modern stili bağladık
            onPressIn={() => {
              isPressed.value = 1; // Basıldı animasyonunu tetikle
            }}
            onPressOut={() => {
              isPressed.value = 0; // Bırakıldı animasyonunu tetikle
            }}
            onPress={() => {
              triggerHaptic('light'); // Hafif titreşim (modern hissi çok güçlendirir)
              requestAnimationFrame(() => {
                handleAddChapter();
              });
            }}
          >
            <LinearGradient
              colors={['#F98A21', '#FF6B35']}
              locations={[0, 0.99]}
              style={styles.fabGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Iconify icon="ic:round-plus" size={30} color="#FFFFFF" />
            </LinearGradient>
          </AnimatedPressable>
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
    paddingHorizontal: 25,
    minHeight: 400,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -150,
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
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 70,
    height: 70,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: '#F98A21', // solid base under the gradient: cheap iOS shadow
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
    marginTop: -120,
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

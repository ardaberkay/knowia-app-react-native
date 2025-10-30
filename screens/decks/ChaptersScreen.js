import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../theme/theme';
import { typography } from '../../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { listChapters, distributeUnassignedEvenly, getNextOrdinal, createChapter, deleteChapter } from '../../services/ChapterService';
import CreateButton from '../../components/tools/CreateButton';
import { supabase } from '../../lib/supabase';

export default function ChaptersScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { deck } = route.params || {};
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [distLoading, setDistLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!deck?.id) { setLoading(false); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        // Owner can edit only if deck is not shared (treat undefined as not shared)
        if (mounted) setIsOwner(user?.id === deck.user_id && !deck.is_shared);
        const data = await listChapters(deck.id);
        if (mounted) setChapters(data);
      } catch (e) {
        // noop
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [deck?.id]);

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
      setChapters([...chapters, inserted].sort((a,b) => {
        if (a.ordinal !== b.ordinal) return a.ordinal - b.ordinal;
        return new Date(a.created_at) - new Date(b.created_at);
      }));
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('chapters.createError', 'Bölüm eklenemedi.'));
    }
  };

  return (
    <View style={[styles.bgGradient, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
        {loading ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="progress-clock" size={48} color={colors.muted} />
            <Text style={[styles.emptyStateText, typography.styles.body, { color: colors.subtext }]}> {t('common.loading', 'Yükleniyor...')} </Text>
          </View>
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
                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.buttonColor} style={{ marginRight: 8 }} />
                    <Text style={[typography.styles.body, { color: colors.text }]}>{t('chapters.unassigned', 'Atanmamış')}</Text>
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
              renderItem={({ item, index }) => (
                <View style={[styles.chapterRow, { borderColor: colors.border }]}>
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
                        flex: 1,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="book" size={20} color={colors.buttonColor} style={{ marginRight: 8 }} />
                    <Text style={[typography.styles.body, { color: colors.text }]}>Bölüm {index + 1}</Text>
                  </TouchableOpacity>
                  {isOwner && (
                    <TouchableOpacity
                      onPress={async () => {
                        Alert.alert(
                          t('common.warning', 'Uyarı'),
                          t('chapters.deleteConfirm', 'Bu bölümü silmek istiyor musun? Kartlar atanmamışa taşınacaktır.'),
                          [
                            { text: t('common.no', 'Hayır'), style: 'cancel' },
                            { text: t('common.yes', 'Evet'), style: 'destructive', onPress: async () => {
                                try { await deleteChapter(item.id); setChapters(chapters.filter(c => c.id !== item.id)); }
                                catch(e){ Alert.alert(t('common.error','Hata'), e.message || t('chapters.deleteError','Silinemedi')); }
                              } }
                          ]
                        );
                      }}
                      style={[styles.deleteBtn, { borderColor: colors.border }]}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={20} color={'#E74C3C'} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
            
          </View>
        )}
        {isOwner && (
          <TouchableOpacity
            onPress={handleAddChapter}
            activeOpacity={0.85}
            style={[styles.fab, { backgroundColor: colors.buttonColor }]}
          >
            <MaterialCommunityIcons name="plus" size={28} color={colors.buttonText} />
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 28,
    borderWidth: 1,
    marginBottom: 14,
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 5,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});

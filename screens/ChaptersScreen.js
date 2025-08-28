import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../theme/theme';
import { typography } from '../theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { listChapters, distributeUnassignedEvenly, getNextOrdinal, createChapter, deleteChapter } from '../services/ChapterService';
import { supabase } from '../lib/supabase';

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
      setChapters([...chapters, inserted].sort((a,b) => a.ordinal - b.ordinal));
    } catch (e) {
      Alert.alert(t('common.error', 'Hata'), e.message || t('chapters.createError', 'Bölüm eklenemedi.'));
    }
  };

  return (
    <LinearGradient
      colors={colors.deckGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bgGradient}
    >
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
            {isOwner && (
              <TouchableOpacity onPress={handleAddChapter} style={[styles.actionBtn, { backgroundColor: colors.buttonColor, marginTop: 16 }]}>
                <MaterialCommunityIcons name="plus" size={20} color={colors.buttonText} style={{ marginRight: 8 }} />
                <Text style={[typography.styles.button, { color: colors.buttonText }]}>{t('chapters.add', 'Bölüm Ekle')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {isOwner && (
              <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                <TouchableOpacity onPress={handleAddChapter} style={[styles.actionBtn, { backgroundColor: colors.buttonColor }]}>
                  <MaterialCommunityIcons name="plus" size={20} color={colors.buttonText} style={{ marginRight: 8 }} />
                  <Text style={[typography.styles.button, { color: colors.buttonText }]}>{t('chapters.add', 'Bölüm Ekle')}</Text>
                </TouchableOpacity>
              </View>
            )}
            <FlatList
              data={chapters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListHeaderComponent={(
                <TouchableOpacity
                  onPress={() => navigation.navigate('ChapterCards', { chapter: { id: null, name: t('chapters.unassigned', 'Atanmamış') }, deck })}
                  activeOpacity={0.8}
                  style={[styles.chapterItem, { borderColor: colors.border, backgroundColor: colors.blurView }]}
                >
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.buttonColor} style={{ marginRight: 8 }} />
                  <Text style={[typography.styles.body, { color: colors.text }]}>{t('chapters.unassigned', 'Atanmamış')}</Text>
                </TouchableOpacity>
              )}
              renderItem={({ item }) => (
                <View style={[styles.chapterRow, { borderColor: colors.border }]}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ChapterCards', { chapter: { id: item.id, name: `Bölüm ${item.ordinal}` }, deck })}
                    activeOpacity={0.8}
                    style={[styles.chapterItem, { borderColor: 'transparent', backgroundColor: colors.blurView, flex: 1 }]}
                  >
                    <MaterialCommunityIcons name="book" size={20} color={colors.buttonColor} style={{ marginRight: 8 }} />
                    <Text style={[typography.styles.body, { color: colors.text }]}>Bölüm {item.ordinal}</Text>
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
            {isOwner && (
              <View style={{ padding: 16 }}>
                <TouchableOpacity disabled={distLoading} onPress={handleDistribute} style={[styles.distributeBtn, { backgroundColor: colors.buttonColor, opacity: distLoading ? 0.7 : 1 }]}>
                  <MaterialCommunityIcons name="shuffle-variant" size={20} color={colors.buttonText} style={{ marginRight: 8 }} />
                  <Text style={[typography.styles.button, { color: colors.buttonText }]}>{t('chapters.distribute', 'Sihirbazla dağıt')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
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
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  distributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
});

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../theme/typography';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';

export default function DeckEditScreen() {
  const route = useRoute();
  const { deck } = route.params;
  const [name, setName] = useState(deck.name || '');
  const [toName, setToName] = useState(deck.to_name || '');
  const [description, setDescription] = useState(deck.description || '');
  const [isShared, setIsShared] = useState(deck.is_shared || false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const resetForm = () => {
    setName(deck.name || '');
    setToName(deck.to_name || '');
    setDescription(deck.description || '');
    setIsShared(deck.is_shared || false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("common.error", "Hata"), t("common.requiredNameDeck", "Deste adı zorunludur."));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('decks')
        .update({
          name: name.trim(),
          to_name: toName.trim() || null,
          description: description.trim() || null,
          is_shared: isShared,
        })
        .eq('id', deck.id);
      if (error) throw error;
      Alert.alert(t("common.success", "Başarılı"), t("common.successDeckMessage", "Deste güncellendi."));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t("common.error", "Hata"), e.message || t("common.errorDeckMessage", "Deste güncellenemedi."));
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = () => {
    Alert.alert(
      t("create.shareDetails", "Toplulukta Paylaş Ayrıntıları"),
      t("create.shareDetailsText", "Bu deste toplulukla paylaşıldığında diğer kullanıcılar tarafından da görüntülenebilir ve kullanılabilir. Paylaşımı istediğin zaman kapatabilirsin.")
    );
  };

  return (
    <LinearGradient
      colors={colors.deckGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.formContainer}>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="book" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("create.name", "Deste Adı")} *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {borderColor: colors.border, color: colors.text}]}
              placeholder={t("create.nameExam", "Örn: İngilizce")}
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="swap-horizontal" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("create.toName", "Karşılığı")}</Text>
              <Text style={[styles.optional, typography.styles.caption, { color: colors.muted }]}> {t("create.optional", "opsiyonel")}</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {borderColor: colors.border, color: colors.text}]}
              placeholder={t("create.toNameExam", "Örn: Türkçe")}
              placeholderTextColor={colors.muted}
              value={toName}
              onChangeText={setToName}
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="document-text" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("create.description", "Açıklama")}</Text>
              <Text style={[styles.optional, typography.styles.caption, { color: colors.muted }]}> {t("create.optional", "opsiyonel")}</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, { height: 120, textAlignVertical: 'top', borderColor: colors.border, color: colors.text }]}
              placeholder={t("create.descriptionExam", "Deste hakkında açıklama...")}
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>
          <View style={[styles.inputCard, styles.switchCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.switchRow}>
              <View style={styles.labelRow}>
                <Ionicons name="people" size={20} color="#F98A21" style={styles.labelIcon} />
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t("create.isShared", "Toplulukla paylaş")}</Text>
              </View>
              <Switch
                value={isShared}
                onValueChange={setIsShared}
                trackColor={{ false: colors.border, true: colors.secondary }}
                thumbColor={isShared ? colors.secondary : colors.card}
              />
            </View>
          </View>
          <View style={styles.detailsRow}>
            <TouchableOpacity onPress={handleShowDetails} activeOpacity={0.7}>
              <Text style={[styles.detailsText, typography.styles.link, { color: colors.secondary }]}>{t("create.details", "Ayrıntılar")}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRowModern}>
            <TouchableOpacity
              style={[
                styles.favButtonModern,
                { flex: 1, minWidth: 0, marginRight: 10 },
                loading && { opacity: 0.7 }
              ]}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={[styles.favButtonTextModern, typography.styles.button, { color: '#F98A21' }]}>{t("create.removeChanges", "Geri Al")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.startButtonModern,
                { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.buttonBorder || 'transparent' },
                loading && { opacity: 0.7 }
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={[styles.startButtonTextModern, typography.styles.button, { color: '#fff' }]}>{loading ? t("create.saving", "Kaydediliyor...") : t("create.save", "Kaydet")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 16,
    paddingTop: 16,
  },
  inputCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  switchCard: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelIcon: {
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 0,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonRowModern: {
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 18,
    marginTop: 110,
  },
  favButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingHorizontal: 5,
  },
  favButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonModern: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F98A21',
    borderRadius: 10,
    paddingVertical: 13,
    justifyContent: 'center',
    shadowColor: '#F98A21',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsRow: {
    alignSelf: 'flex-end',
    paddingRight: 10,
    marginTop: -10,
  },
  detailsText: {
    textDecorationLine: 'underline',
  },
  optional: {
    marginLeft: 4,
    alignSelf: 'flex-end',
  },
}); 
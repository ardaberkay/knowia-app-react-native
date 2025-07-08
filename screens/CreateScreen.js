import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/theme';
import { useTranslation } from 'react-i18next';

export default function CreateScreen() {
  const [name, setName] = useState('');
  const [toName, setToName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { t } = useTranslation();

  const resetForm = () => {
    setName('');
    setToName('');
    setDescription('');
    setIsShared(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Deste adı zorunludur.');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('decks')
        .insert({
          user_id: user.id,
          name: name.trim(),
          to_name: toName.trim() || null,
          description: description.trim() || null,
          is_shared: isShared,
          is_admin_created: false,
          card_count: 0,
          is_started: false,
        })
        .select()
        .single();
      if (error) throw error;
      resetForm();
      navigation.navigate('DeckDetail', { deck: data });
    } catch (e) {
      Alert.alert('Hata', e.message || 'Deste oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = () => {
    Alert.alert(
      t('create.shareDetails', 'Toplulukta Paylaşma Ayrıntıları'),
      t('create.shareDetailsText', 'Bu deste toplulukla paylaşıldığında diğer kullanıcılar tarafından da görüntülenebilir ve kullanılabilir. Paylaşımı istediğin zaman kapatabilirsin.')
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
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="book" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t('create.name', 'Deste Adı')} *</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text}]}
              placeholder={t('create.nameExam', 'Örn: İngilizce')}
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="swap-horizontal" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t('create.toName', 'Karşılığı')}</Text>
              <Text style={[styles.optional, typography.styles.caption, { color: colors.muted }]}> ({t('create.optional', 'opsiyonel')})</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, {color: colors.text}]}
              placeholder={t('create.toNameExam', 'Örn: Türkçe')}
              placeholderTextColor={colors.muted}
              value={toName}
              onChangeText={setToName}
            />
          </View>
          <View style={[styles.inputCard, {backgroundColor: colors.blurView, shadowColor: colors.blurViewShadow}]}>
            <View style={styles.labelRow}>
              <Ionicons name="document-text" size={20} color="#F98A21" style={styles.labelIcon} />
              <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t('create.description', 'Açıklama')}</Text>
              <Text style={[styles.optional, typography.styles.caption, { color: colors.muted }]}> ({t('create.optional', 'opsiyonel')})</Text>
            </View>
            <TextInput
              style={[styles.input, typography.styles.body, { height: 120, textAlignVertical: 'top', color: colors.text}]}
              placeholder={t('create.descriptionExam', 'Deste hakkında açıklama...')}
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
                <Text style={[styles.label, typography.styles.body, {color: colors.text}]}>{t('create.isShared', 'Toplulukla paylaş')}</Text>
              </View>
              <Switch
                value={isShared}
                onValueChange={setIsShared}
                trackColor={{ false: '#e0e0e0', true: '#5AA3F0' }}
                thumbColor={isShared ? colors.secondary : '#f4f3f4'}
              />
            </View>
          </View>
          <View style={styles.detailsRow}>
            <TouchableOpacity onPress={handleShowDetails} activeOpacity={0.7}>
              <Text style={[styles.detailsText, typography.styles.link, { color: colors.secondary }]}>{t('create.details', 'Ayrıntılar')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.buttonRowModern}>
            <TouchableOpacity
              style={[styles.favButtonModern]}
              onPress={resetForm}
              disabled={loading}
            >
              <Text style={[styles.favButtonTextModern, typography.styles.button]}>{t('create.removeChanges', 'Geri Al')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.startButtonModern, loading && { opacity: 0.7 }]}
              onPress={handleCreate}
              disabled={loading}
            >
              <Text style={[styles.startButtonTextModern, typography.styles.button]}>{loading ? t('create.creating', 'Oluşturuluyor...') : t('create.create', 'Oluştur')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    borderColor: '#eee',
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
    marginTop: 70,
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
    paddingHorizontal: 18,
  },
  favButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F98A21',
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
    marginLeft: 8,
  },
  startButtonTextModern: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/AppText';
import { useTheme } from '../../theme/theme';
import { useTranslation } from 'react-i18next';

export default function BadgeText({ required }) {
    const { colors } = useTheme();
    const { t } = useTranslation();

    return (
        required ? (
            <View style={[styles.badgeContainer, { backgroundColor: colors.error + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.error }]}>{t('create.required', 'Zorunlu')}</Text>
            </View>
        ) : (
            <View style={[styles.badgeContainer, { backgroundColor: colors.optional + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.optional }]}>{t('create.optional', 'Opsiyonel')}</Text>
            </View>
        )
    );
}

const styles = StyleSheet.create({
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
});
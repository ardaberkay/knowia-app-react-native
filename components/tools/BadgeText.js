import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
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
        paddingHorizontal: scale(8),
        paddingVertical: verticalScale(4),
        borderRadius: moderateScale(6),
    },
    badgeText: {
        fontSize: moderateScale(11),
        fontWeight: '600',
    },
});
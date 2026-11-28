import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from './AppImage';
import { Text } from './AppText';
import { LinearGradient } from 'expo-linear-gradient';
import { triggerHaptic } from '../../lib/hapticManager';
import { useTranslation } from 'react-i18next';
import { fontSizes, fonts } from '../../theme/typography';
import { getCategoryColors } from '../../theme/colors';
import { getCategoryIcon, ICONS } from '../../theme/icons';
import PhosphorIcon from './PhosphorIcon';


const CommunityDeckCard = ({
    deck,
    colors,
    typography,
    onPress,
    onToggleFavorite,
    isFavorite = false,
}) => {
    const [localFavorite, setLocalFavorite] = useState(isFavorite);
    const chapter_count = deck.chapter_count;
    const { t } = useTranslation();
    useEffect(() => {
        setLocalFavorite(isFavorite);
    }, [isFavorite]);

    const handleFavoritePress = () => {
        triggerHaptic('medium');
        setLocalFavorite(!localFavorite);
        onToggleFavorite?.(deck.id);
    };

    const gradientColors = getCategoryColors(colors, deck.categories?.sort_order);
    const categoryIcon = getCategoryIcon(deck.categories?.sort_order);

    const username = deck.is_admin_created ? 'Knowia' : deck.profiles?.username || 'Kullanıcı';
    const sectionCount = deck.section_count || deck.sections_count || 0;

    return (
        <TouchableOpacity
            onPress={() => onPress(deck)}
            activeOpacity={0.85}
            style={[styles.touchableWrapper, { backgroundColor: gradientColors[0] }]}
        >
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.cardGradient}
            >
                {/* SOL: Şeffaf Rozet ve İkon */}
                <View style={styles.iconBadgeContainer}>
                    <PhosphorIcon
                        icon={categoryIcon}
                        size={34}
                        color="#FFFFFF"
                    />
                </View>

                {/* SAĞ: İçerik Alanı */}
                <View style={styles.contentContainer}>
                    {/* Üst Satır: Kullanıcı ve Favori */}
                    <View style={styles.topRow}>
                        <View style={styles.userBlock}>
                            <Image
                                source={
                                    deck.is_admin_created
                                        ? require('../../assets/images/app_icon.png')
                                        : deck.profiles?.image_url
                                            ? { uri: deck.profiles.image_url }
                                            : require('../../assets/images/avatar_default.webp')
                                }
                                style={styles.userAvatar}
                            />
                            <Text style={styles.usernameText}
                                numberOfLines={1}
                                ellipsizeMode="tail">
                                {username}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.favoriteButton, { backgroundColor: colors.iconBackground }]}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            onPress={handleFavoritePress}
                            activeOpacity={0.7}
                        >
                            <PhosphorIcon
                                icon={localFavorite ? ICONS.favorite : ICONS.favoriteOff}
                                size={20}
                                color={localFavorite ? '#F98A21' : colors.headText}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Title + subtitle (to_name); without a to_name the name may take 2 lines */}
                    <View style={styles.titleBlock}>
                        <Text
                            style={styles.mainTitle}
                            numberOfLines={deck.to_name ? 1 : 2}
                            ellipsizeMode="tail"
                        >
                            {deck.name}
                        </Text>
                        {deck.to_name ? (
                            <Text style={styles.subTitle} numberOfLines={1} ellipsizeMode="tail">
                                {deck.to_name}
                            </Text>
                        ) : null}
                    </View>

                    {/* Alt Satır: Metrikler */}
                    <View style={styles.bottomRow}>
                        <PhosphorIcon
                            icon={ICONS.stack}
                            size={13}
                            color="rgba(255, 255, 255, 0.9)"
                            style={{ marginRight: 4 }}
                        />
                        <Text
                            style={[typography.styles.subhead, styles.metaText]}
                            numberOfLines={1}
                        >
                            {deck.card_count || 0} {t('home.cardCount', 'Kart')}
                        </Text>
                        <View style={styles.metaDot} />
                        <PhosphorIcon
                            icon={ICONS.chapter}
                            size={13}
                            color="rgba(255, 255, 255, 0.9)"
                            style={{ marginRight: 4 }}
                        />
                        <Text
                            style={[typography.styles.subhead, styles.metaText]}
                            numberOfLines={1}
                        >
                            {chapter_count || 0} {t('home.chapterCount', 'Bölüm')}
                        </Text>
                    </View>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    touchableWrapper: {
        // Solid rounded base (same radius as the gradient) so iOS computes the
        // shadow from the bounds, not from the gradient's pixels.
        borderRadius: 20,
        marginHorizontal: 8,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
    },
    cardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        height: 120,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    iconBadgeContainer: {
        width: 60,
        height: 60,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        marginLeft: 12,
        height: '100%',
        justifyContent: 'space-between',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    userBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
        transform: [{ translateY: -2 }],
    },
    userAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    usernameText: {
        flexShrink: 1,
        fontFamily: fonts.semibold,
        fontSize: fontSizes.caption,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    favoriteButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },

    // --- Başlık Stilleri ---
    titleBlock: {
        width: '100%',
        gap: 2,
    },
    mainTitle: {
        fontSize: fontSizes.body,
        fontFamily: fonts.bold,
        color: '#FFFFFF',
        lineHeight: 20,
    },
    subTitle: {
        fontSize: fontSizes.subhead,
        fontFamily: fonts.medium,
        color: 'rgba(255, 255, 255, 0.75)',
        lineHeight: 18,
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        marginHorizontal: 8,
        marginBottom: 6,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 32,
        paddingBottom: 2,
    },
    metaText: {
        fontSize: fontSizes.micro,
        fontFamily: fonts.semibold,
        color: 'rgba(255, 255, 255, 0.9)',
    },
});

export default React.memo(CommunityDeckCard);
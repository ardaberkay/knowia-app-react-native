import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Iconify } from 'react-native-iconify';
import { scale, moderateScale, verticalScale } from '../../lib/scaling';
import { triggerHaptic } from '../../lib/hapticManager';
import { useTranslation } from 'react-i18next';


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

    const getCategoryColors = (sortOrder) => {
        if (colors?.categoryColors && colors.categoryColors[sortOrder]) {
            return colors.categoryColors[sortOrder];
        }
        return ['#3F5E78', '#203345'];
    };

    const getCategoryIcon = (sortOrder) => {
        const icons = {
            1: 'hugeicons:language-skill',
            2: 'clarity:atom-solid',
            3: 'mdi:math-compass',
            4: 'game-icons:tied-scroll',
            5: 'arcticons:world-geography-alt',
            6: 'map:museum',
            7: 'ic:outline-self-improvement',
            8: 'streamline-ultimate:module-puzzle-2-bold',
        };
        return icons[sortOrder] || 'material-symbols:category';
    };

    const gradientColors = getCategoryColors(deck.categories?.sort_order);
    const categoryIcon = getCategoryIcon(deck.categories?.sort_order);

    const username = deck.is_admin_created ? 'Knowia' : deck.profiles?.username || 'Kullanıcı';
    const sectionCount = deck.section_count || deck.sections_count || 0;

    return (
        <TouchableOpacity
            onPress={() => onPress(deck)}
            activeOpacity={0.85}
            style={styles.touchableWrapper}
        >
            <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.cardGradient}
            >
                {/* SOL: Şeffaf Rozet ve İkon */}
                <View style={styles.iconBadgeContainer}>
                    <Iconify
                        icon={categoryIcon}
                        size={scale(34)}
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
                                        ? require('../../assets/app_icon.png')
                                        : deck.profiles?.image_url
                                            ? { uri: deck.profiles.image_url }
                                            : require('../../assets/avatar_default.webp')
                                }
                                style={styles.userAvatar}
                            />
                            <Text style={[typography.styles.caption, styles.usernameText]}
                                numberOfLines={2}
                                ellipsizeMode="tail">
                                {username}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={{
                                backgroundColor: colors.iconBackground,
                                padding: moderateScale(5),
                                borderRadius: 999,
                                zIndex: 10,
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            onPress={handleFavoritePress}
                            activeOpacity={0.7}
                        >
                            <Iconify
                                icon={localFavorite ? 'solar:heart-bold' : 'solar:heart-broken'}
                                size={moderateScale(20)}
                                color={localFavorite ? '#F98A21' : colors.headText}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Orta Satır: MaskedView Tabanlı Başlık Alanı */}
                    <View style={styles.titleBlock}>
                        <Text
                            style={[typography.styles.h3, styles.mainTitle]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {deck.name}
                        </Text>

                        {deck.to_name && (
                            <>
                                <Text style={styles.separatorDot}></Text>

                                <Text
                                    style={[typography.styles.h3, styles.subTitle]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {deck.to_name}
                                </Text>
                            </>
                        )}
                    </View>

                    {/* Alt Satır: Metrikler */}
                    <View style={styles.bottomRow}>
                        <Iconify
                            icon="ri:stack-fill"
                            size={moderateScale(13)}
                            color="rgba(255, 255, 255, 0.9)"
                            style={{ marginRight: scale(4) }}
                        />
                        <Text
                            style={[typography.styles.caption, styles.metaText]}
                            numberOfLines={1}
                        >
                            {deck.card_count || 0} {t('home.cardCount', 'Kart')}
                        </Text>
                        <Text style={[styles.separatorDot, { width: 4, height: 4 }]}></Text>
                        <Iconify
                            icon="streamline-flex:module-puzzle-2"
                            size={moderateScale(13)}
                            color="rgba(255, 255, 255, 0.9)"
                            style={{ marginRight: scale(4) }}
                        />
                        <Text
                            style={[typography.styles.caption, styles.metaText]}
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
        marginHorizontal: scale(8),
        marginBottom: verticalScale(10),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 3,
    },
    cardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: moderateScale(20),
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(7),
        height: verticalScale(120),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    iconBadgeContainer: {
        width: scale(60),
        height: scale(60),
        borderRadius: moderateScale(14),
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        flex: 1,
        marginLeft: scale(12),
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
        marginRight: scale(10),
    },
    userAvatar: {
        width: scale(24),
        height: scale(24),
        borderRadius: moderateScale(99),
        marginRight: scale(5),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    usernameText: {
        fontWeight: '700',
        fontSize: moderateScale(13),
        color: 'rgba(255, 255, 255, 0.75)',
    },

    // --- Başlık Stilleri ---
    titleBlock: {
        height: verticalScale(22),
        justifyContent: 'center',
        width: '100%',
        transform: [{ translateY: -verticalScale(5) }],

    },
    dualTitleWrapper: {
        flexDirection: 'flex-start',
        width: '100%',
    },
    mainTitle: {
        fontSize: moderateScale(15),
        fontWeight: '700',
        color: '#FFFFFF',
    },
    subTitle: {
        fontSize: moderateScale(15),
        fontWeight: '500',
        color: '#FFFFFF',
    },
    separatorDot: {
        width: scale(28),
        height: StyleSheet.hairlineWidth,
        borderRadius: scale(2),
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        marginHorizontal: scale(8),
        marginTop: scale(2)
    },

    // --- Fade Maske Stili ---
    maskGradient: {
        flex: 1,
        width: '100%',
        height: '100%',
    },

    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: moderateScale(11),
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
    },
});

export default React.memo(CommunityDeckCard);
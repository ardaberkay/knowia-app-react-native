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

const ROW_HEIGHT = 24; // creator row and counts row

/**
 * Wide deck card (community decks). Left: category tile. Right: creator on
 * top, counts at the bottom (both 24 high), the title centred in the space
 * between (name, to_name under it; without a to_name the name may take two
 * lines). The heart is pinned to the top-right corner and takes no room in
 * the layout.
 */
const CommunityDeckCard = ({
    deck,
    colors,
    onPress,
    onToggleFavorite,
    isFavorite = false,
}) => {
    const { t } = useTranslation();
    const [localFavorite, setLocalFavorite] = useState(isFavorite);
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
    const username = deck.is_admin_created ? 'Knowia' : deck.profiles?.username || t('common.user', 'Kullanıcı');

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
                {/* left: category tile */}
                <View style={styles.iconBadgeContainer}>
                    <PhosphorIcon icon={categoryIcon} size={34} color="#FFFFFF" />
                </View>

                <View style={styles.contentContainer}>
                    {/* top: creator */}
                    <View style={styles.userRow}>
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
                        <Text style={styles.usernameText} numberOfLines={1} ellipsizeMode="tail">
                            {username}
                        </Text>
                    </View>

                    {/* middle: title + subtitle (to_name) */}
                    <View style={styles.titleArea}>
                        <Text style={styles.mainTitle} numberOfLines={deck.to_name ? 1 : 2} ellipsizeMode="tail">
                            {deck.name}
                        </Text>
                        {deck.to_name ? (
                            <Text style={styles.subTitle} numberOfLines={1} ellipsizeMode="tail">
                                {deck.to_name}
                            </Text>
                        ) : null}
                    </View>

                    {/* bottom: counts */}
                    <View style={styles.bottomRow}>
                        <PhosphorIcon icon={ICONS.stack} size={13} color="rgba(255, 255, 255, 0.9)" style={{ marginRight: 4 }} />
                        <Text style={styles.metaText} numberOfLines={1}>
                            {deck.card_count || 0} {t('home.cardCount', 'Kart')}
                        </Text>
                        <View style={styles.metaDot} />
                        <PhosphorIcon icon={ICONS.chapter} size={13} color="rgba(255, 255, 255, 0.9)" style={{ marginRight: 4 }} />
                        <Text style={styles.metaText} numberOfLines={1}>
                            {deck.chapter_count || 0} {t('home.chapterCount', 'Bölüm')}
                        </Text>
                    </View>
                </View>

                {/* heart: pinned to the corner, outside the layout */}
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
        paddingVertical: 12,
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
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: ROW_HEIGHT,
        paddingRight: 40, // room for the pinned heart
    },
    userAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
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
    // the space between the two rows; the title is centred in it
    titleArea: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
        paddingRight: 8,
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
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: ROW_HEIGHT,
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        marginHorizontal: 8,
    },
    metaText: {
        fontSize: fontSizes.micro,
        fontFamily: fonts.semibold,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    favoriteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
});

export default React.memo(CommunityDeckCard);

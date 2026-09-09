import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scale, verticalScale, moderateScale } from '../../lib/scaling';
import { useTheme } from '../../theme/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function CommunityDeckSkeleton() {
    const { isDarkMode } = useTheme();
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1200, // Standart skeleton hızı (1.2 saniye)
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        animation.start();
        return () => animation.stop();
    }, [shimmerAnim]);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
    });

    const bgColor = isDarkMode ? '#1E1E1E' : '#EAEAEA';
    const lineColor = isDarkMode ? '#2A2A2A' : '#DCDCDC';

    const shimmerColors = isDarkMode
        ? ['transparent', 'rgba(255, 255, 255, 0.06)', 'transparent']
        : ['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent'];

    // Taşıyıcı kutu: İçindeki shimmer efektini kesin olarak sınırlar
    const ShimmerBox = ({ style, borderRadius = 0 }) => (
        <View style={[style, { backgroundColor: lineColor, borderRadius, overflow: 'hidden' }]}>
            <Animated.View
                style={[
                    StyleSheet.absoluteFillObject,
                    {
                        transform: [{ translateX }],
                    },
                ]}
            >
                <LinearGradient
                    colors={shimmerColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1, width: SCREEN_WIDTH }}
                />
            </Animated.View>
        </View>
    );

    return (
        <View style={styles.touchableWrapper}>
            <View style={[styles.cardGradient, { backgroundColor: bgColor }]}>
                
                {/* SOL: Rozet / İkon Skeleton */}
                <ShimmerBox
                    style={styles.iconBadgeContainer}
                    borderRadius={moderateScale(14)}
                />

                {/* SAĞ: İçerik Alanı Skeleton */}
                <View style={styles.contentContainer}>
                    
                    {/* Üst Satır: Profil Avatar, Kullanıcı Adı ve Favori Butonu */}
                    <View style={styles.topRow}>
                        <View style={styles.userBlock}>
                            <ShimmerBox
                                style={styles.userAvatar}
                                borderRadius={moderateScale(99)}
                            />

                            <ShimmerBox
                                style={styles.usernameSkeleton}
                                borderRadius={moderateScale(6)}
                            />
                        </View>

                        {/* Favori Butonu */}
                        <ShimmerBox
                            style={styles.favoriteButtonSkeleton}
                            borderRadius={999}
                        />
                    </View>

                    {/* Orta Satır: Başlık Alanı Skeleton */}
                    <View style={styles.titleBlock}>
                        <ShimmerBox
                            style={styles.titleSkeleton}
                            borderRadius={moderateScale(6)}
                        />
                    </View>

                    {/* Alt Satır: Metrikler */}
                    <View style={styles.bottomRow}>
                        <ShimmerBox
                            style={styles.metricSkeletonShort}
                            borderRadius={moderateScale(4)}
                        />

                        <View style={[styles.separatorDot, { backgroundColor: lineColor }]} />

                        <ShimmerBox
                            style={styles.metricSkeletonLong}
                            borderRadius={moderateScale(4)}
                        />
                    </View>

                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    touchableWrapper: {
        width: '100%',
        paddingHorizontal: scale(16),
        marginBottom: verticalScale(12),
    },
    cardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: moderateScale(20),
        paddingHorizontal: scale(12),
        paddingVertical: verticalScale(10),
        height: verticalScale(100),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    iconBadgeContainer: {
        width: scale(52),
        height: scale(52),
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
        width: scale(22),
        height: scale(22),
        marginRight: scale(6),
    },
    usernameSkeleton: {
        width: scale(80),
        height: verticalScale(12),
    },
    favoriteButtonSkeleton: {
        width: scale(28),
        height: scale(28),
    },
    titleBlock: {
        height: verticalScale(22),
        justifyContent: 'center',
        width: '100%',
    },
    titleSkeleton: {
        width: '70%',
        height: verticalScale(16),
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metricSkeletonShort: {
        width: scale(45),
        height: verticalScale(12),
    },
    metricSkeletonLong: {
        width: scale(55),
        height: verticalScale(12),
    },
    separatorDot: {
        width: scale(4),
        height: scale(4),
        borderRadius: scale(2),
        marginHorizontal: scale(8),
    },
});
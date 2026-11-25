import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/theme';


export default function CommunityDeckSkeleton() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
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
                    borderRadius={14}
                />

                {/* SAĞ: İçerik Alanı Skeleton */}
                <View style={styles.contentContainer}>
                    
                    {/* Üst Satır: Profil Avatar, Kullanıcı Adı ve Favori Butonu */}
                    <View style={styles.topRow}>
                        <View style={styles.userBlock}>
                            <ShimmerBox
                                style={styles.userAvatar}
                                borderRadius={99}
                            />

                            <ShimmerBox
                                style={styles.usernameSkeleton}
                                borderRadius={6}
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
                            borderRadius={6}
                        />
                    </View>

                    {/* Alt Satır: Metrikler */}
                    <View style={styles.bottomRow}>
                        <ShimmerBox
                            style={styles.metricSkeletonShort}
                            borderRadius={4}
                        />

                        <View style={[styles.separatorDot, { backgroundColor: lineColor }]} />

                        <ShimmerBox
                            style={styles.metricSkeletonLong}
                            borderRadius={4}
                        />
                    </View>

                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    touchableWrapper: {
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
        paddingVertical: 7,
        height: 120,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },

    iconBadgeContainer: {
        width: 60,
        height: 60,
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
    },

    userAvatar: {
        width: 24,
        height: 24,
        marginRight: 5,
    },

    usernameSkeleton: {
        width: 80,
        height: 12,
    },

    favoriteButtonSkeleton: {
        width: 30,
        height: 30,
    },

    titleBlock: {
        height: 22,
        justifyContent: 'center',
        width: '100%',
        transform: [{ translateY: -5 }],
    },

    titleSkeleton: {
        width: '70%',
        height: 16,
    },

    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    metricSkeletonShort: {
        width: 45,
        height: 12,
    },

    metricSkeletonLong: {
        width: 55,
        height: 12,
    },

    separatorDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginHorizontal: 8,
    },
});
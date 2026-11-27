import React, { createContext, useContext, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme/layout';

// The native tab bar (iOS UITabBar / Android BottomNavigationView) floats over
// the tab screens, but it doesn't report its height to JS. react-native-screens'
// native SafeAreaView does know it: inside a tab screen its bottom inset is the
// tab bar plus the home indicator / Android nav bar. withTabBarInset puts an
// empty one at the bottom of each tab screen, measures it and shares the value.
// null = not measured yet, undefined = not inside a tab screen.
const TabBarInsetContext = createContext(undefined);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  probe: { position: 'absolute', left: 0, right: 0, bottom: 0, flex: 0 },
});

export function withTabBarInset(Screen) {
  function TabScreen(props) {
    const [inset, setInset] = useState(null);
    return (
      <TabBarInsetContext.Provider value={inset}>
        <View style={styles.fill}>
          <Screen {...props} />
          <SafeAreaView
            edges={{ bottom: true }}
            pointerEvents="none"
            style={styles.probe}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (__DEV__) console.log('[TabBarInset] measured bottom inset:', h);
              setInset(h);
            }}
          />
        </View>
      </TabBarInsetContext.Provider>
    );
  }
  TabScreen.displayName = `withTabBarInset(${Screen.displayName || Screen.name || 'Screen'})`;
  return TabScreen;
}

// Bottom padding for a scrollable list/page so its last item can scroll clear
// of what sits at the bottom: the native tab bar on tab screens, otherwise the
// home indicator / Android nav bar. `extra` adds room for anything else
// floating there, e.g. a FAB.
// automaticInsets: the list uses contentInsetAdjustmentBehavior="automatic"
// (under a see-through header, SCROLL_EDGE_HEADER), which on iOS already adds
// the bottom safe area; it is left out here so it isn't counted twice.
// iOS UITabBar height above the home indicator. Floor for the measured value:
// on device the probe came back without the tab bar (content ended up behind
// it), so tab screens never get less than this plus the system inset.
const IOS_TAB_BAR_HEIGHT = 49;

export function useListBottomInset(extra = 0, { automaticInsets = false } = {}) {
  const tabInset = useContext(TabBarInsetContext);
  const insets = useSafeAreaInsets();
  const inTabs = tabInset !== undefined;
  const tabFloor = Platform.OS === 'ios' ? insets.bottom + IOS_TAB_BAR_HEIGHT : 0;
  const bottom = inTabs ? Math.max(tabInset ?? insets.bottom, tabFloor) : insets.bottom;
  const systemAdded = !inTabs && automaticInsets && Platform.OS === 'ios' ? insets.bottom : 0;
  return Math.max(0, bottom - systemAdded) + spacing.xl + extra;
}

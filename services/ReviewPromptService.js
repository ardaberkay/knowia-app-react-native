import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const REVIEW_MILESTONES = [15, 60, 120, 200];
const REVIEW_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

// TODO: App Store Connect'ten numeric Apple app id girin.
const IOS_APP_ID = '6761316889';
const ANDROID_PACKAGE_NAME = 'com.arda.knowia';

const getStorageKey = (userId) => `review_prompt_state_${userId}`;

const getDefaultState = () => ({
  promptedMilestones: [],
  lastPromptAt: 0,
});

const loadPromptState = async (userId) => {
  if (!userId) return getDefaultState();
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return {
      promptedMilestones: Array.isArray(parsed?.promptedMilestones) ? parsed.promptedMilestones : [],
      lastPromptAt: Number(parsed?.lastPromptAt || 0),
    };
  } catch (error) {
    console.error('Failed to load review prompt state:', error);
    return getDefaultState();
  }
};

const savePromptState = async (userId, state) => {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save review prompt state:', error);
  }
};

const getNextMilestone = (totalLearned, promptedMilestones) => {
  return REVIEW_MILESTONES.find((milestone) => (
    totalLearned >= milestone && !promptedMilestones.includes(milestone)
  ));
};

const openStoreListingFallback = async () => {
  try {
    const url = Platform.OS === 'ios'
      ? (IOS_APP_ID ? `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review` : null)
      : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;
    if (!url) return false;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('Store fallback open failed:', error);
    return false;
  }
};

export const maybePromptForReview = async ({ userId, totalLearned, allowFallback = true }) => {
  if (!userId || typeof totalLearned !== 'number') return false;

  const state = await loadPromptState(userId);
  const nextMilestone = getNextMilestone(totalLearned, state.promptedMilestones);
  if (!nextMilestone) return false;

  const now = Date.now();
  const inCooldown = state.lastPromptAt > 0 && (now - state.lastPromptAt) < REVIEW_COOLDOWN_MS;
  if (inCooldown) return false;

  let prompted = false;
  try {
    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      await StoreReview.requestReview();
      prompted = true;
    } else if (allowFallback) {
      prompted = await openStoreListingFallback();
    }
  } catch (error) {
    console.error('Native review request failed:', error);
    if (allowFallback) {
      prompted = await openStoreListingFallback();
    }
  }

  if (!prompted) return false;

  const nextState = {
    promptedMilestones: [...state.promptedMilestones, nextMilestone],
    lastPromptAt: now,
  };
  await savePromptState(userId, nextState);
  return true;
};

export const getReviewMilestones = () => REVIEW_MILESTONES;

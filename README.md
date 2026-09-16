# Knowia

**Knowia** is a mobile learning platform built with React Native and Expo, combining flashcards, spaced repetition, swipe-based learning, and structured learning content.

Users can create their own learning materials, explore community-created decks, and study their cards through a personalized review system.

## Features

### 📚 Learning

* Flashcard-based learning
* Spaced repetition system (SRS)
* Customizable learning schedule
* User-defined review intervals
* Swipe-based learning experience
* Card retry and review system
* Learning progress tracking
* Chapter-based study sessions

### 🗂️ Deck Management

* Create personal flashcard decks
* Organize cards into chapters
* Study a deck chapter by chapter for smaller study sessions
* Add and manage cards
* Bulk card import using CSV
* Ready-made system decks
* Community-created decks
* Deck categorization

### 🔍 Discover

The Discover section allows users to explore and find learning content through categorized and curated decks.

Users can browse different types of content and discover new decks based on categories and popularity.

### 👥 Community

Knowia supports user-generated learning content, allowing users to create and share decks with the community.

Community decks can be categorized and explored through the Discover section.

### 🔐 Authentication & User Management

* Email and password authentication
* Google authentication
* Apple authentication
* User profiles
* Learning progress tracking
* User and content reporting
* User and content categorization

### 🌍 Localization

Knowia supports multiple languages through an internationalized interface.

Currently supported languages include:

* Turkish
* English
* German
* French
* Spanish
* Portuguese

### 🔔 Notifications

Knowia includes notification support to help users return to the app and maintain their learning routine.

## Learning System

Knowia uses a spaced repetition system to schedule cards based on the user's learning progress.

Cards move through different learning states and are scheduled for future review using progressively longer intervals.

The swipe-based learning interface provides a fast way to review cards, mark them as learned, or retry cards that need additional practice.

## Deck & Chapter Structure

A deck can be divided into multiple chapters to make larger collections of cards easier to study in smaller sessions.

Chapters do not represent separate subjects or topics. Instead, they allow users to divide an existing deck into manageable sections and study those sections independently.

**Deck → Chapter → Cards**

For example, a large vocabulary deck can contain hundreds of cards and be divided into several chapters so that users can focus on a smaller number of cards during each study session.

## Tech Stack

### Mobile

* **React Native**
* **Expo**
* **JavaScript**
* **React Navigation**
* **React Native Reanimated**
* **React Native Gesture Handler**
* **React Native Paper**
* **Gorhom Bottom Sheet**
* **Lottie**

### Backend

* **Supabase**
* **PostgreSQL**
* **Supabase Authentication**
* **Row Level Security (RLS)**
* **Database Functions / RPC**

### Storage & Data

* **AsyncStorage**
* CSV-based bulk card import
* Server-side learning progress tracking

### Internationalization

* **i18next**
* **react-i18next**
* **expo-localization**

## Architecture

The application uses **Supabase** as its backend for authentication, database operations, user data, learning progress, and community content.

Row Level Security policies are used to control access to user-owned and shared data.

The React Native application communicates with Supabase through its JavaScript client and manages local session-related data using AsyncStorage.

## Project Goals

Knowia aims to provide a flexible learning environment that combines the effectiveness of spaced repetition with a modern mobile learning experience.

The project is designed to support different types of learning content rather than being limited to language vocabulary.

## Platform

* Android
* iOS

## Status

Knowia is an actively developed project.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { EditorScreen } from '../features/editor/EditorScreen';
import { RecordScreen } from '../features/record/RecordScreen';
import { ReviewScreen } from '../features/review/ReviewScreen';
import { TrimScreen } from '../features/trim/TrimScreen';
import { GalleryScreen } from '../features/gallery/GalleryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Library"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Library" component={LibraryScreen} />
      <Stack.Screen name="Editor" component={EditorScreen} />
      <Stack.Screen
        name="Record"
        component={RecordScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Trim" component={TrimScreen} />
      <Stack.Screen name="Gallery" component={GalleryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { EditorScreen } from '../features/editor/EditorScreen';
import { Placeholder } from '../components/Placeholder';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Screens are swapped from placeholder → real as each phase lands.
const RecordScreen = () => <Placeholder title="Record" dark />;
const ReviewScreen = () => <Placeholder title="Take Review" dark />;
const TrimScreen = () => <Placeholder title="Trim" dark />;
const GalleryScreen = () => <Placeholder title="Takes" />;
const SettingsScreen = () => <Placeholder title="Settings" />;

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

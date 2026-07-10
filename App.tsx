import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import {
  useFonts,
  Lexend_400Regular,
  Lexend_600SemiBold,
} from '@expo-google-fonts/lexend';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  // Load the real Lexend prompter typeface at runtime. ExpoFont is already in the
  // native build, so no rebuild is needed; this is non-blocking — the prompter
  // falls back to the system face until Lexend finishes loading.
  useFonts({ Lexend_400Regular, Lexend_600SemiBold });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

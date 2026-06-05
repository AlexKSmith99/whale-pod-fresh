import { Text } from 'react-native';

// Enable long-press text selection / copy globally for every <Text> in the app.
// <TextInput> is selectable by default; <Text> is not, which is why static text
// in the UI could not be copied. Setting defaultProps applies app-wide without
// touching individual components.
//
// Imported for its side effect (App.tsx imports this module at startup).
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.selectable = true;

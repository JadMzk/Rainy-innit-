import { Platform, StyleSheet } from 'react-native';

export const theme = {
  bg: '#07111F',
  bgDeep: '#040910',
  card: '#12263F',
  cardAlt: '#18324F',
  line: 'rgba(196, 214, 236, 0.16)',
  text: '#F4F1EA',
  muted: '#9AABBE',
  faint: '#6E8196',
  rain: '#8EBEFF',
  postbox: '#D71920',
  sage: '#8FCB9B',
  sageInk: '#D7F3DE',
  amber: '#E7B15A',
  cream: '#F3EDE2',
  ink: '#102033',
};

export const font = {
  display: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia, "Iowan Old Style", Palatino, serif',
  }),
  body: Platform.select({
    ios: 'Avenir Next',
    android: 'sans-serif',
    default: '"Avenir Next", "Segoe UI", sans-serif',
  }),
};

export const frame = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: theme.bgDeep,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: theme.bg,
  },
});

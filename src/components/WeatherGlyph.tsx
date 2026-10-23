import Svg, { Circle, Line, Path } from 'react-native-svg';

import { isRainCode, isSnowCode } from '../services/weatherCodes';
import { theme } from '../theme/theme';

type Kind = 'clear' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'heavy' | 'snow' | 'thunder';

function kindFor(code: number): Kind {
  if (code === 0 || code === 1) return 'clear';
  if (code === 45 || code === 48) return 'fog';
  if (code === 95 || code === 96 || code === 99) return 'thunder';
  if (isSnowCode(code)) return 'snow';
  if (code === 65 || code === 67 || code === 82 || code === 55) return 'heavy';
  if (code === 51 || code === 53 || code === 56 || code === 57) return 'drizzle';
  if (isRainCode(code)) return 'rain';
  return 'cloud';
}

export function WeatherGlyph({
  code,
  size = 28,
  color = theme.rain,
}: {
  code: number;
  size?: number;
  color?: string;
}) {
  const kind = kindFor(code);
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden>
      {kind === 'clear' ? <Circle cx="16" cy="16" r="6" fill={theme.amber} /> : null}
      {kind === 'clear' ? (
        <Path
          d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2 2M22.5 22.5l2 2M24.5 7.5l-2 2M9.5 22.5l-2 2"
          stroke={theme.amber}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : null}
      {kind !== 'clear' ? (
        <Path
          d="M10 20h13a5 5 0 0 0 .4-10 7 7 0 0 0-13.2-1.6A4.2 4.2 0 0 0 10 20z"
          fill={theme.cream}
          opacity={0.92}
        />
      ) : null}
      {kind === 'fog' ? (
        <Path d="M8 24h16M9 27h12" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      ) : null}
      {kind === 'drizzle'
        ? [12, 16, 20].map((x) => <Line key={x} x1={x} y1="22" x2={x - 1} y2="26" stroke={color} strokeWidth="1.4" strokeLinecap="round" />)
        : null}
      {kind === 'rain'
        ? [12, 16, 20].map((x) => <Line key={x} x1={x} y1="22" x2={x - 2} y2="28" stroke={color} strokeWidth="1.6" strokeLinecap="round" />)
        : null}
      {kind === 'heavy'
        ? [11, 15, 19, 23].map((x) => (
            <Line key={x} x1={x} y1="22" x2={x - 2.4} y2="29" stroke={theme.postbox} strokeWidth="1.8" strokeLinecap="round" />
          ))
        : null}
      {kind === 'snow' ? <Path d="M16 22v7M13 24.5l6 3M19 24.5l-6 3" stroke={theme.cream} strokeWidth="1.4" strokeLinecap="round" /> : null}
      {kind === 'thunder' ? <Path d="M17 21l-4 6h4l-1 5 6-7h-4l2-4z" fill={theme.amber} /> : null}
    </Svg>
  );
}

export function UmbrellaMark({ size = 72, tone = 'take' }: { size?: number; tone?: 'take' | 'fine' | 'dodgy' }) {
  const canopy = tone === 'fine' ? theme.sage : tone === 'dodgy' ? theme.amber : theme.postbox;
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Path d="M10 34c0-16 12-26 26-26s26 10 26 26H10z" fill={canopy} />
      <Path d="M36 8c-4 8-6 16-6 26h12c0-10-2-18-6-26z" fill={theme.cream} opacity={0.28} />
      <Path d="M36 34v18" stroke={theme.cream} strokeWidth="3" strokeLinecap="round" />
      <Path d="M36 52c6 0 8 4 8 6" stroke={theme.cream} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Circle cx="36" cy="10" r="2.4" fill={theme.cream} />
    </Svg>
  );
}

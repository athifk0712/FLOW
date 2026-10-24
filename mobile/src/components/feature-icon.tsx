import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

// The hen's palette from the celengan ayam mark, plus the chick's yellow. The same in light and dark themes, like the
// companion, so the icons stay recognisable.
const C = {
  white: '#FFFFFF',
  chick: '#FFD45C',
  beak: '#F08A24',
  coral: '#E0604A',
  honey: '#E9A23B',
  coinRim: '#C9851F',
  mint: '#8FC9BE',
  teal: '#0F5C55',
  ink: '#1C2B2A',
};

export type FeatureIconName =
  | 'wallet'
  | 'budget'
  | 'goal'
  | 'debt'
  | 'asset'
  | 'recurring'
  | 'category'
  | 'habit'
  | 'report'
  | 'reflection'
  | 'checkin'
  | 'settings';

/** Each feature's circle colour; neighbours in the grid differ in hue and lightness. */
const BACKGROUND: Record<FeatureIconName, string> = {
  wallet: '#0F5C55',
  budget: '#E9A23B',
  goal: '#E0604A',
  debt: '#3D7FC1',
  asset: '#2E8B6A',
  recurring: '#7A5AC7',
  category: '#C7772A',
  habit: '#3E9E8F',
  report: '#34508C',
  reflection: '#D45D8C',
  checkin: '#2A8FA8',
  settings: '#5E6B69',
};

/** The little chick from the Flowku mark, centred on 0,0 and about 12 units wide; place it with `transform`. */
function Chick({ transform }: { transform: string }) {
  return (
    <G transform={transform}>
      <Circle cx={-2.3} cy={-5.6} r={1.8} fill={C.coral} />
      <Circle cx={0} cy={-6.6} r={2} fill={C.coral} />
      <Circle cx={2.3} cy={-5.6} r={1.8} fill={C.coral} />
      <Circle r={6} fill={C.chick} />
      <Path d="M5.2 -0.6 L9 1 L5.2 2.6 Z" fill={C.beak} />
      <Circle cx={2.2} cy={-1.2} r={1.15} fill={C.ink} />
      <Circle cx={0.2} cy={2.3} r={1.4} fill={C.coral} opacity={0.45} />
    </G>
  );
}

function Coin({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r} fill={C.chick} />
      <Circle cx={cx} cy={cy} r={r * 0.65} fill="none" stroke={C.coinRim} strokeWidth={1} />
    </>
  );
}

const GEAR =
  'M32.1 21.1 L35.2 21.3 L35.2 26.7 L32.1 26.9 L31.8 27.7 L33.8 30 L30 33.8 L27.7 31.8 L26.9 32.1 L26.7 35.2 ' +
  'L21.3 35.2 L21.1 32.1 L20.3 31.8 L18 33.8 L14.2 30 L16.2 27.7 L15.9 26.9 L12.8 26.7 L12.8 21.3 L15.9 21.1 ' +
  'L16.2 20.3 L14.2 18 L18 14.2 L20.3 16.2 L21.1 15.9 L21.3 12.8 L26.7 12.8 L26.9 15.9 L27.7 16.2 L30 14.2 ' +
  'L33.8 18 L31.8 20.3 Z';

/** What sits on each circle: a white object for the feature, and the chick somewhere in or around it. */
function Glyph({ name, bg }: { name: FeatureIconName; bg: string }) {
  switch (name) {
    case 'wallet':
      return (
        <>
          <Chick transform="translate(30 15.5) scale(0.95)" />
          <Rect x={9.5} y={17.5} width={29} height={19} rx={4.5} fill={C.white} />
          <Rect x={27} y={23.5} width={11.5} height={7.5} rx={3} fill={C.honey} />
          <Circle cx={31} cy={27.25} r={1.6} fill={C.white} />
        </>
      );
    case 'budget':
      return (
        <>
          <Circle cx={24} cy={25} r={11} fill="none" stroke={C.white} strokeWidth={6} />
          <Path d="M24 14 A11 11 0 0 1 34.34 28.76" fill="none" stroke={C.teal} strokeWidth={6} />
          <Chick transform="translate(23.5 26.2) scale(0.6)" />
        </>
      );
    case 'goal':
      return (
        <>
          <Path d="M34 8 V20" stroke={C.white} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M34.6 8.2 L41 10.8 L34.6 13.4 Z" fill={C.chick} />
          <Chick transform="translate(23 22) scale(1.05)" />
          <Path
            d="M12.5 27 L16 24.2 L19.5 27.6 L23.5 24.2 L27.5 27.6 L31 24.2 L34.5 27 C34.5 34.5 30 39.5 23.5 39.5 C17 39.5 12.5 34.5 12.5 27 Z"
            fill={C.white}
          />
        </>
      );
    case 'debt':
      return (
        <>
          <Path d="M17 15 Q24 10 31 15" fill="none" stroke={C.white} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M28.6 15.6 L32.2 15.8 L30.8 12.6 Z" fill={C.white} />
          <Path d="M31 35 Q24 40 17 35" fill="none" stroke={C.white} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M19.4 34.4 L15.8 34.2 L17.2 37.4 Z" fill={C.white} />
          <Chick transform="translate(13.5 25) scale(0.85)" />
          <Chick transform="translate(34.5 25) scale(-0.85 0.85)" />
          <Coin cx={24} cy={26} r={4} />
        </>
      );
    case 'asset':
      // The celengan ayam itself, with a coin above its slot.
      return (
        <>
          <Path d="M11.5 28.5 C8 26.5 7.5 22 9.5 19.5 C11 22 12.5 24 14 25.5 Z" fill={C.mint} />
          <Circle cx={33.5} cy={11.4} r={1.6} fill={C.coral} />
          <Circle cx={35.6} cy={10.5} r={1.8} fill={C.coral} />
          <Circle cx={37.6} cy={11.4} r={1.6} fill={C.coral} />
          <Path
            d="M11 30 C11 23 17 20.5 24 20.5 C27 20.5 29 18.5 30 16 C31 13 33.5 12 35.5 12.3 C39 12.8 40.5 16 39.3 19.3 C38.5 21.5 37 22.5 37 26 C37 32.5 32 36.5 24 36.5 C16.5 36.5 11 34 11 30 Z"
            fill={C.white}
          />
          <Path d="M39.4 16.2 L42.6 17.5 L39.4 18.8 Z" fill={C.honey} />
          <Circle cx={36.6} cy={15.6} r={1.15} fill={C.ink} />
          <Path
            d="M17 27.5 C19 24.5 24 24.5 27 27 C25.5 30.5 21.5 32 18.5 31.5 C17 30.5 16.6 29 17 27.5 Z"
            fill={C.coral}
          />
          <Rect x={20} y={21.6} width={7} height={1.8} rx={0.9} fill={C.ink} opacity={0.8} />
          <Coin cx={23.5} cy={14.5} r={4.4} />
        </>
      );
    case 'recurring':
      return (
        <>
          <Path d="M12.6 20 A12 12 0 0 1 33.6 16.4" fill="none" stroke={C.white} strokeWidth={3} strokeLinecap="round" />
          <Path d="M30.4 17.8 L37 14.8 L36.6 21.6 Z" fill={C.white} />
          <Path d="M35.4 28 A12 12 0 0 1 14.4 31.6" fill="none" stroke={C.white} strokeWidth={3} strokeLinecap="round" />
          <Path d="M17.6 30.2 L11 33.2 L11.4 26.4 Z" fill={C.white} />
          <Chick transform="translate(23.5 25) scale(0.72)" />
        </>
      );
    case 'category':
      return (
        <>
          <Rect x={12} y={12} width={10.5} height={10.5} rx={3} fill={C.white} />
          <Rect x={25.5} y={12} width={10.5} height={10.5} rx={3} fill={C.white} />
          <Rect x={12} y={25.5} width={10.5} height={10.5} rx={3} fill={C.white} />
          <Chick transform="translate(30.2 31.6) scale(0.82)" />
        </>
      );
    case 'habit':
      return (
        <>
          <Path d="M21 30 V20.5" stroke={C.white} strokeWidth={2} strokeLinecap="round" />
          <Path d="M21 25 C16 25 13.5 21 14 17.5 C18.5 17.5 21 21 21 25 Z" fill={C.white} />
          <Path d="M21 22.5 C21 18 24 15 28.5 15.5 C28.5 20 25.5 22.5 21 22.5 Z" fill={C.white} />
          <Path d="M13.5 29.5 H28.5 L26.5 38 H15.5 Z" fill={C.chick} />
          <Rect x={12.5} y={28.5} width={17} height={3.5} rx={1.5} fill={C.honey} />
          <Chick transform="translate(34 31.5) scale(0.82)" />
        </>
      );
    case 'report':
      return (
        <>
          <Rect x={11.5} y={29} width={6.5} height={9} rx={1.6} fill={C.white} />
          <Rect x={20.75} y={24} width={6.5} height={14} rx={1.6} fill={C.white} />
          <Rect x={30} y={20} width={6.5} height={18} rx={1.6} fill={C.chick} />
          <Chick transform="translate(32.6 13.6) scale(0.82)" />
        </>
      );
    case 'reflection':
      return (
        <>
          <Rect x={17} y={9.5} width={23} height={17} rx={5} fill={C.white} />
          <Path d="M21.5 25 L19.5 30.5 L27 25.5 Z" fill={C.white} />
          <Path
            d="M28.5 22.6 C23.8 19.4 24.2 14.6 26.7 14.6 C27.6 14.6 28.2 15.2 28.5 16 C28.8 15.2 29.4 14.6 30.3 14.6 C32.8 14.6 33.2 19.4 28.5 22.6 Z"
            fill={C.coral}
          />
          <Chick transform="translate(15.5 33.5) scale(0.95)" />
        </>
      );
    case 'checkin':
      return (
        <>
          <Rect x={12} y={12.5} width={21} height={26} rx={3.5} fill={C.white} />
          <Rect x={17.5} y={10} width={10} height={5} rx={2} fill={C.chick} />
          {[21.5, 29.5].map((y) => (
            <G key={y}>
              <Path
                d={`M16 ${y} L18.2 ${y + 2.2} L21.8 ${y - 1.5}`}
                fill="none"
                stroke={bg}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path d={`M24 ${y + 0.5} H29`} stroke={bg} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
            </G>
          ))}
          <Chick transform="translate(35 32) scale(0.85)" />
        </>
      );
    case 'settings':
      return (
        <>
          <Path d={GEAR} fill={C.white} />
          <Circle cx={24} cy={24} r={6.8} fill={bg} />
          <Chick transform="translate(23.4 25) scale(0.62)" />
        </>
      );
  }
}

/** A feature's round, colourful icon with the Flowku chick in it, like the service grid of a super app. */
export function FeatureIcon({ name, size = 46 }: { name: FeatureIconName; size?: number }) {
  const bg = BACKGROUND[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={24} fill={bg} />
      <Glyph name={name} bg={bg} />
    </Svg>
  );
}

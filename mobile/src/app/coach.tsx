import { useLocalSearchParams } from 'expo-router';

import { CoachChat } from '@/components/coach-chat';

// Modal: "Cek harian" by default, the free chat with ?mode=chat (e.g. from a reminder or a link).
export default function CoachScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  return <CoachChat coachMode={params.mode === 'chat' ? 'chat' : 'check'} />;
}

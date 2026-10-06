import { CoachChat } from '@/components/coach-chat';

// The Flowku tab: the AI companion's free chat, in the middle of the tab bar.
export default function FlowkuTab() {
  return <CoachChat coachMode="chat" embedded />;
}

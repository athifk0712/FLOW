import AppTabs from '@/components/app-tabs';
import { useCurrency } from '@/lib/money';

export default function AppLayout() {
  // Amounts are formatted at render time; remounting the tabs on a currency change redraws them all.
  // Modals mount fresh each time, and one open above the tabs (settings, onboarding) stays open.
  const currency = useCurrency();
  return <AppTabs key={currency.code} />;
}

import { AccountSection } from '@/components/settings/account-section';
import { NameSection } from '@/components/settings/name-section';
import { SubScreen } from '@/components/sub-screen';

export default function ProfileScreen() {
  return (
    <SubScreen title="Profil">
      <NameSection />
      <AccountSection />
    </SubScreen>
  );
}

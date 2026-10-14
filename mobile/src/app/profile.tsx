import { AccountSection } from '@/components/settings/account-section';
import { AvatarSection } from '@/components/settings/avatar-section';
import { NameSection } from '@/components/settings/name-section';
import { SubScreen } from '@/components/sub-screen';

export default function ProfileScreen() {
  return (
    <SubScreen title="Profil">
      <AvatarSection />
      <NameSection />
      <AccountSection />
    </SubScreen>
  );
}

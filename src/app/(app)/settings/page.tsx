import { SettingsForm } from "@/components/settings/settings-form";
import { getSettingsAction } from "@/server/actions/settings";

export default async function SettingsPage() {
  const settings = await getSettingsAction();
  return <SettingsForm initialSettings={settings} />;
}

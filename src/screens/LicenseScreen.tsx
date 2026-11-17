// Port of LicenseTab in Views/LicenseAndSaved.swift (without the Debug Developer screen).

import { AppearanceMenu } from "../ui/Menu";
import { Screen } from "../ui/Screen";
import { LicenseContent } from "./license/LicenseContent";

export default function LicenseScreen() {
  return (
    <Screen title="License" titleDisplay="large" leading={<AppearanceMenu />}>
      <LicenseContent />
    </Screen>
  );
}

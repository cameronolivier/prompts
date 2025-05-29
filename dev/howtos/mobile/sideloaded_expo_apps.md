Quick-start (standalone, no Metro)
	1.	Prebuild your Expo app into a native iOS project:

expo prebuild --platform ios


	2.	Open the generated workspace in Xcode:

open ios/YourApp.xcworkspace


	3.	In Xcode’s Signing & Capabilities for your app target:
	•	Set Team to your personal Apple ID (free account)
	•	Leave Code Signing Style on Automatic
	4.	Switch the Scheme to Release and plug in your device.
	5.	Hit Run ▶️—Xcode will embed the JS bundle and sideload a signed .app to your device.

⸻

CLI-only alternative
If you prefer terminal:
	1.	Install ios-deploy (if you haven’t):

npm install -g ios-deploy


	2.	From your project root:

expo prebuild --platform ios
cd ios
xcodebuild \
  -workspace YourApp.xcworkspace \
  -scheme YourApp \
  -configuration Release \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=YOUR_TEAM_ID \
  BUILD_DIR=build
ios-deploy --bundle build/Release-iphoneos/YourApp.app



Replace YOUR_TEAM_ID with the 10-character ID found in Xcode > Preferences > Accounts.

⸻

Notes & gotchas
	•	Free provisioning limits apps to 7 days before re-signing.
	•	You must rebuild/re-run after the profile expires.
	•	No Metro bundler is involved once you build in Release mode.

⸻

You wanted to sideload a fully standalone Expo-managed app onto your device using only a free Apple ID (valid for ~7 days) without relying on the Metro server—and the steps above show both the Xcode GUI and pure-CLI approaches.
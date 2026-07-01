# MusicDNA Flutter App

This directory contains the in-repo Flutter mobile app for MusicDNA.

## Foundation Scope

The initial foundation includes:

- compile-time environment config via `--dart-define-from-file`
- Supabase bootstrap
- shared MusicDNA API client seam
- auth repository and Cubit foundation
- app routing shell for auth, onboarding, and session flows

## Local Run

1. Copy one of the example config files:

```bash
cp config/dev.example.json config/dev.local.json
```

2. Fill in the real values for:

- `API_BASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

3. Run the app:

```bash
flutter run --dart-define-from-file=config/dev.local.json
```

## Release Prep

Recommended release pattern:

1. Bump `version:` in `pubspec.yaml`
2. Build from a clean branch/worktree
3. Use explicit production config:

```bash
flutter pub get
flutter analyze
flutter test
flutter build ios --release --dart-define-from-file=config/prod.local.json
```

4. Archive from `ios/Runner.xcworkspace`

## Expected Mobile Flow

The shared backend contract for the app lives in:

- [`/Users/rastakit/tga-workspace/idea-builder/docs/musicdna/mobile_flutter_api_contract.md`](/Users/rastakit/tga-workspace/idea-builder/docs/musicdna/mobile_flutter_api_contract.md)

Current intended onboarding/session path:

1. `supabase_flutter.signUp()`
2. `POST /api/v1/onboarding/opener`
3. `POST /api/v1/session`
4. `GET /api/v1/session/:id/next`
5. `POST /api/v1/session/:id/choice`
6. `POST /api/v1/session/:id/reveal`

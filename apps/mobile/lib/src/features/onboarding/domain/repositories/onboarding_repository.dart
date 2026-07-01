import '../entities/started_music_session.dart';

abstract class OnboardingRepository {
  Future<StartedMusicSession> submitOpeningThree({required List<String> songs});
}

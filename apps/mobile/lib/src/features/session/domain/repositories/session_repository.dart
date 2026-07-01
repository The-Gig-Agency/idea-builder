import '../entities/session_pairing.dart';

abstract class SessionRepository {
  Future<SessionRoundState> fetchNextPairing({required String sessionId});

  Future<SessionChoiceFeedback> submitChoice({
    required String sessionId,
    required String pairingId,
    required String chosenSongId,
    required int msToDecide,
  });
}

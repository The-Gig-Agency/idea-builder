import '../../domain/entities/session_pairing.dart';
import '../../domain/repositories/session_repository.dart';
import '../datasources/session_remote_data_source.dart';

class SessionRepositoryImpl implements SessionRepository {
  SessionRepositoryImpl(this._remoteDataSource);

  final SessionRemoteDataSource _remoteDataSource;

  @override
  Future<SessionRoundState> fetchNextPairing({
    required String sessionId,
  }) async {
    final response = await _remoteDataSource.fetchNextPairing(
      sessionId: sessionId,
    );
    return _mapNextResponse(sessionId: sessionId, response: response);
  }

  @override
  Future<SessionChoiceFeedback> submitChoice({
    required String sessionId,
    required String pairingId,
    required String chosenSongId,
    required int msToDecide,
  }) async {
    final response = await _remoteDataSource.submitChoice(
      sessionId: sessionId,
      pairingId: pairingId,
      chosenSongId: chosenSongId,
      msToDecide: msToDecide,
    );

    return SessionChoiceFeedback(
      verdict: response['verdict'] as String? ?? '',
      why: response['why'] as String? ?? '',
      hesitation: response['hesitation'] as String?,
      dimension: response['dim'] as String?,
      delta: _readDouble(response['delta']),
    );
  }

  SessionRoundState _mapNextResponse({
    required String sessionId,
    required Map<String, dynamic> response,
  }) {
    final pairing = response['pairing'];
    return SessionRoundState(
      sessionId: sessionId,
      round: _readInt(response['round']),
      confidence: _readDouble(response['confidence']),
      done: response['done'] == true,
      pairing: pairing is Map<String, dynamic> ? _mapPairing(pairing) : null,
    );
  }

  SessionPairing _mapPairing(Map<String, dynamic> pairing) {
    return SessionPairing(
      id: (pairing['pairing_id'] ?? pairing['id']) as String,
      songA: _mapSong(pairing['song_a'] as Map<String, dynamic>),
      songB: _mapSong(pairing['song_b'] as Map<String, dynamic>),
      tests: _readStringList(pairing['tests']),
      hypothesis: pairing['hypothesis'] as String?,
      whyGood: pairing['why_good'] as String?,
      diagnosticWeight: _readIntOrNull(pairing['diagnostic_weight']),
      lane: pairing['lane'] as String?,
    );
  }

  SessionPairingSong _mapSong(Map<String, dynamic> song) {
    return SessionPairingSong(
      id: song['id'] as String,
      title: song['title'] as String,
      artist: song['artist'] as String,
      year: _readIntOrNull(song['year']),
      primaryLane: song['primary_lane'] as String?,
      catalogLane: song['lane'] as String?,
    );
  }

  List<String> _readStringList(Object? value) {
    if (value is List) {
      return value.whereType<String>().toList(growable: false);
    }
    return const <String>[];
  }

  int _readInt(Object? value) {
    if (value is num) {
      return value.toInt();
    }
    return 0;
  }

  int? _readIntOrNull(Object? value) {
    if (value is num) {
      return value.toInt();
    }
    return null;
  }

  double _readDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    return 0;
  }
}

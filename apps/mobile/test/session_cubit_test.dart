import 'package:flutter_test/flutter_test.dart';
import 'package:music_dna/src/features/onboarding/domain/entities/started_music_session.dart';
import 'package:music_dna/src/features/session/domain/entities/session_pairing.dart';
import 'package:music_dna/src/features/session/domain/repositories/session_repository.dart';
import 'package:music_dna/src/features/session/presentation/cubit/session_cubit.dart';

void main() {
  group('SessionCubit', () {
    test('loads the first pairing from the started session', () async {
      final repository = FakeSessionRepository(
        nextPairings: <SessionRoundState>[
          SessionRoundState(
            sessionId: 'session-1',
            round: 1,
            confidence: 0.42,
            done: false,
            pairing: SessionPairing(
              id: 'pairing-1',
              songA: const SessionPairingSong(
                id: 'song-a',
                title: 'Song A',
                artist: 'Artist A',
              ),
              songB: const SessionPairingSong(
                id: 'song-b',
                title: 'Song B',
                artist: 'Artist B',
              ),
              tests: const <String>['drive'],
            ),
          ),
        ],
      );
      final cubit = SessionCubit(repository, startedSession: _startedSession());

      addTearDown(cubit.close);

      await cubit.initialize();

      expect(cubit.state.status, SessionStatus.ready);
      expect(cubit.state.currentRound?.pairing?.id, 'pairing-1');
      expect(cubit.state.currentRound?.round, 1);
    });

    test(
      'submits a choice, keeps feedback, and advances to completion',
      () async {
        final repository = FakeSessionRepository(
          nextPairings: <SessionRoundState>[
            SessionRoundState(
              sessionId: 'session-1',
              round: 1,
              confidence: 0.42,
              done: false,
              pairing: SessionPairing(
                id: 'pairing-1',
                songA: const SessionPairingSong(
                  id: 'song-a',
                  title: 'Song A',
                  artist: 'Artist A',
                ),
                songB: const SessionPairingSong(
                  id: 'song-b',
                  title: 'Song B',
                  artist: 'Artist B',
                ),
                tests: const <String>['drive'],
              ),
            ),
            const SessionRoundState(
              sessionId: 'session-1',
              round: 2,
              confidence: 0.77,
              done: true,
            ),
          ],
          feedback: const SessionChoiceFeedback(
            verdict: 'Decisive',
            why: 'You rewarded pressure over polish.',
            dimension: 'intensity',
            delta: 0.32,
          ),
        );
        final cubit = SessionCubit(
          repository,
          startedSession: _startedSession(),
        );

        addTearDown(cubit.close);

        await cubit.initialize();
        await cubit.chooseSong(chosenSongId: 'song-a', msToDecide: 1200);

        expect(repository.lastChoiceSongId, 'song-a');
        expect(repository.lastChoiceMsToDecide, 1200);
        expect(cubit.state.status, SessionStatus.completed);
        expect(cubit.state.lastFeedback?.verdict, 'Decisive');
      },
    );

    test(
      'moves to missingSession when no started session is available',
      () async {
        final cubit = SessionCubit(FakeSessionRepository());

        addTearDown(cubit.close);

        await cubit.initialize();

        expect(cubit.state.status, SessionStatus.missingSession);
        expect(cubit.state.errorMessage, isNull);
      },
    );
  });
}

class FakeSessionRepository implements SessionRepository {
  FakeSessionRepository({
    List<SessionRoundState>? nextPairings,
    this.feedback = const SessionChoiceFeedback(
      verdict: 'Decisive',
      why: 'Default feedback',
    ),
  }) : _nextPairings = List<SessionRoundState>.from(
         nextPairings ?? const <SessionRoundState>[],
       );

  final List<SessionRoundState> _nextPairings;
  final SessionChoiceFeedback feedback;
  String? lastChoiceSongId;
  int? lastChoiceMsToDecide;

  @override
  Future<SessionRoundState> fetchNextPairing({
    required String sessionId,
  }) async {
    if (_nextPairings.isEmpty) {
      throw StateError('No more pairings queued');
    }
    return _nextPairings.removeAt(0);
  }

  @override
  Future<SessionChoiceFeedback> submitChoice({
    required String sessionId,
    required String pairingId,
    required String chosenSongId,
    required int msToDecide,
  }) async {
    lastChoiceSongId = chosenSongId;
    lastChoiceMsToDecide = msToDecide;
    return feedback;
  }
}

StartedMusicSession _startedSession() {
  return const StartedMusicSession(
    sessionId: 'session-1',
    sessionLane: 'cinematic',
    sessionLaneConfidence: 0.64,
    analysisLane: 'cinematic',
    analysisConfidence: 0.58,
    hypothesis: 'You lean toward tension and release.',
    reaction: 'Promising start.',
    reasoning: <String>['You reward atmosphere.'],
    secondaryLanes: <String>['electronic'],
    songs: <String>['Song A', 'Song B', 'Song C'],
  );
}

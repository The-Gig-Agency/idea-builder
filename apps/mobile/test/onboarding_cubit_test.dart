import 'package:flutter_test/flutter_test.dart';
import 'package:music_dna/src/core/network/app_api_exception.dart';
import 'package:music_dna/src/features/onboarding/domain/entities/started_music_session.dart';
import 'package:music_dna/src/features/onboarding/domain/repositories/onboarding_repository.dart';
import 'package:music_dna/src/features/onboarding/presentation/cubit/onboarding_cubit.dart';

void main() {
  group('OnboardingCubit', () {
    test(
      'emits success with started session when repository succeeds',
      () async {
        final expected = StartedMusicSession(
          sessionId: 'session-1',
          sessionLane: 'alternative',
          sessionLaneConfidence: 0.87,
          analysisLane: 'alternative',
          analysisConfidence: 0.65,
          hypothesis: 'You trust songs that build pressure.',
          reaction: 'Three songs in. Already a shape.',
          reasoning: const <String>['You keep rewarding propulsion.'],
          secondaryLanes: const <String>['electronic'],
          songs: const <String>['A', 'B', 'C'],
        );
        final cubit = OnboardingCubit(
          FakeOnboardingRepository(result: expected),
        );

        addTearDown(cubit.close);

        await cubit.submitOpeningThree(songs: expected.songs);

        expect(
          cubit.state.submissionStatus,
          OnboardingSubmissionStatus.success,
        );
        expect(cubit.state.startedSession, expected);
      },
    );

    test('emits failure when repository throws', () async {
      final cubit = OnboardingCubit(
        FakeOnboardingRepository(error: Exception('network down')),
      );

      addTearDown(cubit.close);

      await cubit.submitOpeningThree(songs: const <String>['A', 'B', 'C']);

      expect(cubit.state.submissionStatus, OnboardingSubmissionStatus.failure);
      expect(cubit.state.errorMessage, contains('network down'));
    });

    test(
      'marks reauthentication required when the API returns unauthorized',
      () async {
        final cubit = OnboardingCubit(
          FakeOnboardingRepository(
            error: const AppApiException(
              kind: AppApiErrorKind.unauthorized,
              message: 'Token expired',
            ),
          ),
        );

        addTearDown(cubit.close);

        await cubit.submitOpeningThree(songs: const <String>['A', 'B', 'C']);

        expect(
          cubit.state.submissionStatus,
          OnboardingSubmissionStatus.failure,
        );
        expect(cubit.state.requiresReauthentication, isTrue);
        expect(cubit.state.errorMessage, contains('Sign in again'));
      },
    );
  });
}

class FakeOnboardingRepository implements OnboardingRepository {
  FakeOnboardingRepository({this.result, this.error});

  final StartedMusicSession? result;
  final Object? error;

  @override
  Future<StartedMusicSession> submitOpeningThree({
    required List<String> songs,
  }) async {
    if (error != null) {
      throw error!;
    }
    return result!;
  }
}

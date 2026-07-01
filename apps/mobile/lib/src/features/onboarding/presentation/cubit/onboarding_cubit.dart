import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/logging/app_logger.dart';
import '../../../../core/network/app_api_exception.dart';
import '../../domain/entities/started_music_session.dart';
import '../../domain/repositories/onboarding_repository.dart';

enum OnboardingSubmissionStatus { idle, submitting, success, failure }

class OnboardingState extends Equatable {
  const OnboardingState({
    this.submissionStatus = OnboardingSubmissionStatus.idle,
    this.startedSession,
    this.errorMessage,
    this.requiresReauthentication = false,
  });

  final OnboardingSubmissionStatus submissionStatus;
  final StartedMusicSession? startedSession;
  final String? errorMessage;
  final bool requiresReauthentication;

  OnboardingState copyWith({
    OnboardingSubmissionStatus? submissionStatus,
    StartedMusicSession? startedSession,
    bool clearStartedSession = false,
    String? errorMessage,
    bool clearErrorMessage = false,
    bool? requiresReauthentication,
  }) {
    return OnboardingState(
      submissionStatus: submissionStatus ?? this.submissionStatus,
      startedSession: clearStartedSession
          ? null
          : startedSession ?? this.startedSession,
      errorMessage: clearErrorMessage
          ? null
          : errorMessage ?? this.errorMessage,
      requiresReauthentication:
          requiresReauthentication ?? this.requiresReauthentication,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    submissionStatus,
    startedSession,
    errorMessage,
    requiresReauthentication,
  ];
}

class OnboardingCubit extends Cubit<OnboardingState> {
  OnboardingCubit(this._repository, {AppLogger? logger})
    : _logger = logger ?? const AppLogger(),
      super(const OnboardingState());

  final OnboardingRepository _repository;
  final AppLogger _logger;

  Future<void> submitOpeningThree({required List<String> songs}) async {
    _logger.event('onboarding.submit_requested', <String, Object?>{
      'songCount': songs.length,
    });
    emit(
      state.copyWith(
        submissionStatus: OnboardingSubmissionStatus.submitting,
        clearErrorMessage: true,
        requiresReauthentication: false,
      ),
    );

    try {
      final startedSession = await _repository.submitOpeningThree(songs: songs);
      _logger.event('onboarding.submit_succeeded', <String, Object?>{
        'sessionId': startedSession.sessionId,
        'analysisLane': startedSession.analysisLane,
      });
      emit(
        state.copyWith(
          submissionStatus: OnboardingSubmissionStatus.success,
          startedSession: startedSession,
          clearErrorMessage: true,
          requiresReauthentication: false,
        ),
      );
    } catch (error) {
      _logger.error('onboarding.submit_failed', error, <String, Object?>{
        'songCount': songs.length,
      });
      final apiError = error is AppApiException ? error : null;
      emit(
        state.copyWith(
          submissionStatus: OnboardingSubmissionStatus.failure,
          clearStartedSession: true,
          errorMessage: _readableError(apiError ?? error),
          requiresReauthentication: apiError?.isAuthRelated == true,
        ),
      );
    }
  }

  void clearFeedback() {
    emit(
      state.copyWith(
        submissionStatus: OnboardingSubmissionStatus.idle,
        clearErrorMessage: true,
        requiresReauthentication: false,
      ),
    );
  }

  String _readableError(Object error) {
    if (error is AppApiException) {
      switch (error.kind) {
        case AppApiErrorKind.unauthorized:
        case AppApiErrorKind.forbidden:
          return 'Your session expired. Sign in again to continue onboarding.';
        case AppApiErrorKind.network:
          return 'You appear to be offline. Reconnect and try your opener again.';
        case AppApiErrorKind.invalidInput:
          return error.message;
        case AppApiErrorKind.upstream:
        case AppApiErrorKind.internal:
        case AppApiErrorKind.unknown:
          return error.message.isEmpty
              ? 'We could not build your opener right now.'
              : error.message;
      }
    }

    final message = error.toString().trim();
    return message.isEmpty ? 'Something went wrong.' : message;
  }
}

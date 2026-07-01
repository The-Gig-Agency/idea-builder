import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/started_music_session.dart';
import '../../domain/repositories/onboarding_repository.dart';

enum OnboardingSubmissionStatus { idle, submitting, success, failure }

class OnboardingState extends Equatable {
  const OnboardingState({
    this.submissionStatus = OnboardingSubmissionStatus.idle,
    this.startedSession,
    this.errorMessage,
  });

  final OnboardingSubmissionStatus submissionStatus;
  final StartedMusicSession? startedSession;
  final String? errorMessage;

  OnboardingState copyWith({
    OnboardingSubmissionStatus? submissionStatus,
    StartedMusicSession? startedSession,
    bool clearStartedSession = false,
    String? errorMessage,
    bool clearErrorMessage = false,
  }) {
    return OnboardingState(
      submissionStatus: submissionStatus ?? this.submissionStatus,
      startedSession: clearStartedSession
          ? null
          : startedSession ?? this.startedSession,
      errorMessage: clearErrorMessage
          ? null
          : errorMessage ?? this.errorMessage,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    submissionStatus,
    startedSession,
    errorMessage,
  ];
}

class OnboardingCubit extends Cubit<OnboardingState> {
  OnboardingCubit(this._repository) : super(const OnboardingState());

  final OnboardingRepository _repository;

  Future<void> submitOpeningThree({required List<String> songs}) async {
    emit(
      state.copyWith(
        submissionStatus: OnboardingSubmissionStatus.submitting,
        clearErrorMessage: true,
      ),
    );

    try {
      final startedSession = await _repository.submitOpeningThree(songs: songs);
      emit(
        state.copyWith(
          submissionStatus: OnboardingSubmissionStatus.success,
          startedSession: startedSession,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          submissionStatus: OnboardingSubmissionStatus.failure,
          clearStartedSession: true,
          errorMessage: _readableError(error),
        ),
      );
    }
  }

  void clearFeedback() {
    emit(
      state.copyWith(
        submissionStatus: OnboardingSubmissionStatus.idle,
        clearErrorMessage: true,
      ),
    );
  }

  String _readableError(Object error) {
    final message = error.toString().trim();
    if (message.startsWith('OnboardingRemoteDataSourceException:')) {
      return message
          .replaceFirst('OnboardingRemoteDataSourceException:', '')
          .trim();
    }
    return message.isEmpty ? 'Something went wrong.' : message;
  }
}

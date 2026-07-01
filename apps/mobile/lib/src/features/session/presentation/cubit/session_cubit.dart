import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../onboarding/domain/entities/started_music_session.dart';
import '../../domain/entities/session_pairing.dart';
import '../../domain/repositories/session_repository.dart';

enum SessionStatus {
  initial,
  loading,
  ready,
  submitting,
  completed,
  failure,
  missingSession,
}

class SessionState extends Equatable {
  const SessionState({
    this.status = SessionStatus.initial,
    this.startedSession,
    this.currentRound,
    this.lastFeedback,
    this.errorMessage,
  });

  final SessionStatus status;
  final StartedMusicSession? startedSession;
  final SessionRoundState? currentRound;
  final SessionChoiceFeedback? lastFeedback;
  final String? errorMessage;

  String? get sessionId => startedSession?.sessionId ?? currentRound?.sessionId;

  SessionState copyWith({
    SessionStatus? status,
    StartedMusicSession? startedSession,
    bool clearStartedSession = false,
    SessionRoundState? currentRound,
    bool clearCurrentRound = false,
    SessionChoiceFeedback? lastFeedback,
    bool clearLastFeedback = false,
    String? errorMessage,
    bool clearErrorMessage = false,
  }) {
    return SessionState(
      status: status ?? this.status,
      startedSession: clearStartedSession
          ? null
          : startedSession ?? this.startedSession,
      currentRound: clearCurrentRound
          ? null
          : currentRound ?? this.currentRound,
      lastFeedback: clearLastFeedback
          ? null
          : lastFeedback ?? this.lastFeedback,
      errorMessage: clearErrorMessage
          ? null
          : errorMessage ?? this.errorMessage,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    status,
    startedSession,
    currentRound,
    lastFeedback,
    errorMessage,
  ];
}

class SessionCubit extends Cubit<SessionState> {
  SessionCubit(this._repository, {StartedMusicSession? startedSession})
    : super(SessionState(startedSession: startedSession));

  final SessionRepository _repository;

  Future<void> initialize() async {
    final sessionId = state.sessionId;
    if (sessionId == null || sessionId.isEmpty) {
      emit(
        state.copyWith(
          status: SessionStatus.missingSession,
          clearCurrentRound: true,
          clearErrorMessage: true,
        ),
      );
      return;
    }

    emit(
      state.copyWith(status: SessionStatus.loading, clearErrorMessage: true),
    );

    await _loadNextPairing(
      sessionId: sessionId,
      keepFeedback: state.lastFeedback != null,
    );
  }

  Future<void> chooseSong({
    required String chosenSongId,
    required int msToDecide,
  }) async {
    final sessionId = state.sessionId;
    final pairingId = state.currentRound?.pairing?.id;
    if (sessionId == null || pairingId == null) {
      emit(
        state.copyWith(
          status: SessionStatus.failure,
          errorMessage: 'No active pairing is available yet.',
        ),
      );
      return;
    }

    emit(
      state.copyWith(status: SessionStatus.submitting, clearErrorMessage: true),
    );

    try {
      final feedback = await _repository.submitChoice(
        sessionId: sessionId,
        pairingId: pairingId,
        chosenSongId: chosenSongId,
        msToDecide: msToDecide,
      );
      emit(state.copyWith(lastFeedback: feedback, clearErrorMessage: true));
      await _loadNextPairing(sessionId: sessionId, keepFeedback: true);
    } catch (error) {
      emit(
        state.copyWith(
          status: SessionStatus.failure,
          errorMessage: _readableError(error),
        ),
      );
    }
  }

  void clearFeedback() {
    emit(
      state.copyWith(
        clearLastFeedback: true,
        clearErrorMessage: true,
        status: state.currentRound?.pairing != null
            ? SessionStatus.ready
            : state.status,
      ),
    );
  }

  Future<void> _loadNextPairing({
    required String sessionId,
    required bool keepFeedback,
  }) async {
    try {
      final nextRound = await _repository.fetchNextPairing(
        sessionId: sessionId,
      );
      emit(
        state.copyWith(
          status: nextRound.done || nextRound.pairing == null
              ? SessionStatus.completed
              : SessionStatus.ready,
          currentRound: nextRound,
          clearLastFeedback: !keepFeedback,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: SessionStatus.failure,
          errorMessage: _readableError(error),
        ),
      );
    }
  }

  String _readableError(Object error) {
    final message = error.toString().trim();
    if (message.startsWith('SessionRemoteDataSourceException:')) {
      return message
          .replaceFirst('SessionRemoteDataSourceException:', '')
          .trim();
    }
    return message.isEmpty ? 'Something went wrong.' : message;
  }
}

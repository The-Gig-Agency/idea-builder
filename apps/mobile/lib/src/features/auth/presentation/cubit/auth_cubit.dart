import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';

enum AuthStatus { loading, authenticated, unauthenticated }

enum AuthSubmissionStatus { idle, submitting, success, failure }

class AuthState extends Equatable {
  const AuthState({
    required this.status,
    this.user,
    this.submissionStatus = AuthSubmissionStatus.idle,
    this.errorMessage,
  });

  const AuthState.loading() : this(status: AuthStatus.loading);

  const AuthState.authenticated(AuthUser user)
    : this(status: AuthStatus.authenticated, user: user);

  const AuthState.unauthenticated() : this(status: AuthStatus.unauthenticated);

  final AuthStatus status;
  final AuthUser? user;
  final AuthSubmissionStatus submissionStatus;
  final String? errorMessage;

  AuthState copyWith({
    AuthStatus? status,
    AuthUser? user,
    bool clearUser = false,
    AuthSubmissionStatus? submissionStatus,
    String? errorMessage,
    bool clearErrorMessage = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : user ?? this.user,
      submissionStatus: submissionStatus ?? this.submissionStatus,
      errorMessage: clearErrorMessage
          ? null
          : errorMessage ?? this.errorMessage,
    );
  }

  @override
  List<Object?> get props => <Object?>[
    status,
    user,
    submissionStatus,
    errorMessage,
  ];
}

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this._authRepository) : super(const AuthState.loading());

  final AuthRepository _authRepository;
  StreamSubscription<AuthUser?>? _subscription;

  void initialize() {
    final currentUser = _authRepository.currentUser;
    emit(
      currentUser == null
          ? const AuthState.unauthenticated()
          : AuthState.authenticated(currentUser),
    );

    _subscription ??= _authRepository.observeAuthState().listen((
      AuthUser? user,
    ) {
      emit(
        user == null
            ? state.copyWith(
                status: AuthStatus.unauthenticated,
                clearUser: true,
                submissionStatus: AuthSubmissionStatus.idle,
              )
            : state.copyWith(
                status: AuthStatus.authenticated,
                user: user,
                submissionStatus: AuthSubmissionStatus.success,
                clearErrorMessage: true,
              ),
      );
    });
  }

  Future<void> signIn({required String email, required String password}) async {
    emit(
      state.copyWith(
        submissionStatus: AuthSubmissionStatus.submitting,
        clearErrorMessage: true,
      ),
    );
    try {
      final user = await _authRepository.signIn(
        email: email,
        password: password,
      );
      emit(
        state.copyWith(
          status: AuthStatus.authenticated,
          user: user,
          submissionStatus: AuthSubmissionStatus.success,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          submissionStatus: AuthSubmissionStatus.failure,
          errorMessage: _readableError(error),
        ),
      );
    }
  }

  Future<void> signUp({required String email, required String password}) async {
    emit(
      state.copyWith(
        submissionStatus: AuthSubmissionStatus.submitting,
        clearErrorMessage: true,
      ),
    );
    try {
      final user = await _authRepository.signUp(
        email: email,
        password: password,
      );
      emit(
        state.copyWith(
          status: AuthStatus.authenticated,
          user: user,
          submissionStatus: AuthSubmissionStatus.success,
          clearErrorMessage: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          submissionStatus: AuthSubmissionStatus.failure,
          errorMessage: _readableError(error),
        ),
      );
    }
  }

  Future<void> signOut() {
    return _authRepository.signOut();
  }

  void clearFeedback() {
    emit(
      state.copyWith(
        submissionStatus: AuthSubmissionStatus.idle,
        clearErrorMessage: true,
      ),
    );
  }

  String _readableError(Object error) {
    final message = error.toString().trim();
    if (message.isEmpty) {
      return 'Something went wrong. Please try again.';
    }

    if (message.startsWith('AuthException:')) {
      return message.replaceFirst('AuthException:', '').trim();
    }

    if (message.startsWith('AuthApiException:')) {
      return message.replaceFirst('AuthApiException:', '').trim();
    }

    return message;
  }

  @override
  Future<void> close() async {
    await _subscription?.cancel();
    return super.close();
  }
}

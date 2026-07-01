import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';

enum AuthStatus { loading, authenticated, unauthenticated }

class AuthState extends Equatable {
  const AuthState({required this.status, this.user});

  const AuthState.loading() : this(status: AuthStatus.loading);

  const AuthState.authenticated(AuthUser user)
    : this(status: AuthStatus.authenticated, user: user);

  const AuthState.unauthenticated() : this(status: AuthStatus.unauthenticated);

  final AuthStatus status;
  final AuthUser? user;

  @override
  List<Object?> get props => <Object?>[status, user];
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
            ? const AuthState.unauthenticated()
            : AuthState.authenticated(user),
      );
    });
  }

  Future<void> signOut() {
    return _authRepository.signOut();
  }

  @override
  Future<void> close() async {
    await _subscription?.cancel();
    return super.close();
  }
}

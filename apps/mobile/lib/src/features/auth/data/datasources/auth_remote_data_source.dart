import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/auth_user.dart' as domain;

abstract class AuthRemoteDataSource {
  domain.AuthUser? get currentUser;

  Stream<domain.AuthUser?> observeAuthState();

  Future<void> signOut();
}

class SupabaseAuthRemoteDataSource implements AuthRemoteDataSource {
  SupabaseAuthRemoteDataSource(this._supabase);

  final SupabaseClient _supabase;

  @override
  domain.AuthUser? get currentUser => _mapUser(_supabase.auth.currentUser);

  @override
  Stream<domain.AuthUser?> observeAuthState() {
    return _supabase.auth.onAuthStateChange.map(
      (AuthState authState) => _mapUser(authState.session?.user),
    );
  }

  @override
  Future<void> signOut() {
    return _supabase.auth.signOut();
  }

  domain.AuthUser? _mapUser(User? user) {
    if (user == null) {
      return null;
    }

    return domain.AuthUser(id: user.id, email: user.email);
  }
}

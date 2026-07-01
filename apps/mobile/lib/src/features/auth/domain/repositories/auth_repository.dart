import 'dart:async';

import '../entities/auth_user.dart';

abstract class AuthRepository {
  AuthUser? get currentUser;

  Stream<AuthUser?> observeAuthState();

  Future<void> signOut();
}

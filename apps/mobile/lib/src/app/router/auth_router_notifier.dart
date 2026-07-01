import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../features/auth/domain/repositories/auth_repository.dart';

class AuthRouterNotifier extends ChangeNotifier {
  AuthRouterNotifier(this._authRepository) {
    _subscription = _authRepository.observeAuthState().listen((_) {
      notifyListeners();
    });
  }

  final AuthRepository _authRepository;
  StreamSubscription<dynamic>? _subscription;

  bool get isAuthenticated => _authRepository.currentUser != null;

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._remoteDataSource);

  final AuthRemoteDataSource _remoteDataSource;

  @override
  AuthUser? get currentUser => _remoteDataSource.currentUser;

  @override
  Stream<AuthUser?> observeAuthState() {
    return _remoteDataSource.observeAuthState();
  }

  @override
  Future<void> signOut() {
    return _remoteDataSource.signOut();
  }
}

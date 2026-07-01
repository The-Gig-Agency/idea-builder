import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app/router/auth_router_notifier.dart';
import '../../features/auth/data/datasources/auth_remote_data_source.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/presentation/cubit/auth_cubit.dart';
import '../config/app_config.dart';
import '../network/music_dna_api_client.dart';

class AppDependencies {
  AppDependencies({required this.config, required this.supabase}) {
    authRemoteDataSource = SupabaseAuthRemoteDataSource(supabase);
    authRepository = AuthRepositoryImpl(authRemoteDataSource);
    apiClient = MusicDnaApiClient(
      baseUrl: config.apiBaseUrl,
      accessTokenProvider: () async =>
          supabase.auth.currentSession?.accessToken,
    );
  }

  final AppConfig config;
  final SupabaseClient supabase;

  late final AuthRemoteDataSource authRemoteDataSource;
  late final AuthRepository authRepository;
  late final AuthRouterNotifier authRouterNotifier = AuthRouterNotifier(
    authRepository,
  );
  late final MusicDnaApiClient apiClient;

  AuthCubit createAuthCubit() {
    return AuthCubit(authRepository)..initialize();
  }
}

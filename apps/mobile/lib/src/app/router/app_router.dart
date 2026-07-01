import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../core/di/app_dependencies.dart';
import '../../features/auth/presentation/pages/auth_stub_page.dart';
import '../../features/foundation/presentation/pages/foundation_home_page.dart';
import '../../features/onboarding/domain/entities/started_music_session.dart';
import '../../features/onboarding/presentation/cubit/onboarding_cubit.dart';
import '../../features/onboarding/presentation/pages/onboarding_stub_page.dart';
import '../../features/session/presentation/pages/session_stub_page.dart';

GoRouter buildAppRouter(AppDependencies dependencies) {
  return GoRouter(
    refreshListenable: dependencies.authRouterNotifier,
    redirect: (context, state) {
      final isAuthenticated = dependencies.authRouterNotifier.isAuthenticated;
      final isAuthRoute = state.matchedLocation == '/auth';
      final isProtectedRoute =
          state.matchedLocation == '/onboarding' ||
          state.matchedLocation == '/session';

      if (!isAuthenticated && isProtectedRoute) {
        return '/auth';
      }

      if (isAuthenticated && isAuthRoute) {
        return '/';
      }

      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: '/',
        builder: (context, state) =>
            FoundationHomePage(config: dependencies.config),
      ),
      GoRoute(path: '/auth', builder: (context, state) => const AuthStubPage()),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => BlocProvider<OnboardingCubit>(
          create: (_) => dependencies.createOnboardingCubit(),
          child: const OnboardingStubPage(),
        ),
      ),
      GoRoute(
        path: '/session',
        builder: (context, state) => SessionStubPage(
          startedSession: state.extra is StartedMusicSession
              ? state.extra as StartedMusicSession
              : null,
        ),
      ),
    ],
  );
}

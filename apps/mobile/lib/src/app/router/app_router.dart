import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/auth_stub_page.dart';
import '../../features/foundation/presentation/pages/foundation_home_page.dart';
import '../../features/onboarding/presentation/pages/onboarding_stub_page.dart';
import '../../features/session/presentation/pages/session_stub_page.dart';
import '../../core/config/app_config.dart';

GoRouter buildAppRouter(AppConfig config) {
  return GoRouter(
    routes: <RouteBase>[
      GoRoute(
        path: '/',
        builder: (context, state) => FoundationHomePage(config: config),
      ),
      GoRoute(path: '/auth', builder: (context, state) => const AuthStubPage()),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingStubPage(),
      ),
      GoRoute(
        path: '/session',
        builder: (context, state) => const SessionStubPage(),
      ),
    ],
  );
}

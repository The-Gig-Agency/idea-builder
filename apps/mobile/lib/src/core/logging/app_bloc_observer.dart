import 'package:flutter_bloc/flutter_bloc.dart';

import 'app_logger.dart';

class AppBlocObserver extends BlocObserver {
  AppBlocObserver(this._logger);

  final AppLogger _logger;

  @override
  void onChange(BlocBase<dynamic> bloc, Change<dynamic> change) {
    super.onChange(bloc, change);
    _logger.event('bloc.change', <String, Object?>{
      'bloc': bloc.runtimeType.toString(),
      'current': change.currentState.runtimeType.toString(),
      'next': change.nextState.runtimeType.toString(),
    });
  }

  @override
  void onError(BlocBase<dynamic> bloc, Object error, StackTrace stackTrace) {
    _logger.error('bloc.error', error, <String, Object?>{
      'bloc': bloc.runtimeType.toString(),
    });
    super.onError(bloc, error, stackTrace);
  }
}

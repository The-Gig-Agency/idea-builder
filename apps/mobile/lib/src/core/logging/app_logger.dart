import 'package:flutter/foundation.dart';

class AppLogger {
  const AppLogger();

  void event(
    String name, [
    Map<String, Object?> fields = const <String, Object?>{},
  ]) {
    _emit('EVENT', name, fields);
  }

  void error(
    String name,
    Object error, [
    Map<String, Object?> fields = const <String, Object?>{},
  ]) {
    _emit('ERROR', name, <String, Object?>{
      ...fields,
      'error': error.toString(),
    });
  }

  void _emit(String level, String name, Map<String, Object?> fields) {
    final details = fields.entries
        .map((entry) => '${entry.key}=${entry.value}')
        .join(' ');
    debugPrint('[musicdna][$level] $name${details.isEmpty ? '' : ' $details'}');
  }
}

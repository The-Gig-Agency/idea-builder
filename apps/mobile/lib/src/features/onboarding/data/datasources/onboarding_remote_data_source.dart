import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/network/music_dna_api_client.dart';

class OnboardingRemoteDataSource {
  OnboardingRemoteDataSource(this._apiClient);

  final MusicDnaApiClient _apiClient;

  Future<Map<String, dynamic>> commitOpeningThree({
    required List<String> songs,
  }) async {
    final response = await _apiClient.post(
      '/api/v1/onboarding/opener',
      body: <String, dynamic>{'songs': songs},
    );
    return _decodeJson(response);
  }

  Future<Map<String, dynamic>> startSession() async {
    final response = await _apiClient.post('/api/v1/session');
    return _decodeJson(response);
  }

  Map<String, dynamic> _decodeJson(http.Response response) {
    final body = response.body.isEmpty
        ? const <String, dynamic>{}
        : jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode >= 400) {
      final error = body['error'];
      if (error is Map<String, dynamic>) {
        final message = error['message'];
        throw OnboardingRemoteDataSourceException(
          message is String && message.isNotEmpty
              ? message
              : 'Something went wrong.',
        );
      }

      throw const OnboardingRemoteDataSourceException('Something went wrong.');
    }

    return body;
  }
}

class OnboardingRemoteDataSourceException implements Exception {
  const OnboardingRemoteDataSourceException(this.message);

  final String message;

  @override
  String toString() => 'OnboardingRemoteDataSourceException: $message';
}

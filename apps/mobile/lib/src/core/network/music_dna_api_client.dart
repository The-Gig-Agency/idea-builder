import 'dart:convert';

import 'package:http/http.dart' as http;

typedef AccessTokenProvider = Future<String?> Function();

class MusicDnaApiClient {
  MusicDnaApiClient({
    required String baseUrl,
    required AccessTokenProvider accessTokenProvider,
    http.Client? httpClient,
  }) : _baseUri = Uri.parse(baseUrl),
       _accessTokenProvider = accessTokenProvider,
       _httpClient = httpClient ?? http.Client();

  final Uri _baseUri;
  final AccessTokenProvider _accessTokenProvider;
  final http.Client _httpClient;

  Uri buildUri(String path) => _baseUri.resolve(path);

  Future<http.Response> get(String path) async {
    return _httpClient.get(buildUri(path), headers: await _headers());
  }

  Future<http.Response> post(String path, {Map<String, dynamic>? body}) async {
    return _httpClient.post(
      buildUri(path),
      headers: await _headers(),
      body: body == null ? null : jsonEncode(body),
    );
  }

  Future<Map<String, String>> _headers() async {
    final accessToken = await _accessTokenProvider();
    return <String, String>{
      'content-type': 'application/json',
      if (accessToken != null && accessToken.isNotEmpty)
        'authorization': 'Bearer $accessToken',
    };
  }
}

package com.idncar.vmqlistener;

import android.content.Context;
import android.text.TextUtils;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public final class VmqApiClient {
    private static final int TIMEOUT_MS = 10000;
    private static volatile SSLSocketFactory trustAllSocketFactory;
    private static final HostnameVerifier TRUST_ALL_HOSTNAME_VERIFIER = (hostname, session) -> true;

    private VmqApiClient() {
    }

    public static Response sendHeartbeat(Context context) throws Exception {
        String key = requireKey(context);
        String t = epochSeconds();
        Map<String, String> params = new LinkedHashMap<>();
        params.put("t", t);
        params.put("sign", md5(t + key));
        return postForm(ConfigStore.endpoint(context, "/appHeart"), params);
    }

    public static Response pushPayment(Context context, int type, String price,
                                       long paidAtMillis, String eventId, boolean testMode) throws Exception {
        String key = requireKey(context);
        String t = epochSeconds();
        String paidAt = String.valueOf(Math.max(1L, paidAtMillis / 1000L));
        String mode = testMode ? "TEST" : "LIVE";
        String normalizedEventId = TextUtils.isEmpty(eventId)
                ? sha256(type + "|" + price + "|" + paidAt + "|" + UUID.randomUUID())
                : eventId;
        Map<String, String> params = new LinkedHashMap<>();
        params.put("type", String.valueOf(type));
        params.put("price", price);
        params.put("paidAt", paidAt);
        params.put("eventId", normalizedEventId);
        params.put("mode", mode);
        params.put("t", t);
        params.put("sign", md5(type + price + paidAt + normalizedEventId + mode + t + key));
        return postForm(ConfigStore.endpoint(context, "/appPush"), params);
    }

    private static String requireKey(Context context) {
        String key = ConfigStore.getCommunicationKey(context);
        if (TextUtils.isEmpty(key)) {
            throw new IllegalStateException("Missing communication key");
        }
        return key;
    }

    private static Response postForm(String url, Map<String, String> params) throws Exception {
        if (TextUtils.isEmpty(url)) {
            throw new IllegalStateException("Missing endpoint URL");
        }
        byte[] body = formBody(params).getBytes(StandardCharsets.UTF_8);
        URL endpoint = new URL(url);
        HttpURLConnection connection = (HttpURLConnection) endpoint.openConnection();
        if (connection instanceof HttpsURLConnection && isIpv4Address(endpoint.getHost())) {
            HttpsURLConnection httpsConnection = (HttpsURLConnection) connection;
            httpsConnection.setSSLSocketFactory(trustAllSocketFactory());
            httpsConnection.setHostnameVerifier(TRUST_ALL_HOSTNAME_VERIFIER);
        }
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
        connection.setRequestProperty("Accept", "application/json,text/plain,*/*");
        connection.setRequestProperty("User-Agent", "IdncarVmqListener/1.0");
        try (OutputStream outputStream = connection.getOutputStream()) {
            outputStream.write(body);
        }
        int code = connection.getResponseCode();
        InputStream inputStream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String responseBody = readBody(inputStream);
        connection.disconnect();
        return new Response(code, responseBody);
    }

    private static boolean isIpv4Address(String host) {
        if (host == null || host.isEmpty()) {
            return false;
        }
        return host.matches("^\\d{1,3}(?:\\.\\d{1,3}){3}$");
    }

    private static SSLSocketFactory trustAllSocketFactory() throws Exception {
        if (trustAllSocketFactory != null) {
            return trustAllSocketFactory;
        }
        synchronized (VmqApiClient.class) {
            if (trustAllSocketFactory != null) {
                return trustAllSocketFactory;
            }
            TrustManager[] trustManagers = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }
                    }
            };
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustManagers, new SecureRandom());
            trustAllSocketFactory = sslContext.getSocketFactory();
            return trustAllSocketFactory;
        }
    }

    private static String formBody(Map<String, String> params) throws Exception {
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (builder.length() > 0) {
                builder.append('&');
            }
            builder.append(URLEncoder.encode(entry.getKey(), "UTF-8"));
            builder.append('=');
            builder.append(URLEncoder.encode(entry.getValue(), "UTF-8"));
        }
        return builder.toString();
    }

    private static String readBody(InputStream inputStream) throws Exception {
        if (inputStream == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (builder.length() > 0) {
                    builder.append('\n');
                }
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private static String epochSeconds() {
        return String.valueOf(System.currentTimeMillis() / 1000L);
    }

    static String md5(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("MD5");
        byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) {
            builder.append(String.format("%02x", item & 0xff));
        }
        return builder.toString();
    }

    private static String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) {
            builder.append(String.format("%02x", item & 0xff));
        }
        return builder.toString();
    }

    public static final class Response {
        public final int code;
        public final String body;

        Response(int code, String body) {
            this.code = code;
            this.body = body;
        }
    }
}

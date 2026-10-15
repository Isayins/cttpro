package com.idncar.support;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** A real SMTP sink confined to loopback; it never relays mail or contacts a DNS server. */
public final class LoopbackSmtpServer implements AutoCloseable {
    private final ServerSocket listener;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final List<byte[]> messages = new CopyOnWriteArrayList<>();
    private final AtomicInteger submissions = new AtomicInteger();
    private final AtomicReference<Exception> failure = new AtomicReference<>();
    private volatile boolean accepting = true;
    private volatile boolean closed;
    private volatile Socket active;

    public LoopbackSmtpServer() throws IOException {
        listener = new ServerSocket(0, 10, InetAddress.getByName("127.0.0.1"));
        worker.submit(this::serve);
    }

    public int port() {
        return listener.getLocalPort();
    }

    public void acceptMessages(boolean accepting) {
        this.accepting = accepting;
    }

    public int submissionCount() {
        checkHealthy();
        return submissions.get();
    }

    public List<byte[]> messages() {
        checkHealthy();
        return messages.stream().map(byte[]::clone).toList();
    }

    private void serve() {
        try {
            while (!closed) {
                try (Socket connection = listener.accept()) {
                    active = connection;
                    connection.setSoTimeout(10_000);
                    exchange(connection);
                } finally {
                    active = null;
                }
            }
        } catch (IOException exception) {
            if (!closed) failure.compareAndSet(null, exception);
        }
    }

    private void exchange(Socket connection) throws IOException {
        BufferedReader input = new BufferedReader(new InputStreamReader(
                connection.getInputStream(), StandardCharsets.ISO_8859_1));
        BufferedWriter output = new BufferedWriter(new OutputStreamWriter(
                connection.getOutputStream(), StandardCharsets.ISO_8859_1));
        reply(output, "220 localhost fixture SMTP");
        boolean sender = false;
        boolean recipient = false;
        String line;
        while ((line = input.readLine()) != null) {
            String command = line.toUpperCase(Locale.ROOT);
            if (command.startsWith("EHLO ") || command.startsWith("HELO ")) {
                reply(output, "250 localhost");
            } else if (command.startsWith("MAIL FROM:")) {
                sender = true;
                recipient = false;
                reply(output, "250 sender accepted");
            } else if (command.startsWith("RCPT TO:") && sender) {
                recipient = true;
                reply(output, "250 recipient accepted");
            } else if (command.equals("DATA") && sender && recipient) {
                reply(output, "354 end with a single dot");
                byte[] message = readMessage(input);
                submissions.incrementAndGet();
                if (accepting) {
                    messages.add(message);
                    reply(output, "250 accepted by loopback fixture");
                } else {
                    reply(output, "451 fixture temporarily rejects delivery");
                }
                sender = false;
                recipient = false;
            } else if (command.equals("RSET")) {
                sender = false;
                recipient = false;
                reply(output, "250 reset");
            } else if (command.equals("NOOP")) {
                reply(output, "250 ok");
            } else if (command.equals("QUIT")) {
                reply(output, "221 closing");
                return;
            } else {
                reply(output, "503 unsupported command or sequence");
            }
        }
    }

    private byte[] readMessage(BufferedReader input) throws IOException {
        StringBuilder data = new StringBuilder();
        String line;
        while ((line = input.readLine()) != null) {
            if (line.equals(".")) return data.toString().getBytes(StandardCharsets.ISO_8859_1);
            if (line.startsWith("..")) line = line.substring(1);
            data.append(line).append("\r\n");
            if (data.length() > 2 * 1024 * 1024) throw new IOException("Fixture MIME exceeds 2 MiB");
        }
        throw new IOException("SMTP connection ended inside DATA");
    }

    private void reply(BufferedWriter output, String line) throws IOException {
        output.write(line);
        output.write("\r\n");
        output.flush();
    }

    private void checkHealthy() {
        if (failure.get() != null) throw new IllegalStateException("Loopback SMTP failed", failure.get());
    }

    @Override
    public void close() throws Exception {
        closed = true;
        listener.close();
        Socket connection = active;
        if (connection != null) connection.close();
        worker.shutdownNow();
        if (!worker.awaitTermination(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Loopback SMTP worker did not stop");
        }
        checkHealthy();
    }
}

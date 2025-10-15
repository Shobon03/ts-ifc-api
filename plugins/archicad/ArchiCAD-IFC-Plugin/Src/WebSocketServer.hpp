/*
 * Copyright (C) 2025 Matheus Piovezan Teixeira
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

#ifndef WEBSOCKET_SERVER_HPP
#define WEBSOCKET_SERVER_HPP

#ifdef WEBSOCKET_ENABLED

#include <string>
#include <thread>
#include <functional>
#include <vector>
#include <mutex>
#include <memory>
#include <atomic>

// Suppress Boost warnings
#pragma warning(push)
#pragma warning(disable: 4996 4267 4244 4100 4702)

#include <boost/beast/core.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/strand.hpp>

#pragma warning(pop)

namespace beast = boost::beast;
namespace websocket = beast::websocket;
namespace net = boost::asio;
using tcp = net::ip::tcp;

/**
 * @brief WebSocket session - handles individual client connection
 */
class WebSocketSession : public std::enable_shared_from_this<WebSocketSession> {
public:
    WebSocketSession(tcp::socket socket);
    ~WebSocketSession();

    void Run();
    void Send(const std::string& message);
    void Close();
    bool IsOpen() const;

    using MessageCallback = std::function<void(const std::string&)>;
    void SetMessageCallback(MessageCallback callback);

private:
    void DoAccept();
    void DoRead();
    void DoWrite();
    void OnAccept(beast::error_code ec);
    void OnRead(beast::error_code ec, std::size_t bytes_transferred);
    void OnWrite(beast::error_code ec, std::size_t bytes_transferred);

    websocket::stream<beast::tcp_stream> m_ws;
    beast::flat_buffer m_buffer;
    std::vector<std::string> m_writeQueue;
    MessageCallback m_messageCallback;
    std::mutex m_writeMutex;
    std::atomic<bool> m_open;
};

/**
 * @brief WebSocket server for Archicad plugin communication
 *
 * This server runs on port 8081 and allows bidirectional communication
 * between the Archicad plugin and the Node.js backend.
 *
 * Uses Boost.Beast - modern, secure, and well-maintained.
 */
class ArchicadWebSocketServer {
public:
    /**
     * @brief Command callback function type
     * @param command The command name (e.g., "start_conversion")
     * @param jobId Unique job identifier
     * @param payload Full JSON payload as string
     */
    using CommandCallback = std::function<void(const std::string& command, const std::string& jobId, const std::string& payload)>;

    ArchicadWebSocketServer();
    ~ArchicadWebSocketServer();

    /**
     * @brief Start the WebSocket server on specified port
     * @param port Port number (default: 8081)
     * @return true if started successfully, false otherwise
     */
    bool Start(int port = 8081);

    /**
     * @brief Stop the WebSocket server
     */
    void Stop();

    /**
     * @brief Check if server is running
     * @return true if running, false otherwise
     */
    bool IsRunning() const;

    /**
     * @brief Send a message to all connected clients
     * @param message JSON message as string
     */
    void BroadcastMessage(const std::string& message);

    /**
     * @brief Send progress update
     * @param jobId Job identifier
     * @param progress Progress percentage (0-100)
     * @param status Status string (e.g., "processing", "completed")
     * @param message Human-readable message
     */
    void SendProgress(const std::string& jobId, int progress, const std::string& status, const std::string& message);

    /**
     * @brief Send error notification
     * @param jobId Job identifier
     * @param error Error message
     */
    void SendError(const std::string& jobId, const std::string& error);

    /**
     * @brief Send completion notification
     * @param jobId Job identifier
     * @param outputPath Path to generated file
     */
    void SendCompletion(const std::string& jobId, const std::string& outputPath);

    /**
     * @brief Set callback for incoming commands
     * @param callback Function to call when command is received
     */
    void SetCommandCallback(CommandCallback callback);

    /**
     * @brief Get number of connected clients
     * @return Number of active connections
     */
    size_t GetConnectionCount() const;

private:
    /**
     * @brief Accept incoming connections
     */
    void DoAccept();

    /**
     * @brief Handle new client connection
     */
    void OnAccept(beast::error_code ec, tcp::socket socket);

    /**
     * @brief Handle message from client
     */
    void HandleMessage(const std::string& message);

    /**
     * @brief Parse and handle JSON command
     */
    void HandleCommand(const std::string& jsonPayload);

    /**
     * @brief Server run loop (runs in separate thread)
     */
    void RunServer();

    /**
     * @brief Escape JSON string
     */
    std::string EscapeJson(const std::string& str) const;

    net::io_context m_ioc;
    tcp::acceptor m_acceptor;
    std::thread m_serverThread;
    std::vector<std::shared_ptr<WebSocketSession>> m_sessions;
    mutable std::mutex m_sessionMutex;
    CommandCallback m_commandCallback;
    std::atomic<bool> m_running;
    int m_port;
};

#endif // WEBSOCKET_ENABLED

#endif // WEBSOCKET_SERVER_HPP

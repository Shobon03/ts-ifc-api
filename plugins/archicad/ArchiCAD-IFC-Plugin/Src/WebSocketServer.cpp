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

#include "WebSocketServer.hpp"

#ifdef WEBSOCKET_ENABLED

#include <iostream>
#include <sstream>
#include <iomanip>

// ========================================
// WebSocketSession Implementation
// ========================================

WebSocketSession::WebSocketSession(tcp::socket socket)
    : m_ws(std::move(socket))
    , m_open(false)
{
}

WebSocketSession::~WebSocketSession()
{
    Close();
}

void WebSocketSession::Run()
{
    // Set suggested timeout settings for the websocket
    m_ws.set_option(
        websocket::stream_base::timeout::suggested(
            beast::role_type::server));

    // Set a decorator to change the Server of the handshake
    m_ws.set_option(websocket::stream_base::decorator(
        [](websocket::response_type& res)
        {
            res.set(beast::http::field::server,
                std::string("Archicad-Plugin-Beast"));
        }));

    // Accept the websocket handshake
    DoAccept();
}

void WebSocketSession::DoAccept()
{
    m_ws.async_accept(
        beast::bind_front_handler(
            &WebSocketSession::OnAccept,
            shared_from_this()));
}

void WebSocketSession::OnAccept(beast::error_code ec)
{
    if (ec) {
        std::cerr << "WebSocket accept error: " << ec.message() << std::endl;
        return;
    }

    m_open = true;
    std::cout << "✓ WebSocket session accepted" << std::endl;

    // Read a message
    DoRead();
}

void WebSocketSession::DoRead()
{
    m_ws.async_read(
        m_buffer,
        beast::bind_front_handler(
            &WebSocketSession::OnRead,
            shared_from_this()));
}

void WebSocketSession::OnRead(beast::error_code ec, std::size_t bytes_transferred)
{
    boost::ignore_unused(bytes_transferred);

    // This indicates that the session was closed
    if (ec == websocket::error::closed) {
        std::cout << "WebSocket connection closed by client" << std::endl;
        m_open = false;
        return;
    }

    if (ec) {
        std::cerr << "WebSocket read error: " << ec.message() << std::endl;
        m_open = false;
        return;
    }

    // Handle the message
    std::string message = beast::buffers_to_string(m_buffer.data());
    m_buffer.consume(m_buffer.size());

    std::cout << "=== WebSocket Message Received ===" << std::endl;
    std::cout << "Raw message: " << message << std::endl;
    std::cout << "Message length: " << message.length() << std::endl;

    if (m_messageCallback) {
        std::cout << "Calling message callback..." << std::endl;
        m_messageCallback(message);
        std::cout << "Message callback completed" << std::endl;
    } else {
        std::cout << "WARNING: No message callback registered!" << std::endl;
    }

    // Read another message
    DoRead();
}

void WebSocketSession::Send(const std::string& message)
{
    if (!m_open) {
        return;
    }

    std::lock_guard<std::mutex> lock(m_writeMutex);

    // Always add to queue and post
    bool writing = !m_writeQueue.empty();
    m_writeQueue.push_back(message);

    // If not already writing, start
    if (!writing) {
        DoWrite();
    }
}

void WebSocketSession::DoWrite()
{
    if (m_writeQueue.empty()) {
        return;
    }

    m_ws.async_write(
        net::buffer(m_writeQueue.front()),
        beast::bind_front_handler(
            &WebSocketSession::OnWrite,
            shared_from_this()));
}

void WebSocketSession::OnWrite(beast::error_code ec, std::size_t bytes_transferred)
{
    boost::ignore_unused(bytes_transferred);

    if (ec) {
        std::cerr << "WebSocket write error: " << ec.message() << std::endl;
        m_open = false;
        return;
    }

    std::lock_guard<std::mutex> lock(m_writeMutex);
    m_writeQueue.erase(m_writeQueue.begin());

    if (!m_writeQueue.empty()) {
        DoWrite();
    }
}

void WebSocketSession::Close()
{
    if (!m_open) {
        return;
    }

    m_open = false;

    beast::error_code ec;
    m_ws.close(websocket::close_code::normal, ec);

    if (ec) {
        std::cerr << "WebSocket close error: " << ec.message() << std::endl;
    }
}

bool WebSocketSession::IsOpen() const
{
    return m_open;
}

void WebSocketSession::SetMessageCallback(MessageCallback callback)
{
    m_messageCallback = callback;
}

// ========================================
// ArchicadWebSocketServer Implementation
// ========================================

ArchicadWebSocketServer::ArchicadWebSocketServer()
    : m_acceptor(m_ioc)
    , m_running(false)
    , m_port(8081)
{
}

ArchicadWebSocketServer::~ArchicadWebSocketServer()
{
    Stop();
}

bool ArchicadWebSocketServer::Start(int port)
{
    if (m_running) {
        std::cerr << "WebSocket server already running" << std::endl;
        return false;
    }

    m_port = port;

    try {
        tcp::endpoint endpoint{tcp::v4(), static_cast<unsigned short>(port)};

        beast::error_code ec;

        // Open the acceptor
        m_acceptor.open(endpoint.protocol(), ec);
        if (ec) {
            std::cerr << "✗ Failed to open acceptor: " << ec.message() << std::endl;
            return false;
        }

        // Allow address reuse
        m_acceptor.set_option(net::socket_base::reuse_address(true), ec);
        if (ec) {
            std::cerr << "✗ Failed to set reuse_address: " << ec.message() << std::endl;
            return false;
        }

        // Bind to the server address
        m_acceptor.bind(endpoint, ec);
        if (ec) {
            std::cerr << "✗ Failed to bind: " << ec.message() << std::endl;
            return false;
        }

        // Start listening for connections
        m_acceptor.listen(net::socket_base::max_listen_connections, ec);
        if (ec) {
            std::cerr << "✗ Failed to listen: " << ec.message() << std::endl;
            return false;
        }

        m_running = true;

        // Start accepting connections
        DoAccept();

        // Run the I/O service on a background thread
        m_serverThread = std::thread([this]() { RunServer(); });

        std::cout << "✓ WebSocket server started on port " << m_port << std::endl;
        return true;

    } catch (const std::exception& e) {
        std::cerr << "✗ Failed to start WebSocket server: " << e.what() << std::endl;
        return false;
    }
}

void ArchicadWebSocketServer::Stop()
{
    if (!m_running) {
        return;
    }

    std::cout << "Stopping WebSocket server..." << std::endl;

    m_running = false;

    try {
        // Close all sessions
        {
            std::lock_guard<std::mutex> lock(m_sessionMutex);
            for (auto& session : m_sessions) {
                session->Close();
            }
            m_sessions.clear();
        }

        // Stop the acceptor
        beast::error_code ec;
        m_acceptor.close(ec);

        // Stop the io_context
        m_ioc.stop();

        // Wait for the thread
        if (m_serverThread.joinable()) {
            m_serverThread.join();
        }

        std::cout << "✓ WebSocket server stopped" << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "Error stopping WebSocket server: " << e.what() << std::endl;
    }
}

void ArchicadWebSocketServer::RunServer()
{
    try {
        m_ioc.run();
    } catch (const std::exception& e) {
        std::cerr << "Server error: " << e.what() << std::endl;
    }

    m_running = false;
}

void ArchicadWebSocketServer::DoAccept()
{
    m_acceptor.async_accept(
        net::make_strand(m_ioc),
        [this](beast::error_code ec, tcp::socket socket) {
            OnAccept(ec, std::move(socket));
        });
}

void ArchicadWebSocketServer::OnAccept(beast::error_code ec, tcp::socket socket)
{
    if (ec) {
        std::cerr << "Accept error: " << ec.message() << std::endl;
    } else {
        // Create session
        auto session = std::make_shared<WebSocketSession>(std::move(socket));

        // Set callback
        session->SetMessageCallback([this](const std::string& msg) {
            HandleMessage(msg);
        });

        // Store session
        {
            std::lock_guard<std::mutex> lock(m_sessionMutex);
            m_sessions.push_back(session);
        }

        // Run the session
        session->Run();

        std::cout << "✓ Client connected (total: " << GetConnectionCount() << ")" << std::endl;
    }

    // Accept another connection
    if (m_running) {
        DoAccept();
    }
}

void ArchicadWebSocketServer::HandleMessage(const std::string& message)
{
    std::cout << "=== HandleMessage Called ===" << std::endl;
    std::cout << "Message: " << message << std::endl;
    
    try {
        HandleCommand(message);
        std::cout << "HandleCommand completed successfully" << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Error handling message: " << e.what() << std::endl;
    }
}

void ArchicadWebSocketServer::HandleCommand(const std::string& jsonPayload)
{
    std::cout << "=== HandleCommand Called ===" << std::endl;
    std::cout << "JSON Payload: " << jsonPayload << std::endl;
    
    // Simple JSON parsing (basic implementation)
    std::string command;
    std::string jobId;

    // Extract "command" field
    size_t cmdPos = jsonPayload.find("\"command\"");
    if (cmdPos != std::string::npos) {
        size_t colonPos = jsonPayload.find(":", cmdPos);
        size_t quoteStart = jsonPayload.find("\"", colonPos);
        size_t quoteEnd = jsonPayload.find("\"", quoteStart + 1);

        if (quoteStart != std::string::npos && quoteEnd != std::string::npos) {
            command = jsonPayload.substr(quoteStart + 1, quoteEnd - quoteStart - 1);
            std::cout << "Extracted command: '" << command << "'" << std::endl;
        }
    } else {
        std::cout << "WARNING: 'command' field not found in JSON" << std::endl;
    }

    // Extract "jobId" field
    size_t jobPos = jsonPayload.find("\"jobId\"");
    if (jobPos != std::string::npos) {
        size_t colonPos = jsonPayload.find(":", jobPos);
        size_t quoteStart = jsonPayload.find("\"", colonPos);
        size_t quoteEnd = jsonPayload.find("\"", quoteStart + 1);

        if (quoteStart != std::string::npos && quoteEnd != std::string::npos) {
            jobId = jsonPayload.substr(quoteStart + 1, quoteEnd - quoteStart - 1);
            std::cout << "Extracted jobId: '" << jobId << "'" << std::endl;
        }
    } else {
        std::cout << "WARNING: 'jobId' field not found in JSON" << std::endl;
    }

    // Call callback if set
    if (m_commandCallback && !command.empty()) {
        std::cout << "Calling command callback with command='" << command << "', jobId='" << jobId << "'" << std::endl;
        m_commandCallback(command, jobId, jsonPayload);
        std::cout << "Command callback completed" << std::endl;
    } else {
        if (!m_commandCallback) {
            std::cout << "ERROR: Command callback not set!" << std::endl;
        }
        if (command.empty()) {
            std::cout << "ERROR: Command is empty!" << std::endl;
        }
    }
}

bool ArchicadWebSocketServer::IsRunning() const
{
    return m_running;
}

void ArchicadWebSocketServer::BroadcastMessage(const std::string& message)
{
    std::lock_guard<std::mutex> lock(m_sessionMutex);

    // Clean up closed sessions
    m_sessions.erase(
        std::remove_if(m_sessions.begin(), m_sessions.end(),
            [](const std::shared_ptr<WebSocketSession>& session) {
                return !session->IsOpen();
            }),
        m_sessions.end());

    // Broadcast to all open sessions
    for (auto& session : m_sessions) {
        if (session->IsOpen()) {
            session->Send(message);
        }
    }
}

void ArchicadWebSocketServer::SendProgress(const std::string& jobId, int progress, const std::string& status, const std::string& message)
{
    std::ostringstream oss;
    oss << "{"
        << "\"type\":\"progress\","
        << "\"jobId\":\"" << EscapeJson(jobId) << "\","
        << "\"progress\":" << progress << ","
        << "\"status\":\"" << EscapeJson(status) << "\","
        << "\"message\":\"" << EscapeJson(message) << "\""
        << "}";

    BroadcastMessage(oss.str());
}

void ArchicadWebSocketServer::SendError(const std::string& jobId, const std::string& error)
{
    std::ostringstream oss;
    oss << "{"
        << "\"type\":\"error\","
        << "\"jobId\":\"" << EscapeJson(jobId) << "\","
        << "\"error\":\"" << EscapeJson(error) << "\","
        << "\"status\":\"error\""
        << "}";

    BroadcastMessage(oss.str());
}

void ArchicadWebSocketServer::SendCompletion(const std::string& jobId, const std::string& outputPath)
{
    std::ostringstream oss;
    oss << "{"
        << "\"type\":\"completed\","
        << "\"jobId\":\"" << EscapeJson(jobId) << "\","
        << "\"status\":\"completed\","
        << "\"message\":\"Conversion completed successfully\","
        << "\"result\":{"
        << "\"outputPath\":\"" << EscapeJson(outputPath) << "\""
        << "}"
        << "}";

    BroadcastMessage(oss.str());
}

void ArchicadWebSocketServer::SetCommandCallback(CommandCallback callback)
{
    m_commandCallback = callback;
}

size_t ArchicadWebSocketServer::GetConnectionCount() const
{
    std::lock_guard<std::mutex> lock(m_sessionMutex);
    return m_sessions.size();
}

std::string ArchicadWebSocketServer::EscapeJson(const std::string& str) const
{
    std::ostringstream oss;
    for (char c : str) {
        switch (c) {
            case '"':  oss << "\\\""; break;
            case '\\': oss << "\\\\"; break;
            case '\b': oss << "\\b"; break;
            case '\f': oss << "\\f"; break;
            case '\n': oss << "\\n"; break;
            case '\r': oss << "\\r"; break;
            case '\t': oss << "\\t"; break;
            default:
                if (c < 0x20) {
                    oss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                } else {
                    oss << c;
                }
        }
    }
    return oss.str();
}

#endif // WEBSOCKET_ENABLED

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

#include "APIEnvir.h"
#include "ACAPinc.h"
#include "DG.h"

#include "Resources.hpp"

#include "IFCAPI_to_Archicad.hpp"

#ifdef WEBSOCKET_ENABLED
#include "WebSocketServer.hpp"
#include "ConversionHandler.hpp"
#include "ConversionCommand.hpp"
#include "ProgressWindow.hpp"
#include <memory>
#include <iostream>
#include <Windows.h>
#include <sstream>

// Helper para debug que aparece no Visual Studio
static void DebugLog(const std::string& message) {
    std::stringstream ss;
    ss << "[ARCHICAD] " << message << "\n";
    OutputDebugStringA(ss.str().c_str());
    std::cout << ss.str();  // Também manda para cout
}

// Helper para escapar strings para JSON (converte \ em \\)
static std::string EscapeJsonString(const std::string& str) {
    std::string escaped;
    for (char c : str) {
        if (c == '\\') {
            escaped += "\\\\";
        } else if (c == '"') {
            escaped += "\\\"";
        } else {
            escaped += c;
        }
    }
    return escaped;
}

// Global WebSocket server instance
static std::unique_ptr<ArchicadWebSocketServer> g_wsServer;


// Implementação do comando de conversão
GS::ObjectState ConversionCommand::Execute(const GS::ObjectState& parameters, GS::ProcessControl& processControl) const
{
    DebugLog("[MAIN THREAD] ========================================");
    DebugLog("[MAIN THREAD] ConversionCommand::Execute() called!!!");
    DebugLog("[MAIN THREAD] ========================================");

    // Extrai os parâmetros recebidos
    GS::UniString jobId, plnPath, outputPath;
    parameters.Get("jobId", jobId);
    parameters.Get("plnPath", plnPath);
    parameters.Get("outputPath", outputPath);

    DebugLog("[MAIN THREAD] Converting: " + std::string(plnPath.ToCStr().Get()) + " -> " + std::string(outputPath.ToCStr().Get()));

    // Show progress window
    ProgressWindow::Show("PLN to IFC Conversion", "Starting conversion...");
    ProgressWindow::SetJobId(jobId.ToCStr().Get());

    // Chama a lógica de conversão
    bool success = ConversionHandler::ConvertPlnToIfc(
        jobId.ToCStr().Get(),
        plnPath.ToCStr().Get(),
        outputPath.ToCStr().Get(),
        [jobId](int progress, const std::string& message) {
            // Update progress window
            ProgressWindow::UpdateProgress(progress, message);

            // Send WebSocket progress
            if (g_wsServer) {
                std::string status = (progress == 0) ? "error" : (progress == 100) ? "completed" : "processing";
                g_wsServer->SendProgress(jobId.ToCStr().Get(), progress, status, message);
            }
        }
    );

    // Close progress window
    ProgressWindow::Close();

    // Retorna resultado
    GS::ObjectState result;
    result.Add("success", success);
    result.Add("jobId", jobId);

    if (success && g_wsServer) {
        g_wsServer->SendCompletion(jobId.ToCStr().Get(), outputPath.ToCStr().Get());
    } else if (!success && g_wsServer) {
        g_wsServer->SendError(jobId.ToCStr().Get(), "Conversion failed");
    }

    return result;
}

// Implementação do comando de conversão IFC -> PLN
GS::ObjectState ConvertIfcToPlnCommand::Execute(const GS::ObjectState& parameters, GS::ProcessControl& processControl) const
{
    DebugLog("[MAIN THREAD] ========================================");
    DebugLog("[MAIN THREAD] ConvertIfcToPlnCommand::Execute() called!!!");
    DebugLog("[MAIN THREAD] ========================================");

    // Extrai os parâmetros recebidos
    GS::UniString jobId, ifcPath, outputPath;
    parameters.Get("jobId", jobId);
    parameters.Get("ifcPath", ifcPath);
    parameters.Get("outputPath", outputPath);

    DebugLog("[MAIN THREAD] Converting: " + std::string(ifcPath.ToCStr().Get()) + " -> " + std::string(outputPath.ToCStr().Get()));

    // Show progress window
    ProgressWindow::Show("IFC to PLN Conversion", "Starting conversion...");
    ProgressWindow::SetJobId(jobId.ToCStr().Get());

    // Chama a lógica de conversão IFC -> PLN
    bool success = ConversionHandler::ConvertIfcToPln(
        jobId.ToCStr().Get(),
        ifcPath.ToCStr().Get(),
        outputPath.ToCStr().Get(),
        [jobId](int progress, const std::string& message) {
            // Update progress window
            ProgressWindow::UpdateProgress(progress, message);

            // Send WebSocket progress
            if (g_wsServer) {
                std::string status = (progress == 0) ? "error" : (progress == 100) ? "completed" : "processing";
                g_wsServer->SendProgress(jobId.ToCStr().Get(), progress, status, message);
            }
        }
    );

    // Close progress window
    ProgressWindow::Close();

    // Retorna resultado
    GS::ObjectState result;
    result.Add("success", success);
    result.Add("jobId", jobId);

    if (success && g_wsServer) {
        g_wsServer->SendCompletion(jobId.ToCStr().Get(), outputPath.ToCStr().Get());
    } else if (!success && g_wsServer) {
        g_wsServer->SendError(jobId.ToCStr().Get(), "Conversion failed");
    }

    return result;
}

// Implementação do comando simples de Load IFC - cópia exata do menu
GS::ObjectState LoadIfcCommand::Execute(const GS::ObjectState& parameters, GS::ProcessControl& processControl) const
{
    DebugLog("[MAIN THREAD] ========================================");
    DebugLog("[MAIN THREAD] LoadIfcCommand::Execute() called!!!");
    DebugLog("[MAIN THREAD] ========================================");

    // Extrai o caminho do IFC
    GS::UniString jobId, ifcPath;
    parameters.Get("jobId", jobId);
    parameters.Get("ifcPath", ifcPath);

    DebugLog("[MAIN THREAD] Loading IFC: " + std::string(ifcPath.ToCStr().Get()));

    bool success = false;
    std::string errorMsg;

    try {
        // Converter para IO::Location - exatamente como o menu faz
        IO::Location ifcFileLocation;
        ifcFileLocation.Set(ifcPath);

        // Log do caminho completo após conversão
        DebugLog("[MAIN THREAD] Location set to: " + std::string(ifcFileLocation.ToDisplayText().ToCStr().Get()));
        DebugLog("[MAIN THREAD] Location status: " + std::to_string(ifcFileLocation.GetStatus()));

        // Verificar se arquivo existe
        if (ifcFileLocation.GetStatus() != NoError) {
            errorMsg = "IFC file not found!";
            DebugLog("[MAIN THREAD] " + errorMsg);
            goto load_error;
        }

        IO::File ifcFile(ifcFileLocation);
        if (ifcFile.GetStatus() != NoError) {
            errorMsg = "Cannot access IFC file. Please check if the file exists and you have permission to read it.";
            DebugLog("[MAIN THREAD] " + errorMsg);
            goto load_error;
        }

        // Abrir IFC - EXATAMENTE como LoadIFCFile() faz
        API_FileOpenPars openPars;
        BNZeroMemory(&openPars, sizeof(API_FileOpenPars));

        openPars.fileTypeID = APIFType_IfcFile;
        openPars.useStoredLib = true;
        openPars.libGiven = false;
        openPars.file = new IO::Location(ifcFileLocation);

        DebugLog("[MAIN THREAD] Calling ACAPI_ProjectOperation_Open...");
        GSErrCode err = ACAPI_ProjectOperation_Open(&openPars);
        
        delete openPars.file;

        if (err != NoError) {
            errorMsg = "Error opening IFC file. Error code: " + std::to_string(err);
            DebugLog("[MAIN THREAD] " + errorMsg);
            goto load_error;
        }

        DebugLog("[MAIN THREAD] IFC file opened successfully!");
        success = true;

    } catch (const std::exception& e) {
        errorMsg = std::string("Exception: ") + e.what();
        DebugLog("[MAIN THREAD] " + errorMsg);
    } catch (...) {
        errorMsg = "Unknown exception";
        DebugLog("[MAIN THREAD] " + errorMsg);
    }

load_error:
    // Enviar resultado via WebSocket
    if (g_wsServer) {
        if (success) {
            g_wsServer->SendProgress(jobId.ToCStr().Get(), 100, "completed", "IFC file loaded successfully");
        } else {
            g_wsServer->SendError(jobId.ToCStr().Get(), errorMsg);
        }
    }

    // Retornar resultado
    GS::ObjectState result;
    result.Add("success", success);
    result.Add("jobId", jobId);
    if (!errorMsg.empty()) {
        result.Add("error", GS::UniString(errorMsg.c_str()));
    }

    return result;
}
#endif


enum APITestMenu {
	LoadIFCFileMenuItem = 1,
	SaveProjectAsPLNMenuItem,
	ExportProjectAsIFCMenuItem
};

enum APIWebSocketMenu {
	StartWebSocketServerMenuItem = 1,
	StopWebSocketServerMenuItem
};


GSErrCode MenuCommandHandler (const API_MenuParams *menuParams)
{
	switch (menuParams->menuItemRef.menuResID) {
		case IFCAPI_TEST_MENU_STRINGS:
			{
				switch (menuParams->menuItemRef.itemIndex) {
					case LoadIFCFileMenuItem: LoadIFCFile (); break;
					case SaveProjectAsPLNMenuItem: SaveProjectAsPln (); break;
					case ExportProjectAsIFCMenuItem: ExportProjectAsIFC (); break;
				}
				break;
			}
#ifdef WEBSOCKET_ENABLED
		case IFCAPI_WEBSOCKET_MENU_STRINGS:
			{
				switch (menuParams->menuItemRef.itemIndex) {
					case StartWebSocketServerMenuItem: StartWebSocketServer (); break;
					case StopWebSocketServerMenuItem: StopWebSocketServer (); break;
				}
				break;
			}
#endif
		default:
			DBBREAK_STR ("Unhandled menu item!"); break;
	}

	ACAPI_KeepInMemory (true);

	return NoError;
}


API_AddonType CheckEnvironment (API_EnvirParams* envir)
{
	if (envir->serverInfo.serverApplication != APIAppl_ArchiCADID)
		return APIAddon_DontRegister;

	RSGetIndString (&envir->addOnInfo.name, IFC_TO_ARCHICAD_ADDON_NAME, 1, ACAPI_GetOwnResModule ());
	RSGetIndString (&envir->addOnInfo.description, IFC_TO_ARCHICAD_ADDON_NAME, 2, ACAPI_GetOwnResModule ());

	return APIAddon_Normal;
}


GSErrCode RegisterInterface (void)
{
	GSErrCode err = NoError;

	// Register Debug submenu
	err = ACAPI_MenuItem_RegisterMenu (IFCAPI_TEST_MENU_STRINGS, IFCAPI_TEST_MENU_PROMPT_STRINGS, MenuCode_UserDef, MenuFlag_InsertIntoSame);
	DBASSERT (err == NoError);

#ifdef WEBSOCKET_ENABLED
	// Register WebSocket submenu
	err = ACAPI_MenuItem_RegisterMenu (IFCAPI_WEBSOCKET_MENU_STRINGS, IFCAPI_WEBSOCKET_MENU_PROMPT_STRINGS, MenuCode_UserDef, MenuFlag_InsertIntoSame);
	DBASSERT (err == NoError);
#endif

	return err;
}


GSErrCode Initialize (void)
{
	GSErrCode err = NoError;

	// Install menu handler for Debug submenu
	err = ACAPI_MenuItem_InstallMenuHandler (IFCAPI_TEST_MENU_STRINGS, MenuCommandHandler);
	DBASSERT (err == NoError);

#ifdef WEBSOCKET_ENABLED
	// Install menu handler for WebSocket submenu
	err = ACAPI_MenuItem_InstallMenuHandler (IFCAPI_WEBSOCKET_MENU_STRINGS, MenuCommandHandler);
	DBASSERT (err == NoError);

    // Registrar o command handler para a conversão PLN -> IFC
    err = ACAPI_AddOnAddOnCommunication_InstallAddOnCommandHandler(
        GS::Owner<API_AddOnCommand>(new ConversionCommand())
    );
    if (err == NoError) {
        std::cout << "ConversionCommand (PLN->IFC) registered successfully" << std::endl;
    } else {
        std::cerr << "Failed to register ConversionCommand. Error: " << err << std::endl;
    }

    // Registrar o command handler para a conversão IFC -> PLN
    err = ACAPI_AddOnAddOnCommunication_InstallAddOnCommandHandler(
        GS::Owner<API_AddOnCommand>(new ConvertIfcToPlnCommand())
    );
    if (err == NoError) {
        std::cout << "ConvertIfcToPlnCommand (IFC->PLN) registered successfully" << std::endl;
    } else {
        std::cerr << "Failed to register ConvertIfcToPlnCommand. Error: " << err << std::endl;
    }

    // Registrar comando simples de Load IFC (cópia exata do menu)
    err = ACAPI_AddOnAddOnCommunication_InstallAddOnCommandHandler(
        GS::Owner<API_AddOnCommand>(new LoadIfcCommand())
    );
    if (err == NoError) {
        std::cout << "LoadIfcCommand (Simple IFC Load) registered successfully" << std::endl;
    } else {
        std::cerr << "Failed to register LoadIfcCommand. Error: " << err << std::endl;
    }
#endif

	return err;
}


GSErrCode FreeData (void)
{
#ifdef WEBSOCKET_ENABLED
	// Cleanup any pending conversions and close projects
	ConversionHandler::Cleanup();

	// Stop WebSocket server on plugin unload
	if (g_wsServer && g_wsServer->IsRunning()) {
		g_wsServer->Stop();
	}
	g_wsServer.reset();
#endif

	return NoError;
}

#ifdef WEBSOCKET_ENABLED

// WebSocket command handler - EXECUTADO NA THREAD DO WEBSOCKET
void HandleWebSocketCommand(const std::string& command, const std::string& jobId, const std::string& payload)
{
	std::cout << "===============================================" << std::endl;
	std::cout << "HandleWebSocketCommand CALLED!" << std::endl;
	std::cout << "Command: '" << command << "'" << std::endl;
	std::cout << "JobId: '" << jobId << "'" << std::endl;
	std::cout << "Payload length: " << payload.length() << std::endl;
	std::cout << "===============================================" << std::endl;
	
	DebugLog("[WEBSOCKET THREAD] ========================================");
	DebugLog("[WEBSOCKET THREAD] Received command: " + command + " (job: " + jobId + ")");
	DebugLog("[WEBSOCKET THREAD] ========================================");
	
	if (command == "start_conversion") {
		// Extract paths from JSON - supports both plnPath/pln_path and ifcPath/ifc_path
		std::string inputPath;
		std::string outputPath;
		bool isPlnToIfc = false;  // Will be determined from which field is present

		DebugLog("[WEBSOCKET THREAD] Payload received: " + payload);

		// Try to extract plnPath or pln_path (PLN -> IFC conversion)
		size_t plnPos = payload.find("\"plnPath\"");
		if (plnPos == std::string::npos) {
			plnPos = payload.find("\"pln_path\"");
		}
		
		if (plnPos != std::string::npos) {
			size_t colonPos = payload.find(":", plnPos);
			size_t quoteStart = payload.find("\"", colonPos);
			size_t quoteEnd = payload.find("\"", quoteStart + 1);
			if (quoteStart != std::string::npos && quoteEnd != std::string::npos) {
				inputPath = payload.substr(quoteStart + 1, quoteEnd - quoteStart - 1);
				isPlnToIfc = true;
				DebugLog("[WEBSOCKET THREAD] Detected PLN -> IFC conversion");
			}
		}

		// If plnPath not found, try ifcPath or ifc_path (IFC -> PLN conversion)
		if (inputPath.empty()) {
			size_t ifcPos = payload.find("\"ifcPath\"");
			if (ifcPos == std::string::npos) {
				ifcPos = payload.find("\"ifc_path\"");
			}
			
			if (ifcPos != std::string::npos) {
				size_t colonPos = payload.find(":", ifcPos);
				size_t quoteStart = payload.find("\"", colonPos);
				size_t quoteEnd = payload.find("\"", quoteStart + 1);
				if (quoteStart != std::string::npos && quoteEnd != std::string::npos) {
					inputPath = payload.substr(quoteStart + 1, quoteEnd - quoteStart - 1);
					isPlnToIfc = false;
					DebugLog("[WEBSOCKET THREAD] Detected IFC -> PLN conversion");
				}
			}
		}

		// Extract outputPath or output_path
		size_t outPos = payload.find("\"outputPath\"");
		if (outPos == std::string::npos) {
			outPos = payload.find("\"output_path\"");
		}
		
		if (outPos != std::string::npos) {
			size_t colonPos = payload.find(":", outPos);
			size_t quoteStart = payload.find("\"", colonPos);
			size_t quoteEnd = payload.find("\"", quoteStart + 1);
			if (quoteStart != std::string::npos && quoteEnd != std::string::npos) {
				outputPath = payload.substr(quoteStart + 1, quoteEnd - quoteStart - 1);
			}
		}

		DebugLog("[WEBSOCKET THREAD] Extracted inputPath: '" + inputPath + "'");
		DebugLog("[WEBSOCKET THREAD] Extracted outputPath: '" + outputPath + "'");
		DebugLog("[WEBSOCKET THREAD] Conversion direction: " + std::string(isPlnToIfc ? "PLN->IFC" : "IFC->PLN"));

		if (inputPath.empty() || outputPath.empty()) {
			DebugLog("[WEBSOCKET THREAD] ERROR: Missing paths!");
			if (g_wsServer) {
				g_wsServer->SendError(jobId, "Missing input path (pln_path or ifc_path) and output_path");
			}
			return;
		}

        // Call appropriate command via HTTP based on conversion direction
        DebugLog("[WEBSOCKET THREAD] Calling command via HTTP on main thread...");

        try {
            // Get the HTTP port
            UShort httpPort = 0;
            GSErrCode err = ACAPI_Command_GetHttpConnectionPort(&httpPort);
            if (err != NoError) {
                DebugLog("[WEBSOCKET THREAD] Failed to get HTTP port. Error: " + std::to_string(err));
                if (g_wsServer) {
                    g_wsServer->SendError(jobId, "Failed to get HTTP port. Error: " + std::to_string(err));
                }
                return;
            }

            DebugLog("[WEBSOCKET THREAD] HTTP port: " + std::to_string(httpPort));

            // Build HTTP request JSON - select command based on conversion direction
            // Escape paths for JSON
            std::string escapedInputPath = EscapeJsonString(inputPath);
            std::string escapedOutputPath = EscapeJsonString(outputPath);

            std::string commandName = isPlnToIfc ? "ConvertPlnToIfc" : "ConvertIfcToPln";
            std::string inputParamName = isPlnToIfc ? "plnPath" : "ifcPath";

            std::string requestJson = "{"
                "\"command\": \"API.ExecuteAddOnCommand\","
                "\"parameters\": {"
                    "\"addOnCommandId\": {"
                        "\"commandNamespace\": \"IFCPlugin\","
                        "\"commandName\": \"" + commandName + "\""
                    "},"
                    "\"addOnCommandParameters\": {"
                        "\"jobId\": \"" + jobId + "\","
                        "\"" + inputParamName + "\": \"" + escapedInputPath + "\","
                        "\"outputPath\": \"" + escapedOutputPath + "\""
                    "}"
                "}"
            "}";

            DebugLog("[WEBSOCKET THREAD] Request JSON: " + requestJson);

            // Make HTTP POST request using Boost.Beast (we already have it linked)
            // This will cause Execute() to run on ArchiCAD's main thread
            try {
                net::io_context ioc;
                tcp::resolver resolver(ioc);
                tcp::socket socket(ioc);

                // Connect to localhost:httpPort
                auto const results = resolver.resolve("127.0.0.1", std::to_string(httpPort));
                net::connect(socket, results.begin(), results.end());

                // Build HTTP POST request
                std::string httpRequest =
                    "POST / HTTP/1.1\r\n"
                    "Host: 127.0.0.1:" + std::to_string(httpPort) + "\r\n"
                    "Content-Type: application/json;charset=utf-8\r\n"
                    "Content-Length: " + std::to_string(requestJson.length()) + "\r\n"
                    "Connection: close\r\n"
                    "\r\n" +
                    requestJson;

                // Send HTTP request
                net::write(socket, net::buffer(httpRequest));

                // Read HTTP response
                beast::flat_buffer buffer;
                beast::error_code ec;

                // Read until socket closes
                while (true) {
                    char buf[1024];
                    size_t bytes = socket.read_some(net::buffer(buf), ec);
                    if (ec == net::error::eof) break;
                    if (ec) throw beast::system_error{ec};

                    std::cout.write(buf, bytes);
                }

                socket.shutdown(tcp::socket::shutdown_both, ec);

                DebugLog("[WEBSOCKET THREAD] HTTP request sent successfully");

            } catch (const std::exception& e) {
                DebugLog("[WEBSOCKET THREAD] HTTP request failed: " + std::string(e.what()));
                if (g_wsServer) {
                    g_wsServer->SendError(jobId, std::string("HTTP request failed: ") + e.what());
                }
            }

        } catch (const std::exception& e) {
            DebugLog("[WEBSOCKET THREAD] Exception: " + std::string(e.what()));
            if (g_wsServer) {
                g_wsServer->SendError(jobId, std::string("Exception: ") + e.what());
            }
        }

	} else if (command == "cancel_job") {
		bool cancelled = ConversionHandler::CancelConversion(jobId);
		if (cancelled && g_wsServer) {
			g_wsServer->SendProgress(jobId, 0, "cancelled", "Conversion cancelled");
		}

	} else if (command == "get_status") {
		if (g_wsServer) {
			std::string status = ConversionHandler::IsConversionInProgress(jobId) ?
			                     "processing" : "idle";
			g_wsServer->SendProgress(jobId, 0, status, "Plugin ready");
		}
	
	} else if (command == "load_ifc") {
		// Comando simples para carregar IFC - igual ao menu
		std::string ifcPath;

		DebugLog("[WEBSOCKET THREAD] Load IFC command received");

		// Extract ifcPath
		size_t ifcPos = payload.find("\"ifcPath\"");
		if (ifcPos != std::string::npos) {
			size_t colonPos = payload.find(":", ifcPos);
			size_t quoteStart = payload.find("\"", colonPos);
			size_t quoteEnd = payload.find("\"", quoteStart + 1);
			if (quoteStart != std::string::npos && quoteEnd != std::string::npos) {
				ifcPath = payload.substr(quoteStart + 1, quoteEnd - quoteStart - 1);
			}
		}

		DebugLog("[WEBSOCKET THREAD] Extracted ifcPath: '" + ifcPath + "'");

		if (ifcPath.empty()) {
			DebugLog("[WEBSOCKET THREAD] ERROR: Missing ifcPath!");
			if (g_wsServer) {
				g_wsServer->SendError(jobId, "Missing ifcPath parameter");
			}
			return;
		}

		// Chamar comando via HTTP
		DebugLog("[WEBSOCKET THREAD] Calling LoadIfc command via HTTP...");

		try {
			UShort httpPort = 0;
			GSErrCode err = ACAPI_Command_GetHttpConnectionPort(&httpPort);
			if (err != NoError) {
				DebugLog("[WEBSOCKET THREAD] Failed to get HTTP port");
				if (g_wsServer) {
					g_wsServer->SendError(jobId, "Failed to get HTTP port");
				}
				return;
			}

			DebugLog("[WEBSOCKET THREAD] HTTP port: " + std::to_string(httpPort));

			// Escapar path para JSON
			std::string escapedIfcPath = EscapeJsonString(ifcPath);

			// Montar request JSON
			std::string requestJson = "{"
				"\"command\": \"API.ExecuteAddOnCommand\","
				"\"parameters\": {"
					"\"addOnCommandId\": {"
						"\"commandNamespace\": \"IFCPlugin\","
						"\"commandName\": \"LoadIfc\""
					"},"
					"\"addOnCommandParameters\": {"
						"\"jobId\": \"" + jobId + "\","
						"\"ifcPath\": \"" + escapedIfcPath + "\""
					"}"
				"}"
			"}";

			DebugLog("[WEBSOCKET THREAD] Request JSON: " + requestJson);

			// Fazer HTTP POST
			try {
				net::io_context ioc;
				tcp::resolver resolver(ioc);
				tcp::socket socket(ioc);

				auto const results = resolver.resolve("127.0.0.1", std::to_string(httpPort));
				net::connect(socket, results.begin(), results.end());

				std::string httpRequest =
					"POST / HTTP/1.1\r\n"
					"Host: 127.0.0.1:" + std::to_string(httpPort) + "\r\n"
					"Content-Type: application/json;charset=utf-8\r\n"
					"Content-Length: " + std::to_string(requestJson.length()) + "\r\n"
					"Connection: close\r\n"
					"\r\n" +
					requestJson;

				net::write(socket, net::buffer(httpRequest));

				// Ler resposta
				beast::flat_buffer buffer;
				beast::error_code ec;

				while (true) {
					char buf[1024];
					size_t bytes = socket.read_some(net::buffer(buf), ec);
					if (ec == net::error::eof) break;
					if (ec) throw beast::system_error{ec};
					std::cout.write(buf, bytes);
				}

				socket.shutdown(tcp::socket::shutdown_both, ec);

				DebugLog("[WEBSOCKET THREAD] HTTP request sent successfully");

			} catch (const std::exception& e) {
				DebugLog("[WEBSOCKET THREAD] HTTP request failed: " + std::string(e.what()));
				if (g_wsServer) {
					g_wsServer->SendError(jobId, std::string("HTTP request failed: ") + e.what());
				}
			}

		} catch (const std::exception& e) {
			DebugLog("[WEBSOCKET THREAD] Exception: " + std::string(e.what()));
			if (g_wsServer) {
				g_wsServer->SendError(jobId, std::string("Exception: ") + e.what());
			}
		}
	}
}

void StartWebSocketServer()
{
	if (g_wsServer && g_wsServer->IsRunning()) {
		DGAlert(DG_INFORMATION, GS::UniString("Info"),
		        GS::UniString("WebSocket server is already running"),
		        GS::UniString(), GS::UniString("OK"));
		return;
	}

	if (!g_wsServer) {
		g_wsServer = std::make_unique<ArchicadWebSocketServer>();
		g_wsServer->SetCommandCallback(HandleWebSocketCommand);
	}

	bool started = g_wsServer->Start(8081);

	if (started) {
		DGAlert(DG_INFORMATION, GS::UniString("Success"),
		        GS::UniString("✓ WebSocket server started on port 8081"),
		        GS::UniString("Listening for connections from Node.js backend"),
		        GS::UniString("OK"));
	} else {
		DGAlert(DG_ERROR, GS::UniString("Error"),
		        GS::UniString("✗ Failed to start WebSocket server"),
		        GS::UniString("Check if port 8081 is available"),
		        GS::UniString("OK"));
	}
}

void StopWebSocketServer()
{
	if (!g_wsServer || !g_wsServer->IsRunning()) {
		DGAlert(DG_INFORMATION, GS::UniString("Info"),
		        GS::UniString("WebSocket server is not running"),
		        GS::UniString(), GS::UniString("OK"));
		return;
	}

	g_wsServer->Stop();

	DGAlert(DG_INFORMATION, GS::UniString("Success"),
	        GS::UniString("✓ WebSocket server stopped"),
	        GS::UniString(), GS::UniString("OK"));
}
#endif

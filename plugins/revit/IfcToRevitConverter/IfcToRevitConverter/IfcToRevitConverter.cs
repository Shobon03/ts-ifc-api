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

using Autodesk.Revit.ApplicationServices;
using Application = Autodesk.Revit.ApplicationServices.Application;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using TaskDialog = Autodesk.Revit.UI.TaskDialog;
using Autodesk.Revit.DB.IFC;
using System;
using System.IO;
using System.Threading.Tasks;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using Form = System.Windows.Forms.Form;
using Label = System.Windows.Forms.Label;
using ProgressBar = System.Windows.Forms.ProgressBar;
using Screen = System.Windows.Forms.Screen;
using Newtonsoft.Json;

namespace IfcToRevitConverter
{
    /// <summary>
    /// Plugin status window
    /// </summary>
    public partial class PluginStatusForm : Form
    {
        private Label titleLabel;
        private Label descriptionLabel;
        private Label statusLabel;
        private ProgressBar progressBar;

        public PluginStatusForm()
        {
            InitializeComponents();
        }

        private void InitializeComponents()
        {
            this.Text = "IFC Conversion Plugin";
            this.Size = new System.Drawing.Size(300, 150);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = System.Windows.Forms.FormStartPosition.Manual;
            this.TopMost = true;

            // Position in top right corner
            this.Location = new System.Drawing.Point(
                Screen.PrimaryScreen.WorkingArea.Width - this.Width - 20,
                20
            );

            // Title
            titleLabel = new Label();
            titleLabel.Text = "IFC Conversion Plugin:  .ifc → .rvt";
            titleLabel.Font = new System.Drawing.Font("Arial", 10, System.Drawing.FontStyle.Bold);
            titleLabel.Location = new System.Drawing.Point(10, 10);
            titleLabel.Size = new System.Drawing.Size(280, 20);
            this.Controls.Add(titleLabel);

            // Description
            descriptionLabel = new Label();
            descriptionLabel.Text = "Conversion from IFC to RVT files.";
            descriptionLabel.Font = new System.Drawing.Font("Arial", 8);
            descriptionLabel.Location = new System.Drawing.Point(10, 35);
            descriptionLabel.Size = new System.Drawing.Size(280, 15);
            this.Controls.Add(descriptionLabel);

            // Status
            statusLabel = new Label();
            statusLabel.Text = "Starting...";
            statusLabel.Location = new System.Drawing.Point(10, 60);
            statusLabel.Size = new System.Drawing.Size(280, 20);
            this.Controls.Add(statusLabel);

            // Progress bar
            progressBar = new ProgressBar();
            progressBar.Location = new System.Drawing.Point(10, 85);
            progressBar.Size = new System.Drawing.Size(260, 20);
            progressBar.Minimum = 0;
            progressBar.Maximum = 100;
            progressBar.Value = 0;
            this.Controls.Add(progressBar);
        }

        public void UpdateStatus(string status, int progress)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<string, int>(UpdateStatus), status, progress);
                return;
            }

            statusLabel.Text = status;
            progressBar.Value = Math.Max(0, Math.Min(100, progress));
        }

        public void CloseForm()
        {
            if (InvokeRequired)
            {
                Invoke(new Action(CloseForm));
                return;
            }

            this.Close();
        }
    }

    /// <summary>
    /// Enums for conversion status
    /// </summary>
    public enum ConversionStatus
    {
        QUEUED,
        UPLOADING,
        PROCESSING,
        DOWNLOADING,
        COMPLETED,
        ERROR,
        CANCELLED
    }

    /// <summary>
    /// Conversion result
    /// </summary>
    public class ConversionResult
    {
        public string downloadUrl { get; set; }
        public string fileName { get; set; }
        public long fileSize { get; set; }
    }

    /// <summary>
    /// Conversion progress
    /// </summary>
    public class ConversionProgress
    {
        public string jobId { get; set; }
        public ConversionStatus status { get; set; }
        public int progress { get; set; }
        public string message { get; set; }
        public object details { get; set; }
        public string error { get; set; }
        public ConversionResult result { get; set; }
    }

    /// <summary>
    /// Class to manage pending conversion requests
    /// </summary>
    public static class ConversionRequestManager
    {
        public static bool HasPendingRequest { get; set; } = false;
        public static string PendingFilePath { get; set; } = "";
        public static string PendingOutputPath { get; set; } = "";
        public static string PendingJobId { get; set; } = "";
    }

    /// <summary>
    /// ExternalEvent Handler to execute conversion on the main thread
    /// </summary>
    public class ConversionEventHandler : IExternalEventHandler
    {
        public void Execute(UIApplication app)
        {
            if (!ConversionRequestManager.HasPendingRequest)
                return;

            try
            {
                string ifcFilePath = ConversionRequestManager.PendingFilePath;
                string outputPath = ConversionRequestManager.PendingOutputPath;
                string jobId = ConversionRequestManager.PendingJobId;

                // Reset pending request
                ConversionRequestManager.HasPendingRequest = false;

                // Execute conversion on main thread
                ExecuteConversionSync(app.Application, ifcFilePath, outputPath, jobId);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error in ExternalEventHandler: {ex.Message}");

                Task.Run(async () => {
                    await BroadcastProgress("ERROR", 0, $"Processing error: {ex.Message}");
                });
            }
        }

        public string GetName()
        {
            return "IFC Conversion Event Handler";
        }

        private void ExecuteConversionSync(Application app, string ifcFilePath, string outputPath, string jobId)
        {
            try
            {
                // Store jobId for use in BroadcastProgress
                IfcToRevitWebSocketCommand._staticJobId = jobId;

                UpdateStatusWindow("Validating IFC file...", 15);
                BroadcastProgress("UPLOADING", 15, "IFC file validated, preparing for import...", jobId).Wait();

                if (!File.Exists(ifcFilePath))
                {
                    UpdateStatusWindow("IFC file not found", 0);
                    BroadcastProgress("ERROR", 0, $"IFC file not found: {ifcFilePath}", jobId).Wait();
                    return;
                }

                UpdateStatusWindow("Configuring import...", 25);
                BroadcastProgress("PROCESSING", 25, "Configuring IFC import options...", jobId).Wait();

                // Configure import options
                IFCImportOptions importOptions = new IFCImportOptions();
                importOptions.Intent = IFCImportIntent.Reference;
                importOptions.AutoJoin = true;

                UpdateStatusWindow("Opening IFC document...", 35);
                BroadcastProgress("PROCESSING", 35, "Opening IFC document...", jobId).Wait();

                // Open IFC document on main thread
                Document ifcDocument = app.OpenIFCDocument(ifcFilePath, importOptions);

                if (ifcDocument == null)
                {
                    UpdateStatusWindow("Failed to open IFC", 0);
                    BroadcastProgress("ERROR", 0, "Failed to open IFC file - document returned as null", jobId).Wait();
                    return;
                }

                UpdateStatusWindow("Processing elements...", 65);
                BroadcastProgress("PROCESSING", 65, "IFC document opened successfully, preparing to save...", jobId).Wait();

                // Use outputPath if provided, otherwise use default naming
                string rvtFilePath;
                string outputFileName;
                if (!string.IsNullOrEmpty(outputPath))
                {
                    rvtFilePath = outputPath;
                    outputFileName = Path.GetFileName(outputPath);
                    // Ensure output directory exists
                    string outputDir = Path.GetDirectoryName(outputPath);
                    if (!string.IsNullOrEmpty(outputDir) && !Directory.Exists(outputDir))
                    {
                        Directory.CreateDirectory(outputDir);
                    }
                }
                else
                {
                    string outputDirectory = Path.GetDirectoryName(ifcFilePath);
                    outputFileName = Path.GetFileNameWithoutExtension(ifcFilePath) + $"_Converted_{DateTime.Now:yyyyMMdd_HHmmss}.rvt";
                    rvtFilePath = Path.Combine(outputDirectory, outputFileName);
                }

                UpdateStatusWindow("Saving RVT file...", 75);
                BroadcastProgress("PROCESSING", 75, $"Saving as: {outputFileName}...", jobId).Wait();

                // Save document
                SaveAsOptions saveOptions = new SaveAsOptions { OverwriteExistingFile = true };
                ifcDocument.SaveAs(rvtFilePath, saveOptions);

                UpdateStatusWindow("Finalizing process...", 90);
                BroadcastProgress("DOWNLOADING", 90, "File saved, finalizing process...", jobId).Wait();

                // Close document
                ifcDocument.Close(false);

                // Get file size
                long fileSize = new FileInfo(rvtFilePath).Length;

                UpdateStatusWindow("Conversion completed!", 100);
                BroadcastProgressWithResult("COMPLETED", 100, $"Conversion completed! File: {outputFileName}", jobId, rvtFilePath, outputFileName, fileSize).Wait();

                // Reset status after 3 seconds
                Task.Delay(3000).ContinueWith(t => {
                    UpdateStatusWindow("Awaiting WebSocket commands...", 0);
                });
            }
            catch (Exception ex)
            {
                string detailedError = $"Conversion error: {ex.GetType().Name} - {ex.Message}";
                if (ex.InnerException != null)
                {
                    detailedError += $"\nInner Exception: {ex.InnerException.Message}";
                }

                UpdateStatusWindow($"Error: {ex.Message}", 0);
                BroadcastProgress("ERROR", 0, detailedError, jobId).Wait();

                System.Diagnostics.Debug.WriteLine($"Conversion Error Details: {detailedError}");
            }
        }

        private static void UpdateStatusWindow(string status, int progress)
        {
            try
            {
                IfcToRevitWebSocketCommand._staticStatusForm?.UpdateStatus(status, progress);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error updating status window: {ex.Message}");
            }
        }

        private static async Task BroadcastProgress(string status, int progress, string message, string jobId = null)
        {
            if (IfcToRevitWebSocketCommand._staticWebSocketServer == null) return;

            try
            {
                var progressData = new
                {
                    type = MapStatusToMessageType(status),
                    jobId = jobId ?? IfcToRevitWebSocketCommand._staticJobId,
                    status = status.ToLower(),
                    progress = progress,
                    message = message,
                    timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                };

                var json = JsonConvert.SerializeObject(progressData);
                await IfcToRevitWebSocketCommand._staticWebSocketServer.BroadcastAsync(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error broadcasting progress: {ex.Message}");
            }
        }

        private static async Task BroadcastProgressWithResult(string status, int progress, string message, string jobId, string outputPath, string fileName, long fileSize)
        {
            if (IfcToRevitWebSocketCommand._staticWebSocketServer == null) return;

            try
            {
                var progressData = new
                {
                    type = "conversion_completed",
                    jobId = jobId,
                    status = status.ToLower(),
                    progress = progress,
                    message = message,
                    result = new
                    {
                        outputPath = outputPath,
                        fileName = fileName,
                        fileSize = fileSize
                    },
                    timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                };

                var json = JsonConvert.SerializeObject(progressData);
                await IfcToRevitWebSocketCommand._staticWebSocketServer.BroadcastAsync(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error broadcasting progress: {ex.Message}");
            }
        }

        public static string MapStatusToMessageType(string status)
        {
            switch (status.ToLower())
            {
                case "uploading":
                    return "conversion_progress";
                case "processing":
                    return "conversion_progress";
                case "downloading":
                    return "conversion_progress";
                case "completed":
                    return "conversion_completed";
                case "error":
                    return "conversion_failed";
                case "cancelled":
                    return "conversion_cancelled";
                case "received":
                    return "conversion_started";
                default:
                    return "progress";
            }
        }
    }

    /// <summary>
    /// Servidor WebSocket interno
    /// </summary>
    public class WebSocketServer : IDisposable
    {
        private HttpListener _httpListener;
        private bool _isRunning;
        private readonly string _url;
        private readonly List<WebSocket> _connectedClients;
        private readonly object _clientsLock = new object();

        public Func<string, Task> OnMessageReceived { get; set; }

        public WebSocketServer(string url = "http://localhost:8082/")
        {
            _url = url;
            _connectedClients = new List<WebSocket>();
        }

        public async Task StartAsync()
        {
            try
            {
                _httpListener = new HttpListener();
                _httpListener.Prefixes.Add(_url);
                _httpListener.Start();
                _isRunning = true;

                System.Diagnostics.Debug.WriteLine($"WebSocket Server started at: {_url}");
                _ = Task.Run(AcceptClientsAsync);
            }
            catch (Exception ex)
            {
                throw new Exception($"Error starting WebSocket server: {ex.Message}");
            }
        }

        private async Task AcceptClientsAsync()
        {
            while (_isRunning)
            {
                try
                {
                    var context = await _httpListener.GetContextAsync();

                    if (context.Request.IsWebSocketRequest)
                    {
                        _ = Task.Run(() => ProcessWebSocketRequest(context));
                    }
                    else
                    {
                        context.Response.StatusCode = 400;
                        context.Response.Close();
                    }
                }
                catch (Exception ex) when (_isRunning)
                {
                    System.Diagnostics.Debug.WriteLine($"Error accepting client: {ex.Message}");
                }
            }
        }

        private async Task ProcessWebSocketRequest(HttpListenerContext context)
        {
            try
            {
                var webSocketContext = await context.AcceptWebSocketAsync(null);
                var webSocket = webSocketContext.WebSocket;

                lock (_clientsLock)
                {
                    _connectedClients.Add(webSocket);
                }

                System.Diagnostics.Debug.WriteLine("WebSocket client connected");

                await SendToClient(webSocket, JsonConvert.SerializeObject(new
                {
                    type = "connection",
                    status = "connected",
                    message = "Connected to Revit IFC plugin",
                    available_commands = new[] { "start_conversion", "get_status", "cancel_job", "update_path" }
                }));

                await HandleWebSocketClient(webSocket);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error processing WebSocket: {ex.Message}");
            }
        }

        private async Task HandleWebSocketClient(WebSocket webSocket)
        {
            var buffer = new byte[1024 * 4];

            try
            {
                while (webSocket.State == WebSocketState.Open)
                {
                    var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        System.Diagnostics.Debug.WriteLine($"Message received: {message}");

                        if (OnMessageReceived != null)
                        {
                            await OnMessageReceived(message);
                        }
                    }
                    else if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error in WebSocket communication: {ex.Message}");
            }
            finally
            {
                lock (_clientsLock)
                {
                    _connectedClients.Remove(webSocket);
                }
                System.Diagnostics.Debug.WriteLine("WebSocket client disconnected");
            }
        }

        private async Task SendToClient(WebSocket client, string message)
        {
            if (client.State == WebSocketState.Open)
            {
                var bytes = Encoding.UTF8.GetBytes(message);
                await client.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }

        public async Task BroadcastAsync(string message)
        {
            var bytes = Encoding.UTF8.GetBytes(message);
            var tasks = new List<Task>();

            lock (_clientsLock)
            {
                foreach (var client in _connectedClients.ToList())
                {
                    if (client.State == WebSocketState.Open)
                    {
                        tasks.Add(client.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None));
                    }
                }
            }

            if (tasks.Count > 0)
            {
                await Task.WhenAll(tasks);
            }
        }

        public void Stop()
        {
            _isRunning = false;
            _httpListener?.Stop();
        }

        public void Dispose()
        {
            Stop();
            _httpListener?.Close();
        }
    }

    /// <summary>
    /// Configurações do plugin
    /// </summary>
    public static class IfcConverterConfig
    {
        public static string WebSocketServerUrl { get; set; } = "ws://localhost:8082/ws";
        public static string InternalWebSocketUrl { get; set; } = "http://localhost:8082/";
        public static string DefaultIfcPath { get; set; } = @"C:\Users\Matheus\Desktop\example.ifc";
        public static bool UseWebSocket { get; set; } = true;
        public static bool UseInternalServer { get; set; } = true;
        public static bool ShowPersistentStatus { get; set; } = false;
        public static int TimeoutMinutes { get; set; } = 10;
    }

    /// <summary>
    /// Plugin principal - Modo WebSocket (só inicializa, aguarda comandos)
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class IfcToRevitWebSocketCommand : IExternalCommand
    {
        public static WebSocketServer _staticWebSocketServer;
        public static string _staticJobId;
        public static PluginStatusForm _staticStatusForm;
        public static ExternalEvent _conversionEvent;
        public static ConversionEventHandler _conversionHandler;

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIApplication uiapp = commandData.Application;
            Application app = uiapp.Application;

            _staticJobId = Guid.NewGuid().ToString();

            try
            {
                // Inicializar ExternalEvent para conversão
                if (_conversionHandler == null)
                {
                    _conversionHandler = new ConversionEventHandler();
                    _conversionEvent = ExternalEvent.Create(_conversionHandler);
                }

                ShowStatusWindow();

                if (IfcConverterConfig.UseInternalServer)
                {
                    InitializeWebSocketServer(app);
                }

                TaskDialog infoDialog = new TaskDialog("WebSocket IFC Converter");
                infoDialog.MainInstruction = "WebSocket Listening Mode Active";
                infoDialog.MainContent = $"WebSocket server started!\n\n" +
                                       $"🌐 URL: ws://localhost:8080/\n" +
                                       $"🆔 Job ID: {_staticJobId}\n\n" +
                                       $"Connect via WebSocket and send commands:\n" +
                                       $"• start_conversion - Start conversion\n" +
                                       $"• get_status - Get current status\n" +
                                       $"• cancel_job - Cancel operation";

                infoDialog.ExpandedContent = $"Current settings:\n" +
                                           $"• IFC File: {IfcConverterConfig.DefaultIfcPath}\n" +
                                           $"• Internal Server: {IfcConverterConfig.UseInternalServer}\n" +
                                           $"• External WebSocket: {IfcConverterConfig.UseWebSocket}";

                infoDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Keep Active", "Leave server running in background");
                infoDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Close", "Shut down WebSocket server");

                TaskDialogResult result = infoDialog.Show();

                if (result == TaskDialogResult.CommandLink2)
                {
                    _staticStatusForm?.CloseForm();
                    _staticWebSocketServer?.Dispose();
                    message = "WebSocket server shut down.";
                }
                else
                {
                    UpdateStatusWindow("Awaiting WebSocket commands...", 0);
                    message = "WebSocket server active. Awaiting commands via WebSocket.";
                }

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                UpdateStatusWindow("Erro na inicialização", 0);
                message = $"Erro na inicialização: {ex.Message}";
                return Result.Failed;
            }
        }

        private static void ShowStatusWindow()
        {
            try
            {
                _staticStatusForm = new PluginStatusForm();
                _staticStatusForm.Show();
                _staticStatusForm.UpdateStatus("WebSocket server starting...", 0);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error creating status window: {ex.Message}");
            }
        }

        private static void UpdateStatusWindow(string status, int progress)
        {
            try
            {
                _staticStatusForm?.UpdateStatus(status, progress);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error updating status window: {ex.Message}");
            }
        }

        private static void InitializeWebSocketServer(Application app)
        {
            try
            {
                _staticWebSocketServer = new WebSocketServer(IfcConverterConfig.InternalWebSocketUrl);

                _staticWebSocketServer.OnMessageReceived = async (message) => {
                    await ProcessWebSocketCommand(message, app);
                };

                _staticWebSocketServer.StartAsync().Wait(5000);

                UpdateStatusWindow("WebSocket server active", 0);

                Task.Run(async () => {
                    await BroadcastProgress("READY", 0, "WebSocket server started - Awaiting commands");
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error starting WebSocket server: {ex.Message}");
                UpdateStatusWindow("WebSocket server failed", 0);
            }
        }

        public static async Task ProcessWebSocketCommand(string message, Application app)
        {
            try
            {
                var command = JsonConvert.DeserializeObject<dynamic>(message);
                string action = command?.action?.ToString() ?? "";

                switch (action.ToLower())
                {
                    case "start_conversion":
                        UpdateStatusWindow("Command received: Start conversion", 0);

                        // Extract parameters from command
                        string filePath = command?.file_path?.ToString()
                            ?? command?.ifcPath?.ToString()
                            ?? IfcConverterConfig.DefaultIfcPath;

                        string outputPath = command?.output_path?.ToString()
                            ?? command?.outputPath?.ToString()
                            ?? "";

                        string receivedJobId = command?.jobId?.ToString()
                            ?? command?.job_id?.ToString()
                            ?? _staticJobId;

                        await BroadcastProgress("RECEIVED", 0, "Conversion command received", receivedJobId);

                        // Configure request for ExternalEvent
                        ConversionRequestManager.HasPendingRequest = true;
                        ConversionRequestManager.PendingFilePath = filePath;
                        ConversionRequestManager.PendingOutputPath = outputPath;
                        ConversionRequestManager.PendingJobId = receivedJobId;

                        // Trigger ExternalEvent to execute on main thread
                        _conversionEvent.Raise();
                        break;

                    case "get_status":
                        await BroadcastProgress("STATUS", 0, "Plugin active and awaiting commands");
                        break;

                    case "cancel_job":
                        UpdateStatusWindow("Command received: Cancel", 0);
                        ConversionRequestManager.HasPendingRequest = false;
                        await BroadcastProgress("CANCELLED", 0, "Operation cancelled via WebSocket");
                        break;

                    case "update_path":
                        string newPath = command?.file_path?.ToString() ?? "";
                        if (!string.IsNullOrEmpty(newPath))
                        {
                            IfcConverterConfig.DefaultIfcPath = newPath;
                            UpdateStatusWindow($"Path updated", 0);
                            await BroadcastProgress("PATH_UPDATED", 0, $"IFC path updated: {Path.GetFileName(newPath)}");
                        }
                        break;

                    default:
                        await BroadcastProgress("UNKNOWN", 0, $"Unrecognized command: {action}");
                        break;
                }
            }
            catch (Exception ex)
            {
                await BroadcastProgress("ERROR", 0, $"Error processing command: {ex.Message}");
            }
        }

        public static async Task BroadcastProgress(string status, int progress, string message, string jobId = null)
        {
            if (_staticWebSocketServer == null) return;

            try
            {
                // Map status to message type
                string messageType = ConversionEventHandler.MapStatusToMessageType(status);

                var progressData = new
                {
                    type = messageType,
                    jobId = jobId ?? _staticJobId,
                    status = status.ToLower(),
                    progress = progress,
                    message = message,
                    timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                };

                var json = JsonConvert.SerializeObject(progressData);
                await _staticWebSocketServer.BroadcastAsync(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error transmitting progress: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// Versão com diálogo de arquivo
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class IfcToRevitWebSocketDialogCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                TaskDialog fileDialog = new TaskDialog("Select IFC File");
                fileDialog.MainInstruction = "Enter the path to the IFC file";
                fileDialog.MainContent = "Please enter the complete path to the IFC file you want to convert.";
                fileDialog.ExpandedContent = "Example: C:\\Users\\User\\Desktop\\model.ifc";
                fileDialog.FooterText = $"Current default path: {IfcConverterConfig.DefaultIfcPath}";

                fileDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Use default path",
                    $"Convert: {Path.GetFileName(IfcConverterConfig.DefaultIfcPath)}");
                fileDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Enter new path");
                fileDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink3, "Cancel");

                TaskDialogResult result = fileDialog.Show();

                string selectedPath = IfcConverterConfig.DefaultIfcPath;

                switch (result)
                {
                    case TaskDialogResult.CommandLink1:
                        break;

                    case TaskDialogResult.CommandLink2:
                        TaskDialog.Show("Instruction",
                            "To use a different file, update the path in:\n" +
                            "IfcConverterConfig.DefaultIfcPath in the plugin code\n\n" +
                            "Using the current default path for this execution.");
                        break;

                    default:
                        message = "Operation cancelled by user.";
                        return Result.Cancelled;
                }

                if (!File.Exists(selectedPath))
                {
                    message = $"File not found: {selectedPath}";
                    return Result.Failed;
                }

                IfcConverterConfig.DefaultIfcPath = selectedPath;
                var mainCommand = new IfcToRevitWebSocketCommand();
                return mainCommand.Execute(commandData, ref message, elements);
            }
            catch (Exception ex)
            {
                message = $"Error in file selection: {ex.Message}";
                return Result.Failed;
            }
        }
    }

    /// <summary>
    /// Comando para configurar WebSocket
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class ConfigureWebSocketCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                TaskDialog configDialog = new TaskDialog("WebSocket Configuration");
                configDialog.MainInstruction = "Configure WebSocket";
                configDialog.MainContent = $"Current URL: {IfcConverterConfig.WebSocketServerUrl}\n\n" +
                                         $"WebSocket enabled: {IfcConverterConfig.UseWebSocket}\n\n" +
                                         "Do you want to enable/disable WebSocket?";

                configDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Enable WebSocket");
                configDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Disable WebSocket");
                configDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink3, "Cancel");

                TaskDialogResult result = configDialog.Show();

                switch (result)
                {
                    case TaskDialogResult.CommandLink1:
                        IfcConverterConfig.UseWebSocket = true;
                        message = "WebSocket enabled.";
                        return Result.Succeeded;

                    case TaskDialogResult.CommandLink2:
                        IfcConverterConfig.UseWebSocket = false;
                        message = "WebSocket disabled.";
                        return Result.Succeeded;

                    default:
                        message = "Configuration cancelled.";
                        return Result.Cancelled;
                }
            }
            catch (Exception ex)
            {
                message = $"Error in configuration: {ex.Message}";
                return Result.Failed;
            }
        }
    }
}
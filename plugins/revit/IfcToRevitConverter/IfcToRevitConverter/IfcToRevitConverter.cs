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
    /// Janela de status do plugin
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
            this.Text = "Plugin Revit IFC";
            this.Size = new System.Drawing.Size(300, 150);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = System.Windows.Forms.FormStartPosition.Manual;
            this.TopMost = true;

            // Posicionar no canto superior direito
            this.Location = new System.Drawing.Point(
                Screen.PrimaryScreen.WorkingArea.Width - this.Width - 20,
                20
            );

            // Título
            titleLabel = new Label();
            titleLabel.Text = "Plugin Revit .ifc → .rvt";
            titleLabel.Font = new System.Drawing.Font("Arial", 10, System.Drawing.FontStyle.Bold);
            titleLabel.Location = new System.Drawing.Point(10, 10);
            titleLabel.Size = new System.Drawing.Size(280, 20);
            this.Controls.Add(titleLabel);

            // Descrição
            descriptionLabel = new Label();
            descriptionLabel.Text = "Conversão automática de arquivos IFC para RVT";
            descriptionLabel.Font = new System.Drawing.Font("Arial", 8);
            descriptionLabel.Location = new System.Drawing.Point(10, 35);
            descriptionLabel.Size = new System.Drawing.Size(280, 15);
            this.Controls.Add(descriptionLabel);

            // Status
            statusLabel = new Label();
            statusLabel.Text = "Iniciando...";
            statusLabel.Location = new System.Drawing.Point(10, 60);
            statusLabel.Size = new System.Drawing.Size(280, 20);
            this.Controls.Add(statusLabel);

            // Barra de progresso
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
    /// Enums para status de conversão
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
    /// Resultado da conversão
    /// </summary>
    public class ConversionResult
    {
        public string downloadUrl { get; set; }
        public string fileName { get; set; }
        public long fileSize { get; set; }
    }

    /// <summary>
    /// Progresso da conversão
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
    /// Classe para gerenciar requisições de conversão pendentes
    /// </summary>
    public static class ConversionRequestManager
    {
        public static bool HasPendingRequest { get; set; } = false;
        public static string PendingFilePath { get; set; } = "";
        public static string PendingJobId { get; set; } = "";
    }

    /// <summary>
    /// ExternalEvent Handler para executar conversão no thread principal
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
                string jobId = ConversionRequestManager.PendingJobId;

                // Reset da requisição pendente
                ConversionRequestManager.HasPendingRequest = false;

                // Executar conversão no thread principal
                ExecuteConversionSync(app.Application, ifcFilePath, jobId);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erro no ExternalEventHandler: {ex.Message}");

                Task.Run(async () => {
                    await BroadcastProgress("ERROR", 0, $"Erro no processamento: {ex.Message}");
                });
            }
        }

        public string GetName()
        {
            return "IFC Conversion Event Handler";
        }

        private void ExecuteConversionSync(Application app, string ifcFilePath, string jobId)
        {
            try
            {
                UpdateStatusWindow("Validando arquivo IFC...", 15);
                BroadcastProgress("UPLOADING", 15, "Arquivo IFC validado, preparando para importação...").Wait();

                if (!File.Exists(ifcFilePath))
                {
                    UpdateStatusWindow("Arquivo IFC não encontrado", 0);
                    BroadcastProgress("ERROR", 0, $"Arquivo IFC não encontrado: {ifcFilePath}").Wait();
                    return;
                }

                UpdateStatusWindow("Configurando importação...", 25);
                BroadcastProgress("PROCESSING", 25, "Configurando opções de importação IFC...").Wait();

                // Configurar opções de importação
                IFCImportOptions importOptions = new IFCImportOptions();
                importOptions.Intent = IFCImportIntent.Reference;
                importOptions.AutoJoin = true;

                UpdateStatusWindow("Abrindo documento IFC...", 35);
                BroadcastProgress("PROCESSING", 35, "Abrindo documento IFC...").Wait();

                // Abrir documento IFC no thread principal
                Document ifcDocument = app.OpenIFCDocument(ifcFilePath, importOptions);

                if (ifcDocument == null)
                {
                    UpdateStatusWindow("Falha ao abrir IFC", 0);
                    BroadcastProgress("ERROR", 0, "Falha ao abrir arquivo IFC - documento retornado como null").Wait();
                    return;
                }

                UpdateStatusWindow("Processando elementos...", 65);
                BroadcastProgress("PROCESSING", 65, "Documento IFC aberto com sucesso, preparando para salvar...").Wait();

                string outputDirectory = Path.GetDirectoryName(ifcFilePath);
                string outputFileName = Path.GetFileNameWithoutExtension(ifcFilePath) + $"_Converted_{DateTime.Now:yyyyMMdd_HHmmss}.rvt";
                string rvtFilePath = Path.Combine(outputDirectory, outputFileName);

                UpdateStatusWindow("Salvando arquivo RVT...", 75);
                BroadcastProgress("PROCESSING", 75, $"Salvando como: {outputFileName}...").Wait();

                // Salvar documento
                SaveAsOptions saveOptions = new SaveAsOptions { OverwriteExistingFile = true };
                ifcDocument.SaveAs(rvtFilePath, saveOptions);

                UpdateStatusWindow("Finalizando processo...", 90);
                BroadcastProgress("DOWNLOADING", 90, "Arquivo salvo, finalizando processo...").Wait();

                // Fechar documento
                ifcDocument.Close(false);

                UpdateStatusWindow("Conversão concluída!", 100);
                BroadcastProgress("COMPLETED", 100, $"Conversão concluída! Arquivo: {outputFileName}").Wait();

                // Resetar status após 3 segundos
                Task.Delay(3000).ContinueWith(t => {
                    UpdateStatusWindow("Aguardando comandos WebSocket...", 0);
                });
            }
            catch (Exception ex)
            {
                string detailedError = $"Erro na conversão: {ex.GetType().Name} - {ex.Message}";
                if (ex.InnerException != null)
                {
                    detailedError += $"\nInner Exception: {ex.InnerException.Message}";
                }

                UpdateStatusWindow($"Erro: {ex.Message}", 0);
                BroadcastProgress("ERROR", 0, detailedError).Wait();

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
                System.Diagnostics.Debug.WriteLine($"Erro ao atualizar janela de status: {ex.Message}");
            }
        }

        private static async Task BroadcastProgress(string status, int progress, string message)
        {
            if (IfcToRevitWebSocketCommand._staticWebSocketServer == null) return;

            try
            {
                var progressData = new
                {
                    jobId = IfcToRevitWebSocketCommand._staticJobId,
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
                System.Diagnostics.Debug.WriteLine($"Erro ao transmitir progresso: {ex.Message}");
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

                System.Diagnostics.Debug.WriteLine($"WebSocket Server iniciado em: {_url}");
                _ = Task.Run(AcceptClientsAsync);
            }
            catch (Exception ex)
            {
                throw new Exception($"Erro ao iniciar servidor WebSocket: {ex.Message}");
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
                    System.Diagnostics.Debug.WriteLine($"Erro ao aceitar cliente: {ex.Message}");
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

                System.Diagnostics.Debug.WriteLine("Cliente WebSocket conectado");

                await SendToClient(webSocket, JsonConvert.SerializeObject(new
                {
                    type = "connection",
                    status = "connected",
                    message = "Conectado ao plugin Revit IFC",
                    available_commands = new[] { "start_conversion", "get_status", "cancel_job", "update_path" }
                }));

                await HandleWebSocketClient(webSocket);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erro ao processar WebSocket: {ex.Message}");
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
                        System.Diagnostics.Debug.WriteLine($"Mensagem recebida: {message}");

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
                System.Diagnostics.Debug.WriteLine($"Erro na comunicação WebSocket: {ex.Message}");
            }
            finally
            {
                lock (_clientsLock)
                {
                    _connectedClients.Remove(webSocket);
                }
                System.Diagnostics.Debug.WriteLine("Cliente WebSocket desconectado");
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
        private static ExternalEvent _conversionEvent;
        private static ConversionEventHandler _conversionHandler;

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
                infoDialog.MainInstruction = "Modo de Escuta WebSocket Ativo";
                infoDialog.MainContent = $"Servidor WebSocket iniciado!\n\n" +
                                       $"🌐 URL: ws://localhost:8080/\n" +
                                       $"🆔 Job ID: {_staticJobId}\n\n" +
                                       $"Conecte-se via WebSocket e envie comandos:\n" +
                                       $"• start_conversion - Iniciar conversão\n" +
                                       $"• get_status - Obter status atual\n" +
                                       $"• cancel_job - Cancelar operação";

                infoDialog.ExpandedContent = $"Configurações atuais:\n" +
                                           $"• Arquivo IFC: {IfcConverterConfig.DefaultIfcPath}\n" +
                                           $"• Servidor interno: {IfcConverterConfig.UseInternalServer}\n" +
                                           $"• WebSocket externo: {IfcConverterConfig.UseWebSocket}";

                infoDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Manter ativo", "Deixar servidor rodando em background");
                infoDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Fechar", "Encerrar servidor WebSocket");

                TaskDialogResult result = infoDialog.Show();

                if (result == TaskDialogResult.CommandLink2)
                {
                    _staticStatusForm?.CloseForm();
                    _staticWebSocketServer?.Dispose();
                    message = "Servidor WebSocket encerrado.";
                }
                else
                {
                    UpdateStatusWindow("Aguardando comandos WebSocket...", 0);
                    message = "Servidor WebSocket ativo. Aguardando comandos via WebSocket.";
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
                _staticStatusForm.UpdateStatus("Servidor WebSocket iniciando...", 0);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erro ao criar janela de status: {ex.Message}");
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
                System.Diagnostics.Debug.WriteLine($"Erro ao atualizar janela de status: {ex.Message}");
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

                UpdateStatusWindow("Servidor WebSocket ativo", 0);

                Task.Run(async () => {
                    await BroadcastProgress("READY", 0, "Servidor WebSocket iniciado - Aguardando comandos");
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Erro ao iniciar servidor WebSocket: {ex.Message}");
                UpdateStatusWindow("Servidor WebSocket falhou", 0);
            }
        }

        private static async Task ProcessWebSocketCommand(string message, Application app)
        {
            try
            {
                var command = JsonConvert.DeserializeObject<dynamic>(message);
                string action = command?.action?.ToString() ?? "";

                switch (action.ToLower())
                {
                    case "start_conversion":
                        UpdateStatusWindow("Comando recebido: Iniciar conversão", 0);
                        await BroadcastProgress("RECEIVED", 0, "Comando de conversão recebido");

                        // Atualizar caminho se fornecido
                        string filePath = command?.file_path?.ToString() ?? IfcConverterConfig.DefaultIfcPath;
                        if (!string.IsNullOrEmpty(filePath))
                        {
                            IfcConverterConfig.DefaultIfcPath = filePath;
                        }

                        // Configurar requisição para ExternalEvent
                        ConversionRequestManager.HasPendingRequest = true;
                        ConversionRequestManager.PendingFilePath = IfcConverterConfig.DefaultIfcPath;
                        ConversionRequestManager.PendingJobId = _staticJobId;

                        // Disparar ExternalEvent para executar no thread principal
                        _conversionEvent.Raise();
                        break;

                    case "get_status":
                        await BroadcastProgress("STATUS", 0, "Plugin ativo e aguardando comandos");
                        break;

                    case "cancel_job":
                        UpdateStatusWindow("Comando recebido: Cancelar", 0);
                        ConversionRequestManager.HasPendingRequest = false;
                        await BroadcastProgress("CANCELLED", 0, "Operação cancelada via WebSocket");
                        break;

                    case "update_path":
                        string newPath = command?.file_path?.ToString() ?? "";
                        if (!string.IsNullOrEmpty(newPath))
                        {
                            IfcConverterConfig.DefaultIfcPath = newPath;
                            UpdateStatusWindow($"Caminho atualizado", 0);
                            await BroadcastProgress("PATH_UPDATED", 0, $"Caminho IFC atualizado: {Path.GetFileName(newPath)}");
                        }
                        break;

                    default:
                        await BroadcastProgress("UNKNOWN", 0, $"Comando não reconhecido: {action}");
                        break;
                }
            }
            catch (Exception ex)
            {
                await BroadcastProgress("ERROR", 0, $"Erro ao processar comando: {ex.Message}");
            }
        }

        private static async Task BroadcastProgress(string status, int progress, string message)
        {
            if (_staticWebSocketServer == null) return;

            try
            {
                var progressData = new
                {
                    jobId = _staticJobId,
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
                System.Diagnostics.Debug.WriteLine($"Erro ao transmitir progresso: {ex.Message}");
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
                TaskDialog fileDialog = new TaskDialog("Selecionar Arquivo IFC");
                fileDialog.MainInstruction = "Informe o caminho do arquivo IFC";
                fileDialog.MainContent = "Por favor, insira o caminho completo para o arquivo IFC que deseja converter.";
                fileDialog.ExpandedContent = "Exemplo: C:\\Users\\Usuario\\Desktop\\modelo.ifc";
                fileDialog.FooterText = $"Caminho padrão atual: {IfcConverterConfig.DefaultIfcPath}";

                fileDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Usar caminho padrão",
                    $"Converter: {Path.GetFileName(IfcConverterConfig.DefaultIfcPath)}");
                fileDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Digitar novo caminho");
                fileDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink3, "Cancelar");

                TaskDialogResult result = fileDialog.Show();

                string selectedPath = IfcConverterConfig.DefaultIfcPath;

                switch (result)
                {
                    case TaskDialogResult.CommandLink1:
                        break;

                    case TaskDialogResult.CommandLink2:
                        TaskDialog.Show("Instrução",
                            "Para usar um arquivo diferente, atualize o caminho em:\n" +
                            "IfcConverterConfig.DefaultIfcPath no código do plugin\n\n" +
                            "Usando o caminho padrão atual para esta execução.");
                        break;

                    default:
                        message = "Operação cancelada pelo usuário.";
                        return Result.Cancelled;
                }

                if (!File.Exists(selectedPath))
                {
                    message = $"Arquivo não encontrado: {selectedPath}";
                    return Result.Failed;
                }

                IfcConverterConfig.DefaultIfcPath = selectedPath;
                var mainCommand = new IfcToRevitWebSocketCommand();
                return mainCommand.Execute(commandData, ref message, elements);
            }
            catch (Exception ex)
            {
                message = $"Erro na seleção do arquivo: {ex.Message}";
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
                TaskDialog configDialog = new TaskDialog("Configuração WebSocket");
                configDialog.MainInstruction = "Configurar WebSocket";
                configDialog.MainContent = $"URL atual: {IfcConverterConfig.WebSocketServerUrl}\n\n" +
                                         $"WebSocket habilitado: {IfcConverterConfig.UseWebSocket}\n\n" +
                                         "Deseja habilitar/desabilitar o WebSocket?";

                configDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Habilitar WebSocket");
                configDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Desabilitar WebSocket");
                configDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink3, "Cancelar");

                TaskDialogResult result = configDialog.Show();

                switch (result)
                {
                    case TaskDialogResult.CommandLink1:
                        IfcConverterConfig.UseWebSocket = true;
                        message = "WebSocket habilitado.";
                        return Result.Succeeded;

                    case TaskDialogResult.CommandLink2:
                        IfcConverterConfig.UseWebSocket = false;
                        message = "WebSocket desabilitado.";
                        return Result.Succeeded;

                    default:
                        message = "Configuração cancelada.";
                        return Result.Cancelled;
                }
            }
            catch (Exception ex)
            {
                message = $"Erro na configuração: {ex.Message}";
                return Result.Failed;
            }
        }
    }
}
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

using Autodesk.Revit.UI;
using Autodesk.Revit.DB;
using Autodesk.Revit.Attributes;
using System;
using System.Reflection;
using TaskDialog = Autodesk.Revit.UI.TaskDialog;

namespace IfcToRevitConverter
{
    /// <summary>
    /// External Application for IFC Conversion Plugin
    /// Creates the ribbon panel with hierarchical menu structure
    /// </summary>
    public class IfcConverterApp : IExternalApplication
    {
        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                // Create a ribbon panel
                RibbonPanel ribbonPanel = application.CreateRibbonPanel("IFC Conversion Plugin");

                // Get the assembly path
                string assemblyPath = Assembly.GetExecutingAssembly().Location;

                // Create Start Server button
                PushButtonData startButtonData = new PushButtonData(
                    "StartWebSocketServer",
                    "Start\nServer",
                    assemblyPath,
                    "IfcToRevitConverter.StartServerCommand"
                );
                startButtonData.ToolTip = "Start WebSocket server to receive conversion commands";
                startButtonData.LongDescription = "Starts the internal WebSocket server on port 8082 to listen for IFC conversion requests from the Python bridge.";
                startButtonData.AvailabilityClassName = "IfcToRevitConverter.StartServerAvailability";

                // Create Stop Server button
                PushButtonData stopButtonData = new PushButtonData(
                    "StopWebSocketServer",
                    "Stop\nServer",
                    assemblyPath,
                    "IfcToRevitConverter.StopServerCommand"
                );
                stopButtonData.ToolTip = "Stop WebSocket server";
                stopButtonData.LongDescription = "Stops the WebSocket server and closes all active connections.";
                stopButtonData.AvailabilityClassName = "IfcToRevitConverter.StopServerAvailability";

                // Create a pulldown button for WebSocket Menu
                PulldownButtonData pulldownData = new PulldownButtonData(
                    "WebSocketMenu",
                    "WebSocket\nMenu"
                );
                pulldownData.ToolTip = "WebSocket server controls";
                pulldownData.LongDescription = "Start or stop the WebSocket server that receives IFC conversion commands from the Python bridge.";

                // Add the pulldown button to the panel
                PulldownButton pulldownButton = ribbonPanel.AddItem(pulldownData) as PulldownButton;

                if (pulldownButton != null)
                {
                    // Add commands to the pulldown menu
                    pulldownButton.AddPushButton(startButtonData);
                    pulldownButton.AddPushButton(stopButtonData);
                }

                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Error", $"Failed to initialize IFC Converter plugin: {ex.Message}");
                return Result.Failed;
            }
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            // Cleanup if needed
            try
            {
                // Stop WebSocket server if running
                if (IfcToRevitWebSocketCommand._staticWebSocketServer != null)
                {
                    IfcToRevitWebSocketCommand._staticWebSocketServer.Stop();
                }

                // Close status form if open
                IfcToRevitWebSocketCommand._staticStatusForm?.CloseForm();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error during shutdown: {ex.Message}");
            }

            return Result.Succeeded;
        }
    }

    /// <summary>
    /// Command to start WebSocket server
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class StartServerCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                // Check if server is already running
                if (IfcToRevitWebSocketCommand._staticWebSocketServer != null)
                {
                    TaskDialog infoDialog = new TaskDialog("WebSocket Server");
                    infoDialog.MainInstruction = "Server Already Running";
                    infoDialog.MainContent = "The WebSocket server is already active and listening for commands.";
                    infoDialog.CommonButtons = TaskDialogCommonButtons.Ok;
                    infoDialog.Show();
                    return Result.Succeeded;
                }

                UIApplication uiapp = commandData.Application;
                Autodesk.Revit.ApplicationServices.Application app = uiapp.Application;

                // Initialize ExternalEvent for conversion
                if (IfcToRevitWebSocketCommand._conversionHandler == null)
                {
                    IfcToRevitWebSocketCommand._conversionHandler = new ConversionEventHandler();
                    IfcToRevitWebSocketCommand._conversionEvent = ExternalEvent.Create(IfcToRevitWebSocketCommand._conversionHandler);
                }

                // Generate a new job ID
                IfcToRevitWebSocketCommand._staticJobId = Guid.NewGuid().ToString();

                // Show status window
                IfcToRevitWebSocketCommand._staticStatusForm = new PluginStatusForm();
                IfcToRevitWebSocketCommand._staticStatusForm.Show();
                IfcToRevitWebSocketCommand._staticStatusForm.UpdateStatus("WebSocket server starting...", 0);

                // Initialize WebSocket server
                if (IfcConverterConfig.UseInternalServer)
                {
                    IfcToRevitWebSocketCommand._staticWebSocketServer = new WebSocketServer(IfcConverterConfig.InternalWebSocketUrl);

                    IfcToRevitWebSocketCommand._staticWebSocketServer.OnMessageReceived = async (msg) => {
                        await IfcToRevitWebSocketCommand.ProcessWebSocketCommand(msg, app);
                    };

                    IfcToRevitWebSocketCommand._staticWebSocketServer.StartAsync().Wait(5000);

                    IfcToRevitWebSocketCommand._staticStatusForm.UpdateStatus("WebSocket server active", 0);

                    System.Threading.Tasks.Task.Run(async () => {
                        await IfcToRevitWebSocketCommand.BroadcastProgress("READY", 0, "WebSocket server started - Awaiting commands");
                    });
                }

                // Show success dialog
                TaskDialog successDialog = new TaskDialog("WebSocket Server Started");
                successDialog.MainInstruction = "Server Ready";
                successDialog.MainContent = $"WebSocket server is now active and listening for conversion commands.\n\n" +
                                           $"🌐 URL: {IfcConverterConfig.WebSocketServerUrl}\n" +
                                            $"🆔 Session ID: {IfcToRevitWebSocketCommand._staticJobId}\n\n" +
                                            $"The server will receive IFC conversion requests from the Python bridge.";
                successDialog.ExpandedContent = $"Configuration:\n" +
                                               $"• Internal Server URL: {IfcConverterConfig.InternalWebSocketUrl}\n" +
                                                $"• Default IFC Path: {IfcConverterConfig.DefaultIfcPath}\n" +
                                                $"• Status Window: Active";
                successDialog.CommonButtons = TaskDialogCommonButtons.Ok;
                successDialog.Show();

                message = "WebSocket server started successfully.";
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                IfcToRevitWebSocketCommand._staticStatusForm?.UpdateStatus("Server failed to start", 0);
                message = $"Error starting WebSocket server: {ex.Message}";
                TaskDialog.Show("Error", message);
                return Result.Failed;
            }
        }
    }

    /// <summary>
    /// Availability check for Start Server command
    /// </summary>
    public class StartServerAvailability : IExternalCommandAvailability
    {
        public bool IsCommandAvailable(UIApplication applicationData, CategorySet selectedCategories)
        {
            // Enable Start Server when server is NOT running
            return IfcToRevitWebSocketCommand._staticWebSocketServer == null;
        }
    }

    /// <summary>
    /// Availability check for Stop Server command
    /// </summary>
    public class StopServerAvailability : IExternalCommandAvailability
    {
        public bool IsCommandAvailable(UIApplication applicationData, CategorySet selectedCategories)
        {
            // Enable Stop Server when server IS running
            return IfcToRevitWebSocketCommand._staticWebSocketServer != null;
        }
    }

    /// <summary>
    /// Command to stop WebSocket server
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class StopServerCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                // Check if server is running
                if (IfcToRevitWebSocketCommand._staticWebSocketServer == null)
                {
                    TaskDialog infoDialog = new TaskDialog("WebSocket Server");
                    infoDialog.MainInstruction = "Server Not Running";
                    infoDialog.MainContent = "The WebSocket server is not currently active.";
                    infoDialog.CommonButtons = TaskDialogCommonButtons.Ok;
                    infoDialog.Show();
                    return Result.Succeeded;
                }

                // Stop the server
                IfcToRevitWebSocketCommand._staticWebSocketServer.Stop();
                IfcToRevitWebSocketCommand._staticWebSocketServer.Dispose();
                IfcToRevitWebSocketCommand._staticWebSocketServer = null;

                // Close status form
                IfcToRevitWebSocketCommand._staticStatusForm?.CloseForm();
                IfcToRevitWebSocketCommand._staticStatusForm = null;

                // Show confirmation dialog
                TaskDialog successDialog = new TaskDialog("WebSocket Server Stopped");
                successDialog.MainInstruction = "Server Stopped";
                successDialog.MainContent = "The WebSocket server has been stopped successfully.\n\n" +
                                           "All active connections have been closed.";
                successDialog.CommonButtons = TaskDialogCommonButtons.Ok;
                successDialog.Show();

                message = "WebSocket server stopped successfully.";
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = $"Error stopping WebSocket server: {ex.Message}";
                TaskDialog.Show("Error", message);
                return Result.Failed;
            }
        }
    }
}

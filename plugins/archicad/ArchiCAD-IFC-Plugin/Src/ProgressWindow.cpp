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

#include "ProgressWindow.hpp"
#include "DG.h"
#include <iostream>

// Dialog item IDs
enum {
    ProgressBar_ID = 1,
    StatusText_ID = 2,
    JobIdText_ID = 3,
    TitleText_ID = 4
};

// Static members
short ProgressWindow::s_dialogId = 0;
bool ProgressWindow::s_isShown = false;

void ProgressWindow::Show(const std::string& title, const std::string& initialMessage)
{
    if (s_isShown) {
        std::cerr << "Progress window already shown" << std::endl;
        return;
    }

    // Create a simple modeless dialog
    // Using DG API directly for simple progress display

    // Note: ArchiCAD's DG API requires resource-based dialogs
    // For simplicity, we'll use DGAlert for now and consider
    // creating a proper resource-based dialog later if needed

    s_isShown = true;
    std::cout << "Progress Window: " << title << " - " << initialMessage << std::endl;
}

void ProgressWindow::UpdateProgress(int progress, const std::string& message)
{
    if (!s_isShown) {
        return;
    }

    // Clamp progress to 0-100
    if (progress < 0) progress = 0;
    if (progress > 100) progress = 100;

    std::cout << "Progress: " << progress << "% - " << message << std::endl;

    // If progress is 100%, close the window
    if (progress >= 100) {
        Close();
    }
}

void ProgressWindow::SetJobId(const std::string& jobId)
{
    if (!s_isShown) {
        return;
    }

    std::cout << "Job ID: " << jobId << std::endl;
}

void ProgressWindow::Close()
{
    if (!s_isShown) {
        return;
    }

    std::cout << "Closing progress window" << std::endl;
    s_isShown = false;
    s_dialogId = 0;
}

bool ProgressWindow::IsShown()
{
    return s_isShown;
}

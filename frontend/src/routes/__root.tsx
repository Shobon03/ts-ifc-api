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

import { SiGithub } from '@icons-pack/react-simple-icons';
import {
  createRootRoute,
  Link,
  Outlet,
  useLocation,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from '@/components/ui/nav-link';
import { SquareButton, SquareLinkButton } from '@/components/ui/square-button';
import { WebSocketStatus } from '@/components/websocket-status';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const _location = useLocation();

  const [darkMode, setDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved) {
      setDarkMode(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      localStorage.setItem('darkMode', JSON.stringify(darkMode));
      document.documentElement.classList.add('dark');
    } else {
      localStorage.removeItem('darkMode');
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Track location changes if needed for debugging
  // useEffect(() => {
  //   console.log(location);
  // }, [location]);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode ? 'dark' : ''
      }`}
    >
      <nav className='bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4'>
        <div className='max-w-7xl mx-auto flex items-center justify-between'>
          <Link
            to='/'
            className='text-xl font-bold text-gray-900 dark:text-white'
          >
            IFC API
          </Link>

          <div className='hidden md:flex items-center space-x-6'>
            <NavLink to='/' name='Home' />
            <NavLink to='/about' name='Sobre' />
            <NavLink
              to='/model-transformation'
              name='Transformação .rvt ↔ .pln'
            />
            <NavLink to='/model-generation' name='Gerar IFC' />
            <NavLink to='/model-validation' name='Validação de IFC' />
          </div>

          <div className='hidden md:flex items-center space-x-4'>
            <WebSocketStatus showDetails={false} />
            <SquareLinkButton
              href='https://github.com/Shobon03/ts-ifc-api'
              title='Repositório do GitHub'
            >
              <SiGithub size={20} title='' />
            </SquareLinkButton>
            <SquareButton
              onClick={() => setDarkMode(!darkMode)}
              title={`Mudar para modo ${darkMode ? 'claro' : 'escuro'}`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </SquareButton>
          </div>

          <div className='md:hidden flex items-center'>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className='text-gray-900 dark:text-white'
              title='Abrir menu'
              type='button'
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className='md:hidden mt-4'>
            <div className='flex flex-col space-y-2'>
              <NavLink to='/' name='Home' />
              <NavLink to='/about' name='Sobre' />
              <NavLink
                to='/model-transformation'
                name='Transformação .rvt ↔ .pln'
              />
              <NavLink to='/model-generation' name='Gerar IFC' />
              <NavLink to='/model-validation' name='Validação de IFC' />
              <NavLink to='/websocket-demo' name='WebSocket Demo' />
            </div>
            <div className='border-t border-gray-200 dark:border-gray-700 mt-4 pt-4 flex items-center space-x-4'>
              <WebSocketStatus showDetails={false} />
              <SquareLinkButton
                href='https://github.com/Shobon03/ts-ifc-api'
                title='Repositório do GitHub'
              >
                <SiGithub size={20} title='' />
              </SquareLinkButton>
              <SquareButton
                onClick={() => setDarkMode(!darkMode)}
                title={`Mudar para modo ${darkMode ? 'claro' : 'escuro'}`}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </SquareButton>
            </div>
          </div>
        )}
      </nav>
      <main className='bg-white dark:bg-gray-900 text-gray-900 dark:text-white min-h-[calc(100vh-69px)]'>
        <Outlet />
      </main>
      <TanStackRouterDevtools initialIsOpen={false} />
    </div>
  );
}
